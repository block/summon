import {
  contractIssue,
  type ContractIssue,
} from './contracts.js';
import type {
  ToolPack,
  ToolSpec,
} from './prompt.js';
import {
  SURFACE_PERSISTENCE_VALUES,
  SURFACE_PURPOSE_VALUES,
  type SurfaceAuthority,
  type SurfaceData,
  type SurfacePersistence,
  type SurfacePlan,
  type SurfacePlanMode,
  type SurfacePurpose,
} from './surface-plan.js';

export type SurfaceTier = 'static' | 'declarative' | 'worker' | 'approval';

export const SURFACE_TIER_VALUES = [
  'static',
  'declarative',
  'worker',
  'approval',
] as const satisfies readonly SurfaceTier[];

export interface SurfacePolicy {
  tier: SurfaceTier;
  purpose?: SurfacePurpose;
  grants?: string[];
  persistence?: SurfacePersistence;
}

export interface NormalizedSurfacePolicy {
  tier: SurfaceTier;
  purpose: SurfacePurpose;
  grants: string[];
  persistence: SurfacePersistence;
}

export interface CompileSurfacePolicyOptions {
  tools?: ToolPack | null;
}

export interface CompiledSurfacePolicy {
  policy: NormalizedSurfacePolicy;
  tools: ToolPack | null;
  mode: SurfacePlanMode;
  surfacePlan: SurfacePlan;
  issues: ContractIssue[];
}

const TIERS = new Set<SurfaceTier>(SURFACE_TIER_VALUES);
const PURPOSES = new Set<SurfacePurpose>(SURFACE_PURPOSE_VALUES);
const PERSISTENCES = new Set<SurfacePersistence>(SURFACE_PERSISTENCE_VALUES);

const DEFAULT_POLICY: NormalizedSurfacePolicy = {
  tier: 'static',
  purpose: 'inform',
  grants: [],
  persistence: 'replayable',
};

export function normalizeSurfacePolicy(raw: unknown): NormalizedSurfacePolicy | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;
  const tier = enumValue(input.tier, TIERS);
  if (!tier) return null;
  const purpose = input.purpose === undefined
    ? DEFAULT_POLICY.purpose
    : enumValue(input.purpose, PURPOSES);
  const persistence = input.persistence === undefined
    ? DEFAULT_POLICY.persistence
    : enumValue(input.persistence, PERSISTENCES);
  if (!purpose || !persistence) return null;
  return {
    tier,
    purpose,
    grants: dedupeStrings(input.grants),
    persistence,
  };
}

export function compileSurfacePolicy(
  policy: SurfacePolicy | unknown,
  options: CompileSurfacePolicyOptions = {},
): CompiledSurfacePolicy {
  const issues: ContractIssue[] = [];
  const normalized = normalizeSurfacePolicy(policy);
  const effective = normalized ?? DEFAULT_POLICY;
  if (!normalized) {
    issues.push(surfacePolicyIssue(
      'surface-policy-invalid',
      'surfacePolicy must include a valid tier',
    ));
  }

  const toolPack = options.tools ?? null;
  const toolsByName = new Map((toolPack?.tools ?? []).map((tool) => [tool.name, tool]));

  const selectedTools: ToolSpec[] = [];
  for (const grant of effective.grants) {
    const tool = toolsByName.get(grant);
    if (!tool) {
      issues.push(surfacePolicyIssue(
        'surface-policy-unknown-grant',
        `SurfacePolicy references unknown grant "${grant}"`,
      ));
      continue;
    }
    selectedTools.push(tool);
    validateToolForTier(effective.tier, tool, issues);
  }

  validateTierRequirements(effective, selectedTools, issues);

  const surfacePlan = planForPolicy(effective, selectedTools);
  return {
    policy: effective,
    tools: narrowToolPack(toolPack, selectedTools, effective.grants),
    mode: effective.tier === 'static' ? 'static' : 'interactive',
    surfacePlan,
    issues,
  };
}

function validateToolForTier(
  tier: SurfaceTier,
  tool: ToolSpec,
  issues: ContractIssue[],
): void {
  const data = toolData(tool);
  const authority = toolAuthority(tool);
  if (tier === 'static') {
    issues.push(surfacePolicyIssue(
      'surface-policy-tier-exceeded',
      `Static SurfacePolicy cannot use grant "${tool.name}"`,
    ));
    return;
  }
  if (tier === 'declarative' && data === 'worker') {
    issues.push(surfacePolicyIssue(
      'surface-policy-tier-exceeded',
      `${tier} SurfacePolicy cannot use worker-backed grant "${tool.name}"`,
    ));
  }
  if (tier === 'declarative' && authority === 'approval-gated') {
    issues.push(surfacePolicyIssue(
      'surface-policy-tier-exceeded',
      `${tier} SurfacePolicy cannot use approval-gated grant "${tool.name}"`,
    ));
  }
  if (tier === 'worker' && data !== 'worker') {
    issues.push(surfacePolicyIssue(
      'surface-policy-tier-exceeded',
      `Worker SurfacePolicy can only use worker-backed grants; "${tool.name}" is not worker-backed`,
    ));
  }
  if (tier === 'approval' && authority !== 'approval-gated') {
    issues.push(surfacePolicyIssue(
      'surface-policy-tier-exceeded',
      `Approval SurfacePolicy can only use approval-gated grants; "${tool.name}" is ${authority}`,
    ));
  }
}

function validateTierRequirements(
  policy: NormalizedSurfacePolicy,
  tools: ToolSpec[],
  issues: ContractIssue[],
): void {
  if (
    policy.tier === 'worker' &&
    !tools.some((tool) => toolData(tool) === 'worker')
  ) {
    issues.push(surfacePolicyIssue(
      'surface-policy-tier-requirement',
      'Worker SurfacePolicy requires at least one worker-backed grant',
    ));
  }
  if (
    policy.tier === 'approval' &&
    !tools.some((tool) => toolAuthority(tool) === 'approval-gated')
  ) {
    issues.push(surfacePolicyIssue(
      'surface-policy-tier-requirement',
      'Approval SurfacePolicy requires at least one approval-gated grant',
    ));
  }
}

function planForPolicy(
  policy: NormalizedSurfacePolicy,
  tools: ToolSpec[],
): SurfacePlan {
  if (policy.tier === 'static') {
    return {
      purpose: policy.purpose,
      runtime: 'arrow',
      data: 'embedded',
      authority: 'none',
      persistence: policy.persistence,
      network: 'none',
    };
  }

  const data = policy.tier === 'worker'
    ? 'worker'
    : strongestData([
        ...tools.map(toolData),
      ]);
  const authority = policy.tier === 'approval'
    ? 'approval-gated'
    : strongestAuthority([
        ...tools.map(toolAuthority),
      ]);

  return {
    purpose: policy.purpose,
    runtime: 'arrow',
    data,
    authority,
    persistence: policy.persistence,
    network: 'none',
  };
}

function narrowToolPack(
  pack: ToolPack | null,
  tools: ToolSpec[],
  selectedGrantNames: string[],
): ToolPack | null {
  if (!pack || tools.length === 0) return null;
  const grants = new Set(selectedGrantNames);
  const patterns = (pack.patterns ?? []).filter((pattern) =>
    pattern.tool === undefined || grants.has(pattern.tool),
  );
  return {
    tools,
    ...(patterns.length > 0 ? { patterns } : {}),
  };
}

function toolData(tool: ToolSpec): SurfaceData {
  return tool.surface?.data ??
    (tool.kind === 'resource' ? 'host-resource' : 'embedded');
}

function toolAuthority(tool: ToolSpec): SurfaceAuthority {
  return tool.surface?.authority ??
    (tool.kind === 'resource' ? 'read' : 'host-action');
}

function strongestData(values: SurfaceData[]): SurfaceData {
  if (values.includes('worker')) return 'worker';
  if (values.includes('host-resource')) return 'host-resource';
  return 'embedded';
}

function strongestAuthority(values: SurfaceAuthority[]): SurfaceAuthority {
  if (values.includes('approval-gated')) return 'approval-gated';
  if (values.includes('host-action')) return 'host-action';
  if (values.includes('read')) return 'read';
  return 'none';
}

function surfacePolicyIssue(code: string, message: string): ContractIssue {
  return contractIssue({
    source: 'system',
    severity: 'block',
    code,
    message,
  });
}

function enumValue<T extends string>(raw: unknown, values: ReadonlySet<T>): T | null {
  return typeof raw === 'string' && values.has(raw as T) ? raw as T : null;
}

function dedupeStrings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of raw) {
    if (typeof value !== 'string' || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}
