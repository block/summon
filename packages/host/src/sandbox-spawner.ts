import type { EventStore } from '@summon-internal/devtools';
import { hasCompleteResourceStateKeys, type ValidationCapability } from '@summon-internal/engine';
import type {
  ArrowNetworkPolicy,
  ArrowSurfaceArtifact,
  Artifact,
  ComponentIslandDescriptor,
  SandboxHandle,
  SandboxInboundMessage,
} from './types.js';

/**
 * CSP applied inside every Summon sandbox. Scripts are nonce-authorized trusted
 * bootstrap/resource scripts only; generated artifact HTML arrives after
 * SUMMON_READY and never receives a script nonce. Generated CSS remains inline
 * because the compiler constrains it and visual richness is a core Summon goal.
 */
function cspForNonce(nonce: string, networkPolicy: ArrowNetworkPolicy = 'none'): string {
  const connectSrc = networkPolicy === 'restricted-fetch'
    ? 'connect-src https: http://localhost:* http://127.0.0.1:* http://[::1]:*'
    : "connect-src 'none'";
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' 'wasm-unsafe-eval'`,
    "style-src 'unsafe-inline'",
    "img-src data:",
    "font-src data:",
    connectSrc,
    "form-action 'none'",
    "base-uri 'none'",
    "frame-src 'none'",
    "child-src 'none'",
    "media-src 'none'",
    "object-src 'none'",
    "worker-src 'none'",
  ].join('; ');
}

export interface SpawnOptions {
  iframe: HTMLIFrameElement;
  artifact: Artifact;
  /**
   * Host-controlled allowlist of intents this sandbox may emit. The bridge
   * enforces it; anything else is rejected before reaching `onIntent`.
   *
   * This is required even for static/read-only surfaces. Pass `[]` when the
   * host grants no executable intents. `artifact.intents` is advisory only and
   * never becomes executable authority.
   */
  grantedIntents: string[];
  /**
   * Host-controlled capability grant metadata. Used by the sandbox runtime
   * only to resolve declarative resource aliases to host-owned state keys.
   * Intent execution remains governed solely by `grantedIntents`.
   */
  grantedCapabilities?: ValidationCapability[];
  /** Raw bootstrap source; published consumers can use `@anarchitecture/summon/assets`. */
  bootstrapSource: string;
  /** Raw token CSS source; published consumers can use `@anarchitecture/summon/assets`. */
  tokensSource: string;
  /**
   * Optional trusted Arrow runtime bundle. It must install
   * `window.__SUMMON_ARROW_SANDBOX__ = { sandbox }` inside the iframe before
   * the Summon Arrow adapter receives an artifact.
   */
  arrowRuntimeSource?: string;
  /**
   * Host-owned network grant for Arrow sandboxes. Defaults to `none`; do not
   * derive this from generated artifact metadata.
   */
  arrowNetworkPolicy?: ArrowNetworkPolicy;
  /** Receives only intents that passed the bridge allowlist. */
  onIntent?: (intent: string, args: Record<string, unknown>) =>
    | void
    | Record<string, unknown>
    | Promise<void | Record<string, unknown>>;
  /** Receives intents that were rejected by the allowlist. Useful for logging / tests. */
  onIntentRejected?: (reason: string, raw: unknown) => void;
  /** Receives sandbox-measured component island placeholders. */
  onComponents?: (components: ComponentIslandDescriptor[], sandboxId: string) => void;
  /**
   * Fires when bootstrap's startup self-test rejects its own sandbox. The
   * iframe has already been disposed by the time this is called; treat the
   * spawn as failed and surface the reason.
   */
  onSandboxFatal?: (reason: string) => void;
  /**
   * Optional devtools event store. When set, the spawner pushes lifecycle and
   * intent-bridge events into it (sandbox-spawned/ready/fatal/disposed,
   * intent-emitted/rejected, render). Behavior is identical when omitted.
   */
  events?: EventStore;
}

/** Cryptographically-random per-sandbox id. Bound into postMessage payloads. */
function randomSandboxId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function buildSrcdoc(params: {
  sandboxId: string;
  scriptNonce: string;
  bootstrapSource: string;
  tokensSource: string;
  resourceMap: ResourceMap;
  networkPolicy: ArrowNetworkPolicy;
  arrowRuntimeSource?: string;
}): string {
  // The CSP meta must come FIRST in <head> — anything before it is unprotected.
  // Artifact HTML is deliberately absent from initial srcdoc. The trusted
  // bootstrap sends SUMMON_READY, then the host queues the compiled render
  // through SUMMON_RENDER.
  //
  // The base style block is emitted BEFORE the direction's tokensSource so
  // directions can override Summon's generic motion helpers.
  return `<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(cspForNonce(params.scriptNonce, params.networkPolicy))}">
<meta charset="utf-8">
<script nonce="${params.scriptNonce}">window.__SUMMON_SANDBOX_ID__=${escapeScriptJson(params.sandboxId)};</script>
<script nonce="${params.scriptNonce}">window.__SUMMON_RESOURCES__=${escapeScriptJson(params.resourceMap)};</script>
<script nonce="${params.scriptNonce}">window.__SUMMON_NETWORK_POLICY__=${escapeScriptJson(params.networkPolicy)};</script>
${params.arrowRuntimeSource ? `<script nonce="${params.scriptNonce}">${params.arrowRuntimeSource}</script>` : ''}
<script nonce="${params.scriptNonce}">${params.bootstrapSource}</script>
<style>${SUMMON_BASE_CSS}</style>
<style>${params.tokensSource}</style>
</head>
<body>
<div id="summon-root"></div>
<script nonce="${params.scriptNonce}">window.__SUMMON_SIGNAL_READY__?.();</script>
</body>
</html>`;
}

const SUMMON_BASE_CSS = `
.summon-motion-enter-rise {
  animation: summon-motion-rise 0.34s cubic-bezier(0.33, 1, 0.68, 1) both;
}
.summon-motion-enter-fade {
  animation: summon-motion-fade 0.24s ease-out both;
}
.summon-motion-enter-fade-slide {
  animation: summon-motion-fade-slide 0.32s cubic-bezier(0.33, 1, 0.68, 1) both;
}
.summon-motion-enter-pop {
  animation: summon-motion-pop 0.28s cubic-bezier(0.2, 0.9, 0.2, 1.2) both;
}
.summon-motion-update-pulse {
  animation: summon-motion-pulse 0.46s ease-out both;
}
.summon-motion-update-fade {
  animation: summon-motion-update-fade 0.28s ease-out both;
}
.summon-motion-update-pop {
  animation: summon-motion-pop 0.24s cubic-bezier(0.2, 0.9, 0.2, 1.2) both;
}
.summon-transition-fade,
.summon-transition-rise,
.summon-transition-fade-slide,
.summon-transition-pop {
  transition:
    opacity 0.18s ease-out,
    filter 0.18s ease-out,
    transform 0.18s ease-out,
    box-shadow 0.18s ease-out;
}
@keyframes summon-motion-rise {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes summon-motion-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes summon-motion-fade-slide {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes summon-motion-pop {
  from { opacity: 0; transform: scale(0.985); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes summon-motion-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(80, 112, 255, 0); }
  35%  { box-shadow: 0 0 0 3px rgba(80, 112, 255, 0.16); }
  100% { box-shadow: 0 0 0 0 rgba(80, 112, 255, 0); }
}
@keyframes summon-motion-update-fade {
  0%   { opacity: 0.72; }
  100% { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .summon-motion-enter-rise,
  .summon-motion-enter-fade,
  .summon-motion-enter-fade-slide,
  .summon-motion-enter-pop,
  .summon-motion-update-pulse,
  .summon-motion-update-fade,
  .summon-motion-update-pop {
    animation: none;
  }
  .summon-transition-fade,
  .summon-transition-rise,
  .summon-transition-fade-slide,
  .summon-transition-pop {
    transition: none;
  }
  .summon-motion-enter-rise,
  .summon-motion-enter-fade-slide,
  .summon-motion-enter-pop {
    opacity: 1;
    filter: none;
    transform: none;
  }
}
`;

interface ResourceMapEntry {
  stateKeys: {
    loading: string;
    data: string;
    error: string;
    empty?: string;
  };
}

type ResourceMap = Record<string, ResourceMapEntry>;

function resourceMapFromCapabilities(capabilities: ValidationCapability[] | undefined): ResourceMap {
  const out: ResourceMap = {};
  for (const capability of capabilities ?? []) {
    if (capability.kind !== 'resource') continue;
    if (!hasCompleteResourceStateKeys(capability.stateKeys)) continue;
    out[capability.name] = {
      stateKeys: {
        loading: capability.stateKeys.loading,
        data: capability.stateKeys.data,
        error: capability.stateKeys.error,
        ...(capability.stateKeys.empty ? { empty: capability.stateKeys.empty } : {}),
      },
    };
  }
  return out;
}

function normalizeComponentDescriptors(raw: unknown): ComponentIslandDescriptor[] {
  if (!Array.isArray(raw)) return [];
  const out: ComponentIslandDescriptor[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.id !== 'string' || typeof obj.name !== 'string') continue;
    const bounds = obj.bounds;
    if (!bounds || typeof bounds !== 'object') continue;
    const b = bounds as Record<string, unknown>;
    if (
      typeof b.x !== 'number' ||
      typeof b.y !== 'number' ||
      typeof b.width !== 'number' ||
      typeof b.height !== 'number' ||
      !Number.isFinite(b.x) ||
      !Number.isFinite(b.y) ||
      !Number.isFinite(b.width) ||
      !Number.isFinite(b.height)
    ) {
      continue;
    }
    const props = obj.props && typeof obj.props === 'object' && !Array.isArray(obj.props)
      ? obj.props as Record<string, unknown>
      : {};
    out.push({
      id: obj.id,
      name: obj.name,
      props,
      bounds: {
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
      },
    });
    if (out.length >= 64) break;
  }
  return out;
}

export function spawnSandbox(opts: SpawnOptions): SandboxHandle {
  const sandboxId = randomSandboxId();
  const scriptNonce = randomSandboxId();
  // Bridge allowlist comes only from the host grant. A JS caller that omits
  // grantedIntents fails closed because `new Set(undefined)` grants nothing.
  const intentAllowlist = new Set(opts.grantedIntents);
  const grantedCapabilities = opts.grantedCapabilities ?? opts.artifact.capabilities ?? [];
  const resourceMap = resourceMapFromCapabilities(grantedCapabilities);
  const arrowNetworkPolicy = opts.arrowNetworkPolicy ?? 'none';

  // Deliberately NOT adding allow-same-origin. That keeps the iframe null-origin:
  // no storage, no parent DOM access, cross-origin isolation applies.
  opts.iframe.setAttribute('sandbox', 'allow-scripts');

  let ready = false;
  const pendingStates: Record<string, unknown>[] = [];
  const pendingDomOps: Array<{ kind: 'artifact'; artifact: ArrowSurfaceArtifact }> = [];
  // Chrome attributes are merged before flush so a flurry of setChrome calls
  // pre-ready collapses into a single postMessage. Post-ready, each setChrome
  // call dispatches immediately.
  const pendingChrome: Record<string, string> = {};
  let hasPendingChrome = false;

  function flushPending() {
    if (!ready || !opts.iframe.contentWindow) return;
    if (hasPendingChrome) {
      opts.iframe.contentWindow.postMessage(
        { type: 'SUMMON_CHROME', sandbox_id: sandboxId, attrs: { ...pendingChrome } },
        '*'
      );
      for (const k of Object.keys(pendingChrome)) delete pendingChrome[k];
      hasPendingChrome = false;
    }
    while (pendingStates.length > 0) {
      const state = pendingStates.shift()!;
      opts.iframe.contentWindow.postMessage({ type: 'SUMMON_STATE', sandbox_id: sandboxId, state }, '*');
    }
    while (pendingDomOps.length > 0) {
      const op = pendingDomOps.shift()!;
      opts.iframe.contentWindow.postMessage({ type: 'SUMMON_RENDER', sandbox_id: sandboxId, artifact: op.artifact }, '*');
    }
  }

  function postIntentResult(requestId: string | undefined, result: {
    ok: boolean;
    state?: Record<string, unknown>;
    error?: string;
  }) {
    if (!requestId || !opts.iframe.contentWindow) return;
    opts.iframe.contentWindow.postMessage({
      type: 'SUMMON_INTENT_RESULT',
      sandbox_id: sandboxId,
      request_id: requestId,
      ok: result.ok,
      state: result.state ?? {},
      ...(result.error ? { error: result.error } : {}),
    }, '*');
  }

  function handleMessage(event: MessageEvent) {
    const data = event.data as SandboxInboundMessage | undefined;
    if (!data || typeof data !== 'object') return;

    // Filter ambient browser noise (Vite HMR, devtools, extensions, other
    // iframes). The handler is bound to `window` so it sees every postMessage
    // delivered to the host page — only those claiming to speak the Summon
    // protocol should reach the sandbox_id gate below.
    if (
      data.type !== 'SUMMON_INTENT' &&
      data.type !== 'SUMMON_READY' &&
      data.type !== 'SUMMON_RENDERED' &&
      data.type !== 'SUMMON_FATAL' &&
      data.type !== 'SUMMON_COMPONENTS'
    ) {
      return;
    }

    // sandbox_id is the authoritative binding: a 128-bit random nonce generated
    // per spawn, injected into this iframe's srcdoc, and scrubbed from window
    // scope immediately after bootstrap reads it. A foreign frame cannot post a
    // valid message without it.
    //
    // We deliberately do NOT gate on event.source. Browsers vary on what
    // event.source reports for messages originating inside a null-origin
    // sandboxed iframe — WebKit has been observed to report `window` rather
    // than `iframe.contentWindow` — and the nonce is the real boundary
    // regardless of which window object the runtime hands us.
    //
    // A nonce miss is silently dropped rather than reported as a rejection.
    // The listener is bound to `window`, so on a page with multiple sandboxes
    // every listener sees every sibling's messages. Those aren't this
    // sandbox's intents to validate — they're not addressed to it. Reserving
    // onIntentRejected for messages that *do* claim this sandbox's identity
    // (and fail later checks) keeps the rejection signal meaningful.
    if (data.sandbox_id !== sandboxId) {
      return;
    }

    if (data.type === 'SUMMON_FATAL') {
      // Bootstrap's self-test failed. Tear down: never set ready, never push
      // state, never deliver intents. The sandbox is structurally unsound.
      const reason = typeof data.reason === 'string' ? data.reason : 'unknown';
      window.removeEventListener('message', handleMessage);
      opts.iframe.srcdoc = '';
      ready = false;
      opts.events?.push({ kind: 'sandbox-fatal', at: Date.now(), sandboxId, reason });
      opts.onSandboxFatal?.(reason);
      return;
    }

    if (data.type === 'SUMMON_READY') {
      ready = true;
      if (opts.artifact.initialState) {
        pendingStates.unshift(opts.artifact.initialState);
      }
      opts.events?.push({ kind: 'sandbox-ready', at: Date.now(), sandboxId });
      flushPending();
      return;
    }

    if (data.type === 'SUMMON_RENDERED') {
      opts.events?.push({
        kind: 'rendered',
        at: Date.now(),
        sandboxId,
        revision: typeof data.revision === 'number' ? data.revision : 0,
      });
      return;
    }

    if (data.type === 'SUMMON_COMPONENTS') {
      const components = normalizeComponentDescriptors(data.components);
      opts.events?.push({
        kind: 'component-sync',
        at: Date.now(),
        sandboxId,
        components: components.map((component) => ({
          id: component.id,
          name: component.name,
          width: component.bounds.width,
          height: component.bounds.height,
        })),
      });
      opts.onComponents?.(components, sandboxId);
      return;
    }

    if (data.type === 'SUMMON_INTENT') {
      const { intent, args } = data;
      if (typeof intent !== 'string' || !intent) {
        opts.events?.push({
          kind: 'intent-rejected',
          at: Date.now(),
          sandboxId,
          reason: 'intent not a non-empty string',
          raw: data,
        });
        opts.onIntentRejected?.('intent not a non-empty string', data);
        postIntentResult(data.request_id, { ok: false, error: 'intent not a non-empty string' });
        return;
      }
      if (!intentAllowlist.has(intent)) {
        opts.events?.push({
          kind: 'intent-rejected',
          at: Date.now(),
          sandboxId,
          reason: `intent "${intent}" not granted`,
          raw: data,
        });
        opts.onIntentRejected?.(`intent "${intent}" not granted`, data);
        postIntentResult(data.request_id, { ok: false, error: `intent "${intent}" not granted` });
        return;
      }
      const safeArgs =
        args && typeof args === 'object' ? (args as Record<string, unknown>) : {};
      opts.events?.push({
        kind: 'intent-emitted',
        at: Date.now(),
        sandboxId,
        intent,
        args: safeArgs,
      });
      void Promise.resolve(opts.onIntent?.(intent, safeArgs))
        .then((state) => {
          postIntentResult(data.request_id, {
            ok: true,
            state: state && typeof state === 'object' && !Array.isArray(state) ? state : {},
          });
        })
        .catch((err) => {
          const error = err instanceof Error ? err.message : String(err);
          postIntentResult(data.request_id, { ok: false, error });
        });
    }
  }

  window.addEventListener('message', handleMessage);

  opts.iframe.srcdoc = buildSrcdoc({
    sandboxId,
    scriptNonce,
    bootstrapSource: opts.bootstrapSource,
    tokensSource: opts.tokensSource,
    resourceMap,
    networkPolicy: arrowNetworkPolicy,
    arrowRuntimeSource: opts.arrowRuntimeSource,
  });
  if (opts.artifact.arrow) {
    pendingDomOps.push({ kind: 'artifact', artifact: opts.artifact.arrow });
  }

  opts.events?.push({
    kind: 'sandbox-spawned',
    at: Date.now(),
    sandboxId,
    grantedIntents: Array.from(intentAllowlist),
    artifactCapabilities: opts.artifact.capabilities,
    grantedCapabilities,
  });

  return {
    sandboxId,
    iframe: opts.iframe,
    pushState(state) {
      pendingStates.push(state);
      flushPending();
    },
    renderArtifact(artifact) {
      pendingDomOps.push({ kind: 'artifact', artifact });
      opts.events?.push({
        kind: 'render',
        at: Date.now(),
        sandboxId,
        bytes: JSON.stringify(artifact.source).length,
      });
      flushPending();
    },
    setChrome(attrs) {
      // Validate keys defensively. We get away with `unsafe-inline` everywhere
      // else because the iframe is null-origin, but `data-summon-<key>` is
      // host-controlled — keep it boring.
      for (const [k, v] of Object.entries(attrs)) {
        if (!/^[a-z][a-z0-9-]*$/.test(k)) continue;
        pendingChrome[k] = String(v);
        hasPendingChrome = true;
      }
      flushPending();
    },
    dispose() {
      window.removeEventListener('message', handleMessage);
      opts.iframe.srcdoc = '';
      ready = false;
      opts.events?.push({ kind: 'sandbox-disposed', at: Date.now(), sandboxId });
    },
  };
}
