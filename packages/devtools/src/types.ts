/**
 * Devtools event vocabulary. Every interesting boundary in summon emits one of
 * these so a panel can reconstruct what happened: which surface mounted, what
 * tools the artifact tried, which were rejected at the bridge, which made it
 * to the policy engine, what state was pushed back, and what the server streamed.
 *
 * Events are append-only. Producers should treat the EventStore as fire-and-
 * forget — if no store is wired in, the host code paths run unchanged.
 */

export interface BaseEvent {
  /** ms since epoch. */
  at: number;
  /**
   * Identifies which surface this event belongs to when applicable. Omitted for
   * events that are not scoped to a mounted surface.
   */
  surfaceId?: string;
}

/** An inline surface was mounted with the given grant. */
export interface SurfaceMountedEvent extends BaseEvent {
  kind: 'surface-mounted';
  surfaceId: string;
  grantedTools: string[];
  validationTools?: unknown[];
}

/** Surface runtime reported a mount/runtime error. */
export interface SurfaceRuntimeErrorEvent extends BaseEvent {
  kind: 'surface-runtime-error';
  surfaceId: string;
  reason: string;
}

/** Host called dispose() on the inline surface handle. */
export interface SurfaceDisposedEvent extends BaseEvent {
  kind: 'surface-disposed';
  surfaceId: string;
}

/** Host-owned preview accepted and rendered a semantic event. */
export interface SurfacePreviewEvent extends BaseEvent {
  kind: 'surface-preview-event';
  surfaceId: string;
  event: unknown;
}

/** A tool passed the bridge allowlist. Args are the still-unvalidated generated bag. */
export interface ToolCalledEvent extends BaseEvent {
  kind: 'tool-called';
  surfaceId?: string;
  tool: string;
  args: Record<string, unknown>;
}

/** The bridge rejected an invalid or ungranted tool request. */
export interface ToolRejectedEvent extends BaseEvent {
  kind: 'tool-rejected';
  surfaceId?: string;
  reason: string;
  raw: unknown;
}

/** Policy engine started running a handler. `id` matches the settled event. */
export interface ToolDispatchedEvent extends BaseEvent {
  kind: 'tool-dispatched';
  id: string;
  tool: string;
  args: unknown;
}

/** Policy engine finished a handler (success or thrown error). */
export interface ToolSettledEvent extends BaseEvent {
  kind: 'tool-settled';
  id: string;
  tool: string;
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

/** A server-owned stream line was successfully parsed. */
export interface ServerLineEvent extends BaseEvent {
  kind: 'server-line';
  line: { op: 'meta' | 'event' | 'artifact' | 'patch'; path: string; value?: unknown };
}

/** A server transport line did not parse as a stream line. */
export interface TransportParseErrorEvent extends BaseEvent {
  kind: 'transport-parse-error';
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
    warningCount: number;
    blockedCount: number;
  };
  artifacts: Array<{
    revision: number;
    runtime: 'arrow' | 'html';
    bytes: number;
    firstSeenLine?: number;
    lastUpdatedLine?: number;
  }>;
  preview?: {
    events: {
      count: number;
      firstSeenLine?: number;
      lastUpdatedLine?: number;
      lastType?: string;
    };
    lastStatus?: string;
    lastStatusText?: string;
  };
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

export interface SurfaceContractEvent extends BaseEvent {
  kind: 'surface-contract';
  contract: {
    surface?: unknown;
    tools?: unknown[];
    layout?: unknown;
    issues?: unknown[];
  };
}

/** Host pushed an artifact into the inline surface runtime. */
export interface RenderEvent extends BaseEvent {
  kind: 'render';
  surfaceId: string;
  /** Approximate byte length of the artifact payload. */
  bytes: number;
}

/** The inline surface runtime finished mounting the latest artifact. */
export interface RenderedEvent extends BaseEvent {
  kind: 'rendered';
  surfaceId: string;
  revision: number;
}

export type DevtoolsEvent =
  | SurfaceMountedEvent
  | SurfaceRuntimeErrorEvent
  | SurfaceDisposedEvent
  | SurfacePreviewEvent
  | ToolCalledEvent
  | ToolRejectedEvent
  | ToolDispatchedEvent
  | ToolSettledEvent
  | StatePushedEvent
  | ServerLineEvent
  | TransportParseErrorEvent
  | StreamLifecycleEvent
  | StreamGraphEvent
  | SurfacePlanEvent
  | SurfaceContractEvent
  | RenderEvent
  | RenderedEvent;

export type DevtoolsEventKind = DevtoolsEvent['kind'];
