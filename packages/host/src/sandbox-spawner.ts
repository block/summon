import type { EventStore } from '@summon-internal/devtools';
import { hasCompleteResourceStateKeys, type ValidationCapability } from '@summon-internal/engine';
import type {
  Artifact,
  ComponentIslandDescriptor,
  HtmlNodePatch,
  SandboxHandle,
  SandboxInboundMessage,
} from './types.js';

/**
 * CSP applied inside every Summon sandbox. `'unsafe-inline'` for scripts is safe here
 * because (a) the iframe is null-origin via sandbox="allow-scripts", so there is no
 * trusted origin for a script to abuse, and (b) `connect-src 'none'` prevents any
 * outbound network. What runs inline has nowhere to exfiltrate to and no parent
 * DOM to touch.
 */
const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "font-src data:",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "worker-src 'none'",
].join('; ');

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
  /** Receives only intents that passed the bridge allowlist. */
  onIntent?: (intent: string, args: Record<string, unknown>) => void;
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

function buildSrcdoc(params: {
  sandboxId: string;
  bootstrapSource: string;
  tokensSource: string;
  bodyHtml: string;
  resourceMap: ResourceMap;
}): string {
  // The CSP meta must come FIRST in <head> — anything before it is unprotected.
  // Artifact HTML always renders inside #summon-root so the bootstrap can swap
  // content post-spawn via SUMMON_RENDER messages without touching bootstrap or
  // tokens.
  //
  // The base style block (entrance animation for live-paint sections) is
  // emitted BEFORE the direction's tokensSource so directions can override —
  // e.g., a direction wanting no decorative motion can redeclare the
  // `[data-summon-section]` rule with `animation: none`.
  return `<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(CSP)}">
<meta charset="utf-8">
<script>window.__SUMMON_SANDBOX_ID__=${JSON.stringify(params.sandboxId)};</script>
<script>window.__SUMMON_RESOURCES__=${JSON.stringify(params.resourceMap)};</script>
<script>${params.bootstrapSource}</script>
<style>${SUMMON_BASE_CSS}</style>
<style>${params.tokensSource}</style>
</head>
<body>
<div id="summon-root">${params.bodyHtml}</div>
</body>
</html>`;
}

const SUMMON_BASE_CSS = `
[data-summon-section] {
  animation: summon-section-in 0.45s cubic-bezier(0.33, 1, 0.68, 1) both;
}
.summon-node-enter {
  animation: summon-node-enter 0.32s cubic-bezier(0.33, 1, 0.68, 1) both;
  will-change: opacity, filter, transform;
}
.summon-node-update {
  animation: summon-node-update 0.42s ease-out both;
}
.summon-slot-filled {
  animation: summon-slot-filled 0.42s ease-out both;
}
[data-summon-skeleton] {
  position: relative;
  overflow: hidden;
  min-height: 0.8em;
  border-radius: 6px;
  color: transparent !important;
  background: rgba(127, 127, 127, 0.14);
  pointer-events: none;
  user-select: none;
}
[data-summon-skeleton] > * {
  visibility: hidden;
}
[data-summon-skeleton]::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.38), transparent);
  animation: summon-skeleton-sheen 1.35s ease-in-out infinite;
}
@keyframes summon-section-in {
  from { opacity: 0; filter: blur(8px); transform: translateY(8px); }
  to   { opacity: 1; filter: blur(0);   transform: translateY(0); }
}
@keyframes summon-node-enter {
  from { opacity: 0; filter: blur(5px); transform: translateY(6px); }
  to   { opacity: 1; filter: blur(0);   transform: translateY(0); }
}
@keyframes summon-node-update {
  0%   { box-shadow: 0 0 0 0 rgba(80, 112, 255, 0); }
  35%  { box-shadow: 0 0 0 2px rgba(80, 112, 255, 0.18); }
  100% { box-shadow: 0 0 0 0 rgba(80, 112, 255, 0); }
}
@keyframes summon-slot-filled {
  0%   { box-shadow: inset 0 0 0 0 rgba(80, 112, 255, 0); }
  45%  { box-shadow: inset 0 0 0 1px rgba(80, 112, 255, 0.12); }
  100% { box-shadow: inset 0 0 0 0 rgba(80, 112, 255, 0); }
}
@keyframes summon-skeleton-sheen {
  0%   { transform: translateX(-100%); }
  60%, 100% { transform: translateX(100%); }
}
@media (prefers-reduced-motion: reduce) {
  [data-summon-section],
  .summon-node-enter,
  .summon-node-update,
  .summon-slot-filled,
  [data-summon-skeleton]::after {
    animation: none;
  }
  .summon-node-enter {
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
  // Bridge allowlist comes only from the host grant. A JS caller that omits
  // grantedIntents fails closed because `new Set(undefined)` grants nothing.
  const intentAllowlist = new Set(opts.grantedIntents);
  const grantedCapabilities = opts.grantedCapabilities ?? opts.artifact.capabilities ?? [];
  const resourceMap = resourceMapFromCapabilities(grantedCapabilities);

  // Deliberately NOT adding allow-same-origin. That keeps the iframe null-origin:
  // no storage, no parent DOM access, cross-origin isolation applies.
  opts.iframe.setAttribute('sandbox', 'allow-scripts');

  let ready = false;
  const pendingStates: Record<string, unknown>[] = [];
  const pendingDomOps: Array<
    | { kind: 'render'; html: string }
    | { kind: 'node-patch'; patch: HtmlNodePatch }
  > = [];
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
      opts.iframe.contentWindow.postMessage({ type: 'SUMMON_STATE', state }, '*');
    }
    while (pendingDomOps.length > 0) {
      const op = pendingDomOps.shift()!;
      if (op.kind === 'render') {
        opts.iframe.contentWindow.postMessage({ type: 'SUMMON_RENDER', html: op.html }, '*');
      } else {
        opts.iframe.contentWindow.postMessage({ type: 'SUMMON_NODE_PATCH', patch: op.patch }, '*');
      }
    }
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
      opts.onIntent?.(intent, safeArgs);
    }
  }

  window.addEventListener('message', handleMessage);

  opts.iframe.srcdoc = buildSrcdoc({
    sandboxId,
    bootstrapSource: opts.bootstrapSource,
    tokensSource: opts.tokensSource,
    bodyHtml: opts.artifact.html,
    resourceMap,
  });

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
    render(html) {
      pendingDomOps.push({ kind: 'render', html });
      opts.events?.push({
        kind: 'render',
        at: Date.now(),
        sandboxId,
        bytes: html.length,
      });
      flushPending();
    },
    patchNode(patch) {
      pendingDomOps.push({ kind: 'node-patch', patch });
      opts.events?.push({
        kind: 'render',
        at: Date.now(),
        sandboxId,
        bytes: patch.html.length,
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
