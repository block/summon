// Summon sandbox bootstrap — runs FIRST inside every sandbox iframe, before any
// artifact HTML/JS. Installs window.sandbox (frozen) as the only way for the
// sandboxed code to talk to the host. Capture parent reference and the message
// constructor early so a later-injected script can't shadow them.
(() => {
  'use strict';

  const PARENT = window.parent;
  const SANDBOX_ID = window.__SUMMON_SANDBOX_ID__;
  const RESOURCE_MAP = normalizeResources(window.__SUMMON_RESOURCES__);
  if (!SANDBOX_ID || typeof SANDBOX_ID !== 'string') {
    // No ID means host didn't spawn this correctly. Refuse to install SDK.
    return;
  }

  // Scrub globals so artifact code can't read or overwrite them after bootstrap.
  try {
    delete window.__SUMMON_SANDBOX_ID__;
    delete window.__SUMMON_RESOURCES__;
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
  const subscribers = new Set();
  const mountedIntentKeys = new Set();
  let componentSyncScheduled = false;
  let componentSyncFallbackTimer = 0;
  let componentLayoutPollTimer = 0;
  let componentLayoutSignature = '';
  let componentResizeObserver = null;
  const componentResizeObserved = new Set();
  const SAFE_ATTR_BINDINGS = Object.freeze(['src', 'alt', 'title', 'aria-label', 'value', 'placeholder', 'disabled']);

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

  function onState(cb) {
    if (typeof cb !== 'function') return () => {};
    subscribers.add(cb);
    // Fire immediately with current snapshot for convenience.
    try { cb(currentState); } catch (_) { /* swallow */ }
    return () => subscribers.delete(cb);
  }

  // ── Declarative bindings ───────────────────────────────────────────────────
  // The LLM authors HTML with `data-summon-*` attributes; this binder is what
  // makes them live. Two halves:
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
  // Scripts written via `sandbox.onState` keep working. The contract is: a
  // script subscriber should NOT mutate elements that carry a `data-summon-bind`
  // / `-show` / `-hide` — the binder runs after subscribers and will overwrite.

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
        const v = resolveKey(el.getAttribute('data-summon-attr-' + attr), el);
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

  function applyBindings() {
    const root = document.getElementById('summon-root');
    if (!root) return;
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
      el.hidden = !truthy(resolveKey(el.getAttribute('data-summon-show'), el));
    }
    const hides = root.querySelectorAll('[data-summon-hide]');
    for (const el of hides) {
      el.hidden = truthy(resolveKey(el.getAttribute('data-summon-hide'), el));
    }
    applyAttrBindings(root);
    scheduleComponentSync();
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

  function mountKeyFor(el, intent, rawArgs) {
    const section = el.closest('[data-summon-section]');
    const sectionId = section ? section.getAttribute('data-summon-section') || 'root' : 'root';
    return sectionId + '\n' + intent + '\n' + (rawArgs || '');
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

  // Tracks the <section data-summon-section="..."> elements currently in
  // #summon-root, keyed by id, so live-paint renders only mount NEW sections
  // instead of re-creating the whole tree on every section update. Without
  // this, every entrance animation re-fires on every section arrival.
  const sectionEls = new Map();

  function indexExistingSections(root) {
    if (sectionEls.size > 0) return;
    for (const child of Array.from(root.children)) {
      if (child.tagName === 'SECTION' && child.hasAttribute('data-summon-section')) {
        const id = child.getAttribute('data-summon-section');
        if (id) sectionEls.set(id, child);
      }
    }
  }

  /**
   * Render a blob of HTML into #summon-root.
   *
   * If the incoming HTML is section-structured (top-level
   * `<section data-summon-section="...">` children, as produced by
   * SectionAccumulator.compose()), diff by section id: existing sections stay
   * in place, new sections are appended (so their CSS entrance animation fires
   * once), changed sections get their innerHTML replaced without remount,
   * removed sections are pulled out.
   *
   * Otherwise (raw artifact HTML, no sections), fall back to a full
   * innerHTML replace.
   *
   * Inline <script> tags don't execute via innerHTML — clone them into fresh
   * script elements so they run, but only inside the parts of the tree that
   * actually changed.
   */
  function renderRoot(html) {
    const root = document.getElementById('summon-root');
    if (!root) return;
    indexExistingSections(root);
    const incoming = typeof html === 'string' ? html : '';

    const tmp = document.createElement('div');
    tmp.innerHTML = incoming;

    const newSections = [];
    for (const child of Array.from(tmp.children)) {
      if (child.tagName === 'SECTION' && child.hasAttribute('data-summon-section')) {
        newSections.push(child);
      }
    }

    if (newSections.length === 0) {
      // Full replace — every prior subscriber is now pointing at detached DOM.
      sectionEls.clear();
      subscribers.clear();
      root.innerHTML = incoming;
      rerunScripts(root);
      applyBindings();
      applyMountIntents();
      return;
    }

    const wantedOrder = [];
    const wantedIds = new Set();

    for (const incomingEl of newSections) {
      const id = incomingEl.getAttribute('data-summon-section');
      if (!id) continue;
      wantedOrder.push(id);
      wantedIds.add(id);

      const existingEl = sectionEls.get(id);
      if (existingEl) {
        // Same section, possibly updated content. Replace innerHTML on the
        // existing element so the entrance animation does NOT re-fire.
        if (existingEl.innerHTML !== incomingEl.innerHTML) {
          if (!patchSectionBlocks(existingEl, incomingEl)) {
            existingEl.innerHTML = incomingEl.innerHTML;
            rerunScripts(existingEl);
          }
        }
      } else {
        // New section — appending to #summon-root mounts it for the first time,
        // which triggers the CSS entrance animation declared on the
        // [data-summon-section] selector.
        root.appendChild(incomingEl);
        rerunScripts(incomingEl);
        sectionEls.set(id, incomingEl);
      }
    }

    for (const [id, el] of Array.from(sectionEls.entries())) {
      if (!wantedIds.has(id)) {
        el.remove();
        sectionEls.delete(id);
      }
    }

    // Reorder children to match wantedOrder. insertBefore on a node already in
    // the tree moves it rather than cloning, so this is in-place.
    for (let i = 0; i < wantedOrder.length; i++) {
      const desired = sectionEls.get(wantedOrder[i]);
      if (!desired) continue;
      if (root.children[i] !== desired) {
        root.insertBefore(desired, root.children[i] || null);
      }
    }

    applyBindings();
    applyMountIntents();
  }

  function patchSectionBlocks(existingSection, incomingSection) {
    var existingBlocks = directBlockChildren(existingSection);
    var incomingBlocks = directBlockChildren(incomingSection);
    if (existingBlocks.length === 0 || incomingBlocks.length === 0) return false;

    var existingById = new Map();
    for (var i = 0; i < existingBlocks.length; i++) {
      var existingId = existingBlocks[i].getAttribute('data-summon-block');
      if (existingId) existingById.set(existingId, existingBlocks[i]);
    }

    var wantedIds = new Set();
    for (var j = 0; j < incomingBlocks.length; j++) {
      var incomingBlock = incomingBlocks[j];
      var id = incomingBlock.getAttribute('data-summon-block');
      if (!id) continue;
      wantedIds.add(id);
      var existingBlock = existingById.get(id);
      if (existingBlock) {
        if (existingBlock.innerHTML !== incomingBlock.innerHTML) {
          existingBlock.innerHTML = incomingBlock.innerHTML;
          rerunScripts(existingBlock);
        }
      } else {
        existingSection.appendChild(incomingBlock);
        rerunScripts(incomingBlock);
        existingById.set(id, incomingBlock);
      }
    }

    for (var _i = 0; _i < existingBlocks.length; _i++) {
      var stale = existingBlocks[_i];
      var staleId = stale.getAttribute('data-summon-block');
      if (staleId && !wantedIds.has(staleId)) stale.remove();
    }

    for (var k = 0; k < incomingBlocks.length; k++) {
      var wantedId = incomingBlocks[k].getAttribute('data-summon-block');
      if (!wantedId) continue;
      var desired = existingById.get(wantedId);
      if (!desired) continue;
      if (existingSection.children[k] !== desired) {
        existingSection.insertBefore(desired, existingSection.children[k] || null);
      }
    }

    return true;
  }

  function directBlockChildren(section) {
    var out = [];
    for (var i = 0; i < section.children.length; i++) {
      var child = section.children[i];
      if (child.hasAttribute('data-summon-block')) out.push(child);
    }
    return out;
  }

  function patchHtmlNode(patch) {
    if (!patch || typeof patch !== 'object') return;
    var sectionId = typeof patch.sectionId === 'string' ? patch.sectionId : '';
    var nodeId = typeof patch.nodeId === 'string' ? patch.nodeId : '';
    var parentId = typeof patch.parentId === 'string' ? patch.parentId : '';
    var html = typeof patch.html === 'string' ? patch.html : '';
    if (!sectionId || !nodeId) return;

    var root = document.getElementById('summon-root');
    if (!root) return;
    indexExistingSections(root);

    var section = sectionEls.get(sectionId);
    if (!section) {
      section = document.createElement('section');
      section.setAttribute('data-summon-section', sectionId);
      root.appendChild(section);
      sectionEls.set(sectionId, section);
    }

    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    var incoming = tmp.firstElementChild;
    if (!incoming || incoming.getAttribute('data-summon-node') !== nodeId) return;

    var parent = parentId ? findSummonNode(section, parentId) : section;
    if (!parent) return;

    var existing = findSummonNode(section, nodeId);
    if (existing) {
      var preservedChildren = directNodeChildren(existing);
      var incomingChildHost = nodeChildrenHost(incoming);
      var replacementSlotChanged = false;
      if (preservedChildren.length > 0) {
        replacementSlotChanged = prepareNodeChildHost(incomingChildHost);
      }
      for (var i = 0; i < preservedChildren.length; i++) {
        incomingChildHost.appendChild(preservedChildren[i]);
      }
      markTransientClass(incoming, 'summon-node-update', 520);
      existing.replaceWith(incoming);
      if (replacementSlotChanged) markSlotFilled(incomingChildHost);
    } else {
      var childHost = nodeChildrenHost(parent);
      var slotChanged = prepareNodeChildHost(childHost);
      markTransientClass(incoming, 'summon-node-enter', 520);
      childHost.appendChild(incoming);
      if (slotChanged) markSlotFilled(childHost);
    }

    applyBindings();
    applyMountIntents();
  }

  function findSummonNode(section, nodeId) {
    var nodes = section.querySelectorAll('[data-summon-node]');
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].getAttribute('data-summon-node') === nodeId) return nodes[i];
    }
    return null;
  }

  function directNodeChildren(parent) {
    var out = [];
    var childHost = nodeChildrenHost(parent);
    for (var i = 0; i < childHost.children.length; i++) {
      var child = childHost.children[i];
      if (child.hasAttribute('data-summon-node')) out.push(child);
    }
    return out;
  }

  function nodeChildrenHost(parent) {
    if (!parent || typeof parent.querySelector !== 'function') return parent;
    return parent.querySelector('[data-summon-node-children]') || parent;
  }

  function prepareNodeChildHost(host) {
    if (!isNodeChildrenSlot(host)) return false;
    var hadNodeChildren = directSummonNodeChildCount(host) > 0;
    var removedSkeletons = removeDirectSkeletons(host);
    return removedSkeletons > 0 || !hadNodeChildren;
  }

  function directSummonNodeChildCount(host) {
    if (!host || !host.children) return 0;
    var count = 0;
    for (var i = 0; i < host.children.length; i++) {
      if (host.children[i].hasAttribute('data-summon-node')) count += 1;
    }
    return count;
  }

  function removeDirectSkeletons(host) {
    if (!host || !host.children) return 0;
    var removed = 0;
    var children = Array.from(host.children);
    for (var i = 0; i < children.length; i++) {
      if (children[i].hasAttribute('data-summon-skeleton')) {
        children[i].remove();
        removed += 1;
      }
    }
    return removed;
  }

  function isNodeChildrenSlot(el) {
    return !!(el && el.hasAttribute && el.hasAttribute('data-summon-node-children'));
  }

  function markSlotFilled(slot) {
    if (!isNodeChildrenSlot(slot)) return;
    markTransientClass(slot, 'summon-slot-filled', 560);
  }

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

  function rerunScripts(scope) {
    const scripts = scope.querySelectorAll('script');
    for (const old of scripts) {
      const s = document.createElement('script');
      for (const attr of Array.from(old.attributes)) {
        s.setAttribute(attr.name, attr.value);
      }
      s.textContent = old.textContent;
      old.parentNode.replaceChild(s, old);
    }
  }

  window.addEventListener('message', (event) => {
    // Only accept messages from our parent window. Other frames or workers ignored.
    if (event.source !== PARENT) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'SUMMON_STATE') {
      const next = data.state && typeof data.state === 'object' ? data.state : {};
      currentState = Object.freeze({ ...next });
      // Subscribers fire first; declarative bindings refresh last so the DOM
      // ends up consistent with currentState even if a subscriber wrote to a
      // bound element.
      notify();
      applyBindings();
      return;
    }

    if (data.type === 'SUMMON_RENDER') {
      // renderRoot decides whether to wipe subscribers: a full innerHTML
      // replace clears them, but a section-by-section diff leaves alive
      // sections (and their onState subscribers) in place.
      renderRoot(data.html);
      return;
    }

    if (data.type === 'SUMMON_NODE_PATCH') {
      patchHtmlNode(data.patch);
      return;
    }

    if (data.type === 'SUMMON_CHROME') {
      // Mirror host-declared chrome attributes onto <html>. Host-controlled —
      // we still validate keys/values defensively because the listener is
      // bound to `window` and other frames' messages can land here even
      // though the sandbox_id gate filtered the major culprits.
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

  // Signal ready so the host can push initial state.
  PARENT.postMessage({ type: 'SUMMON_READY', sandbox_id: SANDBOX_ID }, '*');
})();
