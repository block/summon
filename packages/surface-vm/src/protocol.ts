// The surface-vm wire protocol.
//
// This is the single load-bearing contract of the package: a dialect-agnostic,
// capability-safe description of UI that crosses the VM->host boundary. It is a
// serialized DOM tree (`SerializedNode`) plus a small set of DOM patches
// (`VmPatch`), with events flowing back as plain-data snapshots
// (`SandboxedEventPayload`). There is intentionally NOTHING here about how the
// UI was authored (Arrow, imperative HTML/JS, anything else) — engines produce
// these messages; the host renderer consumes them.
//
// Shape is deliberately small. Do not grow `VmPatch` without a real prompt that
// proves the existing ops cannot express it. Lists are handled by
// `replace-region`, not arbitrary node insertion.
//
// Vendored and owned by Summon (originally modeled on @arrow-js/sandbox's
// shared protocol, MIT). We own it now: it is our cross-platform UI wire format.

/** A plain-data snapshot of an event target. Never a live DOM node. */
export interface SandboxedEventTargetSnapshot {
  tagName?: string;
  id?: string;
  value?: string;
  checked?: boolean;
}

/** A plain-data event delivered host -> VM. Never a live Event object. */
export interface SandboxedEventPayload {
  type: string;
  currentTargetId: string;
  targetId?: string;
  currentTarget?: SandboxedEventTargetSnapshot;
  target?: SandboxedEventTargetSnapshot;
  srcElement?: SandboxedEventTargetSnapshot;
  value?: string;
  checked?: boolean;
  key?: string;
  clientX?: number;
  clientY?: number;
  button?: number;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

export type ElementNamespace = 'svg';

// --- Serialized tree (a full render) ---------------------------------------

export interface SerializedElementNode {
  kind: 'element';
  id: string;
  tag: string;
  namespace?: ElementNamespace;
  attrs: Record<string, string | boolean>;
  events: Record<string, string>;
  children: SerializedNode[];
}

export interface SerializedTextNode {
  kind: 'text';
  id: string;
  text: string;
}

/** A stable anchor whose children can be wholesale replaced (lists, conditionals). */
export interface SerializedRegionNode {
  kind: 'region';
  id: string;
  children: SerializedNode[];
}

export interface SerializedFragmentNode {
  kind: 'fragment';
  children: SerializedNode[];
}

export type SerializedNode =
  | SerializedFragmentNode
  | SerializedElementNode
  | SerializedTextNode
  | SerializedRegionNode;

// --- Patches (incremental updates) -----------------------------------------
//
// The complete vocabulary. Six ops. Hold this line.

export type VmPatch =
  | { type: 'set-text'; nodeId: string; text: string }
  | { type: 'set-attribute'; nodeId: string; name: string; value: string | boolean }
  | { type: 'remove-attribute'; nodeId: string; name: string }
  | { type: 'set-event-binding'; nodeId: string; eventType: string; handlerId: string }
  | { type: 'clear-event-binding'; nodeId: string; eventType: string }
  | { type: 'replace-region'; regionId: string; children: SerializedNode[] };

// --- Messages --------------------------------------------------------------

export interface VmInitPayload {
  entryPath: string;
  debug?: boolean;
}

export type HostToVmMessage =
  | { type: 'init'; payload: VmInitPayload }
  | { type: 'event'; payload: { handlerId: string; event: SandboxedEventPayload } }
  // Host pushes new surface state; the VM stores it and notifies onState listeners.
  | { type: 'state'; state: Record<string, unknown> }
  | { type: 'destroy' };

/**
 * Host-side implementation of the capability bridge. The VM calls tools by name
 * with plain-data args and awaits a plain-data result. This is the ONLY inbound
 * authority channel — keep it small, validate args/results as plain data.
 */
export type HostBridge = (tool: string, args: Record<string, unknown>) => unknown | Promise<unknown>;

export type VmToHostMessage =
  | { type: 'ready' }
  | { type: 'render'; tree: SerializedNode }
  | { type: 'patch'; patches: VmPatch[] }
  | { type: 'error'; error: string }
  | { type: 'output'; payload: unknown };
