import {
  type CapabilityRegistry,
  type ComponentDefinition,
  type ComponentRegistry,
} from '@anarchitecture/summon';
import {
  compileArtifactHtml,
  isArrowSurfaceArtifact,
  SectionAccumulator,
  type ArtifactLine,
  type ArrowNetworkPolicy,
  type CompiledArtifactHtml,
  type CompiledHtmlNodePatch,
  type HtmlNodePatch,
  type ProtocolLine,
  type ArrowSurfaceArtifact,
  type ValidationContext,
} from '@anarchitecture/summon/engine';
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
  arrowRuntimeSource as defaultArrowRuntimeSource,
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
  artifact?: ArrowSurfaceArtifact | null;
  html?: string;
  protocolLines?: ProtocolLine[];
  artifactIntents?: string[];
  grantedIntents?: string[];
  grantedCapabilities?: Artifact['capabilities'];
  artifactComponents?: Artifact['components'];
  capabilityRegistry?: CapabilityRegistry | null;
  componentRegistry?: ComponentRegistry | null;
  bootstrapSource?: string;
  arrowRuntimeSource?: string;
  arrowNetworkPolicy?: ArrowNetworkPolicy;
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
  renderArtifact(artifact: ArrowSurfaceArtifact): void;
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
  const validationContextRef = useRef<ValidationContext | null>(null);
  const lastRenderedHtmlRef = useRef<CompiledArtifactHtml | null>(null);
  const events = useMemo(() => createEventStore(), []);

  useImperativeHandle(ref, () => ({
    get iframe() {
      return iframeRef.current;
    },
    get sandboxId() {
      return handleRef.current?.sandboxId ?? null;
    },
    render(html: string) {
      const compiled = compileForRender(html, validationContextRef.current ?? defaultValidationContext());
      lastRenderedHtmlRef.current = compiled;
      preflightComponentProps(
        compiled,
        props.componentRegistry,
        handleRef.current?.sandboxId ?? undefined,
        events,
        props.onComponentError,
      );
      handleRef.current?.render(compiled);
    },
    renderArtifact(artifact: ArrowSurfaceArtifact) {
      handleRef.current?.renderArtifact(artifact);
    },
    patchNode(patch: HtmlNodePatch) {
      const compiled = compilePatchForRender(patch, validationContextRef.current ?? defaultValidationContext());
      if (compiled) {
        preflightComponentProps(
          compiled.html,
          props.componentRegistry,
          handleRef.current?.sandboxId ?? undefined,
          events,
          props.onComponentError,
        );
        handleRef.current?.patchNode(compiled);
      }
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
  }, [props.envelope, props.artifact, props.html, props.protocolLines]);

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
    const validationContext = validationContextFromProps(
      props,
      grantedIntents,
      grantedCapabilities,
      componentContract?.validationComponents ?? props.artifactComponents ?? props.envelope?.grants.components,
    );
    validationContextRef.current = validationContext;
    const arrowArtifact = resolveArrowArtifact(props);
    const arrowNetworkPolicy = props.arrowNetworkPolicy ?? props.envelope?.surfacePlan.network ?? 'none';

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
      runtime: arrowArtifact ? 'arrow' : 'html',
      // Advisory only. spawnSandbox receives host grants below.
      intents: props.artifactIntents ?? props.envelope?.grants.intents ?? grantedIntents,
      capabilities: props.envelope?.grants.capabilities ?? props.grantedCapabilities,
      components: props.artifactComponents ?? props.envelope?.grants.components ?? componentContract?.validationComponents,
      ...(arrowArtifact
        ? { arrow: arrowArtifact }
        : { html: resolveCompiledHtml(props, validationContext) }),
      initialState,
    };
    const grantedComponentNames = new Set((artifact.components ?? []).map((component) => component.name));

    handle = spawnSandbox({
      iframe,
      artifact,
      grantedIntents,
      grantedCapabilities,
      bootstrapSource: props.bootstrapSource ?? defaultBootstrapSource,
      arrowRuntimeSource: props.arrowRuntimeSource ?? defaultArrowRuntimeSource,
      arrowNetworkPolicy,
      tokensSource: props.tokensSource ?? props.envelope?.tokenCss ?? defaultTokensSource,
      events,
      onSandboxFatal: props.onFatal,
      onIntent: (intent, args) => {
        props.onIntent?.(intent, args);
        if (Object.prototype.hasOwnProperty.call(handlers, intent)) {
          return policy.dispatch(intent, args).then((result) => result.state);
        }
        return policy.getState();
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
    if (artifact.html) {
      preflightComponentProps(
        artifact.html,
        props.componentRegistry,
        handle.sandboxId,
        events,
        props.onComponentError,
      );
    }
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
      validationContextRef.current = null;
    };
  }, [
    events,
    props.bootstrapSource,
    props.arrowRuntimeSource,
    props.arrowNetworkPolicy,
    props.capabilityRegistry,
    props.chrome,
    props.componentRegistry,
    props.envelope,
    props.artifact,
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

function resolveCompiledHtml(props: SummonSurfaceProps, context: ValidationContext): CompiledArtifactHtml {
  if (props.envelope) return props.envelope.compiledHtml;
  if (props.html !== undefined) return compileForRender(props.html, context);
  if (!props.protocolLines) return compileForRender('', context);
  const accumulator = new SectionAccumulator();
  for (const line of props.protocolLines) accumulator.apply(line);
  return compileForRender(accumulator.compose(), context);
}

function resolveArrowArtifact(props: SummonSurfaceProps): ArrowSurfaceArtifact | null {
  if (props.artifact) return props.artifact;
  const lines = props.envelope?.protocolLines ?? props.protocolLines;
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

function compileForRender(html: string, context: ValidationContext): CompiledArtifactHtml {
  const result = compileArtifactHtml(html, context);
  if (result.issues.some((issue) => issue.severity === 'block')) {
    return '' as CompiledArtifactHtml;
  }
  return result.html;
}

function compilePatchForRender(
  patch: HtmlNodePatch,
  context: ValidationContext,
): CompiledHtmlNodePatch | null {
  const result = compileArtifactHtml(patch.html, {
    ...context,
    experimentalFragmentMode: 'html-node-v0',
  });
  if (result.issues.some((issue) => issue.severity === 'block')) return null;
  return {
    sectionId: patch.sectionId,
    nodeId: patch.nodeId,
    ...(patch.parentId ? { parentId: patch.parentId } : {}),
    html: result.html,
  };
}

function preflightComponentProps(
  html: CompiledArtifactHtml,
  componentRegistry: ComponentRegistry | null | undefined,
  sandboxId: string | undefined,
  events: ReturnType<typeof createEventStore>,
  onError: ((error: ComponentIslandError) => void) | undefined,
): void {
  if (!componentRegistry || typeof DOMParser === 'undefined') return;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const placeholders = doc.querySelectorAll('[data-summon-component]');
  for (const placeholder of placeholders) {
    const componentName = placeholder.getAttribute('data-summon-component') ?? '';
    const componentId = placeholder.getAttribute('data-summon-component-id') ?? undefined;
    const rawProps = placeholder.getAttribute('data-summon-props') ?? '{}';
    let props: unknown;
    try {
      props = JSON.parse(rawProps);
    } catch {
      emitComponentPreflightError({
        code: 'props-invalid',
        componentId,
        componentName,
        sandboxId,
        reason: `component "${componentName}" props are not valid JSON`,
      }, events, onError);
      continue;
    }
    const parsed = componentRegistry.validateProps(componentName, props);
    if (parsed.ok) continue;
    emitComponentPreflightError({
      code: parsed.error?.startsWith('unknown component') ? 'unknown-component' : 'props-invalid',
      componentId,
      componentName,
      sandboxId,
      reason: parsed.error ?? 'component props failed validation',
    }, events, onError);
  }
}

function emitComponentPreflightError(
  error: ComponentIslandError,
  events: ReturnType<typeof createEventStore>,
  onError: ((error: ComponentIslandError) => void) | undefined,
): void {
  events.push({
    kind: 'component-error',
    at: Date.now(),
    code: error.code,
    sandboxId: error.sandboxId,
    componentId: error.componentId,
    componentName: error.componentName,
    reason: error.reason,
  });
  onError?.(error);
}

function validationContextFromProps(
  props: SummonSurfaceProps,
  grantedIntents: string[],
  grantedCapabilities: Artifact['capabilities'],
  components: Artifact['components'],
): ValidationContext {
  const surfacePlan = props.envelope?.surfacePlan;
  return {
    mode: props.envelope?.metadata.mode ??
      (surfacePlan?.runtime === 'static' || grantedIntents.length === 0 ? 'static' : 'interactive'),
    scriptPolicy: 'forbid',
    allowedIntents: props.envelope?.grants.intents ?? grantedIntents,
    capabilities: props.envelope?.grants.capabilities ?? grantedCapabilities,
    components,
    ...(surfacePlan ? { surfacePlan } : {}),
  };
}

function defaultValidationContext(): ValidationContext {
  return {
    mode: 'static',
    scriptPolicy: 'forbid',
    allowedIntents: [],
    capabilities: [],
    components: [],
  };
}
