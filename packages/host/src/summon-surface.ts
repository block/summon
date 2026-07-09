import type { EventStore } from '@summon-internal/devtools';
import type {
  SurfaceDocumentArtifact,
  SurfaceStatus,
  SurfaceEvent,
  ValidationTool,
} from '@summon-internal/engine';

import { buildSurfaceDocumentModules, mountSurface } from '@summon-internal/surface-vm';
import { installFontFaces, type InstalledFontFaces } from './font-faces.js';
import { mountDraftingApparition, type ApparitionHandle } from './drafting-apparition.js';

export type SummonSurfaceArtifact = SurfaceDocumentArtifact;

export interface SummonSurfaceOptions {
  root: HTMLElement;
  artifact?: SummonSurfaceArtifact | null;
  grantedTools: string[];
  validationTools?: ValidationTool[];
  initialState?: Record<string, unknown>;
  tokensSource?: string;
  /**
   * Host-owned `@font-face` CSS. Installed into the document head (font
   * faces are document-scoped and do not load inside shadow roots) after
   * sanitization to @font-face blocks only; deduplicated and refcounted
   * across live surfaces. Generated `main.css` never carries fonts — token
   * stacks reference the family and fall back to system fonts when absent.
   */
  fontFacesSource?: string;
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

export type SummonSurfaceLifecycle = 'preview' | 'rendering' | 'rendered' | 'failed';

export interface SummonSurfaceHandle {
  surfaceId: string;
  root: HTMLElement;
  renderArtifact(artifact: SummonSurfaceArtifact): void;
  pushState(state: Record<string, unknown>): void;
  applyPreviewEvent(event: SurfaceEvent): SurfacePreviewSnapshot;
  previewSnapshot(): SurfacePreviewSnapshot;
  /** Host-owned render lifecycle: drafting preview, artifact mounting, rendered, or failed. */
  lifecycle(): SummonSurfaceLifecycle;
  dispose(): void;
}

const PREVIEW_ROOT_ATTR = 'data-summon-preview-root';

// Live apparition canvases keyed by their drafting root. WeakMap so a
// drafting root removed by any path (dispose, clearRuntimeChildren) cannot
// leak its handle; the apparition also self-destroys when disconnected.
const apparitions = new WeakMap<HTMLElement, ApparitionHandle>();

function destroyApparition(root: HTMLElement): void {
  const draftingRoot = root.querySelector<HTMLElement>(`[${PREVIEW_ROOT_ATTR}]`);
  if (!draftingRoot) return;
  apparitions.get(draftingRoot)?.destroy();
  apparitions.delete(draftingRoot);
}

interface SummonSurfaceToolCallOptions {
  surfaceId: string;
  toolAllowlist: ReadonlySet<string>;
  currentState: Record<string, unknown>;
  tool: unknown;
  rawArgs: unknown;
  onToolCall?: SummonSurfaceOptions['onToolCall'];
  onToolRejected?: SummonSurfaceOptions['onToolRejected'];
  events?: EventStore;
}

interface SummonSurfaceToolCallResult {
  ok: boolean;
  state: Record<string, unknown>;
  error?: string;
  stateChanged: boolean;
}

export async function resolveSummonSurfaceToolCall(options: SummonSurfaceToolCallOptions): Promise<SummonSurfaceToolCallResult> {
  const { currentState, events, onToolCall, onToolRejected, rawArgs, surfaceId, tool, toolAllowlist } = options;
  if (typeof tool !== 'string' || !tool) {
    return rejectSummonSurfaceToolCall('tool not a non-empty string', {
      currentState,
      events,
      onToolRejected,
      raw: { tool, args: rawArgs },
      surfaceId,
    });
  }
  if (!toolAllowlist.has(tool)) {
    return rejectSummonSurfaceToolCall(`tool "${tool}" not granted`, {
      currentState,
      events,
      onToolRejected,
      raw: { tool, args: rawArgs },
      surfaceId,
    });
  }
  if (!onToolCall) {
    return rejectSummonSurfaceToolCall(`tool "${tool}" has no host handler`, {
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

function rejectSummonSurfaceToolCall(
  error: string,
  options: {
    currentState: Record<string, unknown>;
    raw: unknown;
    onToolRejected?: SummonSurfaceOptions['onToolRejected'];
    events?: EventStore;
    surfaceId?: string;
  },
): SummonSurfaceToolCallResult {
  options.events?.push({ kind: 'tool-rejected', at: Date.now(), surfaceId: options.surfaceId, reason: error, raw: options.raw });
  options.onToolRejected?.(error, options.raw);
  return { ok: false, state: cloneState(options.currentState), error, stateChanged: false };
}


export function mountSummonSurface(options: SummonSurfaceOptions): SummonSurfaceHandle {
  const surfaceId = randomSurfaceId();
  const root = options.root;
  const toolAllowlist = new Set(options.grantedTools);
  const subscribers = new Set<(state: Record<string, unknown>) => void>();
  const preview = createPreviewState();
  let currentState = cloneState(options.initialState);
  // The mounted surface-vm surface, if an artifact has been rendered.
  let vmSurface: { pushState(state: Record<string, unknown>): void; destroy(): void } | null = null;
  let vmStateListener: ((state: Record<string, unknown>) => void) | null = null;
  let renderRevision = 0;
  // Preview status events can arrive after an accepted artifact line but before
  // the surface-vm DOM exists. Track the host-owned render lifecycle instead
  // of inferring it from DOM shape so late "finalizing" events cannot redraw the
  // pulsing preview over a real surface. Keep the previous/preview surface in
  // place until the runtime is ready to avoid a blank handoff.
  let renderState: 'preview' | 'rendering' | 'rendered' | 'failed' = 'preview';
  let disposed = false;

  root.dataset.summonSurface = surfaceId;
  root.classList.add('summon-surface');
  installTokenStyle(root, surfaceId, options.tokensSource);
  const installedFontFaces: InstalledFontFaces | null = installFontFaces(
    options.fontFacesSource,
    root.ownerDocument,
  );

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
    const result = await resolveSummonSurfaceToolCall({
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

  const teardownVmRuntime = () => {
    if (vmStateListener) {
      subscribers.delete(vmStateListener);
      vmStateListener = null;
    }
    if (vmSurface) {
      try {
        vmSurface.destroy();
      } catch {
        // best effort
      }
    }
    vmSurface = null;
  };

  const renderSurfaceDocumentArtifact = (artifact: SurfaceDocumentArtifact, revision: number) => {
    teardownVmRuntime();
    renderState = 'rendering';
    // Keep the drafting surface in place during the async VM mount so the
    // handoff is drafting -> rendered with no blank frame. Everything else
    // from a previous render is torn down now.
    clearRuntimeChildren(root, { keepPreview: true });

    const shadowHost = document.createElement('div');
    shadowHost.className = 'summon-surface-document-host';
    shadowHost.dataset.summonEntering = 'true';
    shadowHost.setAttribute('part', 'surface-document-host');
    const shadowRoot = shadowHost.attachShadow({ mode: 'open' });

    const baseStyle = document.createElement('style');
    baseStyle.dataset.summonShadowBase = surfaceId;
    baseStyle.textContent = surfaceDocumentShadowBaseCss();
    shadowRoot.append(baseStyle);

    if (options.tokensSource?.trim()) {
      const tokenStyle = document.createElement('style');
      tokenStyle.dataset.summonShadowTokens = surfaceId;
      tokenStyle.textContent = shadowSurfaceCss(options.tokensSource);
      shadowRoot.append(tokenStyle);
    }

    const artifactCss = artifact.source['main.css'];
    if (typeof artifactCss === 'string' && artifactCss.trim()) {
      const styleEl = document.createElement('style');
      styleEl.dataset.summonShadowArtifactCss = surfaceId;
      styleEl.textContent = shadowSurfaceCss(artifactCss);
      shadowRoot.append(styleEl);
    }

    const mountPoint = document.createElement('div');
    mountPoint.className = 'summon-surface-document-mount';
    shadowRoot.append(mountPoint);
    root.append(shadowHost);

    const { modules, entryPath } = buildSurfaceDocumentModules({
      html: artifact.source['main.html'],
      ...(typeof artifact.source['main.js'] === 'string' ? { behaviorEntry: artifact.source['main.js'] } : {}),
    });
    void mountSurface({
      modules,
      entryPath,
      root: mountPoint,
      initialState: cloneState(currentState),
      hostBridge: (tool, args) => callToolInternal(tool, args as Record<string, unknown>),
      onError(reason) {
        if (disposed || revision !== renderRevision) return;
        renderState = 'failed';
        teardownVmRuntime();
        clearRuntimeChildren(root);
        renderRuntimeError(root, `Surface Document runtime error: ${reason}`);
        reportRuntimeError(options, surfaceId, `Surface Document runtime error: ${reason}`);
      },
    })
      .then((surface) => {
        // A hydrate-time error may have already failed this revision via
        // onError even though the mount promise resolved; keep the surface
        // handle for teardown but do not overwrite the failed state.
        if (disposed || revision !== renderRevision) {
          try {
            surface.destroy();
          } catch {
            // best effort
          }
          return;
        }
        if (renderState === 'failed') {
          vmSurface = surface;
          return;
        }
        vmSurface = surface;
        const listener = (state: Record<string, unknown>) => surface.pushState(state);
        subscribers.add(listener);
        vmStateListener = listener;
        renderState = 'rendered';
        completeDraftingHandoff(root);
        options.events?.push({ kind: 'rendered', at: Date.now(), surfaceId, revision });
      })
      .catch((err: unknown) => {
        if (disposed || revision !== renderRevision) return;
        renderState = 'failed';
        const reason = `Surface Document runtime failed to mount: ${err instanceof Error ? err.message : String(err)}`;
        clearRuntimeChildren(root);
        renderRuntimeError(root, reason);
        reportRuntimeError(options, surfaceId, reason);
      });
  };

  const handle: SummonSurfaceHandle = {
    surfaceId,
    root,
    renderArtifact(artifact) {
      if (disposed) return;
      renderRevision += 1;
      const revision = renderRevision;
      options.events?.push({
        kind: 'render',
        at: Date.now(),
        surfaceId,
        bytes: JSON.stringify(artifact.source).length,
      });
      renderSurfaceDocumentArtifact(artifact, revision);
    },
    pushState(state) {
      if (disposed) return;
      currentState = cloneState(state);
      notifyState();
    },
    applyPreviewEvent(event) {
      const snapshot = preview.apply(event);
      // The drafting surface stays live through 'rendering' (it is kept in
      // place until the VM mount lands) and re-enters after 'failed'. Only a
      // rendered surface is immune to late status events.
      if (renderState !== 'rendered') {
        renderDraftingSurface(root, snapshot);
      }
      options.events?.push({ kind: 'surface-preview-event', at: Date.now(), surfaceId, event });
      return snapshot;
    },
    previewSnapshot() {
      return preview.snapshot();
    },
    lifecycle() {
      return renderState;
    },
    dispose() {
      disposed = true;
      installedFontFaces?.release();
      teardownVmRuntime();
      subscribers.clear();
      destroyApparition(root);
      root.replaceChildren();
      root.classList.remove('summon-surface');
      delete root.dataset.summonSurface;
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
    renderDraftingSurface(root, preview.snapshot());
  }
  return handle;
}

function reportRuntimeError(
  options: Pick<SummonSurfaceOptions, 'events' | 'onRuntimeError'>,
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

/** Host-owned copy for each drafting phase. Status text from the stream
 * overrides the kicker detail; these are the fallbacks. */
const DRAFTING_PHASE_LABELS: Record<SurfaceStatus, string> = {
  planning: 'Reading the request',
  contract: 'Binding the host contract',
  drafting: 'Composing the surface',
  validating: 'Checking against the contract',
  rendering: 'Rendering',
  finalizing: 'Finalizing',
};

/**
 * Render the fingerprint-derived drafting surface. Everything here is
 * host-owned: styled from the same token source as the final artifact and
 * driven only by validated stream metadata. No model output is painted.
 * See docs/spec/surface-document.md "Generation-time presentation".
 */
function renderDraftingSurface(root: HTMLElement, snapshot: SurfacePreviewSnapshot): void {
  // Re-entering drafting supersedes a runtime-error card from a failed pass.
  root.querySelector('.summon-runtime-error')?.remove();

  let draftingRoot = root.querySelector<HTMLElement>(`[${PREVIEW_ROOT_ATTR}]`);
  const firstPaint = !draftingRoot;
  if (!draftingRoot) {
    draftingRoot = document.createElement('section');
    draftingRoot.setAttribute(PREVIEW_ROOT_ATTR, 'true');
    draftingRoot.setAttribute('role', 'status');
    draftingRoot.setAttribute('aria-live', 'polite');
    draftingRoot.className = 'summon-drafting';

    const material = document.createElement('div');
    material.className = 'summon-drafting__material';
    material.setAttribute('aria-hidden', 'true');

    const kicker = document.createElement('span');
    kicker.className = 'summon-drafting__kicker';

    const detail = document.createElement('p');
    detail.className = 'summon-drafting__detail';

    draftingRoot.append(material, kicker, detail);
    root.append(draftingRoot);

    // The apparition canvas is the loading visual: the surface being
    // conjured out of dithered ink. Falls back to the CSS-only treatment
    // when a canvas context is unavailable.
    const apparition = mountDraftingApparition(draftingRoot);
    if (apparition) apparitions.set(draftingRoot, apparition);
  }

  const status = snapshot.status?.status ?? 'planning';
  // A phase that moves backwards (e.g. rendering -> validating) means the
  // server blocked a bundle and re-entered a repair pass. Mark it so the
  // drafting surface can present repair honestly instead of freezing.
  const previous = draftingRoot.dataset.summonDraftingPhase as SurfaceStatus | undefined;
  if (!firstPaint && previous && phaseRank(status) < phaseRank(previous)) {
    draftingRoot.dataset.summonDraftingRepair = 'true';
  }
  draftingRoot.dataset.summonDraftingPhase = status;

  // Drive the apparition from validated metadata only: phase rank plus the
  // ids of nodes the stream has accepted. Node ids seed skeleton geometry;
  // no model-authored content reaches the canvas.
  apparitions.get(draftingRoot)?.update({
    phaseRank: phaseRank(status),
    nodeIds: snapshot.nodes.map((node) => node.id),
    repair: Boolean(draftingRoot.dataset.summonDraftingRepair),
  });

  const kicker = draftingRoot.querySelector<HTMLElement>('.summon-drafting__kicker');
  if (kicker) {
    kicker.textContent = snapshot.surface?.title ?? DRAFTING_PHASE_LABELS[status] ?? 'Composing';
  }
  const detail = draftingRoot.querySelector<HTMLElement>('.summon-drafting__detail');
  if (detail) {
    detail.textContent = snapshot.status?.text ?? '';
    detail.hidden = !snapshot.status?.text;
  }
}

const DRAFTING_PHASE_ORDER: readonly SurfaceStatus[] = [
  'planning',
  'contract',
  'drafting',
  'validating',
  'rendering',
  'finalizing',
];

function phaseRank(status: SurfaceStatus): number {
  const rank = DRAFTING_PHASE_ORDER.indexOf(status);
  return rank === -1 ? 0 : rank;
}

/**
 * Finish the drafting -> rendered handoff: fade the drafting surface out and
 * reveal the mounted artifact. Both transitions come from the drafting CSS and
 * collapse to instant swaps under prefers-reduced-motion.
 */
function completeDraftingHandoff(root: HTMLElement): void {
  const shadowHost = root.querySelector<HTMLElement>('.summon-surface-document-host');
  if (shadowHost) delete shadowHost.dataset.summonEntering;

  const draftingRoot = root.querySelector<HTMLElement>(`[${PREVIEW_ROOT_ATTR}]`);
  if (!draftingRoot) return;
  const reducedMotion = typeof globalThis.matchMedia === 'function'
    && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    apparitions.get(draftingRoot)?.destroy();
    apparitions.delete(draftingRoot);
    draftingRoot.remove();
    return;
  }
  draftingRoot.dataset.summonDraftingLeaving = 'true';
  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    apparitions.get(draftingRoot)?.destroy();
    apparitions.delete(draftingRoot);
    draftingRoot.remove();
  };
  draftingRoot.addEventListener('transitionend', remove, { once: true });
  // Fallback in case transitions are unavailable (e.g. non-browser DOM).
  setTimeout(remove, 400);
}

function installTokenStyle(root: HTMLElement, surfaceId: string, tokensSource?: string): void {
  const style = document.createElement('style');
  style.dataset.summonSurfaceTokens = surfaceId;
  style.textContent = [
    scopeTokenCss(tokensSource ?? '', surfaceId),
    defaultPreviewCss(surfaceId),
  ].join('\n');
  root.prepend(style);
}

function clearRuntimeChildren(root: HTMLElement, opts?: { keepPreview?: boolean }): void {
  if (!opts?.keepPreview) destroyApparition(root);
  for (const child of Array.from(root.children)) {
    if (child instanceof HTMLStyleElement && child.dataset.summonSurfaceTokens) continue;
    if (opts?.keepPreview && child instanceof HTMLElement && child.hasAttribute(PREVIEW_ROOT_ATTR)) continue;
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
  return scopeCssRules(css, `[data-summon-surface="${escapeCssIdentifier(surfaceId)}"]`);
}

export function shadowSurfaceCss(css: string): string {
  return mapCssRootSelectors(css, {
    root: ':host',
    document: '.summon-surface-document-mount',
  });
}

function surfaceDocumentShadowBaseCss(): string {
  return `
:host {
  display: block;
  contain: layout paint style;
  isolation: isolate;
}

.summon-surface-document-mount {
  display: block;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  color: var(--color-text, CanvasText);
  background: var(--color-bg, Canvas);
  font-family: var(--font-sans, system-ui, sans-serif);
}

.summon-surface-document-mount,
.summon-surface-document-mount *,
.summon-surface-document-mount *::before,
.summon-surface-document-mount *::after {
  box-sizing: border-box;
}
`;
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

  const rootScoped = mapDocumentRootSelector(trimmed, {
    root: rootSelector,
    document: rootSelector,
  });
  if (rootScoped !== trimmed) {
    return `${leadingTrivia}${rootScoped}${trailingWhitespace}`;
  }

  return `${leadingTrivia}${rootSelector} ${trimmed}${trailingWhitespace}`;
}

function mapCssRootSelectors(css: string, selectors: { root: string; document: string }): string {
  return transformCssSelectors(css, (selector) => mapOneRootSelector(selector, selectors));
}

function transformCssSelectors(css: string, transform: (selector: string) => string): string {
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
      output += prelude + '{' + (atRuleContainsStyleRules(atRuleName) ? transformCssSelectors(block, transform) : block) + '}';
    } else {
      output += splitSelectorList(prelude).map(transform).join(',') + '{' + block + '}';
    }
    cursor = close + 1;
  }

  return output;
}

function mapOneRootSelector(selector: string, selectors: { root: string; document: string }): string {
  const leadingTriviaLength = leadingCssTriviaLength(selector);
  const leadingTrivia = selector.slice(0, leadingTriviaLength);
  const selectorBody = selector.slice(leadingTriviaLength);
  const trailingWhitespace = selector.match(/\s*$/)?.[0] ?? '';
  const trimmed = selectorBody.trim();
  if (!trimmed) return selector;
  const mapped = mapDocumentRootSelector(trimmed, selectors);
  return `${leadingTrivia}${mapped}${trailingWhitespace}`;
}

function mapDocumentRootSelector(selector: string, selectors: { root: string; document: string }): string {
  return selector
    .replace(/^:root\b/, selectors.root)
    .replace(/^html\b/, selectors.document)
    .replace(/^body\b/, selectors.document);
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
[data-summon-surface="${surfaceId}"] {
  position: relative;
  background: var(--color-bg, Canvas);
  color: var(--color-text, CanvasText);
  font-family: var(--font-sans, system-ui, sans-serif);
}

/* Drafting surface: host-owned, styled entirely from fingerprint tokens.
 * The apparition canvas is the visual — a dithered conjuring of the surface
 * being summoned, drawn in the fingerprint's text and accent inks. The
 * kicker/detail sit quietly at the bottom edge and stay legible over it. */
[data-summon-surface="${surfaceId}"] .summon-drafting {
  position: relative;
  isolation: isolate;
  display: grid;
  min-height: 100%;
  align-content: end;
  justify-items: start;
  gap: var(--space-1, 4px);
  overflow: hidden;
  padding: var(--space-8, 40px) var(--space-7, 32px) var(--space-6, 24px);
  background: var(--color-bg, Canvas);
  transition: opacity 320ms ease;
}
[data-summon-surface="${surfaceId}"] .summon-drafting[data-summon-drafting-leaving] {
  position: absolute;
  inset: 0;
  z-index: 1;
  opacity: 0;
  pointer-events: none;
}
[data-summon-surface="${surfaceId}"] .summon-drafting__material {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--color-accent, CanvasText) 7%, transparent), transparent 52%),
    linear-gradient(160deg, var(--color-bg, Canvas), color-mix(in srgb, var(--color-surface, Canvas) 72%, var(--color-bg, Canvas)));
}
[data-summon-surface="${surfaceId}"] .summon-drafting__apparition {
  position: absolute;
  inset: 0;
  z-index: -1;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
  image-rendering: pixelated;
}
[data-summon-surface="${surfaceId}"] .summon-drafting__kicker {
  color: var(--color-text, CanvasText);
  font-family: var(--font-serif, var(--font-sans, system-ui, sans-serif));
  font-size: var(--text-md, 15px);
  line-height: var(--leading-display, 1.15);
  letter-spacing: var(--tracking-display, normal);
}
[data-summon-surface="${surfaceId}"] .summon-drafting__detail {
  margin: 0;
  max-width: 52ch;
  color: var(--color-text-muted, color-mix(in srgb, CanvasText 54%, transparent));
  font-size: var(--text-sm, 13px);
  line-height: var(--leading-body, 1.5);
  letter-spacing: var(--tracking-label, 0.02em);
}


/* The mounted artifact fades in underneath the departing drafting surface. */
[data-summon-surface="${surfaceId}"] .summon-surface-document-host {
  transition: opacity 280ms ease;
}
[data-summon-surface="${surfaceId}"] .summon-surface-document-host[data-summon-entering] {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  [data-summon-surface="${surfaceId}"] .summon-drafting,
  [data-summon-surface="${surfaceId}"] .summon-surface-document-host {
    transition: none;
  }
}
[data-summon-surface="${surfaceId}"] .summon-runtime-error {
  display: grid;
  align-content: center;
  gap: 12px;
  min-height: 100%;
  padding: clamp(24px, 6vw, 72px);
  background: var(--color-bg, Canvas);
  color: var(--color-text, CanvasText);
}
[data-summon-surface="${surfaceId}"] .summon-runtime-error__kicker {
  color: var(--color-text-muted, color-mix(in srgb, CanvasText 62%, transparent));
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}
[data-summon-surface="${surfaceId}"] .summon-runtime-error p {
  max-width: 72ch;
  margin: 0;
  color: var(--color-text, CanvasText);
  font-size: clamp(15px, 2vw, 20px);
  line-height: 1.45;
}
`;
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
