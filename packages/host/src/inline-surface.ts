import type { EventStore } from '@summon-internal/devtools';
import type {
  SurfaceDocumentArtifact,
  SurfaceStatus,
  SurfaceEvent,
  ValidationTool,
} from '@summon-internal/engine';

import { buildSurfaceDocumentModules, mountSurface } from '@summon-internal/surface-vm';

export type InlineSurfaceArtifact = SurfaceDocumentArtifact;

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
  pushState(state: Record<string, unknown>): void;
  applyPreviewEvent(event: SurfaceEvent): SurfacePreviewSnapshot;
  previewSnapshot(): SurfacePreviewSnapshot;
  dispose(): void;
}

const PREVIEW_ROOT_ATTR = 'data-summon-preview-root';

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


export function mountInlineSurface(options: InlineSurfaceOptions): InlineSurfaceHandle {
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
    clearRuntimeChildren(root);

    const shadowHost = document.createElement('div');
    shadowHost.className = 'summon-surface-document-host';
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
        if (disposed || revision !== renderRevision) {
          try {
            surface.destroy();
          } catch {
            // best effort
          }
          return;
        }
        vmSurface = surface;
        const listener = (state: Record<string, unknown>) => surface.pushState(state);
        subscribers.add(listener);
        vmStateListener = listener;
        renderState = 'rendered';
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

  const handle: InlineSurfaceHandle = {
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
      teardownVmRuntime();
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
@keyframes summon-preview-spin {
  to { transform: rotate(360deg); }
}
@keyframes summon-preview-breathe {
  0%, 100% { transform: scale(0.82); opacity: 0.42; }
  50% { transform: scale(1); opacity: 0.68; }
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
