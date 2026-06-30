import type { EventStore } from '@summon-internal/devtools';
import type {
  ArrowSurfaceArtifact,
  DomjsSurfaceArtifact,
  HtmlSurfaceArtifact,
  HtmlPatchAction,
  HtmlSurfacePatch,
  SurfaceStatus,
  SurfaceEvent,
  ValidationTool,
} from '@summon-internal/engine';

import { buildDomjsModules, mountSurface } from '@summon-internal/surface-vm';

export type InlineSurfaceArtifact = ArrowSurfaceArtifact | HtmlSurfaceArtifact | DomjsSurfaceArtifact;

export interface HtmlStreamPreviewDelta {
  runtime: 'html';
  target: string;
  action: HtmlPatchAction;
  delta?: string;
  text?: string;
}

export interface InlineSurfaceOptions {
  root: HTMLElement;
  artifact?: InlineSurfaceArtifact | null;
  grantedTools: string[];
  validationTools?: ValidationTool[];
  initialState?: Record<string, unknown>;
  tokensSource?: string;
  onToolCall?: (
    tool: string,
    args: Record<string, unknown>,
  ) => void | Record<string, unknown> | Promise<void | Record<string, unknown>>;
  onToolRejected?: (reason: string, raw: unknown) => void;
  onRuntimeError?: (reason: string) => void;
  events?: EventStore;
}

export interface SurfacePreviewNode {
  id: string;
  parent?: string;
  kind: string;
  role?: string;
  label?: string;
  props: Record<string, unknown>;
}

export interface SurfacePreviewSnapshot {
  surface: {
    id: string;
    kind: string;
    title?: string;
  } | null;
  status?: {
    status: SurfaceStatus;
    text?: string;
  };
  nodes: SurfacePreviewNode[];
  finalized: boolean;
}

export interface InlineSurfaceHandle {
  surfaceId: string;
  root: HTMLElement;
  renderArtifact(artifact: InlineSurfaceArtifact): void;
  applyHtmlPreviewDelta(delta: HtmlStreamPreviewDelta): void;
  applyHtmlPatch(patch: HtmlSurfacePatch): void;
  pushState(state: Record<string, unknown>): void;
  applyPreviewEvent(event: SurfaceEvent): SurfacePreviewSnapshot;
  previewSnapshot(): SurfacePreviewSnapshot;
  dispose(): void;
}

const PREVIEW_ROOT_ATTR = 'data-summon-preview-root';
export const HTML_IFRAME_SANDBOX = 'allow-scripts';
const HTML_PREVIEW_IFRAME_SANDBOX = 'allow-same-origin';
const HTML_PREVIEW_ROOT_ID = 'summon-html-stream-preview-root';
const HTML_PREVIEW_STYLE_ID = 'summon-html-stream-preview-style';
const HTML_MESSAGE_READY = 'SUMMON_HTML_READY';
const HTML_MESSAGE_TOOL = 'SUMMON_HTML_TOOL';
const HTML_MESSAGE_TOOL_RESULT = 'SUMMON_HTML_TOOL_RESULT';
const HTML_MESSAGE_STATE = 'SUMMON_HTML_STATE';
const HTML_MESSAGE_PATCH = 'SUMMON_HTML_PATCH';
const DISABLE_FETCH_PRELUDE = [
  'try {',
  '  Object.defineProperty(globalThis, "fetch", { value: undefined, configurable: true, writable: false });',
  '} catch {',
  '  globalThis.fetch = undefined;',
  '}',
  '',
].join('\n');

interface InlineToolCallOptions {
  surfaceId: string;
  toolAllowlist: ReadonlySet<string>;
  currentState: Record<string, unknown>;
  tool: unknown;
  rawArgs: unknown;
  onToolCall?: InlineSurfaceOptions['onToolCall'];
  onToolRejected?: InlineSurfaceOptions['onToolRejected'];
  events?: EventStore;
}

interface InlineToolCallResult {
  ok: boolean;
  state: Record<string, unknown>;
  error?: string;
  stateChanged: boolean;
}

export async function resolveInlineToolCall(options: InlineToolCallOptions): Promise<InlineToolCallResult> {
  const { currentState, events, onToolCall, onToolRejected, rawArgs, surfaceId, tool, toolAllowlist } = options;
  if (typeof tool !== 'string' || !tool) {
    return rejectInlineToolCall('tool not a non-empty string', {
      currentState,
      events,
      onToolRejected,
      raw: { tool, args: rawArgs },
      surfaceId,
    });
  }
  if (!toolAllowlist.has(tool)) {
    return rejectInlineToolCall(`tool "${tool}" not granted`, {
      currentState,
      events,
      onToolRejected,
      raw: { tool, args: rawArgs },
      surfaceId,
    });
  }
  if (!onToolCall) {
    return rejectInlineToolCall(`tool "${tool}" has no host handler`, {
      currentState,
      events,
      onToolRejected,
      raw: { tool, args: rawArgs },
      surfaceId,
    });
  }

  const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)
    ? rawArgs as Record<string, unknown>
    : {};
  events?.push({ kind: 'tool-called', at: Date.now(), surfaceId, tool, args });
  try {
    const result = await onToolCall(tool, args);
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      return {
        ok: true,
        state: cloneState(result as Record<string, unknown>),
        stateChanged: true,
      };
    }
    return { ok: true, state: cloneState(currentState), stateChanged: false };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, state: cloneState(currentState), error, stateChanged: false };
  }
}

function rejectInlineToolCall(
  error: string,
  options: {
    currentState: Record<string, unknown>;
    raw: unknown;
    onToolRejected?: InlineSurfaceOptions['onToolRejected'];
    events?: EventStore;
    surfaceId?: string;
  },
): InlineToolCallResult {
  options.events?.push({ kind: 'tool-rejected', at: Date.now(), surfaceId: options.surfaceId, reason: error, raw: options.raw });
  options.onToolRejected?.(error, options.raw);
  return { ok: false, state: cloneState(options.currentState), error, stateChanged: false };
}

type SandboxFactory = (
  options: {
    source: Record<string, string>;
    shadowDOM?: boolean;
    onError?: (error: unknown) => void;
  },
  events?: { output?: (payload: unknown) => void },
  hostBridge?: Record<string, Record<string, unknown>>,
) => (root: HTMLElement) => void | (() => void);

let sandboxFactoryPromise: Promise<SandboxFactory> | null = null;

export function mountInlineSurface(options: InlineSurfaceOptions): InlineSurfaceHandle {
  const surfaceId = randomSurfaceId();
  const root = options.root;
  const toolAllowlist = new Set(options.grantedTools);
  const subscribers = new Set<(state: Record<string, unknown>) => void>();
  const preview = createPreviewState();
  let currentState = cloneState(options.initialState);
  let arrowTeardown: (() => void) | null = null;
  // domjs (surface-vm) mounted surface, if the active artifact is a domjs one.
  let domjsSurface: { pushState(state: Record<string, unknown>): void; destroy(): void } | null = null;
  let domjsStateListener: ((state: Record<string, unknown>) => void) | null = null;
  let htmlTeardown: (() => void) | null = null;
  let htmlFrame: HTMLIFrameElement | null = null;
  let htmlPreviewFrame: HTMLIFrameElement | null = null;
  let htmlPreviewCss = '';
  let htmlPreviewArtifactCss = '';
  let htmlSandboxId: string | null = null;
  let htmlReady = false;
  const pendingHtmlPatches: HtmlSurfacePatch[] = [];
  const htmlPreviewBuffers = new Map<string, string>();
  let renderRevision = 0;
  // Preview status events can arrive after an accepted artifact line but before
  // Arrow's sandbox DOM exists. Track the host-owned render lifecycle instead
  // of inferring it from DOM shape so late "finalizing" events cannot redraw the
  // pulsing preview over a real surface. Keep the previous/preview surface in
  // place until the sandbox factory is ready to avoid a blank handoff.
  let renderState: 'preview' | 'rendering' | 'rendered' | 'failed' = 'preview';
  let disposed = false;

  root.dataset.summonInlineSurface = surfaceId;
  root.classList.add('summon-inline-surface');
  installTokenStyle(root, surfaceId, options.tokensSource);

  const notifyState = () => {
    const snapshot = cloneState(currentState);
    for (const cb of subscribers) {
      try {
        cb(snapshot);
      } catch {
        // Keep one generated subscriber from breaking the rest.
      }
    }
  };

  const callToolInternal = async (
    tool: unknown,
    rawArgs: unknown,
  ): Promise<{ ok: boolean; state: Record<string, unknown>; error?: string }> => {
    const result = await resolveInlineToolCall({
      surfaceId,
      toolAllowlist,
      currentState,
      tool,
      rawArgs,
      onToolCall: options.onToolCall,
      onToolRejected: options.onToolRejected,
      events: options.events,
    });
    if (result.stateChanged) {
      currentState = cloneState(result.state);
      notifyState();
    }
    return result;
  };

  const teardownDomjsRuntime = () => {
    if (domjsStateListener) {
      subscribers.delete(domjsStateListener);
      domjsStateListener = null;
    }
    if (domjsSurface) {
      try {
        domjsSurface.destroy();
      } catch {
        // best effort
      }
    }
    domjsSurface = null;
  };

  const teardownHtmlRuntime = () => {
    if (htmlTeardown) {
      try {
        htmlTeardown();
      } catch {
        // best effort
      }
    }
    htmlTeardown = null;
    htmlFrame = null;
    htmlSandboxId = null;
    htmlReady = false;
    pendingHtmlPatches.length = 0;
    clearHtmlPreview();
    htmlPreviewCss = '';
    htmlPreviewArtifactCss = '';
  };

  const clearHtmlPreview = (target?: string) => {
    if (target) {
      for (const key of Array.from(htmlPreviewBuffers.keys())) {
        if (key.endsWith(`:${target}`)) htmlPreviewBuffers.delete(key);
      }
    } else {
      htmlPreviewBuffers.clear();
    }
    if (htmlPreviewBuffers.size > 0) {
      renderHtmlPreviewFrame();
      return;
    }
    htmlPreviewFrame?.remove();
    htmlPreviewFrame = null;
    htmlPreviewCss = '';
  };

  const renderHtmlPreviewFrame = () => {
    const bodyHtml = Array.from(htmlPreviewBuffers.values()).join('\n');
    if (!bodyHtml.trim()) {
      clearHtmlPreview();
      return;
    }
    const css = htmlPreviewCssFor(options.tokensSource, htmlPreviewArtifactCss);
    const frame = htmlPreviewFrame ?? document.createElement('iframe');
    if (!htmlPreviewFrame) {
      frame.className = 'summon-html-stream-preview-frame';
      frame.title = 'Summon inert HTML stream preview';
      frame.setAttribute('sandbox', HTML_PREVIEW_IFRAME_SANDBOX);
      frame.setAttribute('referrerpolicy', 'no-referrer');
      frame.srcdoc = buildHtmlPreviewSrcdoc({
        bodyHtml: '',
        tokensSource: options.tokensSource,
        artifactCss: htmlPreviewArtifactCss,
      });
      htmlPreviewCss = css;
      htmlPreviewFrame = frame;
      frame.addEventListener('load', () => {
        if (htmlPreviewFrame !== frame) return;
        updateHtmlPreviewFrame(frame, Array.from(htmlPreviewBuffers.values()).join('\n'), htmlPreviewCss);
      });
      root.append(frame);
      updateHtmlPreviewFrame(frame, bodyHtml, css);
      return;
    }
    if (htmlPreviewCss !== css) {
      htmlPreviewCss = css;
      updateHtmlPreviewFrame(frame, bodyHtml, css);
      return;
    }
    updateHtmlPreviewFrame(frame, bodyHtml, css);
  };

  const postHtmlMessage = (type: string, value: Record<string, unknown> = {}) => {
    if (!htmlFrame?.contentWindow || !htmlSandboxId) return false;
    htmlFrame.contentWindow.postMessage({ type, sandboxId: htmlSandboxId, ...value }, '*');
    return true;
  };

  const flushHtmlPatches = () => {
    if (!htmlReady) return;
    while (pendingHtmlPatches.length > 0) {
      const patch = pendingHtmlPatches.shift();
      if (!patch) continue;
      postHtmlMessage(HTML_MESSAGE_PATCH, { patch });
    }
  };

  const renderDomjsArtifact = (artifact: DomjsSurfaceArtifact, revision: number) => {
    // Tear down any other runtime; domjs replaces the active surface.
    teardownDomjsRuntime();
    teardownHtmlRuntime();
    if (arrowTeardown) {
      try {
        arrowTeardown();
      } catch {
        // best effort
      }
      arrowTeardown = null;
    }
    renderState = 'rendering';
    clearRuntimeChildren(root);

    const entry = artifact.source['main.js'];
    if (typeof entry !== 'string') {
      const reason = 'domjs artifact is missing a main.js entry';
      renderState = 'failed';
      renderRuntimeError(root, reason);
      reportRuntimeError(options, surfaceId, reason);
      return;
    }

    const { modules, entryPath } = buildDomjsModules({ entry });
    void mountSurface({
      modules,
      entryPath,
      root,
      initialState: cloneState(currentState),
      // The surface-vm bridge forwards every tool call to the same host plumbing
      // the Arrow path uses, so grants/policy/state behave identically.
      hostBridge: (tool, args) => callToolInternal(tool, args as Record<string, unknown>),
      onError(reason) {
        if (disposed || revision !== renderRevision) return;
        renderState = 'failed';
        teardownDomjsRuntime();
        clearRuntimeChildren(root);
        renderRuntimeError(root, `domjs runtime error: ${reason}`);
        reportRuntimeError(options, surfaceId, `domjs runtime error: ${reason}`);
      },
    })
      .then((surface) => {
        if (disposed || revision !== renderRevision) {
          try {
            surface.destroy();
          } catch {
            // best effort
          }
          return;
        }
        domjsSurface = surface;
        // Keep the VM's surface state in sync with host state.
        const listener = (state: Record<string, unknown>) => surface.pushState(state);
        subscribers.add(listener);
        domjsStateListener = listener;
        renderState = 'rendered';
        options.events?.push({ kind: 'rendered', at: Date.now(), surfaceId, revision });
      })
      .catch((err: unknown) => {
        if (disposed || revision !== renderRevision) return;
        renderState = 'failed';
        const reason = `domjs runtime failed to mount: ${err instanceof Error ? err.message : String(err)}`;
        clearRuntimeChildren(root);
        renderRuntimeError(root, reason);
        reportRuntimeError(options, surfaceId, reason);
      });
  };

  const renderHtmlArtifact = (artifact: HtmlSurfaceArtifact, revision: number) => {
    teardownHtmlRuntime();
    htmlPreviewArtifactCss = artifact.source['main.css'] ?? '';
    if (arrowTeardown) {
      try {
        arrowTeardown();
      } catch {
        // best effort
      }
      arrowTeardown = null;
    }
    renderState = 'rendering';
    clearRuntimeChildren(root);

    const sandboxId = `${surfaceId}-${revision}`;
    const bootstrapNonce = randomNonce();
    const frame = document.createElement('iframe');
    frame.className = 'summon-html-surface-frame';
    frame.title = 'Summon generated HTML surface';
    frame.setAttribute('sandbox', HTML_IFRAME_SANDBOX);
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.srcdoc = buildHtmlSandboxSrcdoc({
      artifact,
      sandboxId,
      bootstrapNonce,
      tokensSource: options.tokensSource,
    });
    htmlFrame = frame;
    htmlSandboxId = sandboxId;

    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) return;
      const message = parseHtmlSandboxMessage(event.data, sandboxId);
      if (!message) {
        options.onToolRejected?.('forged or malformed HTML sandbox message', event.data);
        return;
      }
      if (message.type === HTML_MESSAGE_READY) {
        if (disposed || revision !== renderRevision) return;
        htmlReady = true;
        renderState = 'rendered';
        postHtmlMessage(HTML_MESSAGE_STATE, { state: cloneState(currentState) });
        flushHtmlPatches();
        options.events?.push({ kind: 'rendered', at: Date.now(), surfaceId, revision });
        return;
      }
      if (message.type === HTML_MESSAGE_TOOL) {
        void callToolInternal(message.tool, message.args).then((result) => {
          postHtmlMessage(HTML_MESSAGE_TOOL_RESULT, {
            requestId: message.requestId,
            result,
          });
        });
      }
    };
    window.addEventListener('message', onMessage);
    htmlTeardown = () => {
      window.removeEventListener('message', onMessage);
      frame.remove();
    };
    root.append(frame);
  };

  const handle: InlineSurfaceHandle = {
    surfaceId,
    root,
    renderArtifact(artifact) {
      if (disposed) return;
      renderRevision += 1;
      const revision = renderRevision;
      if (artifact.runtime === 'html') {
        options.events?.push({
          kind: 'render',
          at: Date.now(),
          surfaceId,
          bytes: JSON.stringify(artifact.source).length,
        });
        renderHtmlArtifact(artifact, revision);
        return;
      }
      if (artifact.runtime === 'domjs') {
        options.events?.push({
          kind: 'render',
          at: Date.now(),
          surfaceId,
          bytes: JSON.stringify(artifact.source).length,
        });
        renderDomjsArtifact(artifact, revision);
        return;
      }
      teardownDomjsRuntime();
      teardownHtmlRuntime();
      if (arrowTeardown) {
        try {
          arrowTeardown();
        } catch {
          // best effort
        }
        arrowTeardown = null;
      }
      renderState = 'rendering';
      options.events?.push({
        kind: 'render',
        at: Date.now(),
        surfaceId,
        bytes: JSON.stringify(artifact.source).length,
      });
      void loadSandboxFactory()
        .then((sandbox) => {
          if (disposed || revision !== renderRevision) return;
          clearRuntimeChildren(root);
          const view = sandbox(
            {
              source: sourceForNetworkPolicy(artifact),
              shadowDOM: true,
              onError(error) {
                if (disposed || revision !== renderRevision) return;
                const reason = `Arrow runtime error: ${String(error instanceof Error ? error.message : error)}`;
                renderState = 'failed';
                clearRuntimeChildren(root);
                renderRuntimeError(root, reason);
                reportRuntimeError(options, surfaceId, reason);
              },
            },
            {
              output(payload) {
                if (payload && typeof payload === 'object' && (payload as { type?: unknown }).type === 'tool') {
                  const request = payload as { tool?: unknown; args?: unknown };
                  void callToolInternal(request.tool, request.args);
                }
              },
            },
            {
              'host-bridge:summon': {
                getState() {
                  return cloneState(currentState);
                },
                onState(cb: unknown) {
                  if (typeof cb !== 'function') return () => {};
                  const listener = cb as (state: Record<string, unknown>) => void;
                  subscribers.add(listener);
                  listener(cloneState(currentState));
                  return () => subscribers.delete(listener);
                },
                callTool(tool: unknown, args: unknown) {
                  return callToolInternal(tool, args);
                },
              },
            },
          );
          const maybeTeardown = view(root);
          if (typeof maybeTeardown === 'function') arrowTeardown = maybeTeardown;
          queueMicrotask(() => {
            if (!disposed && revision === renderRevision) {
              renderState = 'rendered';
              options.events?.push({ kind: 'rendered', at: Date.now(), surfaceId, revision });
            }
          });
        })
        .catch((err: unknown) => {
          if (disposed || revision !== renderRevision) return;
          renderState = 'failed';
          const reason = `Arrow runtime failed to mount: ${err instanceof Error ? err.message : String(err)}`;
          clearRuntimeChildren(root);
          renderRuntimeError(root, reason);
          reportRuntimeError(options, surfaceId, reason);
        });
    },
    pushState(state) {
      if (disposed) return;
      currentState = cloneState(state);
      notifyState();
      postHtmlMessage(HTML_MESSAGE_STATE, { state: cloneState(currentState) });
    },
    applyHtmlPatch(patch) {
      if (disposed) return;
      clearHtmlPreview(patch.target);
      if (!htmlFrame || !htmlSandboxId || !htmlReady) {
        pendingHtmlPatches.push(patch);
        return;
      }
      postHtmlMessage(HTML_MESSAGE_PATCH, { patch });
    },
    applyHtmlPreviewDelta(delta) {
      if (disposed) return;
      const text = typeof delta.delta === 'string'
        ? delta.delta
        : typeof delta.text === 'string'
          ? delta.text
          : '';
      if (!text || !delta.target || !delta.action) return;
      const key = `${delta.action}:${delta.target}`;
      htmlPreviewBuffers.set(key, `${htmlPreviewBuffers.get(key) ?? ''}${text}`);
      renderHtmlPreviewFrame();
    },
    applyPreviewEvent(event) {
      const snapshot = preview.apply(event);
      if (renderState === 'preview' || renderState === 'failed') {
        renderPreview(root, snapshot);
      }
      options.events?.push({ kind: 'surface-preview-event', at: Date.now(), surfaceId, event });
      return snapshot;
    },
    previewSnapshot() {
      return preview.snapshot();
    },
    dispose() {
      disposed = true;
      if (arrowTeardown) {
        try {
          arrowTeardown();
        } catch {
          // best effort
        }
      }
      arrowTeardown = null;
      teardownDomjsRuntime();
      teardownHtmlRuntime();
      subscribers.clear();
      root.replaceChildren();
      root.classList.remove('summon-inline-surface');
      delete root.dataset.summonInlineSurface;
      options.events?.push({ kind: 'surface-disposed', at: Date.now(), surfaceId });
    },
  };

  options.events?.push({
    kind: 'surface-mounted',
    at: Date.now(),
    surfaceId,
    grantedTools: Array.from(toolAllowlist),
    validationTools: options.validationTools ?? [],
  });
  if (options.artifact) {
    handle.renderArtifact(options.artifact);
  } else {
    renderPreview(root, preview.snapshot());
  }
  return handle;
}

export interface HtmlSandboxSrcdocOptions {
  artifact: HtmlSurfaceArtifact;
  sandboxId: string;
  bootstrapNonce: string;
  tokensSource?: string;
}

export interface HtmlPreviewSrcdocOptions {
  bodyHtml: string;
  tokensSource?: string;
  artifactCss?: string;
}

export type HtmlSandboxMessage =
  | {
      type: typeof HTML_MESSAGE_READY;
      sandboxId: string;
    }
  | {
      type: typeof HTML_MESSAGE_TOOL;
      sandboxId: string;
      requestId: string;
      tool: string;
      args: Record<string, unknown>;
    };

export function buildHtmlSandboxCsp(nonce: string): string {
  return [
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "connect-src 'none'",
    "object-src 'none'",
    'img-src data:',
    'font-src data:',
    'media-src data:',
    `style-src 'nonce-${cspNonce(nonce)}' 'unsafe-inline'`,
    `script-src 'nonce-${cspNonce(nonce)}'`,
  ].join('; ');
}

export function buildHtmlPreviewCsp(): string {
  return [
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "connect-src 'none'",
    "object-src 'none'",
    'img-src data:',
    'font-src data:',
    'media-src data:',
    "style-src 'unsafe-inline'",
    "script-src 'none'",
  ].join('; ');
}

export function buildHtmlSandboxSrcdoc(options: HtmlSandboxSrcdocOptions): string {
  const { artifact, bootstrapNonce, sandboxId } = options;
  const css = [
    htmlSandboxFrameCss(),
    options.tokensSource ?? '',
    artifact.source['main.css'] ?? '',
  ].filter(Boolean).join('\n');
  const generatedScript = artifact.source['main.js'];
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta http-equiv="Content-Security-Policy" content="${escapeHtmlAttr(buildHtmlSandboxCsp(bootstrapNonce))}">`,
    `<style nonce="${escapeHtmlAttr(bootstrapNonce)}">${escapeStyleText(css)}</style>`,
    '</head>',
    '<body>',
    '<main id="summon-html-root">',
    artifact.source['body.html'],
    '</main>',
    `<script nonce="${escapeHtmlAttr(bootstrapNonce)}">${escapeScriptText(htmlSandboxBootstrap(sandboxId))}</script>`,
    generatedScript
      ? `<script nonce="${escapeHtmlAttr(bootstrapNonce)}">${escapeScriptText(generatedScript)}</script>`
      : '',
    '</body>',
    '</html>',
  ].join('');
}

function htmlPreviewCssFor(tokensSource?: string, artifactCss?: string): string {
  return [
    htmlSandboxFrameCss(),
    tokensSource ?? '',
    artifactCss ?? '',
    `
body {
  background: color-mix(in srgb, var(--color-bg, Canvas) 92%, transparent);
}
#${HTML_PREVIEW_ROOT_ID} {
  min-height: 100%;
}
`,
  ].filter(Boolean).join('\n');
}

function updateHtmlPreviewFrame(frame: HTMLIFrameElement, bodyHtml: string, css: string): void {
  const doc = frame.contentDocument;
  if (!doc?.body) {
    frame.srcdoc = htmlPreviewSrcdocFromCss(bodyHtml, css);
    return;
  }
  let style = doc.getElementById(HTML_PREVIEW_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement('style');
    style.id = HTML_PREVIEW_STYLE_ID;
    doc.head.append(style);
  }
  if (style.textContent !== css) style.textContent = css;

  let previewRoot = doc.getElementById(HTML_PREVIEW_ROOT_ID);
  if (!previewRoot) {
    previewRoot = doc.createElement('main');
    previewRoot.id = HTML_PREVIEW_ROOT_ID;
    doc.body.replaceChildren(previewRoot);
  }
  previewRoot.innerHTML = sanitizeHtmlPreview(bodyHtml);
}

function htmlPreviewSrcdocFromCss(bodyHtml: string, css: string): string {
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta http-equiv="Content-Security-Policy" content="${escapeHtmlAttr(buildHtmlPreviewCsp())}">`,
    `<style id="${HTML_PREVIEW_STYLE_ID}">${escapeStyleText(css)}</style>`,
    '</head>',
    '<body>',
    `<main id="${HTML_PREVIEW_ROOT_ID}">`,
    sanitizeHtmlPreview(bodyHtml),
    '</main>',
    '</body>',
    '</html>',
  ].join('');
}

export function buildHtmlPreviewSrcdoc(options: HtmlPreviewSrcdocOptions): string {
  return htmlPreviewSrcdocFromCss(
    options.bodyHtml,
    htmlPreviewCssFor(options.tokensSource, options.artifactCss),
  );
}

export function parseHtmlSandboxMessage(value: unknown, expectedSandboxId: string): HtmlSandboxMessage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const message = value as Record<string, unknown>;
  if (message.sandboxId !== expectedSandboxId) return null;
  if (message.type === HTML_MESSAGE_READY) {
    return {
      type: HTML_MESSAGE_READY,
      sandboxId: expectedSandboxId,
    };
  }
  if (message.type === HTML_MESSAGE_TOOL) {
    if (typeof message.requestId !== 'string' || !message.requestId) return null;
    if (typeof message.tool !== 'string' || !message.tool) return null;
    const args = message.args && typeof message.args === 'object' && !Array.isArray(message.args)
      ? message.args as Record<string, unknown>
      : {};
    return {
      type: HTML_MESSAGE_TOOL,
      sandboxId: expectedSandboxId,
      requestId: message.requestId,
      tool: message.tool,
      args,
    };
  }
  return null;
}

async function loadSandboxFactory(): Promise<SandboxFactory> {
  sandboxFactoryPromise ??= import('@arrow-js/sandbox').then((mod) => {
    const candidate = (mod as { sandbox?: unknown; default?: unknown }).sandbox ??
      ((mod as { default?: { sandbox?: unknown } }).default?.sandbox);
    if (typeof candidate !== 'function') {
      throw new Error('@arrow-js/sandbox did not export sandbox()');
    }
    return candidate as SandboxFactory;
  });
  return sandboxFactoryPromise;
}

function sourceForNetworkPolicy(artifact: ArrowSurfaceArtifact): Record<string, string> {
  if (artifact.network === 'restricted-fetch') return artifact.source;
  const source: Record<string, string> = {};
  for (const [path, contents] of Object.entries(artifact.source)) {
    source[path] = path.endsWith('.css') ? contents : `${DISABLE_FETCH_PRELUDE}${contents}`;
  }
  return source;
}

function reportRuntimeError(
  options: Pick<InlineSurfaceOptions, 'events' | 'onRuntimeError'>,
  surfaceId: string,
  reason: string,
): void {
  options.events?.push({ kind: 'surface-runtime-error', at: Date.now(), surfaceId, reason });
  options.onRuntimeError?.(reason);
}

function createPreviewState() {
  let surface: SurfacePreviewSnapshot['surface'] = null;
  let status: SurfacePreviewSnapshot['status'];
  let finalized = false;
  const nodes = new Map<string, SurfacePreviewNode>();

  const snapshot = (): SurfacePreviewSnapshot => ({
    surface: surface ? { ...surface } : null,
    ...(status ? { status: { ...status } } : {}),
    nodes: Array.from(nodes.values()).map((node) => ({
      ...node,
      props: { ...node.props },
    })),
    finalized,
  });

  return {
    apply(event: SurfaceEvent): SurfacePreviewSnapshot {
      if (event.type === 'surface.start') {
        surface = {
          id: event.id,
          kind: event.kind,
          ...(event.title ? { title: event.title } : {}),
        };
      } else if (event.type === 'surface.status') {
        status = {
          status: event.status,
          ...(event.text ? { text: event.text } : {}),
        };
      } else if (event.type === 'region.add') {
        const node: SurfacePreviewNode = {
          id: event.id,
          kind: 'region',
          role: event.role,
          props: {},
        };
        if (event.parent) node.parent = event.parent;
        if (event.label) node.label = event.label;
        nodes.set(event.id, node);
      } else if (event.type === 'node.add') {
        nodes.set(event.id, {
          id: event.id,
          parent: event.parent,
          kind: event.kind,
          props: { ...(event.props ?? {}) },
        });
      } else if (event.type === 'node.patch') {
        const existing = nodes.get(event.id);
        if (existing) {
          existing.props = { ...existing.props, ...event.props };
        }
      } else if (event.type === 'surface.finalize') {
        finalized = true;
      }
      return snapshot();
    },
    snapshot,
  };
}

function renderPreview(root: HTMLElement, _snapshot: SurfacePreviewSnapshot): void {
  let previewRoot = root.querySelector<HTMLElement>(`[${PREVIEW_ROOT_ATTR}]`);
  if (!previewRoot) {
    previewRoot = document.createElement('section');
    previewRoot.setAttribute(PREVIEW_ROOT_ATTR, 'true');
    previewRoot.setAttribute('role', 'status');
    previewRoot.setAttribute('aria-live', 'polite');
    root.append(previewRoot);
  }
  previewRoot.className = 'summon-preview';
  previewRoot.replaceChildren();

  const ambient = document.createElement('div');
  ambient.className = 'summon-preview__ambient';
  ambient.setAttribute('aria-hidden', 'true');

  const loader = document.createElement('div');
  loader.className = 'summon-preview__loader';
  loader.setAttribute('aria-hidden', 'true');

  const label = document.createElement('span');
  label.className = 'summon-preview__loading-label';
  label.textContent = 'Loading';

  previewRoot.append(ambient, loader, label);
}

function installTokenStyle(root: HTMLElement, surfaceId: string, tokensSource?: string): void {
  const style = document.createElement('style');
  style.dataset.summonInlineTokens = surfaceId;
  style.textContent = [
    scopeTokenCss(tokensSource ?? '', surfaceId),
    defaultPreviewCss(surfaceId),
  ].join('\n');
  root.prepend(style);
}

function clearRuntimeChildren(root: HTMLElement): void {
  for (const child of Array.from(root.children)) {
    if (child instanceof HTMLStyleElement && child.dataset.summonInlineTokens) continue;
    child.remove();
  }
}

function renderRuntimeError(root: HTMLElement, reason: string): void {
  const errorRoot = document.createElement('section');
  errorRoot.className = 'summon-runtime-error';
  errorRoot.setAttribute('role', 'alert');

  const kicker = document.createElement('span');
  kicker.className = 'summon-runtime-error__kicker';
  kicker.textContent = 'Surface runtime failed';

  const message = document.createElement('p');
  message.textContent = reason;

  errorRoot.append(kicker, message);
  root.append(errorRoot);
}

export function scopeTokenCss(css: string, surfaceId: string): string {
  return scopeCssRules(css, `[data-summon-inline-surface="${escapeCssIdentifier(surfaceId)}"]`);
}

function scopeCssRules(css: string, rootSelector: string): string {
  let output = '';
  let cursor = 0;

  while (cursor < css.length) {
    const delimiter = findNextRuleDelimiter(css, cursor);
    if (!delimiter) {
      output += css.slice(cursor);
      break;
    }

    const prelude = css.slice(cursor, delimiter.index);
    if (delimiter.char === ';') {
      output += prelude + delimiter.char;
      cursor = delimiter.index + 1;
      continue;
    }

    const close = findMatchingBlockEnd(css, delimiter.index);
    if (close < 0) {
      output += css.slice(cursor);
      break;
    }

    const block = css.slice(delimiter.index + 1, close);
    const atRuleName = parseAtRuleName(prelude);
    if (atRuleName) {
      output += prelude + '{' + (atRuleContainsStyleRules(atRuleName) ? scopeCssRules(block, rootSelector) : block) + '}';
    } else {
      output += scopeSelectorList(prelude, rootSelector) + '{' + block + '}';
    }
    cursor = close + 1;
  }

  return output;
}

function scopeSelectorList(selectorList: string, rootSelector: string): string {
  return splitSelectorList(selectorList)
    .map((selector) => scopeOneSelector(selector, rootSelector))
    .join(',');
}

function scopeOneSelector(selector: string, rootSelector: string): string {
  const leadingTriviaLength = leadingCssTriviaLength(selector);
  const leadingTrivia = selector.slice(0, leadingTriviaLength);
  const selectorBody = selector.slice(leadingTriviaLength);
  const trailingWhitespace = selector.match(/\s*$/)?.[0] ?? '';
  const trimmed = selectorBody.trim();
  if (!trimmed) return selector;
  if (trimmed.startsWith(rootSelector)) return selector;

  const rootScoped = trimmed
    .replace(/^:root\b/, rootSelector)
    .replace(/^html\b/, rootSelector)
    .replace(/^body\b/, rootSelector);
  if (rootScoped !== trimmed) {
    return `${leadingTrivia}${rootScoped}${trailingWhitespace}`;
  }

  return `${leadingTrivia}${rootSelector} ${trimmed}${trailingWhitespace}`;
}

function leadingCssTriviaLength(value: string): number {
  let index = 0;
  while (index < value.length) {
    const whitespace = value.slice(index).match(/^\s+/)?.[0];
    if (whitespace) {
      index += whitespace.length;
      continue;
    }
    if (value[index] === '/' && value[index + 1] === '*') {
      const commentEnd = value.indexOf('*/', index + 2);
      if (commentEnd < 0) return index;
      index = commentEnd + 2;
      continue;
    }
    break;
  }
  return index;
}

function splitSelectorList(selectorList: string): string[] {
  const selectors: string[] = [];
  let start = 0;
  let squareDepth = 0;
  let parenDepth = 0;
  let quote: '"' | "'" | null = null;
  let inComment = false;

  for (let i = 0; i < selectorList.length; i += 1) {
    const char = selectorList[i];
    const next = selectorList[i + 1];
    if (inComment) {
      if (char === '*' && next === '/') {
        inComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (char === '\\') {
        i += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '/' && next === '*') {
      inComment = true;
      i += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '[') {
      squareDepth += 1;
      continue;
    }
    if (char === ']') {
      squareDepth = Math.max(0, squareDepth - 1);
      continue;
    }
    if (char === '(') {
      parenDepth += 1;
      continue;
    }
    if (char === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }
    if (char === ',' && squareDepth === 0 && parenDepth === 0) {
      selectors.push(selectorList.slice(start, i));
      start = i + 1;
    }
  }

  selectors.push(selectorList.slice(start));
  return selectors;
}

function findNextRuleDelimiter(css: string, start: number): { index: number; char: '{' | ';' } | null {
  let parenDepth = 0;
  let squareDepth = 0;
  let quote: '"' | "'" | null = null;
  let inComment = false;

  for (let i = start; i < css.length; i += 1) {
    const char = css[i];
    const next = css[i + 1];
    if (inComment) {
      if (char === '*' && next === '/') {
        inComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (char === '\\') {
        i += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '/' && next === '*') {
      inComment = true;
      i += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(') {
      parenDepth += 1;
      continue;
    }
    if (char === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }
    if (char === '[') {
      squareDepth += 1;
      continue;
    }
    if (char === ']') {
      squareDepth = Math.max(0, squareDepth - 1);
      continue;
    }
    if (parenDepth === 0 && squareDepth === 0 && (char === '{' || char === ';')) {
      return { index: i, char };
    }
  }

  return null;
}

function findMatchingBlockEnd(css: string, openIndex: number): number {
  let depth = 0;
  let quote: '"' | "'" | null = null;
  let inComment = false;

  for (let i = openIndex; i < css.length; i += 1) {
    const char = css[i];
    const next = css[i + 1];
    if (inComment) {
      if (char === '*' && next === '/') {
        inComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (char === '\\') {
        i += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '/' && next === '*') {
      inComment = true;
      i += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '{') {
      depth += 1;
      continue;
    }
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function parseAtRuleName(prelude: string): string | null {
  const match = prelude.slice(leadingCssTriviaLength(prelude)).match(/^@([A-Za-z-]+)/);
  return match?.[1]?.toLowerCase() ?? null;
}

function atRuleContainsStyleRules(name: string): boolean {
  return !new Set([
    'counter-style',
    'font-face',
    'keyframes',
    'page',
    'property',
  ]).has(name);
}

function escapeCssIdentifier(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function defaultPreviewCss(surfaceId: string): string {
  return `
[data-summon-inline-surface="${surfaceId}"] {
  position: relative;
  background: var(--color-bg, Canvas);
  color: var(--color-text, CanvasText);
  font-family: var(--font-sans, system-ui, sans-serif);
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview {
  position: relative;
  isolation: isolate;
  display: grid;
  min-height: 100%;
  place-items: center;
  gap: 14px;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--color-text, CanvasText) 7%, transparent), transparent 34%),
    linear-gradient(180deg, var(--color-bg, Canvas), color-mix(in srgb, var(--color-surface, Canvas) 88%, var(--color-bg, Canvas)));
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__ambient {
  position: absolute;
  inset: 18%;
  z-index: -1;
  border-radius: 999px;
  pointer-events: none;
  background: color-mix(in srgb, var(--color-text, CanvasText) 10%, transparent);
  filter: blur(42px);
  opacity: 0.6;
  animation: summon-preview-breathe 2.4s ease-in-out infinite;
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__loader {
  width: 30px;
  height: 30px;
  border: 2px solid color-mix(in srgb, var(--color-text, CanvasText) 16%, transparent);
  border-top-color: var(--color-text, CanvasText);
  border-radius: 999px;
  animation: summon-preview-spin 820ms linear infinite;
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__loading-label {
  color: var(--color-text-muted, color-mix(in srgb, CanvasText 54%, transparent));
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
}
[data-summon-inline-surface="${surfaceId}"] .summon-runtime-error {
  display: grid;
  align-content: center;
  gap: 12px;
  min-height: 100%;
  padding: clamp(24px, 6vw, 72px);
  background: var(--color-bg, Canvas);
  color: var(--color-text, CanvasText);
}
[data-summon-inline-surface="${surfaceId}"] .summon-runtime-error__kicker {
  color: var(--color-text-muted, color-mix(in srgb, CanvasText 62%, transparent));
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}
[data-summon-inline-surface="${surfaceId}"] .summon-runtime-error p {
  max-width: 72ch;
  margin: 0;
  color: var(--color-text, CanvasText);
  font-size: clamp(15px, 2vw, 20px);
  line-height: 1.45;
}
[data-summon-inline-surface="${surfaceId}"] .summon-html-surface-frame {
  display: block;
  width: 100%;
  min-height: 100%;
  height: 100%;
  border: 0;
  background: var(--color-bg, Canvas);
}
[data-summon-inline-surface="${surfaceId}"] .summon-html-stream-preview-frame {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  pointer-events: none;
  background: transparent;
}
@keyframes summon-preview-spin {
  to { transform: rotate(360deg); }
}
@keyframes summon-preview-breathe {
  0%, 100% { transform: scale(0.82); opacity: 0.42; }
  50% { transform: scale(1); opacity: 0.68; }
}
`;
}

function htmlSandboxFrameCss(): string {
  return `
html,
body,
#summon-html-root {
  min-height: 100%;
  margin: 0;
}
body {
  background: var(--color-bg, Canvas);
  color: var(--color-text, CanvasText);
  font-family: var(--font-sans, system-ui, sans-serif);
}
* {
  box-sizing: border-box;
}
img,
svg,
video,
canvas {
  max-width: 100%;
}
`;
}

function htmlSandboxBootstrap(sandboxId: string): string {
  return `
(() => {
  const sandboxId = ${JSON.stringify(sandboxId)};
  const pending = new Map();
  let requestSeq = 0;
  let currentState = {};
  const clone = (value) => {
    if (!value || typeof value !== 'object') return {};
    try { return JSON.parse(JSON.stringify(value)); } catch { return {}; }
  };
  const send = (type, payload = {}) => {
    window.parent.postMessage({ type, sandboxId, ...payload }, '*');
  };
  const fragmentFromHtml = (html) => {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    return template.content;
  };
  const applyPatch = (patch) => {
    if (!patch || patch.runtime !== 'html' || typeof patch.target !== 'string') return;
    const target = document.getElementById(patch.target);
    if (!target) return;
    if (patch.action === 'remove') {
      target.remove();
      return;
    }
    const fragment = fragmentFromHtml(patch.html);
    if (patch.action === 'append') {
      target.append(fragment);
      return;
    }
    if (patch.action === 'update') {
      target.replaceChildren(fragment);
      return;
    }
    if (patch.action === 'replace' || patch.action === 'morph') {
      target.replaceWith(fragment);
    }
  };
  window.summon = Object.freeze({
    getState() {
      return clone(currentState);
    },
    callTool(tool, args = {}) {
      const requestId = 'html-tool-' + (++requestSeq);
      send(${JSON.stringify(HTML_MESSAGE_TOOL)}, {
        requestId,
        tool: String(tool || ''),
        args: clone(args),
      });
      return new Promise((resolve) => {
        pending.set(requestId, resolve);
      });
    },
  });
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (!message || typeof message !== 'object' || message.sandboxId !== sandboxId) return;
    if (message.type === ${JSON.stringify(HTML_MESSAGE_STATE)}) {
      currentState = clone(message.state);
      return;
    }
    if (message.type === ${JSON.stringify(HTML_MESSAGE_PATCH)}) {
      applyPatch(message.patch);
      return;
    }
    if (message.type === ${JSON.stringify(HTML_MESSAGE_TOOL_RESULT)}) {
      const resolve = pending.get(message.requestId);
      if (resolve) {
        pending.delete(message.requestId);
        resolve(message.result || { ok: false, state: clone(currentState), error: 'missing result' });
      }
    }
  });
  send(${JSON.stringify(HTML_MESSAGE_READY)});
})();
`;
}

function sanitizeHtmlPreview(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*\/?\s*>/gi, '')
    .replace(/\s+on[a-z][\w:-]*\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(?:src|href|xlink:href|formaction|action|poster|data)\s*=\s*("(?:https?:|javascript:)[^"]*"|'(?:https?:|javascript:)[^']*'|(?:https?:|javascript:)[^\s>]+)/gi, '')
    .replace(/<\/?(?:iframe|object|embed|form|frame|frameset|portal|meta|base|link)\b[^>]*>/gi, '');
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function escapeStyleText(value: string): string {
  return value.replace(/<\/style/gi, '<\\/style');
}

function escapeScriptText(value: string): string {
  return value.replace(/<\/script/gi, '<\\/script');
}

function cspNonce(value: string): string {
  return value.replace(/[^A-Za-z0-9+/_=-]/g, '');
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  if (bytes.some(Boolean)) {
    return btoa(String.fromCharCode(...bytes)).replace(/=+$/, '');
  }
  return `nonce-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function randomSurfaceId(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto?.getRandomValues?.(bytes);
  if (bytes.some(Boolean)) {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `surface-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function cloneState(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    return {};
  }
}
