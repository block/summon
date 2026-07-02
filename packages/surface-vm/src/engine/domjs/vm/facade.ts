// surface-vm:domjs-facade — the `document` + node behavior the model programs
// against. Maps 1:1 to the 6 protocol patch ops.
//
// Authored as TypeScript, runs INSIDE QuickJS: scripts/build-vm-source.mjs
// strips types, rewrites the './core.js' import to the VM module id, and embeds
// the result as a source string in runtime-source.generated.ts.
//
// The facade is NOT security-critical: it has no capabilities, it only builds
// plain-data trees. A bug here is a wrong render, not an escape.

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  allocNodeId, allocHandlerId, registerHandler, clearHandler,
  enqueuePatch, scheduleChildrenReplace, serialize, bind, reactive,
} from './core.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function unsupported(name: string, hint: string): () => never {
  return function () { throw new Error('domjs: ' + name + ' is not supported. ' + hint); };
}

// Coerce append/insert arguments the way the real DOM does: strings and
// numbers become text nodes.
function toNode(value: any): any {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number') return new TextNode(value);
  return value;
}

function camelToKebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

// Common on<event> handler properties (el.onclick = fn), mapped to
// addEventListener/removeEventListener. A fixed list keeps the facade simple
// and covers what models actually write.
const ON_EVENT_PROPS = [
  'click', 'dblclick', 'input', 'change', 'submit',
  'keydown', 'keyup', 'keypress',
  'focus', 'blur',
  'mousedown', 'mouseup', 'mouseenter', 'mouseleave', 'mouseover', 'mouseout',
  'pointerdown', 'pointerup',
];

// Properties models set directly that the real DOM reflects to/from attributes.
const REFLECTED_PROPS = [
  'value', 'checked', 'disabled', 'hidden', 'placeholder',
  'href', 'src', 'alt', 'title', 'type', 'name', 'min', 'max', 'step',
];

// Define throwing accessors so unsupported APIs fail with a clear, repairable
// message instead of being undefined (which would reproduce the very
// "not a function" crash this project exists to prevent).
function defineUnsupportedGetter(obj: object, name: string, hint: string): void {
  Object.defineProperty(obj, name, {
    configurable: true,
    get() { throw new Error('domjs: ' + name + ' is not supported. ' + hint); },
    set() { throw new Error('domjs: ' + name + ' is not supported. ' + hint); },
  });
}

class TextNode {
  __kind: string;
  __id: string;
  __live: boolean;
  _text: string;

  constructor(text: unknown) {
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
  __setText(value: unknown): void {
    if (typeof value === 'function') {
      const self = this;
      bind(function () { self.__apply((value as () => unknown)()); });
    } else {
      this.__apply(value);
    }
  }
  __apply(value: unknown): void {
    this._text = value == null ? '' : String(value);
    if (this.__live) enqueuePatch({ type: 'set-text', nodeId: this.__id, text: this._text });
  }
  get textContent(): string { return this._text; }
  set textContent(value: any) { this.__setText(value); }
  get text(): string { return this._text; }
}

class ElementNode {
  __kind: string;
  __id: string;
  tag: string;
  namespace: string | undefined;
  attrs: Record<string, string | boolean>;
  events: Map<string, string>;
  _handlers: Map<string, string>;
  __childNodes: any[];
  __live: boolean;
  __styleProxy: any;
  __classList: any;

  constructor(tag: string, namespace?: string) {
    this.__kind = 'element';
    this.__id = allocNodeId();
    this.tag = String(tag).toLowerCase();
    this.namespace = namespace;
    this.attrs = {};
    this.events = new Map();   // type -> handlerId
    this._handlers = new Map();// type -> fn
    this.__childNodes = [];
    this.__live = false;
    this.__styleProxy = null;
    this.__classList = null;

    defineUnsupportedGetter(this, 'innerHTML', 'Build nodes with document.createElement/createTextNode and append.');
    defineUnsupportedGetter(this, 'outerHTML', 'Build nodes with document.createElement/createTextNode and append.');
    defineUnsupportedGetter(this, 'parentNode', 'Hold references to nodes you created; no live-tree traversal.');
    defineUnsupportedGetter(this, 'parentElement', 'Hold references to nodes you created; no live-tree traversal.');

    for (const type of ON_EVENT_PROPS) {
      const self = this;
      Object.defineProperty(this, 'on' + type, {
        configurable: true,
        get() { return null; },
        set(fn: any) {
          self.removeEventListener(type);
          if (typeof fn === 'function') self.addEventListener(type, fn);
        },
      });
    }
    for (const prop of REFLECTED_PROPS) {
      const self = this;
      Object.defineProperty(this, prop, {
        configurable: true,
        get() {
          const v = self.attrs[prop];
          if (prop === 'checked' || prop === 'disabled' || prop === 'hidden') return v === true || v === 'true' || v === '';
          return v === undefined ? '' : v;
        },
        set(value: any) {
          if (value === false || value == null) self.removeAttribute(prop);
          else self.setAttribute(prop, value);
        },
      });
    }
  }

  // el.style.backgroundColor = '...' — a write-through style object serialized
  // to the style attribute (set-attribute op). Read-back returns only what was
  // set through it; there are no computed styles in the VM.
  get style(): any {
    if (this.__styleProxy) return this.__styleProxy;
    const self = this;
    const declared: Record<string, string> = {};
    const sync = () => {
      const css = Object.entries(declared)
        .filter(([, v]) => v !== '')
        .map(([k, v]) => k + ': ' + v)
        .join('; ');
      if (css) self.setAttribute('style', css);
      else self.removeAttribute('style');
    };
    this.__styleProxy = new Proxy(declared, {
      get(t, key: string | symbol) {
        if (key === 'setProperty') return (name: string, value: string) => { t[name] = String(value); sync(); };
        if (key === 'removeProperty') return (name: string) => { delete t[name]; sync(); };
        if (typeof key === 'string') return t[camelToKebab(key)] ?? '';
        return undefined;
      },
      set(t, key: string | symbol, value: any) {
        if (typeof key === 'string') {
          t[camelToKebab(key)] = value == null ? '' : String(value);
          sync();
        }
        return true;
      },
    });
    return this.__styleProxy;
  }
  set style(value: any) {
    // el.style = 'color: red' (cssText-style assignment)
    if (typeof value === 'string') this.setAttribute('style', value);
  }

  get classList(): any {
    if (this.__classList) return this.__classList;
    const self = this;
    const classes = (): string[] =>
      String(self.attrs['class'] || '').split(/\s+/).filter(Boolean);
    const write = (list: string[]): void => {
      if (list.length) self.setAttribute('class', list.join(' '));
      else self.removeAttribute('class');
    };
    this.__classList = {
      add(...names: string[]) {
        const list = classes();
        for (const n of names) if (!list.includes(n)) list.push(n);
        write(list);
      },
      remove(...names: string[]) {
        write(classes().filter((c) => !names.includes(c)));
      },
      toggle(name: string, force?: boolean): boolean {
        const has = classes().includes(name);
        const next = force === undefined ? !has : force;
        if (next && !has) this.add(name);
        if (!next && has) this.remove(name);
        return next;
      },
      contains(name: string): boolean { return classes().includes(name); },
    };
    return this.__classList;
  }

  setAttribute(name: string, value: unknown): void {
    // A function value is a reactive binding: re-run on state change, patch the
    // attribute each time (arrow-style reactive attribute bindings).
    if (typeof value === 'function') {
      const self = this;
      bind(function () { self.__applyAttr(name, (value as () => unknown)()); });
      return;
    }
    this.__applyAttr(name, value);
  }
  __applyAttr(name: string, value: unknown): void {
    const v = value === true ? true : value === false ? false : String(value);
    this.attrs[name] = v;
    // Only patch once the element is live (serialized). Before that, the attr is
    // carried in the render/replace-region payload — no redundant patch.
    if (this.__live) enqueuePatch({ type: 'set-attribute', nodeId: this.__id, name: name, value: v });
  }
  removeAttribute(name: string): void {
    delete this.attrs[name];
    if (this.__live) enqueuePatch({ type: 'remove-attribute', nodeId: this.__id, name: name });
  }
  get className(): string { return (this.attrs['class'] as string) || ''; }
  set className(value: any) { this.setAttribute('class', value); }
  get id(): string { return (this.attrs['id'] as string) || ''; }
  set id(value: any) { this.setAttribute('id', value); }

  get textContent(): string {
    return this.__childNodes.map((c) => (c.__kind === 'text' ? c.text : '')).join('');
  }
  set textContent(value: any) {
    // A string or function both become a single child text node. A function is
    // a reactive binding (handled by TextNode), so el.textContent = () => state.x
    // updates that text node in place without re-rendering the element. On a
    // live element this is a structural change: coalesced implicit-region swap.
    this.__childNodes = [new TextNode(value)];
    this.__structuralChange();
  }

  // Post-mount structural mutations coalesce into one replace-region patch per
  // element per flush (an "implicit region": regionId = element id).
  __structuralChange(): void {
    if (this.__live) scheduleChildrenReplace(this);
  }

  append(...nodes: any[]): this {
    for (const node of nodes) {
      const child = toNode(node);
      if (child == null) continue;
      this.__childNodes.push(child);
    }
    this.__structuralChange();
    return this;
  }
  appendChild(node: any): any { this.append(node); return node; }
  prepend(...nodes: any[]): this {
    const prepared = nodes.map(toNode).filter((n) => n != null);
    this.__childNodes.unshift(...prepared);
    this.__structuralChange();
    return this;
  }
  insertBefore(node: any, reference: any): any {
    const child = toNode(node);
    if (child == null) return node;
    const index = reference == null ? -1 : this.__childNodes.indexOf(reference);
    if (index === -1) this.__childNodes.push(child);
    else this.__childNodes.splice(index, 0, child);
    this.__structuralChange();
    return node;
  }
  removeChild(node: any): any {
    const index = this.__childNodes.indexOf(node);
    if (index === -1) throw new Error('domjs: removeChild: the node is not a child of this element.');
    this.__childNodes.splice(index, 1);
    this.__structuralChange();
    return node;
  }
  replaceChildren(...nodes: any[]): void {
    this.__childNodes = nodes.map(toNode).filter((n) => n != null);
    this.__structuralChange();
  }
  remove(): void {
    // Detached-node removal needs parent links, which the facade does not keep.
    throw new Error('domjs: node.remove() is not supported. Call removeChild on the parent you created, or use region(...)/replaceChildren.');
  }

  addEventListener(type: string, fn: (event: unknown) => unknown): void {
    if (typeof fn !== 'function') throw new Error('domjs: addEventListener requires a function.');
    const handlerId = allocHandlerId();
    this.events.set(type, handlerId);
    this._handlers.set(type, handlerId);
    registerHandler(handlerId, fn);
    if (this.__live) enqueuePatch({ type: 'set-event-binding', nodeId: this.__id, eventType: type, handlerId: handlerId });
  }
  removeEventListener(type: string): void {
    const handlerId = this.events.get(type);
    if (handlerId) { clearHandler(handlerId); this.events.delete(type); }
    if (this.__live) enqueuePatch({ type: 'clear-event-binding', nodeId: this.__id, eventType: type });
  }

  querySelector(): never { throw new Error('domjs: querySelector is not supported. Hold references to nodes you created.'); }
}

class RegionNode {
  __kind: string;
  __id: string;
  _render: () => unknown;
  __effect: unknown;

  constructor(renderFn: () => unknown) {
    this.__kind = 'region';
    this.__id = allocNodeId();
    this._render = renderFn;
    this.__effect = null;
  }
  renderChildren(): any[] {
    const result = this._render();
    const list = Array.isArray(result) ? result : result == null ? [] : [result];
    return list.filter((n) => n != null);
  }
  // Auto-tracking: the FIRST render runs inside a tracked effect, so any
  // reactive state the render fn reads will, on change, re-run the effect and
  // emit a replace-region patch — no manual update() needed. The initial
  // (build-phase) run produces no patch because enqueuePatch is silent then.
  __serializeChildren(): any[] {
    const self = this;
    let children: any[] = [];
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
  update(): void {
    enqueuePatch({
      type: 'replace-region',
      regionId: this.__id,
      children: this.renderChildren().map(serialize),
    });
  }
}

export const document = {
  createElement(tag: string) { return new ElementNode(tag); },
  createElementNS(ns: string, tag: string) { return new ElementNode(tag, ns === SVG_NS ? 'svg' : undefined); },
  createTextNode(text: unknown) { return new TextNode(text); },
  querySelector: unsupported('document.querySelector', 'Hold references to nodes you created.'),
  getElementById: unsupported('document.getElementById', 'Hold references to nodes you created.'),
};

export function region(renderFn: () => unknown): RegionNode {
  if (typeof renderFn !== 'function') throw new Error('domjs: region(fn) requires a function.');
  return new RegionNode(renderFn);
}

// state() and reactive() both return a tracking proxy. state() is kept as the
// familiar name; reactive() matches arrow's vocabulary. Reading a key inside a
// binding (function-valued textContent/attribute, or a region render fn)
// subscribes that binding; writing the key re-runs subscribers.
export function state(initial?: Record<string, unknown>): any {
  return reactive(Object.assign({}, initial || {}));
}
export { reactive };

export { ElementNode, TextNode, RegionNode };
