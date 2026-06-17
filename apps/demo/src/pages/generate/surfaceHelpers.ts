import {
  parseTokenValues,
  type ToolPack,
  type SurfaceContractView,
  type SurfacePlan,
  type SurfacePolicy,
} from '@anarchitecture/summon/engine';
import {
  narrowToolPack,
  type ActiveContract,
  type ShowcaseScenario,
} from '../../showcase.js';
import { baseToolPack, scenarioCategoryOrder } from './constants.js';
import type { ModelProviderInfo, StreamOptionsPayload } from './types.js';

export function describeScenario(scenario: ShowcaseScenario): { category: string; description: string } {
  if (scenario.id.startsWith('ghost-')) {
    return {
      category: 'Fingerprint',
      description: 'Portable Ghost fingerprint package with host-allowed controls.',
    };
  }
  switch (scenario.id) {
    case 'host-resource-search':
      return { category: 'Host data', description: 'Host-owned data resource with explicit read authority.' };
    case 'host-ai-brainstorm':
      return { category: 'Host data', description: 'Host-owned AI resource with loading, error, and response states.' };
    case 'github-profile-lookup':
      return { category: 'Host data', description: 'Host-owned external lookup with proxied image data and read authority.' };
    case 'arrow-fidelity':
      return { category: 'Host action', description: 'Arrow-rendered dashboard with host-owned action authority.' };
    case 'static-summary':
      return { category: 'Read-only', description: 'Static generated UI with embedded data and no host actions.' };
    case 'declarative-form':
    case 'decision-picker':
      return { category: 'Host action', description: 'Declarative controls routed through host-owned handlers.' };
    case 'worker-analysis':
      return { category: 'Worker', description: 'Background worker data plus host-action authority.' };
    case 'approval-publish':
      return { category: 'Approval', description: 'Publish workflow guarded by an approval-gated host action.' };
    case 'local-state-motion':
      return { category: 'Runtime', description: 'Declarative local state and host-owned motion recipes.' };
    case 'token-override':
      return { category: 'Tokens', description: 'Token override request that repaints through host CSS.' };
    case 'layout-card':
      return { category: 'Layout', description: 'Host layout slots constrain the generated card shape.' };
    case 'sibling-summon':
      return { category: 'Composition', description: 'Parent surface can summon a sibling sandbox with narrowed host tools.' };
    default:
      return { category: 'Showcase', description: 'Surface-configured Summon generation scenario.' };
  }
}

export function compactPlanText(plan: SurfacePlan): string {
  return [
    displayPlanPart(plan.purpose),
    displayPlanPart(plan.runtime),
    displayPlanPart(plan.data),
    displayPlanPart(plan.authority),
  ].join(' · ');
}

export function planText(plan: SurfacePlan): string {
  return [
    displayPlanPart(plan.purpose),
    displayPlanPart(plan.runtime),
    displayPlanPart(plan.data),
    displayPlanPart(plan.authority),
    displayPlanPart(plan.persistence),
  ].join(' · ');
}

export function displayPlanPart(value: string): string {
  switch (value) {
    case 'host-resource':
      return 'host data';
    case 'host-action':
      return 'host action';
    case 'approval-gated':
      return 'approval required';
    default:
      return value.replace(/-/g, ' ');
  }
}

export function scenarioUsesFixedPolicy(scenario: ShowcaseScenario): boolean {
  return false;
}

export function toolPackFor(active: ActiveContract): ToolPack {
  return narrowToolPack(baseToolPack, active.toolNames);
}

export function agentBrokerRequestFor(active: ActiveContract): { enabled: true } | undefined {
  return active.agentBroker ? { enabled: true } : undefined;
}

export function explicitSurfaceRequestFor(active: ActiveContract): Pick<StreamOptionsPayload, 'surfacePolicy'> {
  if (active.surfacePolicy) return { surfacePolicy: active.surfacePolicy };
  return {};
}

export function surfaceRequestFor(active: ActiveContract): StreamOptionsPayload {
  const agent = agentBrokerRequestFor(active);
  if (agent) return {};
  return explicitSurfaceRequestFor(active);
}

export function surfacePolicyForPlan(
  plan: SurfacePlan,
  toolNames: string[],
): SurfacePolicy {
  const tier = plan.authority === 'approval-gated'
    ? 'approval'
    : plan.data === 'worker'
      ? 'worker'
      : plan.data === 'host-resource' || plan.authority !== 'none'
        ? 'declarative'
        : 'static';
  return {
    tier,
    purpose: plan.purpose,
    persistence: plan.persistence,
    ...(tier !== 'static' && toolNames.length > 0 ? { grants: toolNames } : {}),
  };
}

export function ghostSelectionValue(rootId: string): string {
  return `ghost:${rootId}`;
}

export function ghostRootFromSelection(selection: string | null): string | null {
  return selection?.startsWith('ghost:') ? selection.slice('ghost:'.length) : null;
}

export function tokenOverridesFor(preset: string): Record<string, string> | undefined {
  if (preset !== 'accent-blue') return undefined;
  return {
    'color-accent': '#0f8cff',
    'color-accent-fg': '#ffffff',
  };
}

export function summarizeValidationMeta(value: unknown): string {
  const summary = value as { blocked?: unknown; warnings?: unknown } | undefined;
  const blocked = typeof summary?.blocked === 'number' ? summary.blocked : 0;
  const warnings = typeof summary?.warnings === 'number' ? summary.warnings : 0;
  return `${blocked}/${warnings}`;
}

export function summarizeStreamGraphMeta(value: unknown): string {
  const summary = value as
    | { artifacts?: unknown[]; health?: { complete?: unknown; blockedCount?: unknown; skippedCount?: unknown } }
    | undefined;
  const complete = summary?.health?.complete === true;
  const artifacts = Array.isArray(summary?.artifacts) ? summary.artifacts.length : 0;
  const blocked = typeof summary?.health?.blockedCount === 'number' ? summary.health.blockedCount : 0;
  return `${complete ? 'complete' : 'blocked'} · artifacts=${artifacts} blocked=${blocked}`;
}

export function parseSurfaceContractView(value: unknown): SurfaceContractView | null {
  if (!value || typeof value !== 'object') return null;
  const contract = value as Partial<SurfaceContractView>;
  if (!contract.surface || typeof contract.surface !== 'object') return null;
  if (!Array.isArray(contract.tools)) return null;
  if (!Array.isArray(contract.issues)) return null;
  return contract as SurfaceContractView;
}

export function agentGoalText(value: unknown): string {
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  const item = value as Record<string, unknown>;
  const parts = [
    typeof item.purpose === 'string' ? item.purpose : null,
    typeof item.interaction === 'string' ? item.interaction : null,
    typeof item.dataNeed === 'string' ? item.dataNeed : null,
    typeof item.sideEffect === 'string' ? item.sideEffect : null,
  ].filter((part): part is string => Boolean(part));
  const grants = Array.isArray(item.requestedTools)
    ? item.requestedTools.filter((name): name is string => typeof name === 'string')
    : [];
  const access = [
    grants.length ? `tools=${grants.join(',')}` : '',
  ].filter(Boolean).join(' ');
  return `${parts.join(' · ') || 'tool'}${access ? ` · ${access}` : ''}`;
}

export function agentPolicyText(value: unknown): string {
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  const item = value as Record<string, unknown>;
  const policy = item.surfacePolicy && typeof item.surfacePolicy === 'object'
    ? item.surfacePolicy as Record<string, unknown>
    : null;
  const source = typeof item.source === 'string' ? item.source : 'broker';
  const goalSource = typeof item.goalSource === 'string' ? item.goalSource : '';
  const tier = typeof policy?.tier === 'string' ? policy.tier : 'policy';
  const purpose = typeof policy?.purpose === 'string' ? policy.purpose : 'inform';
  const fallback = item.fallback === true ? ' · fallback' : '';
  const rejectedTools = Array.isArray(item.rejectedTools) ? item.rejectedTools.length : 0;
  const rejected = rejectedTools;
  const sourceText = goalSource ? `${source}/${goalSource}` : source;
  return `${sourceText} · ${tier}/${purpose}${fallback}${rejected ? ` · rejected=${rejected}` : ''}`;
}

export function applyTokenOverrideCss(baseCss: string, applied: Array<{ token: string; value: string }>): string {
  if (applied.length === 0) return baseCss;
  const replacements = new Map(applied.map((entry) => [entry.token, entry.value]));
  const defined = parseTokenValues(baseCss);
  let css = baseCss.replace(/(--([a-zA-Z0-9_-]+)\s*:\s*)([^;]+)(;)/g, (full, prefix, token, _value, suffix) => {
    const next = replacements.get(token);
    return next ? `${prefix}${next}${suffix}` : full;
  });
  const missing = applied.filter((entry) => !defined.has(entry.token));
  if (missing.length > 0) {
    css += `\n:root {\n${missing.map((entry) => `  --${entry.token}: ${entry.value};`).join('\n')}\n}\n`;
  }
  return css;
}

export function parseAppliedTokenOverrides(value: unknown): Array<{ token: string; value: string }> {
  const raw = value as { applied?: unknown } | undefined;
  if (!Array.isArray(raw?.applied)) return [];
  return raw.applied.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const obj = entry as Record<string, unknown>;
    if (typeof obj.token !== 'string' || typeof obj.value !== 'string') return [];
    return [{ token: obj.token, value: obj.value }];
  });
}

export function buildContractRows({
  active,
  selectedScenario,
  modelProviders,
  currentAgentGoalSummary,
  currentAgentPolicySummary,
  currentEffectiveSurfacePlan,
  currentShape,
  currentStreamHealth,
  currentSurfaceContractView,
  currentValidationSummary,
}: {
  active: ActiveContract;
  selectedScenario: ShowcaseScenario;
  modelProviders: ModelProviderInfo[];
  currentAgentGoalSummary: string | null;
  currentAgentPolicySummary: string | null;
  currentEffectiveSurfacePlan: SurfacePlan | null;
  currentShape: string | null;
  currentStreamHealth: string | null;
  currentSurfaceContractView: SurfaceContractView | null;
  currentValidationSummary: string | null;
}) {
  const requested = active.surfacePlan;
  const broker = active.agentBroker
    ? currentAgentPolicySummary ?? currentAgentGoalSummary ?? 'planning on run'
    : scenarioUsesFixedPolicy(selectedScenario)
      ? 'fixed policy'
      : 'manual surface config';
  const contract = currentSurfaceContractView;
  const hostTools = contract
    ? contract.tools.map((tool) => tool.name).join(', ') || 'none'
    : active.toolNames.length ? active.toolNames.join(', ') : 'none';
  const toolCount = contract?.tools.length ?? active.toolNames.length;
  const validation = currentValidationSummary ?? 'pending';
  const stream = currentStreamHealth ?? 'pending';
  const effectivePlan = contract?.surface.plan ?? currentEffectiveSurfacePlan;
  const effective = effectivePlan ? planText(effectivePlan) : 'pending';
  const runtime = effectivePlan
    ? `${displayPlanPart(effectivePlan.runtime)} · ${contract?.surface.mode ?? active.mode} · network ${effectivePlan.network ?? 'none'}`
    : `${displayPlanPart(active.surfacePlan.runtime)} · ${active.mode} · pending`;
  const provider = modelProviders.find((item) => item.id === active.modelProvider);
  const selectedModel = active.generationModel
    ?? provider?.defaults?.generationModel
    ?? provider?.model
    ?? 'server default';
  const selectedUtility = active.utilityModel
    ?? provider?.defaults?.utilityModel
    ?? provider?.utilityModel
    ?? 'server default';
  return [
    ['provider', 'Model provider', provider ? `${provider.name} · ${selectedModel}` : 'server default', provider ? 'neutral' : 'pending'],
    ['utility', 'Utility model', selectedUtility, provider ? 'neutral' : 'pending'],
    ['broker', 'Agent broker', broker, active.agentBroker ? currentAgentPolicySummary ? 'good' : 'neutral' : 'pending'],
    ['requested', 'Requested surface config', active.agentBroker ? 'brokered from prompt' : planText(requested), 'neutral'],
    ['effective', 'Effective safety plan', effective, effectivePlan ? 'good' : 'pending'],
    ['grants', 'Allowed host tools', `${toolCount}: ${hostTools}`, toolCount ? 'neutral' : 'pending'],
    ['visuals', 'Generated visuals', 'Arrow artifact only', effectivePlan ? 'good' : 'pending'],
    ['runtime', 'Sandbox runtime', runtime, effectivePlan ? 'good' : 'pending'],
    ['validation', 'Validation', validation, validation !== 'pending' && !validation.startsWith('0/') ? 'warn' : validation === 'pending' ? 'pending' : 'good'],
    ['stream', 'Stream diagnostics', stream, stream.startsWith('complete') ? 'good' : stream === 'pending' ? 'pending' : 'warn'],
    ['tokens', 'Tokens', active.tokenOverrides ? 'override' : 'base', active.tokenOverrides ? 'good' : 'pending'],
    ['shape', 'Shape', currentShape ?? 'pending', currentShape ? 'neutral' : 'pending'],
  ].map(([key, label, value, tone]) => ({ key, label, value, tone })) as Array<{
    key: string;
    label: string;
    value: string;
    tone: string;
  }>;
}

export function numberOptions(presets: number[] | undefined, selected: number): number[] {
  return Array.from(new Set([...(presets ?? []), selected]))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
}

export function formatApprovalDetails(details: unknown): string {
  if (details === undefined || details === null) return '';
  if (typeof details === 'string') return details;
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

export function groupScenarios(showcaseScenarios: ShowcaseScenario[]) {
  const grouped = new Map<string, ShowcaseScenario[]>();
  for (const scenario of showcaseScenarios) {
    const { category } = describeScenario(scenario);
    const items = grouped.get(category) ?? [];
    items.push(scenario);
    grouped.set(category, items);
  }
  const orderedCategories = [
    ...scenarioCategoryOrder.filter((category) => grouped.has(category)),
    ...Array.from(grouped.keys()).filter((category) => !scenarioCategoryOrder.includes(category)),
  ];
  return orderedCategories.map((category) => ({ category, scenarios: grouped.get(category) ?? [] }));
}
