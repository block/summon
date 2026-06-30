// Host renderer: turns protocol messages into real DOM, and turns real DOM
// events into plain-data snapshots for the VM.
//
// This is trust-adjacent glue, not security-critical logic: the isolation
// guarantee lives in the QuickJS runner and the protocol. The renderer only
// ever sees plain data (tag/attr strings, node ids) and only ever produces
// plain-data event snapshots. It never sends a live DOM node or Event across
// the boundary. Keep it a faithful, boring port; do not "improve" it.
//
// Ported from @arrow-js/sandbox's host renderer (MIT), against our protocol.ts.

import type {
  SandboxedEventPayload,
  SandboxedEventTargetSnapshot,
  SerializedNode,
  VmPatch,
} from '../protocol.js';

const SVG_NAMESPACE_URI = 'http://www.w3.org/2000/svg';

interface RegionAnchor {
  start: Comment;
  end: Comment;
}

export interface HostRendererOptions {
  mountPoint: Element;
  onEvent: (handlerId: string, payload: SandboxedEventPayload) => void | Promise<void>;
  onError: (error: Error | string) => void;
}

export class HostRenderer {
  private readonly mountPoint: Element;
  private readonly onEvent: HostRendererOptions['onEvent'];
  private readonly onError: HostRendererOptions['onError'];

  private readonly nodes = new Map<string, Node>();
  private readonly regions = new Map<string, RegionAnchor>();
  private readonly elementEvents = new Map<string, Map<string, string>>();
  private readonly nodeIds = new WeakMap<Node, string>();
  private readonly regionStarts = new WeakMap<Node, string>();
  private readonly delegatedListeners = new Map<string, EventListener>();

  constructor(options: HostRendererOptions) {
    this.mountPoint = options.mountPoint;
    this.onEvent = options.onEvent;
    this.onError = options.onError;
  }

  render(tree: SerializedNode): void {
    this.clear();
    const node = this.instantiate(tree);
    this.mountPoint.replaceChildren(node);
  }

  applyPatches(patches: VmPatch[]): void {
    for (const patch of patches) {
      this.applyPatch(patch);
    }
  }

  destroy(): void {
    this.clear();
    this.mountPoint.replaceChildren();
  }

  private clear(): void {
    for (const [eventType, listener] of this.delegatedListeners) {
      this.mountPoint.removeEventListener(eventType, listener);
    }
    this.delegatedListeners.clear();
    this.nodes.clear();
    this.regions.clear();
    this.elementEvents.clear();
  }

  private instantiate(serialized: SerializedNode): Node {
    switch (serialized.kind) {
      case 'fragment': {
        const fragment = document.createDocumentFragment();
        for (const child of serialized.children) {
          fragment.append(this.instantiate(child));
        }
        return fragment;
      }
      case 'element': {
        const element =
          serialized.namespace === 'svg'
            ? document.createElementNS(SVG_NAMESPACE_URI, serialized.tag)
            : document.createElement(serialized.tag);
        this.nodes.set(serialized.id, element);
        this.nodeIds.set(element, serialized.id);

        for (const [name, value] of Object.entries(serialized.attrs)) {
          this.writeAttribute(element, name, value);
        }
        for (const [eventType, handlerId] of Object.entries(serialized.events)) {
          this.setEventBinding(serialized.id, eventType, handlerId);
        }
        for (const child of serialized.children) {
          element.append(this.instantiate(child));
        }
        return element;
      }
      case 'text': {
        const text = document.createTextNode(serialized.text);
        this.nodes.set(serialized.id, text);
        this.nodeIds.set(text, serialized.id);
        return text;
      }
      case 'region': {
        const fragment = document.createDocumentFragment();
        const start = document.createComment('');
        const end = document.createComment('');
        fragment.append(start);
        for (const child of serialized.children) {
          fragment.append(this.instantiate(child));
        }
        fragment.append(end);
        this.regions.set(serialized.id, { start, end });
        this.regionStarts.set(start, serialized.id);
        return fragment;
      }
    }
  }

  private applyPatch(patch: VmPatch): void {
    switch (patch.type) {
      case 'set-text': {
        const node = this.nodes.get(patch.nodeId);
        if (node) node.textContent = patch.text;
        return;
      }
      case 'set-attribute': {
        const node = this.nodes.get(patch.nodeId);
        if (node instanceof Element) this.writeAttribute(node, patch.name, patch.value);
        return;
      }
      case 'remove-attribute': {
        const node = this.nodes.get(patch.nodeId);
        if (node instanceof Element) node.removeAttribute(patch.name);
        return;
      }
      case 'set-event-binding':
        this.setEventBinding(patch.nodeId, patch.eventType, patch.handlerId);
        return;
      case 'clear-event-binding':
        this.clearEventBinding(patch.nodeId, patch.eventType);
        return;
      case 'replace-region':
        this.replaceRegion(patch.regionId, patch.children);
        return;
    }
  }

  private replaceRegion(regionId: string, children: SerializedNode[]): void {
    const region = this.regions.get(regionId);
    if (!region) return;

    let node = region.start.nextSibling;
    while (node && node !== region.end) {
      const next = node.nextSibling;
      this.teardownNode(node);
      node.remove();
      node = next;
    }

    const parent = region.end.parentNode;
    if (!parent) return;

    for (const child of children) {
      parent.insertBefore(this.instantiate(child), region.end);
    }
  }

  private teardownNode(node: Node): void {
    const nodeId = this.nodeIds.get(node);
    if (nodeId) {
      this.nodes.delete(nodeId);
      this.elementEvents.delete(nodeId);
    }
    const regionId = this.regionStarts.get(node);
    if (regionId) this.regions.delete(regionId);

    if (node instanceof Element) {
      for (const child of Array.from(node.childNodes)) {
        this.teardownNode(child);
      }
    }
  }

  private writeAttribute(element: Element, name: string, value: string | boolean): void {
    if (value === true) {
      element.setAttribute(name, '');
      return;
    }
    if (value === false) {
      element.removeAttribute(name);
      return;
    }
    element.setAttribute(name, String(value));
  }

  private setEventBinding(nodeId: string, eventType: string, handlerId: string): void {
    const bindings = this.elementEvents.get(nodeId) ?? new Map<string, string>();
    bindings.set(eventType, handlerId);
    this.elementEvents.set(nodeId, bindings);

    if (this.delegatedListeners.has(eventType)) return;

    const listener: EventListener = (event) => {
      void Promise.resolve(this.dispatchEvent(event)).catch(this.onError);
    };
    this.delegatedListeners.set(eventType, listener);
    this.mountPoint.addEventListener(eventType, listener);
  }

  private clearEventBinding(nodeId: string, eventType: string): void {
    const bindings = this.elementEvents.get(nodeId);
    bindings?.delete(eventType);
  }

  private async dispatchEvent(event: Event): Promise<void> {
    const target = event.target instanceof Node ? event.target : null;
    const targetId = this.findNodeId(target);
    let current: Node | null = target;

    while (current) {
      if (current === this.mountPoint.parentNode) break;
      const currentId = this.nodeIds.get(current);
      if (currentId) {
        const handlerId = this.elementEvents.get(currentId)?.get(event.type);
        if (handlerId) {
          await this.onEvent(
            handlerId,
            this.sanitizeEvent(event, current, currentId, target, targetId),
          );
        }
      }
      if (current === this.mountPoint) break;
      current = current.parentNode;
    }
  }

  private findNodeId(node: Node | null): string | undefined {
    let current = node;
    while (current) {
      const nodeId = this.nodeIds.get(current);
      if (nodeId) return nodeId;
      current = current.parentNode;
    }
    return undefined;
  }

  private sanitizeEvent(
    event: Event,
    currentTargetNode: Node,
    currentTargetId: string,
    targetNode: Node | null,
    targetId?: string,
  ): SandboxedEventPayload {
    const mouseEvent = event as MouseEvent;
    const keyboardEvent = event as KeyboardEvent;
    const modifierEvent = event as Event & {
      altKey?: boolean;
      ctrlKey?: boolean;
      metaKey?: boolean;
      shiftKey?: boolean;
    };
    const currentTarget = this.snapshotEventNode(currentTargetNode);
    const target = this.snapshotEventNode(targetNode);

    return {
      type: event.type,
      currentTargetId,
      ...(targetId !== undefined ? { targetId } : {}),
      ...(currentTarget ? { currentTarget } : {}),
      ...(target ? { target } : {}),
      ...(target ? { srcElement: target } : {}),
      value: target?.value ?? currentTarget?.value,
      checked: target?.checked ?? currentTarget?.checked,
      ...('key' in keyboardEvent ? { key: keyboardEvent.key } : {}),
      ...('clientX' in mouseEvent ? { clientX: mouseEvent.clientX } : {}),
      ...('clientY' in mouseEvent ? { clientY: mouseEvent.clientY } : {}),
      ...('button' in mouseEvent ? { button: mouseEvent.button } : {}),
      altKey: modifierEvent.altKey,
      ctrlKey: modifierEvent.ctrlKey,
      metaKey: modifierEvent.metaKey,
      shiftKey: modifierEvent.shiftKey,
    };
  }

  private snapshotEventNode(node: Node | null): SandboxedEventTargetSnapshot | undefined {
    const element = this.findElement(node);
    if (!element) return undefined;
    const snapshot = element as Element & { checked?: unknown; value?: unknown };
    return {
      tagName: element.tagName.toLowerCase(),
      ...(element.id ? { id: element.id } : {}),
      ...(typeof snapshot.value === 'string' ? { value: snapshot.value } : {}),
      ...(typeof snapshot.checked === 'boolean' ? { checked: snapshot.checked } : {}),
    };
  }

  private findElement(node: Node | null): Element | null {
    let current = node;
    while (current) {
      if (current instanceof Element) return current;
      current = current.parentNode;
    }
    return null;
  }
}
