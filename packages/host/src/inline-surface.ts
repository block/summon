import type { EventStore } from '@summon-internal/devtools';
import type {
  ArrowSurfaceArtifact,
  SurfaceStatus,
  SurfaceEvent,
  ValidationTool,
} from '@summon-internal/engine';

export interface InlineSurfaceOptions {
  root: HTMLElement;
  artifact?: ArrowSurfaceArtifact | null;
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
  renderArtifact(artifact: ArrowSurfaceArtifact): void;
  pushState(state: Record<string, unknown>): void;
  applyPreviewEvent(event: SurfaceEvent): SurfacePreviewSnapshot;
  previewSnapshot(): SurfacePreviewSnapshot;
  dispose(): void;
}

const PREVIEW_ROOT_ATTR = 'data-summon-preview-root';
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
  let renderRevision = 0;
  let disposed = false;

  root.dataset.summonInlineSurface = surfaceId;
  root.classList.add('summon-inline-surface');
  installTokenStyle(root, surfaceId, options.tokensSource);
  renderPreview(root, preview.snapshot());

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

  const handle: InlineSurfaceHandle = {
    surfaceId,
    root,
    renderArtifact(artifact) {
      if (disposed) return;
      renderRevision += 1;
      const revision = renderRevision;
      if (arrowTeardown) {
        try {
          arrowTeardown();
        } catch {
          // best effort
        }
        arrowTeardown = null;
      }
      clearRuntimeChildren(root);
      options.events?.push({
        kind: 'render',
        at: Date.now(),
        surfaceId,
        bytes: JSON.stringify(artifact.source).length,
      });
      void loadSandboxFactory()
        .then((sandbox) => {
          if (disposed || revision !== renderRevision) return;
          const view = sandbox(
            {
              source: sourceForNetworkPolicy(artifact),
              shadowDOM: true,
              onError(error) {
                const reason = `Arrow runtime error: ${String(error instanceof Error ? error.message : error)}`;
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
              options.events?.push({ kind: 'rendered', at: Date.now(), surfaceId, revision });
            }
          });
        })
        .catch((err: unknown) => {
          if (disposed || revision !== renderRevision) return;
          const reason = `Arrow runtime failed to mount: ${err instanceof Error ? err.message : String(err)}`;
          reportRuntimeError(options, surfaceId, reason);
        });
    },
    pushState(state) {
      if (disposed) return;
      currentState = cloneState(state);
      notifyState();
    },
    applyPreviewEvent(event) {
      const snapshot = preview.apply(event);
      if (!root.querySelector('arrow-sandbox')) {
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
  if (options.artifact) handle.renderArtifact(options.artifact);
  return handle;
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

function renderPreview(root: HTMLElement, snapshot: SurfacePreviewSnapshot): void {
  let previewRoot = root.querySelector<HTMLElement>(`[${PREVIEW_ROOT_ATTR}]`);
  if (!previewRoot) {
    previewRoot = document.createElement('section');
    previewRoot.setAttribute(PREVIEW_ROOT_ATTR, 'true');
    root.append(previewRoot);
  }
  previewRoot.className = 'summon-preview';
  previewRoot.replaceChildren();
  previewRoot.dataset.summonPreviewStatus = snapshot.status?.status ?? 'planning';

  const ambient = document.createElement('div');
  ambient.className = 'summon-preview__ambient';
  ambient.setAttribute('aria-hidden', 'true');
  previewRoot.append(ambient);

  const header = document.createElement('div');
  header.className = 'summon-preview__header';
  const heading = document.createElement('div');
  heading.className = 'summon-preview__heading';
  const title = document.createElement('strong');
  title.textContent = snapshot.surface?.title ?? 'Surface forming';
  const meta = document.createElement('span');
  meta.textContent = snapshot.status?.text ?? statusLabel(snapshot.status?.status ?? 'planning');
  heading.append(title, meta);
  const kind = document.createElement('span');
  kind.className = 'summon-preview__kind';
  kind.textContent = snapshot.surface?.kind ?? 'preview';
  header.append(heading, kind);
  previewRoot.append(header);

  previewRoot.append(renderPreviewPhases(snapshot.status?.status ?? 'planning'));

  const body = document.createElement('div');
  body.className = 'summon-preview__body';
  const topLevel = snapshot.nodes.filter((node) => !node.parent || node.parent === snapshot.surface?.id);
  for (const node of topLevel.length ? topLevel : snapshot.nodes.slice(0, 4)) {
    body.append(renderPreviewNode(node, snapshot.nodes));
  }
  if (body.childElementCount === 0) {
    const shimmer = document.createElement('div');
    shimmer.className = 'summon-preview__shimmer';
    body.append(shimmer);
  }
  previewRoot.append(body);
}

const PREVIEW_PHASES: Array<{ status: SurfaceStatus; label: string }> = [
  { status: 'planning', label: 'Planning' },
  { status: 'contract', label: 'Contract' },
  { status: 'drafting', label: 'Drafting' },
  { status: 'validating', label: 'Validating' },
  { status: 'rendering', label: 'Rendering' },
];

function renderPreviewPhases(status: SurfaceStatus): HTMLElement {
  const phases = document.createElement('ol');
  phases.className = 'summon-preview__phases';
  const activeIndex = previewPhaseIndex(status);
  PREVIEW_PHASES.forEach((phase, index) => {
    const item = document.createElement('li');
    item.className = 'summon-preview__phase';
    if (index < activeIndex) item.dataset.state = 'complete';
    if (index === activeIndex) item.dataset.state = 'active';
    const marker = document.createElement('span');
    marker.className = 'summon-preview__phase-marker';
    marker.textContent = String(index + 1);
    const label = document.createElement('span');
    label.className = 'summon-preview__phase-label';
    label.textContent = phase.label;
    item.append(marker, label);
    phases.append(item);
  });
  return phases;
}

function previewPhaseIndex(status: SurfaceStatus): number {
  if (status === 'finalizing') return PREVIEW_PHASES.length - 1;
  const index = PREVIEW_PHASES.findIndex((phase) => phase.status === status);
  return index === -1 ? 0 : index;
}

function statusLabel(status: SurfaceStatus): string {
  return PREVIEW_PHASES.find((phase) => phase.status === status)?.label ?? 'Finalizing';
}

function renderPreviewNode(node: SurfacePreviewNode, all: SurfacePreviewNode[]): HTMLElement {
  const el = document.createElement('div');
  el.className = `summon-preview__node summon-preview__node--${safeClass(node.kind)}`;
  if (node.role) el.dataset.role = node.role;
  const label = document.createElement('span');
  label.className = 'summon-preview__label';
  label.textContent = node.label ?? stringProp(node.props, 'label') ?? node.role ?? node.kind;
  el.append(label);
  const text = stringProp(node.props, 'text') ?? stringProp(node.props, 'title') ?? stringProp(node.props, 'value');
  if (text) {
    const copy = document.createElement('p');
    copy.textContent = text;
    el.append(copy);
  }
  const children = all.filter((child) => child.parent === node.id);
  for (const child of children) el.append(renderPreviewNode(child, all));
  return el;
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

function scopeTokenCss(css: string, surfaceId: string): string {
  const selector = `[data-summon-inline-surface="${surfaceId}"]`;
  return css
    .replaceAll(':root', selector)
    .replace(/html\s*,\s*body\s*\{/g, `${selector} {`);
}

function defaultPreviewCss(surfaceId: string): string {
  return `
[data-summon-inline-surface="${surfaceId}"] {
  min-height: 100%;
  background:
    radial-gradient(circle at 16% 10%, color-mix(in srgb, var(--color-accent, #7c5cff) 18%, transparent), transparent 30%),
    radial-gradient(circle at 88% 0%, color-mix(in srgb, var(--color-text, CanvasText) 10%, transparent), transparent 26%),
    linear-gradient(135deg, var(--color-bg, Canvas), color-mix(in srgb, var(--color-surface, Canvas) 88%, var(--color-text, CanvasText) 5%));
  color: var(--color-text, CanvasText);
  font-family: var(--font-sans, system-ui, sans-serif);
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview {
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: clamp(18px, 3vw, 34px);
  min-height: 100%;
  padding: clamp(22px, 4vw, 54px);
  overflow: hidden;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-surface, Canvas) 76%, transparent), color-mix(in srgb, var(--color-bg, Canvas) 88%, transparent)),
    repeating-linear-gradient(90deg, color-mix(in srgb, var(--color-text, CanvasText) 5%, transparent) 0 1px, transparent 1px 72px),
    repeating-linear-gradient(0deg, color-mix(in srgb, var(--color-text, CanvasText) 4%, transparent) 0 1px, transparent 1px 72px);
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__ambient {
  position: absolute;
  inset: -30%;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(circle at 24% 24%, color-mix(in srgb, var(--color-accent, #7c5cff) 24%, transparent), transparent 24%),
    radial-gradient(circle at 76% 28%, color-mix(in srgb, var(--color-text, CanvasText) 10%, transparent), transparent 22%),
    conic-gradient(from 110deg at 50% 50%, transparent, color-mix(in srgb, var(--color-accent, #7c5cff) 16%, transparent), transparent 34%);
  filter: blur(18px);
  opacity: 0.72;
  animation: summon-preview-drift 9s ease-in-out infinite alternate;
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: clamp(16px, 3vw, 32px);
  padding: clamp(18px, 3vw, 30px);
  border: 1px solid color-mix(in srgb, var(--color-text, CanvasText) 12%, transparent);
  border-radius: clamp(20px, 3vw, 34px);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--color-surface, Canvas) 86%, transparent), color-mix(in srgb, var(--color-surface, Canvas) 48%, transparent));
  box-shadow:
    0 24px 90px color-mix(in srgb, var(--color-text, CanvasText) 10%, transparent),
    inset 0 1px 0 color-mix(in srgb, white 34%, transparent);
  backdrop-filter: blur(18px);
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__heading {
  display: grid;
  gap: var(--space-2, 8px);
  min-width: 0;
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__header strong {
  max-width: min(820px, 100%);
  overflow-wrap: anywhere;
  color: var(--color-text, CanvasText);
  font-size: clamp(30px, 6vw, 76px);
  font-weight: 780;
  letter-spacing: -0.058em;
  line-height: 0.88;
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__header span {
  max-width: 72ch;
  color: var(--color-text-muted, color-mix(in srgb, CanvasText 62%, transparent));
  font-size: clamp(13px, 1.45vw, 16px);
  line-height: 1.45;
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__kind {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 28ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 9px 12px;
  border: 1px solid color-mix(in srgb, var(--color-accent, CanvasText) 35%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-accent, CanvasText) 10%, transparent);
  color: var(--color-text, CanvasText);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__kind::before {
  content: '';
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--color-accent, CanvasText);
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-accent, CanvasText) 14%, transparent);
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__phases {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid color-mix(in srgb, var(--color-text, CanvasText) 10%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-surface, Canvas) 62%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 24%, transparent);
  overflow: hidden;
  backdrop-filter: blur(14px);
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__phase {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  min-width: 0;
  padding: 12px 14px;
  color: var(--color-text-muted, color-mix(in srgb, CanvasText 58%, transparent));
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__phase + .summon-preview__phase {
  border-left: 1px solid color-mix(in srgb, var(--color-text, CanvasText) 8%, transparent);
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__phase[data-state="active"] {
  color: var(--color-text, CanvasText);
  background: linear-gradient(90deg, color-mix(in srgb, var(--color-accent, CanvasText) 18%, transparent), transparent 88%);
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__phase[data-state="complete"] {
  color: color-mix(in srgb, var(--color-text, CanvasText) 78%, transparent);
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__phase-marker {
  display: inline-grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--color-text, CanvasText) 14%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-bg, Canvas) 72%, transparent);
  color: inherit;
  font-size: 11px;
  font-weight: 800;
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__phase[data-state="active"] .summon-preview__phase-marker {
  border-color: var(--color-accent, CanvasText);
  background: var(--color-accent, CanvasText);
  color: var(--color-accent-fg, Canvas);
  box-shadow: 0 0 0 7px color-mix(in srgb, var(--color-accent, CanvasText) 14%, transparent);
  animation: summon-preview-pulse 1.8s ease-in-out infinite;
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__phase[data-state="complete"] .summon-preview__phase-marker {
  border-color: color-mix(in srgb, var(--color-accent, CanvasText) 42%, transparent);
  color: var(--color-accent, CanvasText);
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__phase-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 760;
  letter-spacing: 0.045em;
  text-transform: uppercase;
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__body {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(220px, 0.8fr);
  align-content: start;
  gap: clamp(14px, 2vw, 22px);
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__node {
  position: relative;
  display: grid;
  gap: 12px;
  min-height: 128px;
  padding: clamp(16px, 2vw, 22px);
  border: 1px solid color-mix(in srgb, var(--color-text, CanvasText) 10%, transparent);
  border-radius: clamp(16px, 2vw, 24px);
  background: linear-gradient(145deg, color-mix(in srgb, var(--color-surface, Canvas) 76%, transparent), color-mix(in srgb, var(--color-bg, Canvas) 56%, transparent));
  box-shadow:
    0 18px 60px color-mix(in srgb, var(--color-text, CanvasText) 8%, transparent),
    inset 0 1px 0 color-mix(in srgb, white 22%, transparent);
  overflow: hidden;
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__node::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: linear-gradient(var(--color-accent, CanvasText), transparent);
  opacity: 0.88;
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__node[data-role="status"] {
  grid-column: 1 / -1;
  min-height: 150px;
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__label {
  color: var(--color-text-muted, color-mix(in srgb, CanvasText 58%, transparent));
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__node p {
  max-width: 70ch;
  margin: 0;
  color: var(--color-text, CanvasText);
  font-size: clamp(14px, 1.55vw, 17px);
  line-height: 1.48;
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__node .summon-preview__node {
  min-height: 72px;
  padding: 12px 14px;
  border-radius: 14px;
  box-shadow: none;
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__shimmer {
  min-height: 210px;
  border: 1px solid color-mix(in srgb, var(--color-text, CanvasText) 10%, transparent);
  border-radius: clamp(18px, 2vw, 28px);
  background:
    linear-gradient(110deg, transparent 0 28%, color-mix(in srgb, white 22%, transparent) 42%, transparent 56%),
    linear-gradient(180deg, color-mix(in srgb, var(--color-surface, Canvas) 74%, transparent), color-mix(in srgb, var(--color-bg, Canvas) 58%, transparent));
  background-size: 220% 100%, 100% 100%;
  animation: summon-preview-shimmer 1.8s linear infinite;
}
@keyframes summon-preview-pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-accent, CanvasText) 13%, transparent); }
  50% { transform: scale(1.06); box-shadow: 0 0 0 11px color-mix(in srgb, var(--color-accent, CanvasText) 5%, transparent); }
}
@keyframes summon-preview-shimmer {
  from { background-position: 180% 0, 0 0; }
  to { background-position: -60% 0, 0 0; }
}
@keyframes summon-preview-drift {
  from { transform: translate3d(-2%, -1%, 0) scale(1); }
  to { transform: translate3d(2%, 1.5%, 0) scale(1.04); }
}
@media (max-width: 860px) {
  [data-summon-inline-surface="${surfaceId}"] .summon-preview__header,
  [data-summon-inline-surface="${surfaceId}"] .summon-preview__body {
    grid-template-columns: 1fr;
  }
  [data-summon-inline-surface="${surfaceId}"] .summon-preview__phases {
    grid-template-columns: 1fr;
    border-radius: 22px;
  }
  [data-summon-inline-surface="${surfaceId}"] .summon-preview__phase + .summon-preview__phase {
    border-left: 0;
    border-top: 1px solid color-mix(in srgb, var(--color-text, CanvasText) 8%, transparent);
  }
}
`;
}

function stringProp(props: Record<string, unknown>, name: string): string | null {
  const value = props[name];
  return typeof value === 'string' ? value : null;
}

function safeClass(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
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
