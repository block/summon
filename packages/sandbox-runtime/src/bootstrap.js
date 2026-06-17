// Summon sandbox bootstrap — runs FIRST inside every sandbox iframe, before any
// Arrow artifact runtime. Installs window.sandbox (frozen) as the trusted
// bridge for controlled host capabilities. Generated artifacts do not receive
// executable scripts.
(() => {
  'use strict';

  const PARENT = window.parent;
  const SANDBOX_ID = window.__SUMMON_SANDBOX_ID__;
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
    delete window.__SUMMON_NETWORK_POLICY__;
  } catch (_) { /* sealed elsewhere */ }

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
  let componentSyncScheduled = false;
  let componentSyncFallbackTimer = 0;
  let componentLayoutPollTimer = 0;
  let componentLayoutSignature = '';
  let componentResizeObserver = null;
  const componentResizeObserved = new Set();
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
            onState: function (cb) {
              return onState(cb);
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
    scheduleComponentSync();
    const done = function () {
      if (revision !== renderRevision) return;
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

  function parseComponentProps(raw) {
    if (!raw) return {};
    try { return JSON.parse(raw); }
    catch (_) {
      try { console.warn('summon: invalid data-summon-props JSON:', raw); } catch (__) {}
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
      const parsed = parseComponentProps(rawProps);
      const props = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
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

  window.addEventListener('resize', scheduleComponentSync);
  window.addEventListener('scroll', scheduleComponentSync, { passive: true });
  document.addEventListener('scroll', scheduleComponentSync, { capture: true, passive: true });
  // ───────────────────────────────────────────────────────────────────────────

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.sandbox_id !== SANDBOX_ID) return;

    if (data.type === 'SUMMON_STATE') {
      const next = data.state && typeof data.state === 'object' ? data.state : {};
      currentState = Object.freeze({ ...next });
      notify();
      scheduleComponentSync();
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
