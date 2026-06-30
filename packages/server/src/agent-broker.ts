import {
  compileSurfacePolicy,
  SURFACE_PURPOSE_VALUES,
  type ToolPack,
  type CompiledSurfacePolicy,
  type ToolSpec,
  type ProtocolLine,
  type SurfacePersistence,
  type SurfacePolicy,
  type SurfacePurpose,
  type SurfaceGoalSource,
} from '@summon-internal/engine';
import { runSurfaceGeneration } from './runner.js';
import type {
  SurfaceGenerationInput,
  SurfaceGenerationSummary,
} from './types.js';

export type SurfaceGoalInteraction =
  | 'none'
  | 'select'
  | 'form'
  | 'search'
  | 'background'
  | 'approval';

export type SurfaceGoalDataNeed = 'embedded' | 'host-resource' | 'worker';
export type SurfaceGoalSideEffect =
  | 'none'
  | 'local-state'
  | 'external-action'
  | 'approval-required';
// `SurfaceGoalSource` is defined in the engine (its canonical home, since the
// surface-contract block consumes it) and re-exported here for broker callers.
export type { SurfaceGoalSource };

export interface SurfaceGoal {
  purpose: SurfacePurpose;
  interaction: SurfaceGoalInteraction;
  dataNeed: SurfaceGoalDataNeed;
  sideEffect: SurfaceGoalSideEffect;
  requestedTools: string[];
  confidence: number;
  rationale?: string;
}

export interface AgentGoalRequest {
  prompt: string;
  tools?: ToolPack | null;
  deterministicGoal: SurfaceGoal;
  signal?: AbortSignal;
}

export type AgentGoalProvider = (
  request: AgentGoalRequest,
) => SurfaceGoal | null | Promise<SurfaceGoal | null>;

export interface AgentGoalTextRequest {
  system: string;
  prompt: string;
  maxTokens: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface AgentGoalTextClient {
  completeText(request: AgentGoalTextRequest): string | Promise<string>;
}

export interface HostPolicyResolutionRequest {
  prompt: string;
  goal: SurfaceGoal;
  proposedSurfacePolicy: SurfacePolicy;
  tools?: ToolPack | null;
}

export type HostPolicyResolver = (
  request: HostPolicyResolutionRequest,
) => SurfacePolicy | null | Promise<SurfacePolicy | null>;

export interface AgentPolicyResolution {
  source: 'default' | 'host';
  proposedSurfacePolicy: SurfacePolicy;
  surfacePolicy: SurfacePolicy;
  rejectedTools: string[];
  fallback: boolean;
}

export interface AgentSurfacePlanningOptions {
  goal?: SurfaceGoal | null;
  goalProvider?: AgentGoalProvider | null;
  goalModel?: AgentGoalTextClient | null;
  goalTimeoutMs?: number;
  hostPolicyResolver?: HostPolicyResolver | null;
  persistence?: SurfacePersistence;
  signal?: AbortSignal;
}

export interface AgentSurfacePlanningInput extends AgentSurfacePlanningOptions {
  prompt: string;
  tools?: ToolPack | null;
}

export interface AgentSurfacePlanResult {
  goal: SurfaceGoal;
  goalSource: SurfaceGoalSource;
  proposedSurfacePolicy: SurfacePolicy;
  surfacePolicy: SurfacePolicy;
  compiledPolicy: CompiledSurfacePolicy;
  policyResolution: AgentPolicyResolution;
}

export type AgentSurfaceGenerationInput = Omit<
  SurfaceGenerationInput,
  'surfacePolicy'
> & AgentSurfacePlanningOptions & {
  emitAgentDiagnostics?: boolean;
};

export interface AgentSurfaceGenerationSummary extends SurfaceGenerationSummary {
  agent: AgentSurfacePlanResult;
}

const PURPOSES = new Set<SurfacePurpose>(SURFACE_PURPOSE_VALUES);
const MIN_MODEL_CONFIDENCE = 0.45;

const APPROVAL_RE =
  /\b(approve|approval|confirm|publish|send|email|post|delete|remove|archive|commit|merge|deploy|invite|charge|pay|purchase|refund)\b|\b(update|change)\s+(the|this|that|a|an|my|our)\b/i;
const BACKGROUND_RE =
  /\b(analy[sz]e|analysis|calculate|compute|forecast|simulate|score|rank|audit|batch|background|long[-\s]?running)\b/i;
const SEARCH_RE =
  /\b(search|lookup|look\s+up|fetch|load|find|browse|filter|query|explore|discover)\b/i;
const FORM_RE =
  /\b(form|collect|intake|survey|questionnaire|submit|capture|enter|input)\b/i;
const SELECT_RE =
  /\b(pick|choose|select|save|remember|vote|rate|rank|favorite)\b/i;
const DIRECT_TOOL_NAME_RE = /[_\W]+/;
const FORM_TOOL_RE =
  /\b(submit|form|collect|intake|survey|questionnaire|capture|input)\b/i;
const SELECT_TOOL_RE =
  /\b(choose|choice|select|save|pick|vote|rate|rank|favorite|remember)\b/i;

export async function planAgentSurface(
  input: AgentSurfacePlanningInput,
): Promise<AgentSurfacePlanResult> {
  const deterministicGoal = inferSurfaceGoal(input.prompt, {
    tools: input.tools ?? null,
  });
  const inferred = input.goal
    ? {
        goal: normalizeSurfaceGoal(input.goal, deterministicGoal),
        source: 'provided' as const,
      }
    : await inferProvidedGoal(input, deterministicGoal);
  const goalSource = inferred?.source ?? 'deterministic';
  const goal = sanitizeSurfaceGoal(inferred?.goal ?? deterministicGoal, {
    tools: input.tools ?? null,
    fallback: deterministicGoal,
  });
  const proposedSurfacePolicy = policyFromGoal(goal, {
    persistence: input.persistence,
  });
  const policyResolution = await resolveHostPolicy({
    prompt: input.prompt,
    goal,
    proposedSurfacePolicy,
    tools: input.tools ?? null,
    resolver: input.hostPolicyResolver ?? null,
  });
  const compiledPolicy = compileSurfacePolicy(policyResolution.surfacePolicy, {
    tools: input.tools ?? null,
  });
  return {
    goal,
    goalSource,
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
    tools: input.tools ?? null,
    surfacePolicy: agent.surfacePolicy,
    preludeLines,
  }, emit);
  return {
    ...summary,
    agent,
  };
}

export function inferSurfaceGoal(
  prompt: string,
  options: {
    tools?: ToolPack | null;
  } = {},
): SurfaceGoal {
  const requestedTools = inferToolNames(prompt, options.tools ?? null);
  const selectedTools = toolsByName(options.tools, requestedTools);

  const hasApproval = selectedTools.some((tool) => toolAuthority(tool) === 'approval-gated');
  const hasWorker = selectedTools.some((tool) => toolData(tool) === 'worker');
  const hasResource = selectedTools.some((tool) => toolData(tool) === 'host-resource');
  const hasAction = selectedTools.some((tool) => toolAuthority(tool) === 'host-action');

  let interaction: SurfaceGoalInteraction = 'none';
  if (hasApproval || APPROVAL_RE.test(prompt)) interaction = 'approval';
  else if (hasWorker || BACKGROUND_RE.test(prompt)) interaction = 'background';
  else if (hasResource || SEARCH_RE.test(prompt)) interaction = 'search';
  else if (FORM_RE.test(prompt)) interaction = 'form';
  else if (hasAction || SELECT_RE.test(prompt)) interaction = 'select';

  const sideEffect: SurfaceGoalSideEffect = interaction === 'approval'
    ? 'approval-required'
    : hasAction || interaction === 'select' || interaction === 'form'
      ? 'local-state'
      : 'none';
  const dataNeed: SurfaceGoalDataNeed = interaction === 'background' || hasWorker
    ? 'worker'
    : interaction === 'search' || hasResource
      ? 'host-resource'
      : 'embedded';

  return {
    purpose: inferPurpose(prompt),
    interaction,
    dataNeed,
    sideEffect,
    requestedTools,
    confidence: requestedTools.length > 0 || interaction !== 'none' ? 0.72 : 0.58,
    rationale: 'deterministic keyword and catalog match',
  };
}

export function policyFromGoal(
  goal: SurfaceGoal,
  options: { persistence?: SurfacePersistence } = {},
): SurfacePolicy {
  const persistence = options.persistence ?? 'replayable';
  const hasSurfaceAccess = goal.requestedTools.length > 0;
  if (goal.sideEffect === 'approval-required' || goal.interaction === 'approval') {
    return {
      tier: 'approval',
      purpose: 'operate',
      grants: goal.requestedTools,
      persistence,
    };
  }
  if (goal.dataNeed === 'worker' || goal.interaction === 'background') {
    return {
      tier: 'worker',
      purpose: goal.purpose,
      grants: goal.requestedTools,
      persistence,
    };
  }
  if (
    hasSurfaceAccess &&
    (
      goal.interaction !== 'none' ||
      goal.dataNeed === 'host-resource' ||
      goal.sideEffect === 'local-state' ||
      goal.sideEffect === 'external-action'
    )
  ) {
    return {
      tier: 'declarative',
      purpose: goal.purpose,
      grants: goal.requestedTools,
      persistence,
    };
  }
  return {
    tier: 'static',
    purpose: goal.purpose,
    persistence,
  };
}

export function defaultHostPolicyResolver(
  request: HostPolicyResolutionRequest,
): SurfacePolicy {
  return narrowSurfacePolicy(request.proposedSurfacePolicy, {
    tools: request.tools ?? null,
  }).surfacePolicy;
}

function agentPreludeLines(agent: AgentSurfacePlanResult): ProtocolLine[] {
  return [
    { op: 'meta', path: '/agent-goal', value: agent.goal },
    {
      op: 'meta',
      path: '/agent-policy-resolution',
      value: {
        source: agent.policyResolution.source,
        goalSource: agent.goalSource,
        proposedSurfacePolicy: agent.policyResolution.proposedSurfacePolicy,
        surfacePolicy: agent.policyResolution.surfacePolicy,
        rejectedTools: agent.policyResolution.rejectedTools,
        fallback: agent.policyResolution.fallback,
      },
    },
  ];
}

async function inferProvidedGoal(
  input: AgentSurfacePlanningInput,
  deterministicGoal: SurfaceGoal,
): Promise<{ goal: SurfaceGoal; source: SurfaceGoalSource } | null> {
  if (input.goalProvider) {
    const goal = await input.goalProvider({
      prompt: input.prompt,
      tools: input.tools ?? null,
      deterministicGoal,
      signal: input.signal,
    });
    return goal ? { goal, source: 'provided' } : null;
  }
  if (!input.goalModel) return null;
  const goal = await inferGoalWithModel(input.goalModel, {
    prompt: input.prompt,
    tools: input.tools ?? null,
    deterministicGoal,
    timeoutMs: input.goalTimeoutMs,
    signal: input.signal,
  });
  return goal ? { goal, source: 'model' } : null;
}

async function inferGoalWithModel(
  client: AgentGoalTextClient,
  input: {
    prompt: string;
    tools?: ToolPack | null;
    deterministicGoal: SurfaceGoal;
    timeoutMs?: number;
    signal?: AbortSignal;
  },
): Promise<SurfaceGoal | null> {
  const system = buildGoalClassifierPrompt(input.tools ?? null);
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
    const parsed = JSON.parse(json) as Partial<SurfaceGoal>;
    const normalized = normalizeSurfaceGoal(parsed, input.deterministicGoal);
    return normalized.confidence >= MIN_MODEL_CONFIDENCE ? normalized : null;
  } catch {
    return null;
  }
}

function buildGoalClassifierPrompt(tools: ToolPack | null): string {
  const toolLines = (tools?.tools ?? [])
    .map((tool) => {
      const data = toolData(tool);
      const authority = toolAuthority(tool);
      return `- ${tool.name}: ${tool.kind ?? 'action'}, data=${data}, authority=${authority}, ${tool.description}`;
    })
    .join('\n') || '- none';
  return `Classify a Summon generative-UI request into a bounded tool object.

Available host tools:
${toolLines}

Respond with ONLY one JSON object. No markdown and no prose.
Shape:
{"purpose":"inform|compare|explore|collect|review|operate","interaction":"none|select|form|search|background|approval","dataNeed":"embedded|host-resource|worker","sideEffect":"none|local-state|external-action|approval-required","requestedTools":["name"],"confidence":0.0,"rationale":"short reason"}

Rules:
- Pick only tool names from the list above.
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
    tools: input.tools ?? null,
  });
  if (!input.resolver) {
    return {
      source: 'default',
      proposedSurfacePolicy: input.proposedSurfacePolicy,
      surfacePolicy: narrowed.surfacePolicy,
      rejectedTools: narrowed.rejectedTools,
      fallback: narrowed.fallback,
    };
  }

  const hostPolicy = await input.resolver({
    prompt: input.prompt,
    goal: input.goal,
    proposedSurfacePolicy: narrowed.surfacePolicy,
    tools: input.tools ?? null,
  });
  const hostNarrowed = narrowSurfacePolicy(hostPolicy ?? { tier: 'static', purpose: 'inform' }, {
    tools: input.tools ?? null,
  });
  return {
    source: 'host',
    proposedSurfacePolicy: input.proposedSurfacePolicy,
    surfacePolicy: hostNarrowed.surfacePolicy,
    rejectedTools: [
      ...new Set([...narrowed.rejectedTools, ...hostNarrowed.rejectedTools]),
    ],
    fallback: narrowed.fallback || hostNarrowed.fallback || hostPolicy === null,
  };
}

function narrowSurfacePolicy(
  policy: SurfacePolicy,
  options: {
    tools: ToolPack | null;
  },
): {
  surfacePolicy: SurfacePolicy;
  rejectedTools: string[];
  fallback: boolean;
} {
  const toolNames = new Set((options.tools?.tools ?? []).map((tool) => tool.name));
  const rawGrants = Array.isArray(policy.grants) ? policy.grants.filter(isString) : [];
  const knownGrantNames = rawGrants.filter((name) => toolNames.has(name));
  const knownTools = toolsByName(options.tools, knownGrantNames);

  const rejectedTools = rawGrants.filter((name) => !toolNames.has(name));
  const tier = strongestTier(policy.tier, knownTools);
  const grants = knownTools
    .filter((tool) => toolAllowedForTier(tier, tool))
    .map((tool) => tool.name);

  for (const name of knownGrantNames) {
    if (!grants.includes(name)) rejectedTools.push(name);
  }

  if ((tier === 'worker' && grants.length === 0) ||
    (tier === 'approval' && !knownTools.some((tool) => toolAuthority(tool) === 'approval-gated'))) {
    // The proposed tier (worker/approval) cannot be satisfied by the available
    // tools. Rather than collapse to a dead `static` surface (the historical
    // "static cliff"), fall back to the strongest *legal* tier the available
    // tools support. We fail-closed on authority — never granting an approval
    // or worker capability the host didn't authorize — but not on the surface's
    // ability to function. Mirrors Ghost's "fall back to core: keep everything,
    // lose focus" instead of "fall back to nothing".
    const declarativeGrants = knownTools
      .filter((tool) => toolAllowedForTier('declarative', tool))
      .map((tool) => tool.name);
    // Recompute rejections against the *downgraded* tier so a tool that is
    // legal at `declarative` isn't reported as rejected just because it was
    // illegal at the proposed approval/worker tier. Unknown (off-ceiling) names
    // stay rejected.
    const downgradeRejected = [
      ...new Set([
        ...rawGrants.filter((name) => !toolNames.has(name)),
        ...knownGrantNames.filter((name) => !declarativeGrants.includes(name)),
      ]),
    ];
    if (declarativeGrants.length === 0) {
      // No usable interactive tools at all — static is the only legal surface.
      return {
        surfacePolicy: staticFallbackPolicy(policy),
        rejectedTools: [...new Set([...rejectedTools, ...knownGrantNames])],
        fallback: true,
      };
    }
    const downgraded: SurfacePolicy = {
      tier: 'declarative',
      purpose: PURPOSES.has(policy.purpose as SurfacePurpose) ? policy.purpose : 'inform',
      grants: declarativeGrants,
      persistence: policy.persistence === 'ephemeral' ? 'ephemeral' : 'replayable',
    };
    const downgradedCompiled = compileSurfacePolicy(downgraded, {
      tools: options.tools,
    });
    if (downgradedCompiled.issues.some((issue) => issue.severity === 'block')) {
      return {
        surfacePolicy: staticFallbackPolicy(policy),
        rejectedTools: [...new Set([...rejectedTools, ...knownGrantNames])],
        fallback: true,
      };
    }
    return {
      surfacePolicy: downgraded,
      rejectedTools: downgradeRejected,
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
    persistence: policy.persistence === 'ephemeral' ? 'ephemeral' : 'replayable',
  };
  const compiled = compileSurfacePolicy(surfacePolicy, {
    tools: options.tools,
  });
  if (compiled.issues.some((issue) => issue.severity === 'block')) {
    return {
      surfacePolicy: staticFallbackPolicy(policy),
      rejectedTools: [...new Set([...rejectedTools, ...knownGrantNames])],
      fallback: true,
    };
  }
  return {
    surfacePolicy,
    rejectedTools: [...new Set(rejectedTools)],
    fallback: false,
  };
}

function strongestTier(
  proposedTier: SurfacePolicy['tier'],
  tools: ToolSpec[],
): SurfacePolicy['tier'] {
  if (proposedTier === 'static') return 'static';
  if (tools.some((tool) => toolAuthority(tool) === 'approval-gated')) return 'approval';
  if (tools.some((tool) => toolData(tool) === 'worker')) return 'worker';
  return proposedTier;
}

function staticFallbackPolicy(policy: SurfacePolicy): SurfacePolicy {
  return {
    tier: 'static',
    purpose: PURPOSES.has(policy.purpose as SurfacePurpose) ? policy.purpose : 'inform',
    persistence: policy.persistence === 'ephemeral' ? 'ephemeral' : 'replayable',
  };
}

function toolAllowedForTier(tier: SurfacePolicy['tier'], tool: ToolSpec): boolean {
  if (tier === 'static') return false;
  const data = toolData(tool);
  const authority = toolAuthority(tool);
  if (tier === 'worker') return data === 'worker';
  if (tier === 'approval') return authority === 'approval-gated';
  return data !== 'worker' && authority !== 'approval-gated';
}

function inferToolNames(prompt: string, pack: ToolPack | null): string[] {
  const tools = pack?.tools ?? [];
  if (tools.length === 0) return [];
  const text = prompt.toLowerCase();
  const directMatches = tools.filter((tool) => matchesToolName(text, tool.name));
  if (directMatches.length > 0) return directMatches.map((tool) => tool.name);

  const approval = APPROVAL_RE.test(prompt)
    ? tools.filter((tool) => toolAuthority(tool) === 'approval-gated')
    : [];
  if (approval.length > 0) return singleCandidateNames(approval);

  const worker = BACKGROUND_RE.test(prompt)
    ? tools.filter((tool) => toolData(tool) === 'worker')
    : [];
  if (worker.length > 0) return singleCandidateNames(worker);

  const resource = SEARCH_RE.test(prompt)
    ? tools.filter((tool) => toolData(tool) === 'host-resource')
    : [];
  if (resource.length > 0) return singleCandidateNames(resource);

  const actions = tools.filter((tool) => toolMatchesActionClass(prompt, tool));
  if (actions.length > 0) {
    return singleCandidateNames(actions);
  }
  return [];
}

function toolMatchesActionClass(prompt: string, tool: ToolSpec): boolean {
  const data = toolData(tool);
  const authority = toolAuthority(tool);
  if (authority !== 'host-action' || data === 'worker') return false;
  if (FORM_RE.test(prompt)) {
    return toolClassMatches(tool, FORM_TOOL_RE);
  }
  if (SELECT_RE.test(prompt)) {
    return toolClassMatches(tool, SELECT_TOOL_RE);
  }
  return false;
}

function matchesToolName(text: string, name: string): boolean {
  const normalizedName = name.toLowerCase();
  if (text.includes(normalizedName)) return true;
  const terms = normalizedName
    .split(DIRECT_TOOL_NAME_RE)
    .filter((term) => term.length > 2);
  if (terms.length === 0) return false;
  return terms.every((term) => text.includes(term));
}

function singleCandidateNames(tools: ToolSpec[]): string[] {
  return tools.length === 1 ? [tools[0]!.name] : [];
}

function toolClassMatches(tool: ToolSpec, pattern: RegExp): boolean {
  return pattern.test(`${tool.name} ${tool.description}`);
}

function normalizeSurfaceGoal(raw: Partial<SurfaceGoal>, fallback: SurfaceGoal): SurfaceGoal {
  return {
    purpose: PURPOSES.has(raw.purpose as SurfacePurpose) ? raw.purpose as SurfacePurpose : fallback.purpose,
    interaction: enumValue(raw.interaction, ['none', 'select', 'form', 'search', 'background', 'approval']) ??
      fallback.interaction,
    dataNeed: enumValue(raw.dataNeed, ['embedded', 'host-resource', 'worker']) ?? fallback.dataNeed,
    sideEffect: enumValue(raw.sideEffect, ['none', 'local-state', 'external-action', 'approval-required']) ??
      fallback.sideEffect,
    requestedTools: stringList(raw.requestedTools),
    confidence: typeof raw.confidence === 'number' && Number.isFinite(raw.confidence)
      ? Math.max(0, Math.min(1, raw.confidence))
      : fallback.confidence,
    rationale: typeof raw.rationale === 'string' ? raw.rationale.slice(0, 240) : fallback.rationale,
  };
}

function sanitizeSurfaceGoal(
  goal: SurfaceGoal,
  options: {
    tools: ToolPack | null;
    fallback: SurfaceGoal;
  },
): SurfaceGoal {
  const toolNames = new Set((options.tools?.tools ?? []).map((item) => item.name));
  const requestedTools = goal.requestedTools.filter((name) => toolNames.has(name));
  if (
    goal.interaction !== 'none' &&
    requestedTools.length === 0 &&
    options.fallback.requestedTools.length > 0
  ) {
    requestedTools.push(...options.fallback.requestedTools);
  }
  return {
    ...goal,
    requestedTools: [...new Set(requestedTools)],
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

function toolsByName(pack: ToolPack | null | undefined, names: string[]): ToolSpec[] {
  const byName = new Map((pack?.tools ?? []).map((tool) => [tool.name, tool]));
  return names.map((name) => byName.get(name)).filter((tool): tool is ToolSpec => Boolean(tool));
}

function toolData(tool: ToolSpec): SurfaceGoalDataNeed {
  return tool.surface?.data ?? (tool.kind === 'resource' ? 'host-resource' : 'embedded');
}

function toolAuthority(tool: ToolSpec): 'none' | 'read' | 'host-action' | 'approval-gated' {
  return tool.surface?.authority ?? (tool.kind === 'resource' ? 'read' : 'host-action');
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
