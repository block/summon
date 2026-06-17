import {
  type ToolRegistry,
} from '@anarchitecture/summon';
import {
  isArrowSurfaceArtifact,
  type ArtifactLine,
  type ArrowSurfaceArtifact,
  type SurfaceEvent,
  type ValidationTool,
} from '@anarchitecture/summon/engine';
import {
  mountInlineSurface,
  type InlineSurfaceHandle,
  type SurfacePreviewSnapshot,
} from '@anarchitecture/summon/browser';
import { createEventStore, type DevtoolsEvent } from '@anarchitecture/summon/devtools';
import type { SurfaceEnvelope } from '@anarchitecture/summon/envelope';
import { PolicyEngine } from '@anarchitecture/summon/policy';
import {
  tokensSource as defaultTokensSource,
} from '@anarchitecture/summon/assets';
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
  artifact?: ArrowSurfaceArtifact | null;
  grantedTools?: string[];
  validationTools?: ValidationTool[];
  toolRegistry?: ToolRegistry | null;
  tokensSource?: string;
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
  renderArtifact(artifact: ArrowSurfaceArtifact): void;
  pushState(state: Record<string, unknown>): void;
  applyPreviewEvent(event: SurfaceEvent): SurfacePreviewSnapshot | null;
}

export const SummonSurface = forwardRef<SummonSurfaceHandle, SummonSurfaceProps>(function SummonSurface(
  props,
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<InlineSurfaceHandle | null>(null);
  const lastRenderedArtifactRef = useRef<ArrowSurfaceArtifact | null>(null);
  const events = useMemo(() => createEventStore(), []);

  useImperativeHandle(ref, () => ({
    get root() {
      return rootRef.current;
    },
    get surfaceId() {
      return handleRef.current?.surfaceId ?? null;
    },
    renderArtifact(artifact: ArrowSurfaceArtifact) {
      lastRenderedArtifactRef.current = artifact;
      handleRef.current?.renderArtifact(artifact);
    },
    pushState(state: Record<string, unknown>) {
      handleRef.current?.pushState(state);
    },
    applyPreviewEvent(event: SurfaceEvent) {
      return handleRef.current?.applyPreviewEvent(event) ?? null;
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
    const arrowArtifact = resolveArrowArtifact(props);

    let handle: InlineSurfaceHandle | null = null;
    const policy = new PolicyEngine({
      handlers,
      initialState,
      events,
      onHandlerError: props.onHandlerError,
      onStateChange: (state) => {
        handle?.pushState(state);
      },
    });

    handle = mountInlineSurface({
      root,
      artifact: arrowArtifact,
      grantedTools,
      validationTools,
      initialState,
      tokensSource: props.tokensSource ?? props.envelope?.tokenCss ?? defaultTokensSource,
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
        return policy.getState();
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

function resolveArrowArtifact(props: SummonSurfaceProps): ArrowSurfaceArtifact | null {
  if (props.artifact) return props.artifact;
  const lines = props.envelope?.protocolLines;
  if (!lines) return null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line || line.op !== 'artifact' || line.path !== '/artifact') continue;
    const value = (line as ArtifactLine).value;
    if (isArrowSurfaceArtifact(value)) {
      return value;
    }
  }
  return null;
}
