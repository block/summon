/**
 * Devtools event vocabulary. Every interesting boundary in summon emits one of
 * these so a panel can reconstruct what happened: which sandbox spawned, what
 * intents the artifact tried, which were rejected at the bridge, which made it
 * to the policy engine, what state was pushed back, what the LLM streamed.
 *
 * Events are append-only. Producers should treat the EventStore as fire-and-
 * forget — if no store is wired in, the host code paths run unchanged.
 */

export interface BaseEvent {
  /** ms since epoch. */
  at: number;
  /**
   * Identifies which sandbox this event belongs to when applicable. Omitted for
   * events that aren't scoped to a sandbox (e.g. streaming protocol parsing
   * happens before any sandbox exists).
   */
  sandboxId?: string;
}

/** A sandbox iframe was spawned with the given grant. */
export interface SandboxSpawnedEvent extends BaseEvent {
  kind: 'sandbox-spawned';
  sandboxId: string;
  grantedIntents: string[];
  artifactCapabilities?: unknown[];
  grantedCapabilities?: unknown[];
}

/** Bootstrap inside the iframe finished its self-test and signaled READY. */
export interface SandboxReadyEvent extends BaseEvent {
  kind: 'sandbox-ready';
  sandboxId: string;
}

/** Bootstrap rejected its own sandbox; the iframe has been torn down. */
export interface SandboxFatalEvent extends BaseEvent {
  kind: 'sandbox-fatal';
  sandboxId: string;
  reason: string;
}

/** Host called dispose() on the sandbox handle. */
export interface SandboxDisposedEvent extends BaseEvent {
  kind: 'sandbox-disposed';
  sandboxId: string;
}

/** An intent passed the bridge allowlist. Args are the (still-unvalidated) bag from the sandbox. */
export interface IntentEmittedEvent extends BaseEvent {
  kind: 'intent-emitted';
  sandboxId: string;
  intent: string;
  args: Record<string, unknown>;
}

/** The bridge rejected a postMessage that claimed this sandbox's identity. */
export interface IntentRejectedEvent extends BaseEvent {
  kind: 'intent-rejected';
  sandboxId: string;
  reason: string;
  raw: unknown;
}

/** Policy engine started running a handler. `id` matches the settled event. */
export interface IntentDispatchedEvent extends BaseEvent {
  kind: 'intent-dispatched';
  id: string;
  intent: string;
  args: unknown;
}

/** Policy engine finished a handler (success or thrown error). */
export interface IntentSettledEvent extends BaseEvent {
  kind: 'intent-settled';
  id: string;
  intent: string;
  ok: boolean;
  error?: string;
  durationMs: number;
}

/** Host pushed a state patch into the sandbox (from a handler, timer, server event, …). */
export interface StatePushedEvent extends BaseEvent {
  kind: 'state-pushed';
  patch: Record<string, unknown>;
  next: Record<string, unknown>;
}

/** A streaming protocol line was successfully parsed. */
export interface ProtocolLineEvent extends BaseEvent {
  kind: 'protocol-line';
  line: { op: 'add' | 'set' | 'meta'; path: string; html?: string; value?: unknown };
}

/** A line in the LLM stream did not parse as a protocol line. */
export interface ProtocolParseErrorEvent extends BaseEvent {
  kind: 'protocol-parse-error';
  raw: string;
}

/** Streaming session boundary. */
export interface StreamLifecycleEvent extends BaseEvent {
  kind: 'stream-lifecycle';
  phase: 'start' | 'end';
  ok?: boolean;
}

export interface StreamGraphEvent extends BaseEvent {
  kind: 'stream-graph';
  health: {
    complete: boolean;
    missingDeclared: string[];
    undeclaredPresent: string[];
    skippedCount: number;
    blockedCount: number;
    repairedCount: number;
  };
  sections: Array<{
    id: string;
    declared: boolean;
    present: boolean;
    revision: number;
    bytes: number;
  }>;
}

export interface SurfacePlanEvent extends BaseEvent {
  kind: 'surface-plan';
  plan: {
    purpose: string;
    runtime: string;
    data: string;
    authority: string;
    persistence: string;
  };
}

/** Host pushed full HTML into the sandbox via SUMMON_RENDER. */
export interface RenderEvent extends BaseEvent {
  kind: 'render';
  sandboxId: string;
  /** byte length of the html payload — full text is omitted to keep the ring buffer small. */
  bytes: number;
}

export interface ComponentSyncEvent extends BaseEvent {
  kind: 'component-sync';
  sandboxId: string;
  components: Array<{
    id: string;
    name: string;
    width: number;
    height: number;
  }>;
}

export interface ComponentErrorEvent extends BaseEvent {
  kind: 'component-error';
  code?: 'bounds-invalid' | 'unknown-component' | 'props-invalid' | 'registry-missing';
  sandboxId?: string;
  componentId?: string;
  componentName?: string;
  reason: string;
}

export type DevtoolsEvent =
  | SandboxSpawnedEvent
  | SandboxReadyEvent
  | SandboxFatalEvent
  | SandboxDisposedEvent
  | IntentEmittedEvent
  | IntentRejectedEvent
  | IntentDispatchedEvent
  | IntentSettledEvent
  | StatePushedEvent
  | ProtocolLineEvent
  | ProtocolParseErrorEvent
  | StreamLifecycleEvent
  | StreamGraphEvent
  | SurfacePlanEvent
  | RenderEvent
  | ComponentSyncEvent
  | ComponentErrorEvent;

export type DevtoolsEventKind = DevtoolsEvent['kind'];
