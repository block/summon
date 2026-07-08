import type { ToolRegistry } from '@decentralized-design/summon';
import {
  isSurfaceDocumentArtifact,
  type ArtifactLine,
  type SurfaceDocumentArtifact,
  type SurfaceEvent,
  type ValidationTool,
} from '@decentralized-design/summon/engine';
import {
  mountSummonSurface,
  type SummonSurfaceHandle as MountedSummonSurfaceHandle,
  type SummonSurfaceLifecycle,
  type SurfacePreviewSnapshot,
} from '@decentralized-design/summon/browser';
import { createEventStore, type DevtoolsEvent } from '@decentralized-design/summon/devtools';
import type { SurfaceEnvelope } from '@decentralized-design/summon/envelope';
import { PolicyEngine } from '@decentralized-design/summon/policy';
import {
  tokensSource as defaultTokensSource,
} from '@decentralized-design/summon/assets';
import {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type CSSProperties,
} from 'react';

export interface SummonSurfaceProps {
  envelope?: SurfaceEnvelope | null;
  artifact?: SummonRenderableArtifact | null;
  grantedTools?: string[];
  validationTools?: ValidationTool[];
  toolRegistry?: ToolRegistry | null;
  tokensSource?: string;
  /** Host-owned @font-face CSS; installed document-level, refcounted. */
  fontFacesSource?: string;
  initialState?: Record<string, unknown>;
  onToolCall?: (tool: string, args: Record<string, unknown>) =>
    | void
    | Record<string, unknown>
    | Promise<void | Record<string, unknown>>;
  onToolRejected?: (reason: string, raw: unknown) => void;
  onEvent?: (event: DevtoolsEvent) => void;
  onRuntimeError?: (reason: string) => void;
  onHandlerError?: (tool: string, error: Error) => void;
  id?: string;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

export interface SummonSurfaceHandle {
  root: HTMLDivElement | null;
  surfaceId: string | null;
  renderArtifact(artifact: SummonRenderableArtifact): void;
  pushState(state: Record<string, unknown>): void;
  applyPreviewEvent(event: SurfaceEvent): SurfacePreviewSnapshot | null;
  /** Host-owned render lifecycle: 'preview' | 'rendering' | 'rendered' | 'failed'. */
  lifecycle(): SummonSurfaceLifecycle | null;
}

export type SummonRenderableArtifact = SurfaceDocumentArtifact;

export const SummonSurface = forwardRef<SummonSurfaceHandle, SummonSurfaceProps>(function SummonSurface(
  props,
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<MountedSummonSurfaceHandle | null>(null);
  const lastRenderedArtifactRef = useRef<SummonRenderableArtifact | null>(null);
  const events = useMemo(() => createEventStore(), []);

  useImperativeHandle(ref, () => ({
    get root() {
      return rootRef.current;
    },
    get surfaceId() {
      return handleRef.current?.surfaceId ?? null;
    },
    renderArtifact(artifact: SummonRenderableArtifact) {
      lastRenderedArtifactRef.current = artifact;
      handleRef.current?.renderArtifact(artifact);
    },
    pushState(state: Record<string, unknown>) {
      handleRef.current?.pushState(state);
    },
    applyPreviewEvent(event: SurfaceEvent) {
      return handleRef.current?.applyPreviewEvent(event) ?? null;
    },
    lifecycle() {
      return handleRef.current?.lifecycle() ?? null;
    },
  }), []);

  useEffect(() => {
    lastRenderedArtifactRef.current = null;
  }, [props.envelope, props.artifact]);

  useEffect(() => {
    if (!props.onEvent) return;
    return events.subscribe(() => {
      const latest = events.snapshot().at(-1);
      if (latest) props.onEvent?.(latest);
    });
  }, [events, props.onEvent]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const contract = props.toolRegistry?.toContract();
    const handlers = props.toolRegistry?.toPolicyHandlers() ?? {};
    const grantedTools = props.grantedTools ??
      props.envelope?.grants.tools ??
      props.toolRegistry?.tools() ??
      [];
    const validationTools = props.validationTools ??
      props.envelope?.grants.validationTools ??
      contract?.validationTools ??
      [];
    const initialState = {
      ...(contract?.initialState ?? {}),
      ...(props.initialState ?? {}),
    };
    const renderableArtifact = resolveRenderableArtifact(props);
    const fontFacesSource = props.fontFacesSource ?? props.envelope?.fontFacesCss ?? undefined;

    let handle: MountedSummonSurfaceHandle | null = null;
    const policy = new PolicyEngine({
      handlers,
      initialState,
      events,
      onHandlerError: props.onHandlerError,
      onStateChange: (state) => {
        handle?.pushState(state);
      },
    });

    handle = mountSummonSurface({
      root,
      artifact: renderableArtifact,
      grantedTools,
      validationTools,
      initialState,
      tokensSource: props.tokensSource ?? props.envelope?.tokenCss ?? defaultTokensSource,
      ...(fontFacesSource ? { fontFacesSource } : {}),
      events,
      onRuntimeError: props.onRuntimeError,
      onToolRejected: props.onToolRejected,
      onToolCall: async (tool, args) => {
        const customState = await props.onToolCall?.(tool, args);
        if (customState && typeof customState === 'object' && !Array.isArray(customState)) {
          return customState;
        }
        if (Object.prototype.hasOwnProperty.call(handlers, tool)) {
          return policy.dispatch(tool, args).then((result) => result.state);
        }
        if (props.onToolCall) {
          return policy.getState();
        }
        throw new Error(`tool "${tool}" has no host handler`);
      },
    });
    handleRef.current = handle;
    if (lastRenderedArtifactRef.current !== null) {
      handle.renderArtifact(lastRenderedArtifactRef.current);
    }

    return () => {
      handle?.dispose();
      handle = null;
      handleRef.current = null;
    };
  }, [
    events,
    props.envelope,
    props.artifact,
    props.grantedTools,
    props.validationTools,
    props.initialState,
    props.onToolCall,
    props.onToolRejected,
    props.onRuntimeError,
    props.onHandlerError,
    props.tokensSource,
    props.fontFacesSource,
    props.toolRegistry,
  ]);

  return createElement('div', {
    ref: rootRef,
    id: props.id,
    title: props.title,
    className: props.className,
    style: props.style,
  });
});

function resolveRenderableArtifact(props: SummonSurfaceProps): SummonRenderableArtifact | null {
  if (props.artifact) return props.artifact;
  const lines = props.envelope?.protocolLines;
  if (!lines) return null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line || line.op !== 'artifact' || line.path !== '/artifact') continue;
    const value = (line as ArtifactLine).value;
    if (isSurfaceDocumentArtifact(value)) {
      return value;
    }
  }
  return null;
}
