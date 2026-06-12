import {
  type CapabilityRegistry,
  type ComponentDefinition,
  type ComponentRegistry,
} from '@anarchitecture/summon';
import { SectionAccumulator, type HtmlNodePatch, type ProtocolLine } from '@anarchitecture/summon/engine';
import {
  createComponentIslandRegistry,
  spawnSandbox,
  type Artifact,
  type ComponentIslandError,
  type ComponentIslandRegistry,
  type SandboxHandle,
} from '@anarchitecture/summon/browser';
import { createEventStore, type DevtoolsEvent } from '@anarchitecture/summon/devtools';
import type { SurfaceEnvelope } from '@anarchitecture/summon/envelope';
import { PolicyEngine } from '@anarchitecture/summon/policy';
import {
  bootstrapSource as defaultBootstrapSource,
  tokensSource as defaultTokensSource,
} from '@anarchitecture/summon/assets';
import {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ComponentType,
  type CSSProperties,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';

export interface SummonSurfaceChrome {
  [key: string]: string;
}

export interface SummonSurfaceProps {
  envelope?: SurfaceEnvelope | null;
  html?: string;
  protocolLines?: ProtocolLine[];
  artifactIntents?: string[];
  grantedIntents?: string[];
  grantedCapabilities?: Artifact['capabilities'];
  artifactComponents?: Artifact['components'];
  capabilityRegistry?: CapabilityRegistry | null;
  componentRegistry?: ComponentRegistry | null;
  bootstrapSource?: string;
  tokensSource?: string;
  initialState?: Record<string, unknown>;
  chrome?: SummonSurfaceChrome;
  onIntent?: (intent: string, args: Record<string, unknown>) => void;
  onIntentRejected?: (reason: string, raw: unknown) => void;
  onEvent?: (event: DevtoolsEvent) => void;
  onFatal?: (reason: string) => void;
  onHandlerError?: (intent: string, error: Error) => void;
  onComponentError?: (error: ComponentIslandError) => void;
  id?: string;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

export interface SummonSurfaceHandle {
  iframe: HTMLIFrameElement | null;
  sandboxId: string | null;
  render(html: string): void;
  patchNode(patch: HtmlNodePatch): void;
  pushState(state: Record<string, unknown>): void;
  setChrome(chrome: SummonSurfaceChrome): void;
}

export const SummonSurface = forwardRef<SummonSurfaceHandle, SummonSurfaceProps>(function SummonSurface(
  props,
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const handleRef = useRef<SandboxHandle | null>(null);
  const lastRenderedHtmlRef = useRef<string | null>(null);
  const events = useMemo(() => createEventStore(), []);

  useImperativeHandle(ref, () => ({
    get iframe() {
      return iframeRef.current;
    },
    get sandboxId() {
      return handleRef.current?.sandboxId ?? null;
    },
    render(html: string) {
      lastRenderedHtmlRef.current = html;
      handleRef.current?.render(html);
    },
    patchNode(patch: HtmlNodePatch) {
      handleRef.current?.patchNode(patch);
    },
    pushState(state: Record<string, unknown>) {
      handleRef.current?.pushState(state);
    },
    setChrome(chrome: SummonSurfaceChrome) {
      handleRef.current?.setChrome(chrome);
    },
  }), []);

  useEffect(() => {
    lastRenderedHtmlRef.current = null;
  }, [props.envelope, props.html, props.protocolLines]);

  useEffect(() => {
    if (!props.onEvent) return;
    return events.subscribe(() => {
      const latest = events.snapshot().at(-1);
      if (latest) props.onEvent?.(latest);
    });
  }, [events, props.onEvent]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const contract = props.capabilityRegistry?.toContract();
    const componentContract = props.componentRegistry?.toContract();
    const handlers = props.capabilityRegistry?.toPolicyHandlers() ?? {};
    const grantedIntents = props.grantedIntents ?? props.capabilityRegistry?.intents() ?? [];
    const grantedCapabilities = props.grantedCapabilities ?? contract?.validationCapabilities ?? [];
    const initialState = {
      ...(contract?.initialState ?? {}),
      ...(props.initialState ?? {}),
    };

    let handle: SandboxHandle | null = null;
    let islands: ComponentIslandRegistry | null = props.componentRegistry
      ? createComponentIslandRegistry({
          outerIframe: iframe,
          registry: props.componentRegistry,
          events,
          onError: props.onComponentError,
        })
      : null;
    const policy = new PolicyEngine({
      handlers,
      initialState,
      events,
      onHandlerError: props.onHandlerError,
      onStateChange: (state) => {
        handle?.pushState(state);
      },
    });

    const artifact: Artifact = {
      // Advisory only. spawnSandbox receives host grants below.
      intents: props.artifactIntents ?? props.envelope?.grants.intents ?? grantedIntents,
      capabilities: props.envelope?.grants.capabilities ?? props.grantedCapabilities,
      components: props.artifactComponents ?? props.envelope?.grants.components ?? componentContract?.validationComponents,
      html: resolveHtml(props),
      initialState,
    };
    const grantedComponentNames = new Set((artifact.components ?? []).map((component) => component.name));

    handle = spawnSandbox({
      iframe,
      artifact,
      grantedIntents,
      grantedCapabilities,
      bootstrapSource: props.bootstrapSource ?? defaultBootstrapSource,
      tokensSource: props.tokensSource ?? props.envelope?.tokenCss ?? defaultTokensSource,
      events,
      onSandboxFatal: props.onFatal,
      onIntent: (intent, args) => {
        props.onIntent?.(intent, args);
        if (Object.prototype.hasOwnProperty.call(handlers, intent)) {
          void policy.dispatch(intent, args);
        }
      },
      onIntentRejected: props.onIntentRejected,
      onComponents: (components, sandboxId) => {
        const grantedComponents = components.filter((component) => grantedComponentNames.has(component.name));
        for (const component of components) {
          if (grantedComponentNames.has(component.name)) continue;
          const error = {
            code: 'unknown-component' as const,
            sandboxId,
            componentId: component.id,
            componentName: component.name,
            reason: `component "${component.name}" was not granted by the host`,
          };
          events.push({
            kind: 'component-error',
            at: Date.now(),
            ...error,
          });
          props.onComponentError?.(error);
        }
        if (!islands && grantedComponentNames.size > 0) {
          for (const component of grantedComponents) {
            if (!grantedComponentNames.has(component.name)) continue;
            const error = {
              code: 'registry-missing' as const,
              sandboxId,
              componentId: component.id,
              componentName: component.name,
              reason: `component "${component.name}" was granted but no componentRegistry was provided`,
            };
            events.push({
              kind: 'component-error',
              at: Date.now(),
              ...error,
            });
            props.onComponentError?.(error);
          }
          return;
        }
        islands?.sync(grantedComponents, {
          sandboxId,
          emitIntent: (intent, args = {}) => {
            void policy.dispatch(intent, args);
          },
        });
      },
    });
    handleRef.current = handle;
    if (props.chrome) handle.setChrome(props.chrome);
    if (lastRenderedHtmlRef.current !== null) {
      handle.render(lastRenderedHtmlRef.current);
    }

    return () => {
      islands?.destroy();
      islands = null;
      handle?.dispose();
      handle = null;
      handleRef.current = null;
    };
  }, [
    events,
    props.bootstrapSource,
    props.capabilityRegistry,
    props.chrome,
    props.componentRegistry,
    props.envelope,
    props.artifactIntents,
    props.grantedIntents,
    props.grantedCapabilities,
    props.artifactComponents,
    props.html,
    props.initialState,
    props.onIntent,
    props.onIntentRejected,
    props.onFatal,
    props.onComponentError,
    props.onHandlerError,
    props.protocolLines,
    props.tokensSource,
  ]);

  return createElement('iframe', {
    ref: iframeRef,
    id: props.id,
    title: props.title ?? 'Summon surface',
    className: props.className,
    style: props.style,
  });
});

export interface ReactComponentDefinition<T = unknown>
  extends Omit<ComponentDefinition<T>, 'render' | 'destroy'> {
  component: ComponentType<T>;
}

export interface ReactComponentRuntimeContext {
  componentId: string;
  sandboxId: string;
  emitIntent: (intent: string, args?: Record<string, unknown>) => void;
}

export interface ReactComponentWithRuntimeDefinition<T = unknown, P = T>
  extends Omit<ComponentDefinition<T>, 'render' | 'destroy'> {
  component: ComponentType<P>;
  mapProps?: (props: T, context: ReactComponentRuntimeContext) => P;
}

export function defineReactComponent<T, P = T>(
  definition: ReactComponentWithRuntimeDefinition<T, P>,
): ComponentDefinition<T> {
  const roots = new WeakMap<HTMLElement, Root>();
  const { component, mapProps, ...rest } = definition;
  return {
    ...rest,
    render: ({ container, props, componentId, sandboxId, emitIntent }) => {
      let root = roots.get(container);
      if (!root) {
        root = createRoot(container);
        roots.set(container, root);
      }
      const runtimeContext = { componentId, sandboxId, emitIntent };
      const componentProps = mapProps
        ? mapProps(props as T, runtimeContext)
        : props as unknown as P;
      root.render(createElement(
        component as ComponentType<Record<string, unknown>>,
        componentProps as Record<string, unknown>,
      ));
    },
    destroy: ({ container }) => {
      const root = roots.get(container);
      root?.unmount();
      roots.delete(container);
    },
  };
}

function resolveHtml(props: SummonSurfaceProps): string {
  if (props.envelope) return props.envelope.html;
  if (props.html !== undefined) return props.html;
  if (!props.protocolLines) return '';
  const accumulator = new SectionAccumulator();
  for (const line of props.protocolLines) accumulator.apply(line);
  return accumulator.compose();
}
