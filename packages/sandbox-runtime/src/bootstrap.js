// Summon sandbox bootstrap — runs FIRST inside every sandbox iframe, before any
// Arrow artifact runtime. Installs window.sandbox (frozen) as the trusted
// bridge for controlled host capabilities. Generated artifacts do not receive
// executable scripts.
(() => {
  'use strict';

  const PARENT = window.parent;
  const SANDBOX_ID = window.__SUMMON_SANDBOX_ID__;
  const RESOURCE_MAP = normalizeResources(window.__SUMMON_RESOURCES__);
  const NETWORK_POLICY = window.__SUMMON_NETWORK_POLICY__ === 'restricted-fetch'
    ? 'restricted-fetch'
    : 'none';
  if (!SANDBOX_ID || typeof SANDBOX_ID !== 'string') {
    // No ID means host didn't spawn this correctly. Refuse to install SDK.
    return;
  }

  // Scrub globals so artifact code can't read or overwrite them after bootstrap.
  try {
    delete window.__SUMMON_SANDBOX_ID__;
    delete window.__SUMMON_RESOURCES__;
    delete window.__SUMMON_NETWORK_POLICY__;
  } catch (_) { /* sealed elsewhere */ }

  function normalizeResources(raw) {
    const out = Object.create(null);
    if (!raw || typeof raw !== 'object') return out;
    for (const name in raw) {
      if (!Object.prototype.hasOwnProperty.call(raw, name)) continue;
      if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(name)) continue;
      const entry = raw[name];
      const keys = entry && typeof entry === 'object' ? entry.stateKeys : null;
      if (!keys || typeof keys !== 'object') continue;
      const loading = keys.loading;
      const data = keys.data;
      const error = keys.error;
      const empty = keys.empty;
      if (typeof loading !== 'string' || typeof data !== 'string' || typeof error !== 'string') continue;
      out[name] = Object.freeze({
        stateKeys: Object.freeze({
          loading,
          data,
          error,
          ...(typeof empty === 'string' ? { empty } : {}),
        }),
      });
    }
    return Object.freeze(out);
  }

  // ----- startup self-test --------------------------------------------------
  // Fail closed if the sandbox is not configured the way Summon requires. Any
  // result here is something a casual misconfiguration (e.g. accidentally
  // adding `allow-same-origin`, stripping the CSP meta) would trigger. None
  // of these throw under a correctly-spawned null-origin iframe, so a passing
  // result means the sandbox is at least structurally sound.
  function selfTest() {
    // Must actually be inside a frame.
    if (PARENT === window) {
      return 'not in iframe — PARENT === window';
    }
    // Cross-origin top access must throw. If reading succeeds, the iframe is
    // same-origin with its parent (the most likely cause: `allow-same-origin`
    // was added to the sandbox attribute).
    try {
      void window.top.location.href;
      return 'window.top.location readable — sandbox is not null-origin';
    } catch (_) { /* expected SecurityError */ }
    // localStorage must be unavailable on opaque origins. Some browsers throw
    // on the getter, others on method calls — exercise both.
    try {
      window.localStorage.getItem('_summon_probe');
      return 'localStorage accessible — sandbox is not null-origin';
    } catch (_) { /* expected SecurityError */ }
    // The restrictive CSP must still be in the document. If the srcdoc was
    // tampered with or the meta stripped, our defaults are gone.
    var meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    var content = meta && meta.getAttribute('content');
    if (!content || content.indexOf("default-src 'none'") === -1) {
      return 'CSP meta missing or not strict';
    }
    return null;
  }

  var failure = selfTest();
  if (failure) {
    try {
      PARENT.postMessage({
        type: 'SUMMON_FATAL',
        sandbox_id: SANDBOX_ID,
        reason: failure,
      }, '*');
    } catch (_) { /* parent gone */ }
    return;
  }
  // -------------------------------------------------------------------------

  let currentState = Object.freeze({});
  const localState = Object.create(null);
  const subscribers = new Set();
  const mountedIntentKeys = new Set();
  let componentSyncScheduled = false;
  let componentSyncFallbackTimer = 0;
  let componentLayoutPollTimer = 0;
  let componentLayoutSignature = '';
  let componentResizeObserver = null;
  const componentResizeObserved = new Set();
  const SAFE_ATTR_BINDINGS = Object.freeze(['src', 'alt', 'title', 'aria-label', 'value', 'placeholder', 'disabled']);
  const MAX_PENDING_INTENT_RESULTS = 32;
  const pendingIntentResults = new Map();
  let arrowTeardown = null;
  let renderRevision = 0;

  function cloneStateSnapshot(value) {
    if (!value || typeof value !== 'object') return Object.freeze({});
    try {
      return Object.freeze(JSON.parse(JSON.stringify(value)));
    } catch (_) {
      return Object.freeze({});
    }
  }

  function notify() {
    const snapshot = currentState;
    for (const cb of subscribers) {
      try { cb(snapshot); } catch (err) { /* swallow, keep others alive */ }
    }
  }

  function emit(intent, args) {
    if (typeof intent !== 'string' || !intent) return;
    PARENT.postMessage({
      type: 'SUMMON_INTENT',
      sandbox_id: SANDBOX_ID,
      intent,
      args: args == null ? {} : args,
    }, '*');
  }

  function emitFatal(reason) {
    try {
      PARENT.postMessage({
        type: 'SUMMON_FATAL',
        sandbox_id: SANDBOX_ID,
        reason,
      }, '*');
    } catch (_) { /* parent gone */ }
  }

  function invokeIntent(intent, args) {
    if (typeof intent !== 'string' || !intent) {
      return Promise.resolve({ ok: false, state: cloneStateSnapshot(currentState), error: 'intent not a non-empty string' });
    }
    if (pendingIntentResults.size >= MAX_PENDING_INTENT_RESULTS) {
      return Promise.resolve({ ok: false, state: cloneStateSnapshot(currentState), error: 'too many pending intents' });
    }
    const requestId = 'arrow-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    return new Promise((resolve) => {
      const timeout = window.setTimeout(function () {
        pendingIntentResults.delete(requestId);
        resolve({ ok: false, state: cloneStateSnapshot(currentState), error: 'intent timed out' });
      }, 15000);
      pendingIntentResults.set(requestId, function (result) {
        window.clearTimeout(timeout);
        resolve(result);
      });
      PARENT.postMessage({
        type: 'SUMMON_INTENT',
        sandbox_id: SANDBOX_ID,
        request_id: requestId,
        intent,
        args: args == null || typeof args !== 'object' ? {} : args,
      }, '*');
    });
  }

  function renderArrowArtifact(artifact) {
    const root = document.getElementById('summon-root');
    if (!root) return;
    if (!artifact || artifact.runtime !== 'arrow' || !artifact.source || typeof artifact.source !== 'object') {
      emitFatal('invalid Arrow artifact');
      return;
    }
    if (artifact.network === 'restricted-fetch' && NETWORK_POLICY !== 'restricted-fetch') {
      emitFatal('Arrow artifact requested restricted fetch without host network grant');
      return;
    }
    if (typeof arrowTeardown === 'function') {
      try { arrowTeardown(); } catch (_) { /* best effort */ }
      arrowTeardown = null;
    }
    const revision = ++renderRevision;
    mountedIntentKeys.clear();
    root.replaceChildren();
    const runtime = window.__SUMMON_ARROW_SANDBOX__;
    const sandbox = runtime && runtime.sandbox;
    if (typeof sandbox !== 'function') {
      emitFatal('Arrow runtime missing — expected window.__SUMMON_ARROW_SANDBOX__.sandbox');
      return;
    }
    try {
      const view = sandbox(
        {
          source: artifact.source,
          shadowDOM: false,
          onError: function (error) {
            emitFatal('Arrow runtime error: ' + String(error && error.message ? error.message : error));
          },
        },
        {
          output: function (payload) {
            if (payload && typeof payload === 'object' && payload.type === 'intent') {
              void invokeIntent(payload.intent, payload.args);
            }
          },
        },
        {
          'host-bridge:summon': {
            getState: function () {
              return cloneStateSnapshot(currentState);
            },
            invoke: function (intent, args) {
              return invokeIntent(intent, args);
            },
          },
        },
      );
      const maybeTeardown = view(root);
      if (typeof maybeTeardown === 'function') arrowTeardown = maybeTeardown;
      waitForArrowRuntimeReady(root, revision);
    } catch (err) {
      emitFatal('Arrow runtime failed to mount: ' + String(err && err.message ? err.message : err));
    }
  }

  function emitRendered(revision) {
    if (revision !== renderRevision) return;
    try {
      PARENT.postMessage({ type: 'SUMMON_RENDERED', sandbox_id: SANDBOX_ID, revision }, '*');
    } catch (_) { /* parent gone */ }
  }

  function finishArrowRender(revision) {
    if (revision !== renderRevision) return;
    applyBindings();
    applyMountIntents();
    scheduleComponentSync();
    const done = function () {
      if (revision !== renderRevision) return;
      applyBindings();
      applyMountIntents();
      scheduleComponentSync();
      emitRendered(revision);
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(done);
    } else {
      setTimeout(done, 0);
    }
  }

  function waitForArrowRuntimeReady(root, revision) {
    const arrowHost = root.querySelector('arrow-sandbox');
    if (!arrowHost) {
      finishArrowRender(revision);
      return;
    }

    let settled = false;
    const cleanup = function () {
      arrowHost.removeEventListener('sandbox-ready', onReady);
      arrowHost.removeEventListener('sandbox-error', onError);
    };
    const onReady = function () {
      if (settled) return;
      settled = true;
      cleanup();
      finishArrowRender(revision);
    };
    const onError = function (event) {
      if (settled) return;
      settled = true;
      cleanup();
      const detail = event && event.detail;
      const message = detail && detail.message ? detail.message : detail;
      emitFatal('Arrow runtime failed to mount: ' + String(message || 'unknown error'));
    };

    arrowHost.addEventListener('sandbox-ready', onReady, { once: true });
    arrowHost.addEventListener('sandbox-error', onError, { once: true });
    const ready = arrowHost.getAttribute('data-ready');
    if (ready === 'true') onReady();
    else if (ready === 'error') onError({ detail: 'unknown error' });
  }

  function onState(cb) {
    if (typeof cb !== 'function') return () => {};
    subscribers.add(cb);
    // Fire immediately with current snapshot for convenience.
    try { cb(currentState); } catch (_) { /* swallow */ }
    return () => subscribers.delete(cb);
  }

  // ── Declarative bindings ───────────────────────────────────────────────────
  // Arrow artifacts can author DOM with `data-summon-*` attributes; this binder
  // is what makes them live. Two halves:
  //
  //   1. Listeners for `data-summon-on-click` and `data-summon-on-submit` —
  //      installed ONCE on document, dispatched via `closest(...)` so re-renders
  //      don't re-bind. Always preventDefault().
  //      `data-summon-on-mount` is handled after render by applyMountIntents().
  //   2. State-driven attributes — `data-summon-bind` (textContent),
  //      `data-summon-show`/`data-summon-hide` (visibility) — recomputed from
  //      currentState after every state push and every render. They're a pure
  //      function of (DOM, state); recomputing is idempotent and the cheapest
  //      possible model.
  //
  // Generated scripts are not an artifact capability. The `window.sandbox`
  // object remains a narrow trusted bridge for host-owned tests, but generated
  // UI should express local behavior with attributes or Arrow handlers.

  function walkPath(obj, path) {
    if (!path) return obj;
    let cur = obj;
    const parts = path.split('.');
    for (let i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function hasPath(obj, path) {
    if (!path) return true;
    let cur = obj;
    const parts = path.split('.');
    for (let i = 0; i < parts.length; i++) {
      if (cur == null || !Object.prototype.hasOwnProperty.call(Object(cur), parts[i])) return false;
      cur = cur[parts[i]];
    }
    return true;
  }

  // Walk up to find the nearest ancestor (inclusive) with a matching foreach
  // scope name. Scope markers are JS properties on stamped clones — invisible
  // to the LLM-authored markup.
  function findScope(name, fromEl) {
    let el = fromEl;
    while (el) {
      if (el.__summon_scope === name) return el;
      el = el.parentElement;
    }
    return null;
  }

  function findResourceScope(name, fromEl) {
    let el = fromEl;
    while (el) {
      const resource = el.__summon_resource;
      if (resource && resource.alias === name) return resource;
      el = el.parentElement;
    }
    return null;
  }

  function resourceStateValue(resource, rest) {
    const keys = resource && resource.stateKeys;
    if (!keys) return undefined;
    const loading = walkPath(currentState, keys.loading);
    const data = walkPath(currentState, keys.data);
    const error = walkPath(currentState, keys.error);
    const empty = keys.empty ? walkPath(currentState, keys.empty) : undefined;
    if (!rest) return { loading, data, error, empty };
    const dot = rest.indexOf('.');
    const head = dot === -1 ? rest : rest.slice(0, dot);
    const tail = dot === -1 ? '' : rest.slice(dot + 1);
    let base;
    if (head === 'loading') base = loading;
    else if (head === 'data') base = data;
    else if (head === 'error') base = error;
    else if (head === 'empty') base = empty;
    else return undefined;
    return tail ? walkPath(base, tail) : base;
  }

  // Resolve a path against either currentState or a foreach scope.
  // Bare `key` / `nested.key` → root state.
  // `$name` → the entire item from foreach scope `name`.
  // `$name.field.sub` → field walk inside that item.
  // fromEl is the binder/click element — used as the starting point for
  // scope lookup. Falls back to root state if no scope matches.
  function resolveKey(path, fromEl) {
    if (!path) return undefined;
    if (path.charCodeAt(0) === 0x24 /* $ */) {
      const dot = path.indexOf('.');
      const name = dot === -1 ? path.slice(1) : path.slice(1, dot);
      const rest = dot === -1 ? '' : path.slice(dot + 1);
      const scopeEl = findScope(name, fromEl);
      if (scopeEl) {
        const item = scopeEl.__summon_item;
        return rest ? walkPath(item, rest) : item;
      }
      const resource = findResourceScope(name, fromEl);
      return resourceStateValue(resource, rest);
    }
    if (hasPath(localState, path)) return walkPath(localState, path);
    return walkPath(currentState, path);
  }

  function truthy(v) {
    if (v == null || v === false || v === 0 || v === '') return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  }

  // Recursively replace string leaves matching `^\$\w+(\..+)?$` with their
  // resolved value. Used at click/submit time to bake the foreach item into
  // the args payload — `{"picked": "$r"}` becomes `{"picked": <itemObj>}`.
  function interpolate(value, fromEl) {
    if (typeof value === 'string') {
      if (value.length > 1 && value.charCodeAt(0) === 0x24 && /^\$[A-Za-z_]\w*(\..+)?$/.test(value)) {
        return resolveKey(value, fromEl);
      }
      return value;
    }
    if (Array.isArray(value)) return value.map((v) => interpolate(v, fromEl));
    if (value && typeof value === 'object') {
      const out = {};
      for (const k in value) {
        if (Object.prototype.hasOwnProperty.call(value, k)) out[k] = interpolate(value[k], fromEl);
      }
      return out;
    }
    return value;
  }

  function seedLocalState(root) {
    const hosts = root.querySelectorAll('[data-summon-local]');
    for (const host of hosts) {
      const raw = host.getAttribute('data-summon-local') || '';
      if (!raw.trim()) continue;
      let parsed;
      try { parsed = JSON.parse(raw); }
      catch (_) { continue; }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      for (const key in parsed) {
        if (!Object.prototype.hasOwnProperty.call(parsed, key)) continue;
        if (!/^[A-Za-z_$][\w$]{0,39}$/.test(key)) continue;
        if (!Object.prototype.hasOwnProperty.call(localState, key)) {
          localState[key] = parsed[key];
        }
      }
    }
  }

  function parseConditionLiteral(raw) {
    const trimmed = String(raw || '').trim();
    if (trimmed.length >= 2 && trimmed[0] === '"' && trimmed[trimmed.length - 1] === '"') {
      try { return JSON.parse(trimmed); } catch (_) { return trimmed.slice(1, -1); }
    }
    if (trimmed.length >= 2 && trimmed[0] === "'" && trimmed[trimmed.length - 1] === "'") {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }

  function evalCondition(expr, fromEl) {
    const raw = String(expr || '').trim();
    if (!raw) return false;
    const match = raw.match(/^(!)?(\$?[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)(?:\s*(==|!=)\s*("[^"]*"|'[^']*'))?$/);
    if (!match) return truthy(resolveKey(raw, fromEl));
    const negated = !!match[1];
    const path = match[2];
    const op = match[3];
    const literal = match[4];
    const value = resolveKey(path, fromEl);
    let result;
    if (op) {
      const expected = parseConditionLiteral(literal);
      result = String(value ?? '') === String(expected);
      if (op === '!=') result = !result;
    } else {
      result = truthy(value);
    }
    return negated ? !result : result;
  }

  function applyResourceScopes(root) {
    const hosts = root.querySelectorAll('[data-summon-resource]');
    for (const host of hosts) {
      const name = host.getAttribute('data-summon-resource') || '';
      const entry = RESOURCE_MAP[name];
      if (!entry) {
        try { delete host.__summon_resource; } catch (_) { host.__summon_resource = undefined; }
        continue;
      }
      const alias = host.getAttribute('data-summon-resource-as') || name;
      host.__summon_resource = {
        name,
        alias,
        stateKeys: entry.stateKeys,
      };
    }
  }

  // Stamp `<template>` children of every `[data-summon-foreach]` host. Idempotent
  // by array reference — when state pushes leave the array === to last frame's,
  // we skip the wipe-and-restamp. Otherwise: remove old clones, clone the
  // template once per item, hang `__summon_scope` + `__summon_item` on each clone
  // root for later scoped lookup.
  function applyForEach(root) {
    const hosts = root.querySelectorAll('[data-summon-foreach]');
    for (const host of hosts) {
      const path = host.getAttribute('data-summon-foreach');
      const asName = host.getAttribute('data-summon-as') || 'item';
      const items = resolveKey(path, host);
      const arr = Array.isArray(items) ? items : [];
      if (host.__summon_lastItems === arr) continue;

      const tmpl = host.querySelector(':scope > template');
      if (!tmpl) continue;

      // Wipe previous clones — everything except the template element.
      const kids = Array.from(host.children);
      for (const c of kids) if (c !== tmpl) c.remove();

      for (const item of arr) {
        const frag = tmpl.content.cloneNode(true);
        const stamped = frag.firstElementChild;
        if (stamped) {
          stamped.__summon_scope = asName;
          stamped.__summon_item = item;
        }
        host.appendChild(frag);
      }
      host.__summon_lastItems = arr;
    }
  }

  function applyAttrBindings(root) {
    for (const attr of SAFE_ATTR_BINDINGS) {
      const selector = '[data-summon-attr-' + attr + ']';
      const els = root.querySelectorAll(selector);
      for (const el of els) {
        const raw = el.getAttribute('data-summon-attr-' + attr);
        const v = attr === 'disabled' ? evalCondition(raw, el) : resolveKey(raw, el);
        applySafeAttribute(el, attr, v);
      }
    }
  }

  function applySafeAttribute(el, attr, value) {
    if (attr === 'disabled') {
      if (truthy(value)) {
        el.setAttribute('disabled', '');
        el.disabled = true;
      } else {
        el.removeAttribute('disabled');
        el.disabled = false;
      }
      return;
    }

    if (attr === 'src') {
      if (el.tagName !== 'IMG') return;
      const src = value == null ? '' : String(value);
      if (!src || src.indexOf('data:') === 0) {
        if (src) el.setAttribute('src', src);
        else el.removeAttribute('src');
      } else {
        el.removeAttribute('src');
      }
      return;
    }

    if (attr === 'value') {
      const next = value == null ? '' : String(value);
      if ('value' in el && document.activeElement !== el) el.value = next;
      el.setAttribute('value', next);
      return;
    }

    if (value == null || value === false) {
      el.removeAttribute(attr);
    } else {
      el.setAttribute(attr, String(value));
    }
  }

  function applyClassBindings(root) {
    const els = root.querySelectorAll('*');
    for (const el of els) {
      for (const attr of Array.from(el.attributes)) {
        if (!attr.name.startsWith('data-summon-class-')) continue;
        const className = attr.name.slice('data-summon-class-'.length);
        if (!/^[A-Za-z][\w-]{0,63}$/.test(className)) continue;
        el.classList.toggle(className, evalCondition(attr.value, el));
      }
    }
  }

  function parseMotionEntries(value) {
    const out = [];
    for (const part of String(value || '').split(';')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const bits = trimmed.split(':');
      if (bits.length !== 2) continue;
      const phase = bits[0].trim();
      const recipe = bits[1].trim();
      if (!/^(enter|update)$/.test(phase)) continue;
      if (!/^[a-z][a-z0-9-]{0,31}$/.test(recipe)) continue;
      out.push({ phase, recipe });
    }
    return out;
  }

  function applyMotion(root) {
    const motionEls = root.querySelectorAll('[data-summon-motion]');
    for (const el of motionEls) {
      const entries = parseMotionEntries(el.getAttribute('data-summon-motion'));
      for (const entry of entries) {
        if (entry.phase === 'enter') {
          el.classList.add('summon-motion-enter-' + entry.recipe);
        }
      }
    }
    const transitionEls = root.querySelectorAll('[data-summon-transition]');
    for (const el of transitionEls) {
      const recipe = (el.getAttribute('data-summon-transition') || '').trim();
      if (/^[a-z][a-z0-9-]{0,31}$/.test(recipe)) {
        el.classList.add('summon-transition-' + recipe);
      }
    }
  }

  function triggerUpdateMotion(root) {
    const motionEls = root.querySelectorAll('[data-summon-motion]');
    for (const el of motionEls) {
      const entries = parseMotionEntries(el.getAttribute('data-summon-motion'));
      for (const entry of entries) {
        if (entry.phase === 'update') {
          markTransientClass(el, 'summon-motion-update-' + entry.recipe, 560);
        }
      }
    }
  }

  function applyBindings() {
    const root = document.getElementById('summon-root');
    if (!root) return;
    seedLocalState(root);
    // Resource scopes must exist before foreach resolution; foreach must stamp
    // clones before bind/show/hide queries run.
    applyResourceScopes(root);
    applyForEach(root);
    const binds = root.querySelectorAll('[data-summon-bind]');
    for (const el of binds) {
      const v = resolveKey(el.getAttribute('data-summon-bind'), el);
      el.textContent = v == null ? '' : String(v);
    }
    const shows = root.querySelectorAll('[data-summon-show]');
    for (const el of shows) {
      el.hidden = !evalCondition(el.getAttribute('data-summon-show'), el);
    }
    const hides = root.querySelectorAll('[data-summon-hide]');
    for (const el of hides) {
      el.hidden = evalCondition(el.getAttribute('data-summon-hide'), el);
    }
    applyAttrBindings(root);
    applyClassBindings(root);
    applyMotion(root);
    syncComponents();
  }

  function parseArgs(raw) {
    if (!raw) return {};
    try { return JSON.parse(raw); }
    catch (_) {
      try { console.warn('summon: invalid data-summon-args JSON:', raw); } catch (__) {}
      return {};
    }
  }

  function scheduleComponentSync() {
    if (componentSyncScheduled) return;
    componentSyncScheduled = true;
    const run = () => {
      if (!componentSyncScheduled) return;
      componentSyncScheduled = false;
      if (componentSyncFallbackTimer) {
        clearTimeout(componentSyncFallbackTimer);
        componentSyncFallbackTimer = 0;
      }
      syncComponents();
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(run);
    }
    componentSyncFallbackTimer = setTimeout(run, 50);
  }

  function syncComponents() {
    const root = document.getElementById('summon-root');
    if (!root) return;
    const els = Array.from(root.querySelectorAll('[data-summon-component]'));
    const components = [];
    const layoutParts = [];
    for (const el of els) {
      const name = el.getAttribute('data-summon-component') || '';
      const id = el.getAttribute('data-summon-component-id') || '';
      const rawProps = el.getAttribute('data-summon-props') || '{}';
      const parsed = parseArgs(rawProps);
      const props = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? interpolate(parsed, el)
        : {};
      const rect = el.getBoundingClientRect();
      layoutParts.push(componentLayoutPart(el, rect));
      components.push({
        id,
        name,
        props: props && typeof props === 'object' && !Array.isArray(props) ? props : {},
        bounds: {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        },
      });
      if (components.length >= 64) break;
    }
    componentLayoutSignature = layoutParts.join('|');
    refreshComponentResizeObservers(root, els);
    updateComponentLayoutPolling(els.length > 0);
    PARENT.postMessage({
      type: 'SUMMON_COMPONENTS',
      sandbox_id: SANDBOX_ID,
      components,
    }, '*');
  }

  function ensureComponentResizeObserver() {
    if (componentResizeObserver || typeof ResizeObserver !== 'function') {
      return componentResizeObserver;
    }
    componentResizeObserver = new ResizeObserver(scheduleComponentSync);
    return componentResizeObserver;
  }

  function refreshComponentResizeObservers(root, els) {
    const observer = ensureComponentResizeObserver();
    if (!observer) return;
    const next = new Set([root, ...els.slice(0, 64)]);
    for (const el of Array.from(componentResizeObserved)) {
      if (next.has(el)) continue;
      observer.unobserve(el);
      componentResizeObserved.delete(el);
    }
    for (const el of next) {
      if (componentResizeObserved.has(el)) continue;
      observer.observe(el);
      componentResizeObserved.add(el);
    }
  }

  function componentLayoutPart(el, rect) {
    return [
      el.getAttribute('data-summon-component-id') || '',
      el.getAttribute('data-summon-component') || '',
      rect.left,
      rect.top,
      rect.width,
      rect.height,
    ].join(':');
  }

  function readComponentLayoutSignature() {
    const root = document.getElementById('summon-root');
    if (!root) return '';
    const els = Array.from(root.querySelectorAll('[data-summon-component]'));
    const parts = [];
    for (const el of els.slice(0, 64)) {
      parts.push(componentLayoutPart(el, el.getBoundingClientRect()));
    }
    return parts.join('|');
  }

  function updateComponentLayoutPolling(enabled) {
    if (!enabled) {
      if (componentLayoutPollTimer) {
        clearInterval(componentLayoutPollTimer);
        componentLayoutPollTimer = 0;
      }
      componentLayoutSignature = '';
      return;
    }
    if (componentLayoutPollTimer) return;
    componentLayoutPollTimer = setInterval(() => {
      const next = readComponentLayoutSignature();
      if (next === componentLayoutSignature) return;
      componentLayoutSignature = next;
      scheduleComponentSync();
    }, 100);
  }

  // Collect named form controls into a flat args object. Multi-step thinking:
  //  - Inputs/selects/textareas with [name] → value.
  //  - Checkboxes → boolean.
  //  - Radios → only the checked one's value, keyed by group name.
  // Anything without [name] is ignored — same as a normal browser submit.
  function collectFormFields(form) {
    const out = {};
    const els = form.querySelectorAll('[name]');
    for (const el of els) {
      const name = el.getAttribute('name');
      if (!name) continue;
      const tag = el.tagName;
      const type = el.type;
      if (tag === 'INPUT' && type === 'checkbox') {
        out[name] = !!el.checked;
      } else if (tag === 'INPUT' && type === 'radio') {
        if (el.checked) out[name] = el.value;
      } else if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
        out[name] = el.value;
      }
    }
    return out;
  }

  function findResourceForElement(fromEl) {
    let el = fromEl;
    while (el) {
      if (el.__summon_resource) return el.__summon_resource;
      el = el.parentElement;
    }
    return null;
  }

  function emitResourceTrigger(el, includeFormFields) {
    const resource = findResourceForElement(el);
    if (!resource || !resource.name) return;
    const rawArgs = el.getAttribute('data-summon-args') || '';
    const base = interpolate(parseArgs(rawArgs), el);
    const args = includeFormFields
      ? Object.assign({}, base, collectFormFields(el))
      : base;
    emit(resource.name, args);
  }

  function parseLocalValue(raw) {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return Number(value);
    if (value.length >= 2 && value[0] === '"' && value[value.length - 1] === '"') {
      try { return JSON.parse(value); } catch (_) { return value.slice(1, -1); }
    }
    if (value.length >= 2 && value[0] === "'" && value[value.length - 1] === "'") {
      return value.slice(1, -1);
    }
    return value;
  }

  function applyLocalAction(el) {
    const setValue = el.getAttribute('data-summon-set');
    const toggleValue = el.getAttribute('data-summon-toggle');
    let changed = false;
    if (setValue) {
      const idx = setValue.indexOf('=');
      const key = idx === -1 ? '' : setValue.slice(0, idx).trim();
      const rawValue = idx === -1 ? '' : setValue.slice(idx + 1);
      if (/^[A-Za-z_$][\w$]{0,39}$/.test(key)) {
        const next = parseLocalValue(rawValue);
        if (localState[key] !== next) {
          localState[key] = next;
          changed = true;
        }
      }
    }
    if (toggleValue) {
      const key = toggleValue.trim();
      if (/^[A-Za-z_$][\w$]{0,39}$/.test(key)) {
        localState[key] = !truthy(localState[key]);
        changed = true;
      }
    }
    if (!changed) return;
    applyBindings();
    const root = document.getElementById('summon-root');
    if (root) triggerUpdateMotion(root);
    scheduleComponentSync();
  }

  function mountKeyFor(el, intent, rawArgs) {
    const index = Array.prototype.indexOf.call(document.querySelectorAll('[data-summon-on-mount]'), el);
    return String(index) + '\n' + intent + '\n' + (rawArgs || '');
  }

  function applyMountIntents() {
    const root = document.getElementById('summon-root');
    if (!root) return;
    const mounts = root.querySelectorAll('[data-summon-on-mount]');
    for (const el of mounts) {
      const intent = el.getAttribute('data-summon-on-mount');
      if (!intent) continue;
      const rawArgs = el.getAttribute('data-summon-args') || '';
      const key = mountKeyFor(el, intent, rawArgs);
      if (mountedIntentKeys.has(key)) continue;
      mountedIntentKeys.add(key);
      emit(intent, interpolate(parseArgs(rawArgs), el));
    }

    const resourceMounts = root.querySelectorAll('[data-summon-resource][data-summon-resource-trigger="mount"]');
    for (const el of resourceMounts) {
      const resource = findResourceForElement(el);
      if (!resource || !resource.name) continue;
      const rawArgs = el.getAttribute('data-summon-args') || '';
      const key = mountKeyFor(el, resource.name, rawArgs);
      if (mountedIntentKeys.has(key)) continue;
      mountedIntentKeys.add(key);
      emitResourceTrigger(el, false);
    }
  }

  // Delegated click. Walks up from event.target to find the closest element
  // carrying `data-summon-on-click`. Always preventDefault — a click that resolves
  // to an intent never falls through to the browser's default (form submit,
  // anchor navigation, etc.). Args are interpolated against the element's
  // foreach scope (if any) at fire time, so `{"picked":"$r"}` resolves to the
  // actual item object the user clicked on.
  document.addEventListener('click', (event) => {
    const t = event.target;
    if (!(t instanceof Element)) return;
    const localEl = t.closest('[data-summon-set],[data-summon-toggle]');
    if (localEl) {
      event.preventDefault();
      applyLocalAction(localEl);
      return;
    }
    const resourceEl = t.closest('[data-summon-resource-trigger="click"]');
    if (resourceEl) {
      event.preventDefault();
      emitResourceTrigger(resourceEl, false);
      return;
    }
    const el = t.closest('[data-summon-on-click]');
    if (!el) return;
    event.preventDefault();
    const intent = el.getAttribute('data-summon-on-click');
    const parsed = parseArgs(el.getAttribute('data-summon-args'));
    emit(intent, interpolate(parsed, el));
  });

  // Delegated submit. Form-only by attribute selector. Auto-collected fields
  // are spread directly into args; an optional `data-summon-args` JSON object
  // provides base args (collected fields win on key conflict). Base args are
  // interpolated against the form's scope so foreach-scoped forms can pass
  // their item identity through.
  document.addEventListener('submit', (event) => {
    const t = event.target;
    if (!(t instanceof Element)) return;
    const resourceForm = t.closest('form[data-summon-resource-trigger="submit"]');
    if (resourceForm) {
      event.preventDefault();
      emitResourceTrigger(resourceForm, true);
      return;
    }
    const form = t.closest('form[data-summon-on-submit]');
    if (!form) return;
    event.preventDefault();
    const intent = form.getAttribute('data-summon-on-submit');
    const base = interpolate(parseArgs(form.getAttribute('data-summon-args')), form);
    emit(intent, Object.assign({}, base, collectFormFields(form)));
  });

  // First-paint pass: hides any `data-summon-show` element whose key resolves
  // to falsy in the empty initial state. Without this, elements meant to be
  // hidden-by-default flash visible until the first state push.
  document.addEventListener('DOMContentLoaded', () => {
    applyBindings();
    applyMountIntents();
  });
  window.addEventListener('resize', scheduleComponentSync);
  window.addEventListener('scroll', scheduleComponentSync, { passive: true });
  document.addEventListener('scroll', scheduleComponentSync, { capture: true, passive: true });
  // ───────────────────────────────────────────────────────────────────────────

  function markTransientClass(el, className, durationMs) {
    if (!el || !el.classList) return;
    el.classList.remove(className);
    // Force a style flush so repeated replacements retrigger the animation.
    void el.offsetWidth;
    el.classList.add(className);
    window.setTimeout(function () {
      if (el && el.classList) el.classList.remove(className);
    }, durationMs);
  }

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.sandbox_id !== SANDBOX_ID) return;

    if (data.type === 'SUMMON_STATE') {
      const next = data.state && typeof data.state === 'object' ? data.state : {};
      currentState = Object.freeze({ ...next });
      // Subscribers fire first; declarative bindings refresh last so the DOM
      // ends up consistent with currentState even if a subscriber wrote to a
      // bound element.
      notify();
      applyBindings();
      {
        const root = document.getElementById('summon-root');
        if (root) triggerUpdateMotion(root);
      }
      return;
    }

    if (data.type === 'SUMMON_RENDER') {
      if (data.artifact) {
        renderArrowArtifact(data.artifact);
        return;
      }
      return;
    }

    if (data.type === 'SUMMON_INTENT_RESULT') {
      var requestId = data.request_id;
      if (typeof requestId !== 'string') return;
      var resolve = pendingIntentResults.get(requestId);
      if (!resolve) return;
      pendingIntentResults.delete(requestId);
      resolve({
        ok: data.ok === true,
        state: data.state && typeof data.state === 'object' ? cloneStateSnapshot(data.state) : cloneStateSnapshot(currentState),
        error: typeof data.error === 'string' ? data.error : undefined,
      });
      return;
    }

    if (data.type === 'SUMMON_CHROME') {
      // Mirror host-declared chrome attributes onto <html>. Host-controlled —
      // we still validate keys/values defensively because the listener is bound
      // to `window` and the sandbox_id gate filters ambient frame messages.
      var attrs = data.attrs;
      if (!attrs || typeof attrs !== 'object') return;
      var root = document.documentElement;
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        if (!/^[a-z][a-z0-9-]*$/.test(k)) continue;
        var v = attrs[k];
        if (v === '' || v == null) {
          root.removeAttribute('data-summon-' + k);
        } else {
          root.setAttribute('data-summon-' + k, String(v));
        }
      }
      return;
    }
  });

  const sdk = Object.freeze({
    get state() { return currentState; },
    onState,
    emit,
  });

  // Install as a non-configurable property so artifact JS can't reassign.
  Object.defineProperty(window, 'sandbox', {
    value: sdk,
    writable: false,
    configurable: false,
    enumerable: true,
  });

  let readySent = false;
  function signalReady() {
    if (readySent) return;
    if (!document.getElementById('summon-root')) return;
    readySent = true;
    try { delete window.__SUMMON_SIGNAL_READY__; } catch (_) { /* non-critical cleanup */ }
    // Signal ready only after the render root exists, so the host can safely
    // flush queued initial renders and state pushes.
    PARENT.postMessage({ type: 'SUMMON_READY', sandbox_id: SANDBOX_ID }, '*');
  }

  Object.defineProperty(window, '__SUMMON_SIGNAL_READY__', {
    value: signalReady,
    writable: false,
    configurable: true,
    enumerable: false,
  });

  if (document.getElementById('summon-root')) {
    signalReady();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', signalReady, { once: true });
  } else {
    window.setTimeout(signalReady, 0);
  }
})();
