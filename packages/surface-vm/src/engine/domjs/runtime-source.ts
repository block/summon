// VM-side runtime for the domjs engine, as source strings handed to QuickJS.
//
// Why strings: this code runs INSIDE the VM, not in the host. It is tested by
// running it in the VM (see test/domjs.test.ts), which is the only test that
// matters for VM behavior. We do not tsc this code. If it grows past ~250 lines,
// revisit a stringify build step (Arrow's sync-vm-sources.mjs pattern).
//
// Two modules:
//   surface-vm:domjs-core   - channel, dispatch, tree model, serialize, patch
//                             queue/flush, id alloc, handler registry, mount.
//   surface-vm:domjs-facade - the `document` + node behavior the model programs
//                             against. Maps 1:1 to the 6 protocol patch ops.
//
// The facade is NOT security-critical: it has no capabilities, it only builds
// plain-data trees. A bug here is a wrong render, not an escape.

export const DOMJS_CORE_MODULE_ID = 'surface-vm:domjs-core';
export const DOMJS_FACADE_MODULE_ID = 'surface-vm:domjs-facade';

export const DOMJS_CORE_SOURCE = `
// Capture the single outbound channel at import time; the global is revoked
// after boot, so later code cannot reach it off globalThis.
const __send = globalThis.__hostSend;

let nextNodeId = 0;
let nextHandlerId = 0;
const handlers = new Map();

// Phase flag: false during initial module eval (build phase), true once the
// surface is mounted (reactive phase). Build-phase mutations build the tree
// silently; reactive-phase mutations enqueue patches.
let mounted = false;
let patchQueue = [];

export function isMounted() { return mounted; }
export function allocNodeId() { nextNodeId += 1; return 'snode:' + nextNodeId; }
export function allocHandlerId() { nextHandlerId += 1; return 'shandler:' + nextHandlerId; }

// --- Reactivity (ported from arrow-js's dependency-tracking model) ----------
// reactive(obj) returns a tracking proxy. A "binding" is an effect: a function
// that reads reactive state. While it runs, every reactive key it reads records
// the binding as a dependent. When that key is written, the binding re-runs.
// This is what removes manual region.update() calls and lets the model write
// el.textContent = () => state.count.
let activeEffect = null;
const reactiveDeps = new WeakMap(); // raw target -> Map(key -> Set<effect>)

function depFor(target, key) {
  let map = reactiveDeps.get(target);
  if (!map) { map = new Map(); reactiveDeps.set(target, map); }
  let dep = map.get(key);
  if (!dep) { dep = new Set(); map.set(key, dep); }
  return dep;
}

// Run fn as a tracked effect. Returns an effect handle whose .run() re-executes
// it. Used by function-valued bindings and by regions.
export function bind(fn) {
  const effect = {
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

export function reactive(obj) {
  const target = obj && typeof obj === 'object' ? obj : {};
  return new Proxy(target, {
    get(t, key, recv) {
      if (typeof key === 'string' && activeEffect) depFor(t, key).add(activeEffect);
      return Reflect.get(t, key, recv);
    },
    set(t, key, value, recv) {
      const old = t[key];
      const ok = Reflect.set(t, key, value, recv);
      if (ok && old !== value && typeof key === 'string') {
        const map = reactiveDeps.get(t);
        const dep = map && map.get(key);
        if (dep) {
          // Copy first: an effect re-run may re-subscribe and mutate the set.
          for (const effect of Array.from(dep)) {
            if (effect !== activeEffect) effect.run();
          }
        }
      }
      return ok;
    },
  });
}

export function registerHandler(id, fn) { handlers.set(id, fn); }
export function clearHandler(id) { handlers.delete(id); }

export function emit(message) { __send(JSON.stringify(message)); }
export function output(payload) { emit({ type: 'output', payload: payload }); }

export function enqueuePatch(patch) {
  if (!mounted) return;            // build phase: tree mutations are silent
  patchQueue.push(patch);
}

function flushPatches() {
  if (patchQueue.length === 0) return;
  const patches = patchQueue;
  patchQueue = [];
  emit({ type: 'patch', patches: patches });
}

// Serialize a facade node into a protocol SerializedNode. Serializing an element
// "freezes" it: it has now been handed to the host, so further STRUCTURAL
// changes (append / textContent reset) must go through a region instead. Text,
// attribute, and event changes still patch normally. Freshly created nodes
// (e.g. inside a region's render fn) are not frozen until they too are
// serialized, so building them up always works.
export function serialize(node) {
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
  node.__frozen = true;
  const out = {
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

export function mount(rootNode) {
  if (rootNode == null) {
    throw new Error('domjs surface must export a node as its default export.');
  }
  mounted = true;
  emit({ type: 'ready' });
  emit({ type: 'render', tree: serialize(rootNode) });
}

// --- Host capability bridge (the only inbound authority) -------------------
const __bridge = globalThis.__hostBridge;
let currentState = {};
const stateListeners = new Set();

export function callTool(tool, args) {
  if (!__bridge) return Promise.reject(new Error('host bridge unavailable'));
  // Args cross the boundary as JSON; functions/objects-with-methods are dropped
  // by JSON.stringify, keeping the channel plain-data only.
  return __bridge(String(tool), JSON.stringify(args || {})).then((json) =>
    json ? JSON.parse(json) : null
  );
}

export function getState() {
  return currentState;
}

export function onState(cb) {
  if (typeof cb !== 'function') return function () {};
  stateListeners.add(cb);
  cb(currentState);
  return function () { stateListeners.delete(cb); };
}

// Inbound message pump. Installed as globalThis.__dispatch for the runner.
globalThis.__dispatch = async function (message) {
  if (message.type === 'event') {
    const fn = handlers.get(message.payload.handlerId);
    if (fn) {
      try {
        await fn(message.payload.event);
      } catch (e) {
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
`;

export const DOMJS_FACADE_SOURCE = `
import {
  allocNodeId, allocHandlerId, registerHandler, clearHandler,
  enqueuePatch, serialize, bind, reactive,
} from '${DOMJS_CORE_MODULE_ID}';

const SVG_NS = 'http://www.w3.org/2000/svg';

function unsupported(name, hint) {
  return function () { throw new Error('domjs: ' + name + ' is not supported. ' + hint); };
}

// Define throwing accessors so unsupported APIs fail with a clear, repairable
// message instead of being undefined (which would reproduce the very
// "not a function" crash this project exists to prevent).
function defineUnsupportedGetter(obj, name, hint) {
  Object.defineProperty(obj, name, {
    configurable: true,
    get() { throw new Error('domjs: ' + name + ' is not supported. ' + hint); },
    set() { throw new Error('domjs: ' + name + ' is not supported. ' + hint); },
  });
}

class TextNode {
  constructor(text) {
    this.__kind = 'text';
    this.__id = allocNodeId();
    this._text = '';
    // __live: has this node been serialized (handed to the host)? Only then do
    // value changes emit patches. A freshly-created node (including inside a
    // region re-render) carries its value in the render/replace-region payload,
    // so it must NOT also emit a redundant set-text. serialize() sets this.
    this.__live = false;
    this.__setText(text);
  }
  // Internal: accept a string OR a function (reactive binding). A function is
  // run as a tracked effect; when the reactive state it reads changes, the
  // effect re-runs and emits a single set-text patch. This is arrow's
  // fine-grained model: only this text node updates, no region teardown.
  __setText(value) {
    if (typeof value === 'function') {
      const self = this;
      bind(function () { self.__apply(value()); });
    } else {
      this.__apply(value);
    }
  }
  __apply(value) {
    this._text = value == null ? '' : String(value);
    if (this.__live) enqueuePatch({ type: 'set-text', nodeId: this.__id, text: this._text });
  }
  get textContent() { return this._text; }
  set textContent(value) { this.__setText(value); }
  get text() { return this._text; }
}

class ElementNode {
  constructor(tag, namespace) {
    this.__kind = 'element';
    this.__id = allocNodeId();
    this.tag = String(tag).toLowerCase();
    this.namespace = namespace;
    this.attrs = {};
    this.events = new Map();   // type -> handlerId
    this._handlers = new Map();// type -> fn
    this.__childNodes = [];
    this.__frozen = false;

    defineUnsupportedGetter(this, 'innerHTML', 'Build nodes with document.createElement and append.');
    defineUnsupportedGetter(this, 'outerHTML', 'Build nodes with document.createElement and append.');
    defineUnsupportedGetter(this, 'style', "Use setAttribute('style', ...) or className.");
    defineUnsupportedGetter(this, 'parentNode', 'Hold references to nodes you created; no live-tree traversal.');
    defineUnsupportedGetter(this, 'children', 'Hold references to nodes you created; no live-tree traversal.');
  }

  setAttribute(name, value) {
    // A function value is a reactive binding: re-run on state change, patch the
    // attribute each time (arrow-style reactive attribute bindings).
    if (typeof value === 'function') {
      const self = this;
      bind(function () { self.__applyAttr(name, value()); });
      return;
    }
    this.__applyAttr(name, value);
  }
  __applyAttr(name, value) {
    const v = value === true ? true : value === false ? false : String(value);
    this.attrs[name] = v;
    // Only patch once the element is live (serialized). Before that, the attr is
    // carried in the render/replace-region payload — no redundant patch.
    if (this.__frozen) enqueuePatch({ type: 'set-attribute', nodeId: this.__id, name: name, value: v });
  }
  removeAttribute(name) {
    delete this.attrs[name];
    if (this.__frozen) enqueuePatch({ type: 'remove-attribute', nodeId: this.__id, name: name });
  }
  get className() { return this.attrs['class'] || ''; }
  set className(value) { this.setAttribute('class', value); }
  get id() { return this.attrs['id'] || ''; }
  set id(value) { this.setAttribute('id', value); }

  get textContent() {
    return this.__childNodes.map((c) => (c.__kind === 'text' ? c.text : '')).join('');
  }
  set textContent(value) {
    if (this.__frozen) {
      throw new Error('domjs: cannot reset textContent of a rendered element. Set textContent on a text node you hold, or use region(...).');
    }
    // A string or function both become a single child text node. A function is
    // a reactive binding (handled by TextNode), so el.textContent = () => state.x
    // updates that text node in place without re-rendering the element.
    this.__childNodes = [new TextNode(value)];
  }

  append(...nodes) {
    if (this.__frozen) {
      throw new Error('domjs: cannot append to a rendered element. Use region(...) for dynamic children.');
    }
    for (const node of nodes) {
      if (node == null) continue;
      this.__childNodes.push(node);
    }
    return this;
  }
  appendChild(node) { this.append(node); return node; }

  addEventListener(type, fn) {
    if (typeof fn !== 'function') throw new Error('domjs: addEventListener requires a function.');
    const handlerId = allocHandlerId();
    this.events.set(type, handlerId);
    this._handlers.set(type, handlerId);
    registerHandler(handlerId, fn);
    if (this.__frozen) enqueuePatch({ type: 'set-event-binding', nodeId: this.__id, eventType: type, handlerId: handlerId });
  }
  removeEventListener(type) {
    const handlerId = this.events.get(type);
    if (handlerId) { clearHandler(handlerId); this.events.delete(type); }
    if (this.__frozen) enqueuePatch({ type: 'clear-event-binding', nodeId: this.__id, eventType: type });
  }

  insertBefore() { throw new Error('domjs: insertBefore is not supported. Use region(...) for dynamic lists.'); }
  removeChild() { throw new Error('domjs: removeChild is not supported. Use region(...) for dynamic lists.'); }
  querySelector() { throw new Error('domjs: querySelector is not supported. Hold references to nodes you created.'); }
}

class RegionNode {
  constructor(renderFn) {
    this.__kind = 'region';
    this.__id = allocNodeId();
    this._render = renderFn;
    this.__effect = null;
  }
  renderChildren() {
    const result = this._render();
    const list = Array.isArray(result) ? result : result == null ? [] : [result];
    return list.filter((n) => n != null);
  }
  // Auto-tracking: the FIRST render runs inside a tracked effect, so any
  // reactive state the render fn reads will, on change, re-run the effect and
  // emit a replace-region patch — no manual update() needed. The initial
  // (build-phase) run produces no patch because enqueuePatch is silent then.
  __serializeChildren() {
    const self = this;
    let children = [];
    if (this.__effect) {
      children = this.renderChildren().map(serialize);
    } else {
      this.__effect = bind(function () {
        children = self.renderChildren().map(serialize);
        if (self.__effect) {
          // Re-run (state changed): emit the region replacement.
          enqueuePatch({ type: 'replace-region', regionId: self.__id, children: children });
        }
      });
    }
    return children;
  }
  // Manual escape hatch (still supported, e.g. for non-reactive data sources).
  update() {
    enqueuePatch({
      type: 'replace-region',
      regionId: this.__id,
      children: this.renderChildren().map(serialize),
    });
  }
}

export const document = {
  createElement(tag) { return new ElementNode(tag); },
  createElementNS(ns, tag) { return new ElementNode(tag, ns === SVG_NS ? 'svg' : undefined); },
  createTextNode(text) { return new TextNode(text); },
  querySelector: unsupported('document.querySelector', 'Hold references to nodes you created.'),
  getElementById: unsupported('document.getElementById', 'Hold references to nodes you created.'),
};

export function region(renderFn) {
  if (typeof renderFn !== 'function') throw new Error('domjs: region(fn) requires a function.');
  return new RegionNode(renderFn);
}

// state() and reactive() both return a tracking proxy. state() is kept as the
// familiar name; reactive() matches arrow's vocabulary. Reading a key inside a
// binding (function-valued textContent/attribute, or a region render fn)
// subscribes that binding; writing the key re-runs subscribers.
export function state(initial) { return reactive(Object.assign({}, initial || {})); }
export { reactive };

export { ElementNode, TextNode, RegionNode };
`;
