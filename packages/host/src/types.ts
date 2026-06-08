import type { ValidationCapability, ValidationComponent } from '@summon/engine';

/** Messages from host into the sandbox iframe. */
export interface StateMessage {
  type: 'SUMMON_STATE';
  state: Record<string, unknown>;
}

/**
 * Host → iframe declaration of chrome attributes the artifact's CSS may
 * target. Each entry becomes `<html data-summon-<key>="<value>">` inside the
 * sandbox document, set before any artifact CSS evaluates against it (or
 * applied live mid-stream via `setChrome`). Used for orthogonal axes the
 * artifact shouldn't author itself — posture, theme, density.
 *
 * The host decides the keys; the iframe just mirrors them. Keys must be
 * lowercase ASCII (kebab-case allowed); values are coerced to strings.
 */
export interface ChromeMessage {
  type: 'SUMMON_CHROME';
  sandbox_id: string;
  attrs: Record<string, string>;
}

/** Messages from the sandbox iframe back to the host. */
export interface IntentMessage {
  type: 'SUMMON_INTENT';
  sandbox_id: string;
  intent: string;
  args: Record<string, unknown>;
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

export type SandboxInboundMessage = IntentMessage | ReadyMessage | FatalMessage | ComponentsMessage;

/** A spawned sandbox instance. */
export interface SandboxHandle {
  sandboxId: string;
  iframe: HTMLIFrameElement;
  /** Push new state into the sandbox. Replaces current state on the sandbox side. */
  pushState(state: Record<string, unknown>): void;
  /** Replace the HTML inside #summon-root. Scripts in the new HTML will execute. */
  render(html: string): void;
  /**
   * Declare chrome attributes that should appear on the sandbox document's
   * `<html>` element. Each entry becomes `data-summon-<key>="<value>"` and is
   * applied live — including before the first render — so artifact CSS can
   * target e.g. `[data-summon-posture="tap"]` without round-trips. Calls are
   * additive: keys present in a previous call but absent from the new one
   * are left in place. Pass an empty string to clear a key explicitly.
   */
  setChrome(attrs: Record<string, string>): void;
  /** Tear down the sandbox: removes listeners, clears srcdoc. */
  dispose(): void;
}

/** Artifact — for MVP this is just a blob of HTML plus a declared intent vocabulary. */
export interface Artifact {
  /** Intents the artifact is allowed to emit. Unknown intents are rejected at the bridge. */
  intents: string[];
  /** Advisory capabilities the artifact claims to use. Execution is still governed by grants. */
  capabilities?: ValidationCapability[];
  /** Advisory components the artifact claims to use. Host registry remains the rendering grant. */
  components?: ValidationComponent[];
  /** Full HTML body to render inside the sandbox. */
  html: string;
  /** Optional initial state pushed after SANDBOX_READY. */
  initialState?: Record<string, unknown>;
}
