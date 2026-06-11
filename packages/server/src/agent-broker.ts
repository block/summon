import {
  compileSurfacePolicy,
  SURFACE_PURPOSE_VALUES,
  type CapabilityPack,
  type ComponentPack,
  type ComponentSpec,
  type CompiledSurfacePolicy,
  type IntentSpec,
  type ProtocolLine,
  type SurfacePersistence,
  type SurfacePolicy,
  type SurfacePurpose,
} from '@summon-internal/engine';
import { runSurfaceGeneration } from './runner.js';
import type {
  SurfaceGenerationInput,
  SurfaceGenerationSummary,
} from './types.js';

export type SurfaceIntentInteraction =
  | 'none'
  | 'select'
  | 'form'
  | 'search'
  | 'background'
  | 'approval';

export type SurfaceIntentDataNeed = 'embedded' | 'host-resource' | 'worker';
export type SurfaceIntentSideEffect =
  | 'none'
  | 'local-state'
  | 'external-action'
  | 'approval-required';

export interface SurfaceIntent {
  purpose: SurfacePurpose;
  interaction: SurfaceIntentInteraction;
  dataNeed: SurfaceIntentDataNeed;
  sideEffect: SurfaceIntentSideEffect;
  requestedCapabilities: string[];
  requestedComponents: string[];
  confidence: number;
  rationale?: string;
}

export interface AgentIntentRequest {
  prompt: string;
  capabilities?: CapabilityPack | null;
  components?: ComponentPack | null;
  deterministicIntent: SurfaceIntent;
  signal?: AbortSignal;
}

export type AgentIntentProvider = (
  request: AgentIntentRequest,
) => SurfaceIntent | null | Promise<SurfaceIntent | null>;

export interface AgentIntentTextRequest {
  system: string;
  prompt: string;
  maxTokens: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface AgentIntentTextClient {
  completeText(request: AgentIntentTextRequest): string | Promise<string>;
}

export interface HostPolicyResolutionRequest {
  prompt: string;
  intent: SurfaceIntent;
  proposedSurfacePolicy: SurfacePolicy;
  capabilities?: CapabilityPack | null;
  components?: ComponentPack | null;
}

export type HostPolicyResolver = (
  request: HostPolicyResolutionRequest,
) => SurfacePolicy | null | Promise<SurfacePolicy | null>;

export interface AgentPolicyResolution {
  source: 'default' | 'host';
  proposedSurfacePolicy: SurfacePolicy;
  surfacePolicy: SurfacePolicy;
  rejectedCapabilities: string[];
  rejectedComponents: string[];
  fallback: boolean;
}

export interface AgentSurfacePlanningOptions {
  intent?: SurfaceIntent | null;
  intentProvider?: AgentIntentProvider | null;
  intentModel?: AgentIntentTextClient | null;
  intentTimeoutMs?: number;
  hostPolicyResolver?: HostPolicyResolver | null;
  persistence?: SurfacePersistence;
  signal?: AbortSignal;
}

export interface AgentSurfacePlanningInput extends AgentSurfacePlanningOptions {
  prompt: string;
  capabilities?: CapabilityPack | null;
  components?: ComponentPack | null;
}

export interface AgentSurfacePlanResult {
  intent: SurfaceIntent;
  proposedSurfacePolicy: SurfacePolicy;
  surfacePolicy: SurfacePolicy;
  compiledPolicy: CompiledSurfacePolicy;
  policyResolution: AgentPolicyResolution;
}

export type AgentSurfaceGenerationInput = Omit<
  SurfaceGenerationInput,
  'surfacePolicy' | 'mode' | 'scriptPolicy' | 'surfacePlan'
> & AgentSurfacePlanningOptions & {
  emitAgentDiagnostics?: boolean;
};

export interface AgentSurfaceGenerationSummary extends SurfaceGenerationSummary {
  agent: AgentSurfacePlanResult;
}

const PURPOSES = new Set<SurfacePurpose>(SURFACE_PURPOSE_VALUES);
const MIN_MODEL_CONFIDENCE = 0.45;

const APPROVAL_RE =
  /\b(approve|approval|confirm|publish|send|email|message|post|delete|remove|archive|update|change|commit|merge|deploy|invite|charge|pay|purchase|refund)\b/i;
const BACKGROUND_RE =
  /\b(analy[sz]e|analysis|calculate|compute|forecast|simulate|score|rank|audit|batch|background|long[-\s]?running)\b/i;
const SEARCH_RE =
  /\b(search|lookup|look\s+up|fetch|load|find|browse|filter|query|explore|discover)\b/i;
const FORM_RE =
  /\b(form|collect|intake|survey|questionnaire|submit|capture|enter|input)\b/i;
const SELECT_RE =
  /\b(pick|choose|select|save|remember|vote|rate|rank|favorite)\b/i;

export async function planAgentSurface(
  input: AgentSurfacePlanningInput,
): Promise<AgentSurfacePlanResult> {
  const deterministicIntent = inferSurfaceIntent(input.prompt, {
    capabilities: input.capabilities ?? null,
    components: input.components ?? null,
  });
  const inferredIntent = input.intent
    ? normalizeSurfaceIntent(input.intent, deterministicIntent)
    : await inferProvidedIntent(input, deterministicIntent);
  const intent = sanitizeSurfaceIntent(inferredIntent ?? deterministicIntent, {
    capabilities: input.capabilities ?? null,
    components: input.components ?? null,
    fallback: deterministicIntent,
  });
  const proposedSurfacePolicy = policyFromIntent(intent, {
    persistence: input.persistence,
  });
  const policyResolution = await resolveHostPolicy({
    prompt: input.prompt,
    intent,
    proposedSurfacePolicy,
    capabilities: input.capabilities ?? null,
    components: input.components ?? null,
    resolver: input.hostPolicyResolver ?? null,
  });
  const compiledPolicy = compileSurfacePolicy(policyResolution.surfacePolicy, {
    capabilities: input.capabilities ?? null,
    components: input.components ?? null,
  });
  return {
    intent,
    proposedSurfacePolicy,
    surfacePolicy: policyResolution.surfacePolicy,
    compiledPolicy,
    policyResolution,
  };
}

export async function runAgentSurfaceGeneration(
  input: AgentSurfaceGenerationInput,
  emit: (line: ProtocolLine) => void | Promise<void>,
): Promise<AgentSurfaceGenerationSummary> {
  const agent = await planAgentSurface(input);
  const preludeLines = [
    ...(input.emitAgentDiagnostics === false ? [] : agentPreludeLines(agent)),
    ...(input.preludeLines ?? []),
  ];
  const summary = await runSurfaceGeneration({
    ...input,
    capabilities: input.capabilities ?? null,
    components: input.components ?? null,
    surfacePolicy: agent.surfacePolicy,
    preludeLines,
  }, emit);
  return {
    ...summary,
    agent,
  };
}

export function inferSurfaceIntent(
  prompt: string,
  options: {
    capabilities?: CapabilityPack | null;
    components?: ComponentPack | null;
  } = {},
): SurfaceIntent {
  const requestedCapabilities = inferCapabilityNames(prompt, options.capabilities ?? null);
  const requestedComponents = inferComponentNames(prompt, options.components ?? null);
  const selectedIntents = intentsByName(options.capabilities, requestedCapabilities);

  const hasApproval = selectedIntents.some((intent) => intentAuthority(intent) === 'approval-gated');
  const hasWorker = selectedIntents.some((intent) => intentData(intent) === 'worker');
  const hasResource = selectedIntents.some((intent) => intentData(intent) === 'host-resource');
  const hasAction = selectedIntents.some((intent) => intentAuthority(intent) === 'host-action');

  let interaction: SurfaceIntentInteraction = 'none';
  if (hasApproval || APPROVAL_RE.test(prompt)) interaction = 'approval';
  else if (hasWorker || BACKGROUND_RE.test(prompt)) interaction = 'background';
  else if (hasResource || SEARCH_RE.test(prompt)) interaction = 'search';
  else if (FORM_RE.test(prompt)) interaction = 'form';
  else if (hasAction || SELECT_RE.test(prompt)) interaction = 'select';

  const sideEffect: SurfaceIntentSideEffect = interaction === 'approval'
    ? 'approval-required'
    : hasAction || interaction === 'select' || interaction === 'form'
      ? 'local-state'
      : 'none';
  const dataNeed: SurfaceIntentDataNeed = interaction === 'background' || hasWorker
    ? 'worker'
    : interaction === 'search' || hasResource
      ? 'host-resource'
      : 'embedded';

  return {
    purpose: inferPurpose(prompt),
    interaction,
    dataNeed,
    sideEffect,
    requestedCapabilities,
    requestedComponents,
    confidence: requestedCapabilities.length > 0 || interaction !== 'none' ? 0.72 : 0.58,
    rationale: 'deterministic keyword and catalog match',
  };
}

export function policyFromIntent(
  intent: SurfaceIntent,
  options: { persistence?: SurfacePersistence } = {},
): SurfacePolicy {
  const persistence = options.persistence ?? 'replayable';
  if (intent.sideEffect === 'approval-required' || intent.interaction === 'approval') {
    return {
      tier: 'approval',
      purpose: 'operate',
      grants: intent.requestedCapabilities,
      components: intent.requestedComponents,
      persistence,
    };
  }
  if (intent.dataNeed === 'worker' || intent.interaction === 'background') {
    return {
      tier: 'worker',
      purpose: intent.purpose,
      grants: intent.requestedCapabilities,
      components: intent.requestedComponents,
      persistence,
    };
  }
  if (
    intent.interaction !== 'none' ||
    intent.dataNeed === 'host-resource' ||
    intent.sideEffect === 'local-state' ||
    intent.sideEffect === 'external-action'
  ) {
    return {
      tier: 'declarative',
      purpose: intent.purpose,
      grants: intent.requestedCapabilities,
      components: intent.requestedComponents,
      persistence,
    };
  }
  return {
    tier: 'static',
    purpose: intent.purpose,
    components: intent.requestedComponents,
    persistence,
  };
}

export function defaultHostPolicyResolver(
  request: HostPolicyResolutionRequest,
): SurfacePolicy {
  return narrowSurfacePolicy(request.proposedSurfacePolicy, {
    capabilities: request.capabilities ?? null,
    components: request.components ?? null,
  }).surfacePolicy;
}

function agentPreludeLines(agent: AgentSurfacePlanResult): ProtocolLine[] {
  return [
    { op: 'meta', path: '/agent-intent', value: agent.intent },
    {
      op: 'meta',
      path: '/agent-policy-resolution',
      value: {
        source: agent.policyResolution.source,
        proposedSurfacePolicy: agent.policyResolution.proposedSurfacePolicy,
        surfacePolicy: agent.policyResolution.surfacePolicy,
        rejectedCapabilities: agent.policyResolution.rejectedCapabilities,
        rejectedComponents: agent.policyResolution.rejectedComponents,
        fallback: agent.policyResolution.fallback,
      },
    },
  ];
}

async function inferProvidedIntent(
  input: AgentSurfacePlanningInput,
  deterministicIntent: SurfaceIntent,
): Promise<SurfaceIntent | null> {
  if (input.intentProvider) {
    return input.intentProvider({
      prompt: input.prompt,
      capabilities: input.capabilities ?? null,
      components: input.components ?? null,
      deterministicIntent,
      signal: input.signal,
    });
  }
  if (!input.intentModel) return null;
  return inferIntentWithModel(input.intentModel, {
    prompt: input.prompt,
    capabilities: input.capabilities ?? null,
    components: input.components ?? null,
    deterministicIntent,
    timeoutMs: input.intentTimeoutMs,
    signal: input.signal,
  });
}

async function inferIntentWithModel(
  client: AgentIntentTextClient,
  input: {
    prompt: string;
    capabilities?: CapabilityPack | null;
    components?: ComponentPack | null;
    deterministicIntent: SurfaceIntent;
    timeoutMs?: number;
    signal?: AbortSignal;
  },
): Promise<SurfaceIntent | null> {
  const system = buildIntentClassifierPrompt(input.capabilities ?? null, input.components ?? null);
  try {
    const request = client.completeText({
      system,
      prompt: input.prompt,
      maxTokens: 500,
      temperature: 0,
      signal: input.signal,
    });
    const raw = await Promise.race([
      Promise.resolve(request),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), input.timeoutMs ?? 1800)),
    ]);
    if (!raw) return null;
    const json = extractJsonObject(raw);
    if (!json) return null;
    const parsed = JSON.parse(json) as Partial<SurfaceIntent>;
    const normalized = normalizeSurfaceIntent(parsed, input.deterministicIntent);
    return normalized.confidence >= MIN_MODEL_CONFIDENCE ? normalized : null;
  } catch {
    return null;
  }
}

function buildIntentClassifierPrompt(
  capabilities: CapabilityPack | null,
  components: ComponentPack | null,
): string {
  const capabilityLines = (capabilities?.intents ?? [])
    .map((intent) => {
      const data = intentData(intent);
      const authority = intentAuthority(intent);
      return `- ${intent.name}: ${intent.kind ?? 'action'}, data=${data}, authority=${authority}, ${intent.description}`;
    })
    .join('\n') || '- none';
  const componentLines = (components?.components ?? [])
    .map((component) => {
      const surface = component.surface ?? {};
      return `- ${component.name}: data=${surface.data ?? 'embedded'}, authority=${surface.authority ?? 'none'}, ${component.description}`;
    })
    .join('\n') || '- none';

  return `Classify a Summon generative-UI request into a bounded intent object.

Available host tools:
${capabilityLines}

Available trusted components:
${componentLines}

Respond with ONLY one JSON object. No markdown and no prose.
Shape:
{"purpose":"inform|compare|explore|collect|review|operate","interaction":"none|select|form|search|background|approval","dataNeed":"embedded|host-resource|worker","sideEffect":"none|local-state|external-action|approval-required","requestedCapabilities":["name"],"requestedComponents":["name"],"confidence":0.0,"rationale":"short reason"}

Rules:
- Pick only capability and component names from the lists above.
- Use "none" interaction for read-only summaries, comparisons, explainers, and dashboards.
- Use "search" for host data lookup, browse, filter, or query surfaces.
- Use "form" for submit/intake/collect surfaces.
- Use "select" for choose, save, pick, vote, or local host-action surfaces.
- Use "background" for worker-style analysis, scoring, simulation, or compute.
- Use "approval" and "approval-required" for publish, send, delete, update, deploy, payment, or other external side effects.
- Do not request broader authority than the prompt needs.`;
}

async function resolveHostPolicy(
  input: HostPolicyResolutionRequest & { resolver: HostPolicyResolver | null },
): Promise<AgentPolicyResolution> {
  const narrowed = narrowSurfacePolicy(input.proposedSurfacePolicy, {
    capabilities: input.capabilities ?? null,
    components: input.components ?? null,
  });
  if (!input.resolver) {
    return {
      source: 'default',
      proposedSurfacePolicy: input.proposedSurfacePolicy,
      surfacePolicy: narrowed.surfacePolicy,
      rejectedCapabilities: narrowed.rejectedCapabilities,
      rejectedComponents: narrowed.rejectedComponents,
      fallback: narrowed.fallback,
    };
  }

  const hostPolicy = await input.resolver({
    prompt: input.prompt,
    intent: input.intent,
    proposedSurfacePolicy: narrowed.surfacePolicy,
    capabilities: input.capabilities ?? null,
    components: input.components ?? null,
  });
  const hostNarrowed = narrowSurfacePolicy(hostPolicy ?? { tier: 'static', purpose: 'inform' }, {
    capabilities: input.capabilities ?? null,
    components: input.components ?? null,
  });
  return {
    source: 'host',
    proposedSurfacePolicy: input.proposedSurfacePolicy,
    surfacePolicy: hostNarrowed.surfacePolicy,
    rejectedCapabilities: [
      ...new Set([...narrowed.rejectedCapabilities, ...hostNarrowed.rejectedCapabilities]),
    ],
    rejectedComponents: [
      ...new Set([...narrowed.rejectedComponents, ...hostNarrowed.rejectedComponents]),
    ],
    fallback: narrowed.fallback || hostNarrowed.fallback || hostPolicy === null,
  };
}

function narrowSurfacePolicy(
  policy: SurfacePolicy,
  options: {
    capabilities: CapabilityPack | null;
    components: ComponentPack | null;
  },
): {
  surfacePolicy: SurfacePolicy;
  rejectedCapabilities: string[];
  rejectedComponents: string[];
  fallback: boolean;
} {
  const capabilityNames = new Set((options.capabilities?.intents ?? []).map((intent) => intent.name));
  const componentNames = new Set((options.components?.components ?? []).map((component) => component.name));
  const rawGrants = Array.isArray(policy.grants) ? policy.grants.filter(isString) : [];
  const rawComponents = Array.isArray(policy.components) ? policy.components.filter(isString) : [];
  const knownGrantNames = rawGrants.filter((name) => capabilityNames.has(name));
  const knownComponentNames = rawComponents.filter((name) => componentNames.has(name));
  const knownIntents = intentsByName(options.capabilities, knownGrantNames);
  const knownComponents = componentsByName(options.components, knownComponentNames);

  const rejectedCapabilities = rawGrants.filter((name) => !capabilityNames.has(name));
  const rejectedComponents = rawComponents.filter((name) => !componentNames.has(name));
  const tier = strongestTier(policy.tier, knownIntents, knownComponents);
  const grants = knownIntents
    .filter((intent) => intentAllowedForTier(tier, intent))
    .map((intent) => intent.name);
  const components = knownComponents
    .filter((component) => componentAllowedForTier(tier, component))
    .map((component) => component.name);

  for (const name of knownGrantNames) {
    if (!grants.includes(name)) rejectedCapabilities.push(name);
  }
  for (const name of knownComponentNames) {
    if (!components.includes(name)) rejectedComponents.push(name);
  }

  if ((tier === 'worker' && grants.length === 0 && !knownComponents.some((component) => componentSurfaceData(component) === 'worker')) ||
    (tier === 'approval' && !knownIntents.some((intent) => intentAuthority(intent) === 'approval-gated'))) {
    return {
      surfacePolicy: staticFallbackPolicy(policy),
      rejectedCapabilities: [...new Set([...rejectedCapabilities, ...knownGrantNames])],
      rejectedComponents: [...new Set([...rejectedComponents, ...knownComponentNames])],
      fallback: true,
    };
  }

  const surfacePolicy: SurfacePolicy = {
    tier,
    purpose: PURPOSES.has(policy.purpose as SurfacePurpose)
      ? policy.purpose
      : tier === 'approval'
        ? 'operate'
        : 'inform',
    ...(grants.length > 0 ? { grants } : {}),
    ...(components.length > 0 ? { components } : {}),
    persistence: policy.persistence === 'ephemeral' ? 'ephemeral' : 'replayable',
  };
  const compiled = compileSurfacePolicy(surfacePolicy, {
    capabilities: options.capabilities,
    components: options.components,
  });
  if (compiled.issues.some((issue) => issue.severity === 'block')) {
    return {
      surfacePolicy: staticFallbackPolicy(policy),
      rejectedCapabilities: [...new Set([...rejectedCapabilities, ...knownGrantNames])],
      rejectedComponents: [...new Set([...rejectedComponents, ...knownComponentNames])],
      fallback: true,
    };
  }
  return {
    surfacePolicy,
    rejectedCapabilities: [...new Set(rejectedCapabilities)],
    rejectedComponents: [...new Set(rejectedComponents)],
    fallback: false,
  };
}

function strongestTier(
  proposedTier: SurfacePolicy['tier'],
  intents: IntentSpec[],
  components: ComponentSpec[],
): SurfacePolicy['tier'] {
  if (proposedTier === 'static') return 'static';
  if (intents.some((intent) => intentAuthority(intent) === 'approval-gated')) return 'approval';
  if (intents.some((intent) => intentData(intent) === 'worker') ||
    components.some((component) => componentSurfaceData(component) === 'worker')) {
    return 'worker';
  }
  return proposedTier === 'scripted' ? 'declarative' : proposedTier;
}

function staticFallbackPolicy(policy: SurfacePolicy): SurfacePolicy {
  return {
    tier: 'static',
    purpose: PURPOSES.has(policy.purpose as SurfacePurpose) ? policy.purpose : 'inform',
    persistence: policy.persistence === 'ephemeral' ? 'ephemeral' : 'replayable',
  };
}

function intentAllowedForTier(tier: SurfacePolicy['tier'], intent: IntentSpec): boolean {
  if (tier === 'static') return false;
  const data = intentData(intent);
  const authority = intentAuthority(intent);
  if (tier === 'worker') return data === 'worker';
  if (tier === 'approval') return authority === 'approval-gated';
  return data !== 'worker' && authority !== 'approval-gated';
}

function componentAllowedForTier(tier: SurfacePolicy['tier'], component: ComponentSpec): boolean {
  const data = componentSurfaceData(component);
  const authority = componentSurfaceAuthority(component);
  if (tier === 'static') return data === 'embedded' && authority === 'none';
  if (tier === 'worker') return data === 'worker';
  if (tier === 'approval') return authority === 'none' || authority === 'approval-gated';
  return data !== 'worker' && authority !== 'approval-gated';
}

function inferCapabilityNames(prompt: string, pack: CapabilityPack | null): string[] {
  const intents = pack?.intents ?? [];
  if (intents.length === 0) return [];
  const text = prompt.toLowerCase();
  const matches = intents.filter((intent) => capabilityMatchesIntent(text, intent));
  if (matches.length > 0) return matches.map((intent) => intent.name);

  const approval = APPROVAL_RE.test(prompt)
    ? intents.filter((intent) => intentAuthority(intent) === 'approval-gated')
    : [];
  if (approval.length === 1) return [approval[0]!.name];

  const worker = BACKGROUND_RE.test(prompt)
    ? intents.filter((intent) => intentData(intent) === 'worker')
    : [];
  if (worker.length > 0) return worker.map((intent) => intent.name);

  const resource = SEARCH_RE.test(prompt)
    ? intents.filter((intent) => intentData(intent) === 'host-resource')
    : [];
  if (resource.length === 1) return [resource[0]!.name];

  const actions = intents.filter((intent) => intentAuthority(intent) === 'host-action');
  if ((FORM_RE.test(prompt) || SELECT_RE.test(prompt)) && actions.length === 1) {
    return [actions[0]!.name];
  }
  return [];
}

function capabilityMatchesIntent(text: string, intent: IntentSpec): boolean {
  const haystack = `${intent.name} ${intent.description}`.toLowerCase();
  const terms = new Set([
    ...intent.name.toLowerCase().split(/[_\W]+/),
    ...intent.description.toLowerCase().split(/[_\W]+/).filter((term) => term.length > 4),
  ]);
  for (const term of terms) {
    if (term && text.includes(term)) return true;
  }
  if (SEARCH_RE.test(text) && intentData(intent) === 'host-resource') return true;
  if (BACKGROUND_RE.test(text) && intentData(intent) === 'worker') return true;
  if (APPROVAL_RE.test(text) && intentAuthority(intent) === 'approval-gated') return true;
  return false;
}

function inferComponentNames(prompt: string, pack: ComponentPack | null): string[] {
  const components = pack?.components ?? [];
  if (components.length === 0) return [];
  const text = prompt.toLowerCase();
  return components
    .filter((component) => {
      const name = component.name.toLowerCase();
      const spacedName = name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
      return text.includes(name) ||
        text.includes(spacedName) ||
        text.includes(component.description.toLowerCase());
    })
    .map((component) => component.name);
}

function normalizeSurfaceIntent(raw: Partial<SurfaceIntent>, fallback: SurfaceIntent): SurfaceIntent {
  return {
    purpose: PURPOSES.has(raw.purpose as SurfacePurpose) ? raw.purpose as SurfacePurpose : fallback.purpose,
    interaction: enumValue(raw.interaction, ['none', 'select', 'form', 'search', 'background', 'approval']) ??
      fallback.interaction,
    dataNeed: enumValue(raw.dataNeed, ['embedded', 'host-resource', 'worker']) ?? fallback.dataNeed,
    sideEffect: enumValue(raw.sideEffect, ['none', 'local-state', 'external-action', 'approval-required']) ??
      fallback.sideEffect,
    requestedCapabilities: stringList(raw.requestedCapabilities),
    requestedComponents: stringList(raw.requestedComponents),
    confidence: typeof raw.confidence === 'number' && Number.isFinite(raw.confidence)
      ? Math.max(0, Math.min(1, raw.confidence))
      : fallback.confidence,
    rationale: typeof raw.rationale === 'string' ? raw.rationale.slice(0, 240) : fallback.rationale,
  };
}

function sanitizeSurfaceIntent(
  intent: SurfaceIntent,
  options: {
    capabilities: CapabilityPack | null;
    components: ComponentPack | null;
    fallback: SurfaceIntent;
  },
): SurfaceIntent {
  const capabilityNames = new Set((options.capabilities?.intents ?? []).map((item) => item.name));
  const componentNames = new Set((options.components?.components ?? []).map((item) => item.name));
  const requestedCapabilities = intent.requestedCapabilities.filter((name) => capabilityNames.has(name));
  const requestedComponents = intent.requestedComponents.filter((name) => componentNames.has(name));
  if (
    intent.interaction !== 'none' &&
    requestedCapabilities.length === 0 &&
    requestedComponents.length === 0 &&
    options.fallback.requestedCapabilities.length > 0
  ) {
    requestedCapabilities.push(...options.fallback.requestedCapabilities);
  }
  return {
    ...intent,
    requestedCapabilities: [...new Set(requestedCapabilities)],
    requestedComponents: [...new Set(requestedComponents)],
  };
}

function inferPurpose(prompt: string): SurfacePurpose {
  const text = prompt.toLowerCase();
  if (/\b(compare|comparison|versus|vs\.?|pros|cons|trade-?offs?)\b/.test(text)) return 'compare';
  if (/\b(collect|intake|form|survey|questionnaire|submit)\b/.test(text)) return 'collect';
  if (/\b(search|find|explore|browse|filter|lookup|discover)\b/.test(text)) return 'explore';
  if (/\b(approve|approval|review|audit|confirm|verify|readiness|risk)\b/.test(text)) return 'review';
  if (/\b(update|create|delete|save|send|publish|change|operate|run|deploy)\b/.test(text)) return 'operate';
  return 'inform';
}

function intentsByName(pack: CapabilityPack | null | undefined, names: string[]): IntentSpec[] {
  const byName = new Map((pack?.intents ?? []).map((intent) => [intent.name, intent]));
  return names.map((name) => byName.get(name)).filter((intent): intent is IntentSpec => Boolean(intent));
}

function componentsByName(pack: ComponentPack | null | undefined, names: string[]): ComponentSpec[] {
  const byName = new Map((pack?.components ?? []).map((component) => [component.name, component]));
  return names.map((name) => byName.get(name)).filter((component): component is ComponentSpec => Boolean(component));
}

function intentData(intent: IntentSpec): SurfaceIntentDataNeed {
  return intent.surface?.data ?? (intent.kind === 'resource' ? 'host-resource' : 'embedded');
}

function intentAuthority(intent: IntentSpec): 'none' | 'read' | 'host-action' | 'approval-gated' {
  return intent.surface?.authority ?? (intent.kind === 'resource' ? 'read' : 'host-action');
}

function componentSurfaceData(component: ComponentSpec): SurfaceIntentDataNeed {
  return component.surface?.data ?? 'embedded';
}

function componentSurfaceAuthority(component: ComponentSpec): 'none' | 'read' | 'host-action' | 'approval-gated' {
  return component.surface?.authority ?? 'none';
}

function enumValue<T extends string>(raw: unknown, values: readonly T[]): T | null {
  return typeof raw === 'string' && (values as readonly string[]).includes(raw) ? raw as T : null;
}

function stringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(isString))];
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function extractJsonObject(raw: string): string | null {
  const cleaned = raw
    .replace(/^[\s\S]*?```(?:json)?\s*/i, '')
    .replace(/\s*```[\s\S]*$/, '')
    .trim();
  const candidate = cleaned.startsWith('{') ? cleaned : raw;
  const match = candidate.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}
