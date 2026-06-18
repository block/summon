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
  background: var(--color-bg, Canvas);
  color: var(--color-text, CanvasText);
  font-family: var(--font-sans, system-ui, sans-serif);
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview {
  display: grid;
  gap: var(--space-5, 24px);
  min-height: 220px;
  padding: var(--space-5, 24px);
  background: var(--color-surface, Canvas);
  border: 1px solid var(--color-border, color-mix(in srgb, CanvasText 14%, transparent));
  border-radius: var(--radius-md, 10px);
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3, 12px);
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__heading {
  display: grid;
  gap: var(--space-1, 4px);
  min-width: 0;
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__header strong {
  font-size: var(--text-lg, 18px);
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__header span,
[data-summon-inline-surface="${surfaceId}"] .summon-preview__label {
  color: var(--color-text-muted, color-mix(in srgb, CanvasText 60%, transparent));
  font-size: var(--text-sm, 13px);
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__kind {
  flex: 0 0 auto;
  max-width: 28ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-muted, color-mix(in srgb, CanvasText 60%, transparent));
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__phases {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--space-2, 8px);
  margin: 0;
  padding: 0;
  list-style: none;
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__phase {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-2, 8px);
  min-width: 0;
  padding: var(--space-2, 8px);
  border: 1px solid var(--color-border, color-mix(in srgb, CanvasText 14%, transparent));
  border-radius: var(--radius-sm, 6px);
  color: var(--color-text-muted, color-mix(in srgb, CanvasText 60%, transparent));
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__phase[data-state="active"] {
  border-color: var(--color-accent, CanvasText);
  color: var(--color-text, CanvasText);
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__phase[data-state="complete"] {
  background: var(--color-surface-muted, color-mix(in srgb, CanvasText 5%, Canvas));
  color: var(--color-text, CanvasText);
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__phase-marker {
  display: inline-grid;
  width: 1.4em;
  height: 1.4em;
  place-items: center;
  border-radius: 999px;
  background: var(--color-surface-muted, color-mix(in srgb, CanvasText 5%, Canvas));
  font-size: var(--text-xs, 11px);
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__phase[data-state="active"] .summon-preview__phase-marker {
  background: var(--color-accent, CanvasText);
  color: var(--color-accent-fg, Canvas);
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__phase-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-xs, 11px);
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__body {
  display: grid;
  gap: var(--space-3, 12px);
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__node {
  display: grid;
  gap: var(--space-2, 8px);
  padding: var(--space-4, 16px);
  background: var(--color-surface-muted, color-mix(in srgb, CanvasText 5%, Canvas));
  border-radius: var(--radius-sm, 6px);
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__node p {
  margin: 0;
}
[data-summon-inline-surface="${surfaceId}"] .summon-preview__shimmer {
  min-height: 96px;
  border-radius: var(--radius-sm, 6px);
  background: linear-gradient(90deg, transparent, color-mix(in srgb, CanvasText 8%, transparent), transparent);
}
@media (max-width: 700px) {
  [data-summon-inline-surface="${surfaceId}"] .summon-preview__phases {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
