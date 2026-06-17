import type {
  ArrowNetworkPolicy,
  ArrowSurfaceArtifact,
  ValidationTool,
  ValidationComponent,
} from '@summon-internal/engine';

export type {
  ArrowNetworkPolicy,
  ArrowSurfaceArtifact,
} from '@summon-internal/engine';

/** Messages from host into the sandbox iframe. */
export interface StateMessage {
  type: 'SUMMON_STATE';
  sandbox_id: string;
  state: Record<string, unknown>;
}

export interface RenderMessage {
  type: 'SUMMON_RENDER';
  sandbox_id: string;
  artifact?: ArrowSurfaceArtifact;
}

/** Messages from the sandbox iframe back to the host. */
export interface ToolCallMessage {
  type: 'SUMMON_TOOL_CALL';
  sandbox_id: string;
  tool: string;
  args: Record<string, unknown>;
  request_id?: string;
}

export interface ToolResultMessage {
  type: 'SUMMON_TOOL_RESULT';
  sandbox_id: string;
  request_id: string;
  ok: boolean;
  state: Record<string, unknown>;
  error?: string;
}

export interface ComponentIslandBounds {
  /** Sandbox-relative left, in CSS px. */
  x: number;
  /** Sandbox-relative top, in CSS px. */
  y: number;
  width: number;
  height: number;
}

export interface ComponentIslandDescriptor {
  id: string;
  name: string;
  props: Record<string, unknown>;
  bounds: ComponentIslandBounds;
}

export interface ComponentsMessage {
  type: 'SUMMON_COMPONENTS';
  sandbox_id: string;
  components: ComponentIslandDescriptor[];
}

export interface ReadyMessage {
  type: 'SUMMON_READY';
  sandbox_id: string;
}

export interface RenderedMessage {
  type: 'SUMMON_RENDERED';
  sandbox_id: string;
  revision: number;
}

/**
 * Sent by bootstrap when its startup self-test detects the sandbox is not
 * configured the way Summon requires (e.g. someone added `allow-same-origin`,
 * CSP got stripped, the iframe is reachable from the artifact's top window).
 * The host should treat the sandbox as unusable: dispose the iframe, do not
 * push state, and surface the failure for diagnostics.
 */
export interface FatalMessage {
  type: 'SUMMON_FATAL';
  sandbox_id: string;
  reason: string;
}

export type SandboxInboundMessage =
  | ToolCallMessage
  | ReadyMessage
  | RenderedMessage
  | FatalMessage
  | ComponentsMessage;

/** A spawned sandbox instance. */
export interface SandboxHandle {
  sandboxId: string;
  iframe: HTMLIFrameElement;
  /** Push new state into the sandbox. Replaces current state on the sandbox side. */
  pushState(state: Record<string, unknown>): void;
  /** Replace the Arrow source artifact inside #summon-root. */
  renderArtifact(artifact: ArrowSurfaceArtifact): void;
  /** Tear down the sandbox: removes listeners, clears srcdoc. */
  dispose(): void;
}

/** Artifact — generated HTML plus advisory declarations used for diagnostics and replay. */
export interface Artifact {
  runtime?: 'arrow';
  /** Tools the artifact declares it may emit. Execution is governed by host grants. */
  tools: string[];
  /** Advisory validation metadata for tools the artifact claims to use. */
  validationTools?: ValidationTool[];
  /** Advisory components the artifact claims to use. Host registry remains the rendering grant. */
  components?: ValidationComponent[];
  /** Arrow source artifact to render inside the sandbox. */
  arrow?: ArrowSurfaceArtifact;
  /** Optional initial state pushed after SANDBOX_READY. */
  initialState?: Record<string, unknown>;
}
