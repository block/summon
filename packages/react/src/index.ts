import { createEventStore, type DevtoolsEvent, type EventStore } from '@summon-internal/devtools';
import { SectionAccumulator, type ProtocolLine } from '@summon-internal/engine';
import {
  createComponentIslandRegistry,
  defineComponent as defineHostComponent,
  PolicyEngine,
  spawnSandbox,
  type Artifact,
  type CapabilityRegistry,
  type ComponentDefinition,
  type ComponentIslandError,
  type ComponentIslandRegistry,
  type ComponentRegistry,
  type SandboxHandle,
} from '@summon-internal/host';
import type { SurfaceEnvelope } from '@summon-internal/host/envelope';
import {
  bootstrapSource as defaultBootstrapSource,
  tokensSource as defaultTokensSource,
} from '@summon-internal/sandbox-runtime/assets';
import { createElement, useEffect, useMemo, useRef, type ComponentType, type CSSProperties } from 'react';
import { createRoot, type Root } from 'react-dom/client';

export interface SummonSurfaceChrome {
  [key: string]: string;
}

export interface SummonSurfaceProps {
  envelope?: SurfaceEnvelope | null;
  html?: string;
  protocolLines?: ProtocolLine[];
  capabilityRegistry?: CapabilityRegistry | null;
  componentRegistry?: ComponentRegistry | null;
  bootstrapSource?: string;
  tokensSource?: string;
  initialState?: Record<string, unknown>;
  chrome?: SummonSurfaceChrome;
  onEvent?: (event: DevtoolsEvent) => void;
  onFatal?: (reason: string) => void;
  onHandlerError?: (intent: string, error: Error) => void;
  onComponentError?: (error: ComponentIslandError) => void;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

export function SummonSurface(props: SummonSurfaceProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const events = useMemo(() => createEventStore(), []);

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
    const grantedIntents = props.capabilityRegistry?.intents() ?? [];
    const grantedCapabilities = contract?.validationCapabilities ?? [];
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
      intents: props.envelope?.grants.intents ?? [],
      capabilities: props.envelope?.grants.capabilities,
      components: props.envelope?.grants.components ?? componentContract?.validationComponents,
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
        void policy.dispatch(intent, args);
      },
      onComponents: (components, sandboxId) => {
        if (!islands && grantedComponentNames.size > 0) {
          for (const component of components) {
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
        islands?.sync(components, {
          sandboxId,
          emitIntent: (intent, args = {}) => {
            void policy.dispatch(intent, args);
          },
        });
      },
    });
    if (props.chrome) handle.setChrome(props.chrome);

    return () => {
      islands?.destroy();
      islands = null;
      handle?.dispose();
      handle = null;
    };
  }, [
    events,
    props.bootstrapSource,
    props.capabilityRegistry,
    props.chrome,
    props.componentRegistry,
    props.envelope,
    props.html,
    props.initialState,
    props.onFatal,
    props.onComponentError,
    props.onHandlerError,
    props.protocolLines,
    props.tokensSource,
  ]);

  return createElement('iframe', {
    ref: iframeRef,
    title: props.title ?? 'Summon surface',
    className: props.className,
    style: props.style,
  });
}

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
  return defineHostComponent({
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
  });
}

function resolveHtml(props: SummonSurfaceProps): string {
  if (props.envelope) return props.envelope.html;
  if (props.html !== undefined) return props.html;
  if (!props.protocolLines) return '';
  const accumulator = new SectionAccumulator();
  for (const line of props.protocolLines) accumulator.apply(line);
  return accumulator.compose();
}
