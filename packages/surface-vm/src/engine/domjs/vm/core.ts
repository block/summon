// surface-vm:domjs-core — VM-side core: channel, dispatch, reactivity,
// serialize, patch queue/flush, id alloc, handler registry, mount.
//
// This file is authored as TypeScript for hygiene but runs INSIDE QuickJS:
// scripts/build-vm-source.mjs strips types and embeds it as a source string in
// runtime-source.generated.ts. It must stay dependency-free and use only
// ES2022 language features. It is tested by running it in the VM
// (test/domjs.test.ts) — that is the only test that matters for VM behavior.
//
// The core is trusted VM-side glue. It has no capabilities beyond the two
// channels the runner injects (`__hostSend`, `__hostBridge`), both captured at
// import time and revoked from globalThis after boot.

/* eslint-disable @typescript-eslint/no-explicit-any */

declare const globalThis: any;

// Capture the single outbound channel at import time; the global is revoked
// after boot, so later code cannot reach it off globalThis.
const __send: (json: string) => void = globalThis.__hostSend;

let nextNodeId = 0;
let nextHandlerId = 0;
const handlers = new Map<string, (event: unknown) => unknown>();

// Phase flag: false during initial module eval (build phase), true once the
// surface is mounted (reactive phase). Build-phase mutations build the tree
// silently; reactive-phase mutations enqueue patches.
let mounted = false;
let patchQueue: any[] = [];

export function isMounted(): boolean { return mounted; }
export function allocNodeId(): string { nextNodeId += 1; return 'snode:' + nextNodeId; }
export function allocHandlerId(): string { nextHandlerId += 1; return 'shandler:' + nextHandlerId; }

// --- Reactivity (ported from arrow-js's dependency-tracking model) ----------
// reactive(obj) returns a tracking proxy. A "binding" is an effect: a function
// that reads reactive state. While it runs, every reactive key it reads records
// the binding as a dependent. When that key is written, the binding re-runs.
// This is what removes manual region.update() calls and lets the model write
// el.textContent = () => state.count.

interface Effect { run(): unknown }

let activeEffect: Effect | null = null;
const reactiveDeps = new WeakMap<object, Map<string, Set<Effect>>>();

// Cycle guard: a binding that writes state it (transitively) reads would
// re-trigger itself forever and livelock the VM (or blow the VM stack, since
// cascades run synchronously and therefore recursively). Cap both total effect
// re-runs per outer (non-effect) write and cascade depth; on breach, throw a
// clear, repairable error instead of hanging until the host interrupt fires.
const MAX_EFFECT_RUNS_PER_FLUSH = 1000;
const MAX_EFFECT_CASCADE_DEPTH = 32;
const CYCLE_ERROR_MESSAGE = 'domjs: reactive update cycle detected — a binding writes state it also reads. Mutate state only in event handlers, not inside bindings or region render functions.';
let effectRunDepth = 0;
let effectRunCount = 0;

function depFor(target: object, key: string): Set<Effect> {
  let map = reactiveDeps.get(target);
  if (!map) { map = new Map(); reactiveDeps.set(target, map); }
  let dep = map.get(key);
  if (!dep) { dep = new Set(); map.set(key, dep); }
  return dep;
}

// Run fn as a tracked effect. Returns an effect handle whose .run() re-executes
// it. Used by function-valued bindings and by regions.
export function bind(fn: () => unknown): Effect {
  const effect: Effect = {
    run() {
      const prev = activeEffect;
      activeEffect = effect;
      try { return fn(); }
      finally { activeEffect = prev; }
    },
  };
  effect.run();
  return effect;
}

function notify(target: object, key: string): void {
  const map = reactiveDeps.get(target);
  const dep = map && map.get(key);
  if (!dep) return;
  if (effectRunDepth === 0) effectRunCount = 0;
  effectRunDepth += 1;
  try {
    if (effectRunDepth > MAX_EFFECT_CASCADE_DEPTH) {
      throw new Error(CYCLE_ERROR_MESSAGE);
    }
    // Copy first: an effect re-run may re-subscribe and mutate the set.
    for (const effect of Array.from(dep)) {
      if (effect === activeEffect) continue;
      effectRunCount += 1;
      if (effectRunCount > MAX_EFFECT_RUNS_PER_FLUSH) {
        throw new Error(CYCLE_ERROR_MESSAGE);
      }
      effect.run();
    }
  } finally {
    effectRunDepth -= 1;
  }
}

// Deep reactivity: nested objects/arrays returned from a reactive read are
// wrapped too (cached for stable identity), and mutating array methods notify
// the array's subscribers — so s.items.push(x) tracks, matching the model's
// DOM-era prior. Reads inside effects subscribe per-key; array iteration
// subscribes via 'length'.
const proxyCache = new WeakMap<object, any>();
const rawOf = new WeakMap<object, object>();
const MUTATING_ARRAY_METHODS = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin'];

function notifyAll(target: object): void {
  const map = reactiveDeps.get(target);
  if (!map) return;
  for (const key of Array.from(map.keys())) notify(target, key);
}

export function reactive(obj: unknown): any {
  if (!obj || typeof obj !== 'object') return obj;
  const target: any = obj;
  if (rawOf.has(target)) return target; // already a proxy
  const cached = proxyCache.get(target);
  if (cached) return cached;

  const proxy: any = new Proxy(target, {
    get(t: any, key: string | symbol, recv: unknown) {
      if (typeof key === 'string') {
        if (Array.isArray(t) && MUTATING_ARRAY_METHODS.includes(key)) {
          const method = Reflect.get(t, key) as (...args: unknown[]) => unknown;
          return function (...args: unknown[]) {
            const result = method.apply(t, args);
            notifyAll(t);
            return result;
          };
        }
        if (activeEffect) depFor(t, key).add(activeEffect);
      }
      const value = Reflect.get(t, key, recv);
      // Wrap nested objects/arrays so deep reads track and deep writes notify.
      if (value && typeof value === 'object' && typeof key === 'string') {
        return reactive(value);
      }
      return value;
    },
    set(t: any, key: string | symbol, value: unknown, recv: unknown) {
      // Store raw values, not proxies, so identity comparisons on t stay sane.
      const raw = value && typeof value === 'object' ? (rawOf.get(value as object) ?? value) : value;
      const old = t[key];
      const ok = Reflect.set(t, key, raw, recv);
      if (ok && old !== raw && typeof key === 'string') {
        notify(t, key);
        // Writing an index or nested key must also wake array-level readers.
        if (Array.isArray(t) && key !== 'length') notify(t, 'length');
      }
      return ok;
    },
    deleteProperty(t: any, key: string | symbol) {
      const ok = Reflect.deleteProperty(t, key);
      if (ok && typeof key === 'string') notify(t, key);
      return ok;
    },
  });
  proxyCache.set(target, proxy);
  rawOf.set(proxy, target);
  return proxy;
}

export function registerHandler(id: string, fn: (event: unknown) => unknown): void { handlers.set(id, fn); }
export function clearHandler(id: string): void { handlers.delete(id); }

// NOTE: handlers of detached subtrees are intentionally NOT released. The model
// may hold a node reference and re-append it elsewhere (move patterns), and the
// region path has always kept superseded handlers registered. The map is
// bounded by the surface's lifetime and cleared on destroy.

export function emit(message: unknown): void { __send(JSON.stringify(message)); }
export function output(payload: unknown): void { emit({ type: 'output', payload: payload }); }

export function enqueuePatch(patch: unknown): void {
  if (!mounted) return;            // build phase: tree mutations are silent
  patchQueue.push(patch);
}

// Implicit element regions: a structural mutation (append / removeChild /
// insertBefore / textContent reset) on a LIVE element schedules that element's
// children for wholesale replacement, coalesced to at most one replace-region
// patch per element per flush. Serialization happens at flush time so the
// payload reflects the element's final child list for this dispatch.
const pendingChildReplaces = new Map<string, any>();

export function scheduleChildrenReplace(node: any): void {
  if (!mounted) return;            // build phase: tree mutations are silent
  pendingChildReplaces.set(node.__id, node);
}

function flushPatches(): void {
  if (pendingChildReplaces.size > 0) {
    for (const node of pendingChildReplaces.values()) {
      patchQueue.push({
        type: 'replace-region',
        regionId: node.__id,
        children: node.__childNodes.map(serialize),
      });
    }
    pendingChildReplaces.clear();
  }
  if (patchQueue.length === 0) return;
  const patches = patchQueue;
  patchQueue = [];
  emit({ type: 'patch', patches: patches });
}

// Serialize a facade node into a protocol SerializedNode. Serializing a node
// marks it LIVE: it has been handed to the host, so subsequent changes emit
// patches (before that, values travel inside the render/replace-region payload
// and emitting a patch too would be redundant). Structural changes to a live
// element coalesce into an implicit-region replacement via
// scheduleChildrenReplace.
export function serialize(node: any): any {
  if (node == null) return null;
  if (node.__kind === 'text') {
    node.__live = true; // now handed to host: future value changes emit set-text
    return { kind: 'text', id: node.__id, text: String(node.text) };
  }
  if (node.__kind === 'region') {
    // __serializeChildren establishes the auto-tracking effect on first call so
    // the region re-renders when reactive state it reads changes. Falls back to
    // renderChildren() for regions that don't implement it.
    const children = typeof node.__serializeChildren === 'function'
      ? node.__serializeChildren()
      : node.renderChildren().map(serialize);
    return { kind: 'region', id: node.__id, children: children };
  }
  // element
  node.__live = true;
  const out: any = {
    kind: 'element',
    id: node.__id,
    tag: node.tag,
    attrs: Object.assign({}, node.attrs),
    events: {},
    children: node.__childNodes.map(serialize),
  };
  if (node.namespace) out.namespace = node.namespace;
  for (const [type, handlerId] of node.events) out.events[type] = handlerId;
  return out;
}

export function mount(rootNode: unknown): void {
  if (rootNode == null) {
    throw new Error('domjs surface must export a node as its default export.');
  }
  mounted = true;
  emit({ type: 'ready' });
  emit({ type: 'render', tree: serialize(rootNode) });
}

// --- Host capability bridge (the only inbound authority) -------------------
const __bridge: ((tool: string, argsJson: string) => Promise<string>) | undefined =
  globalThis.__hostBridge;
let currentState: Record<string, unknown> = {};
const stateListeners = new Set<(state: Record<string, unknown>) => void>();

export function callTool(tool: string, args?: Record<string, unknown>): Promise<unknown> {
  if (!__bridge) return Promise.reject(new Error('host bridge unavailable'));
  // Args cross the boundary as JSON; functions/objects-with-methods are dropped
  // by JSON.stringify, keeping the channel plain-data only.
  return __bridge(String(tool), JSON.stringify(args || {})).then((json) =>
    json ? JSON.parse(json) : null
  );
}

export function getState(): Record<string, unknown> {
  return currentState;
}

export function onState(cb: (state: Record<string, unknown>) => void): () => void {
  if (typeof cb !== 'function') return function () {};
  stateListeners.add(cb);
  cb(currentState);
  return function () { stateListeners.delete(cb); };
}

// Inbound message pump. Installed as globalThis.__dispatch for the runner.
globalThis.__dispatch = async function (message: any): Promise<void> {
  if (message.type === 'event') {
    const fn = handlers.get(message.payload.handlerId);
    if (fn) {
      try {
        await fn(message.payload.event);
      } catch (e: any) {
        emit({ type: 'error', error: String(e && e.message ? e.message : e) });
      }
    }
    flushPatches();
    return;
  }
  if (message.type === 'state') {
    currentState = message.state || {};
    for (const cb of stateListeners) {
      try { cb(currentState); } catch (e) { /* listener errors are surface bugs */ }
    }
    flushPatches();
    return;
  }
  if (message.type === 'destroy') {
    handlers.clear();
    stateListeners.clear();
    return;
  }
};
