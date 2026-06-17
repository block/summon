import {
  contractIssue,
  type ContractIssue,
} from './contracts.js';
import type {
  CapabilityPack,
  ComponentPack,
  IntentSpec,
  ScriptPolicy,
} from './prompt.js';
import {
  SURFACE_PERSISTENCE_VALUES,
  SURFACE_PURPOSE_VALUES,
  type ComponentSurface,
  type SurfaceAuthority,
  type SurfaceCeiling,
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
  components?: string[];
  persistence?: SurfacePersistence;
}

export interface NormalizedSurfacePolicy {
  tier: SurfaceTier;
  purpose: SurfacePurpose;
  grants: string[];
  components: string[];
  persistence: SurfacePersistence;
}

export interface CompileSurfacePolicyOptions {
  capabilities?: CapabilityPack | null;
  components?: ComponentPack | null;
}

export interface CompiledSurfacePolicy {
  policy: NormalizedSurfacePolicy;
  capabilities: CapabilityPack | null;
  components: ComponentPack | null;
  mode: SurfacePlanMode;
  scriptPolicy: ScriptPolicy;
  surfacePlan: SurfacePlan;
  surfaceCeiling: SurfaceCeiling;
  issues: ContractIssue[];
}

const TIERS = new Set<SurfaceTier>(SURFACE_TIER_VALUES);
const PURPOSES = new Set<SurfacePurpose>(SURFACE_PURPOSE_VALUES);
const PERSISTENCES = new Set<SurfacePersistence>(SURFACE_PERSISTENCE_VALUES);

const DEFAULT_POLICY: NormalizedSurfacePolicy = {
  tier: 'static',
  purpose: 'inform',
  grants: [],
  components: [],
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
    components: dedupeStrings(input.components),
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

  const capabilityPack = options.capabilities ?? null;
  const componentPack = options.components ?? null;
  const intentsByName = new Map((capabilityPack?.intents ?? []).map((intent) => [intent.name, intent]));
  const componentsByName = new Map((componentPack?.components ?? []).map((component) => [component.name, component]));

  const selectedIntents: IntentSpec[] = [];
  for (const grant of effective.grants) {
    const intent = intentsByName.get(grant);
    if (!intent) {
      issues.push(surfacePolicyIssue(
        'surface-policy-unknown-grant',
        `SurfacePolicy references unknown grant "${grant}"`,
      ));
      continue;
    }
    selectedIntents.push(intent);
    validateIntentForTier(effective.tier, intent, issues);
  }

  const selectedComponents: ComponentPack['components'] = [];
  for (const componentName of effective.components) {
    const component = componentsByName.get(componentName);
    if (!component) {
      issues.push(surfacePolicyIssue(
        'surface-policy-unknown-component',
        `SurfacePolicy references unknown component "${componentName}"`,
      ));
      continue;
    }
    selectedComponents.push(component);
    validateComponentForTier(effective.tier, component.surface, component.name, issues);
  }

  validateTierRequirements(effective, selectedIntents, selectedComponents, issues);

  const surfacePlan = planForPolicy(effective, selectedIntents, selectedComponents);
  return {
    policy: effective,
    capabilities: narrowCapabilityPack(capabilityPack, selectedIntents, effective.grants),
    components: selectedComponents.length > 0 ? { components: selectedComponents } : null,
    mode: effective.tier === 'static' ? 'static' : 'interactive',
    scriptPolicy: 'forbid',
    surfacePlan,
    surfaceCeiling: exactCeiling(surfacePlan),
    issues,
  };
}

function validateIntentForTier(
  tier: SurfaceTier,
  intent: IntentSpec,
  issues: ContractIssue[],
): void {
  const data = intentData(intent);
  const authority = intentAuthority(intent);
  if (tier === 'static') {
    issues.push(surfacePolicyIssue(
      'surface-policy-tier-exceeded',
      `Static SurfacePolicy cannot use grant "${intent.name}"`,
    ));
    return;
  }
  if (tier === 'declarative' && data === 'worker') {
    issues.push(surfacePolicyIssue(
      'surface-policy-tier-exceeded',
      `${tier} SurfacePolicy cannot use worker-backed grant "${intent.name}"`,
    ));
  }
  if (tier === 'declarative' && authority === 'approval-gated') {
    issues.push(surfacePolicyIssue(
      'surface-policy-tier-exceeded',
      `${tier} SurfacePolicy cannot use approval-gated grant "${intent.name}"`,
    ));
  }
  if (tier === 'worker' && data !== 'worker') {
    issues.push(surfacePolicyIssue(
      'surface-policy-tier-exceeded',
      `Worker SurfacePolicy can only use worker-backed grants; "${intent.name}" is not worker-backed`,
    ));
  }
  if (tier === 'approval' && authority !== 'approval-gated') {
    issues.push(surfacePolicyIssue(
      'surface-policy-tier-exceeded',
      `Approval SurfacePolicy can only use approval-gated grants; "${intent.name}" is ${authority}`,
    ));
  }
}

function validateComponentForTier(
  tier: SurfaceTier,
  surface: ComponentSurface | undefined,
  name: string,
  issues: ContractIssue[],
): void {
  const data = surface?.data ?? 'embedded';
  const authority = surface?.authority ?? 'none';
  if (tier === 'static' && (data !== 'embedded' || authority !== 'none')) {
    issues.push(surfacePolicyIssue(
      'surface-policy-tier-exceeded',
      `Static SurfacePolicy can only use embedded display components; "${name}" requires ${data}/${authority}`,
    ));
  }
  if (tier === 'declarative' && data === 'worker') {
    issues.push(surfacePolicyIssue(
      'surface-policy-tier-exceeded',
      `${tier} SurfacePolicy cannot use worker-backed component "${name}"`,
    ));
  }
  if (tier === 'declarative' && authority === 'approval-gated') {
    issues.push(surfacePolicyIssue(
      'surface-policy-tier-exceeded',
      `${tier} SurfacePolicy cannot use approval-gated component "${name}"`,
    ));
  }
  if (tier === 'worker' && data !== 'worker') {
    issues.push(surfacePolicyIssue(
      'surface-policy-tier-exceeded',
      `Worker SurfacePolicy can only use worker-backed components; "${name}" is not worker-backed`,
    ));
  }
  if (tier === 'approval' && authority !== 'none' && authority !== 'approval-gated') {
    issues.push(surfacePolicyIssue(
      'surface-policy-tier-exceeded',
      `Approval SurfacePolicy cannot use component "${name}" with ${authority} authority`,
    ));
  }
}

function validateTierRequirements(
  policy: NormalizedSurfacePolicy,
  intents: IntentSpec[],
  components: ComponentPack['components'],
  issues: ContractIssue[],
): void {
  if (
    policy.tier === 'worker' &&
    !intents.some((intent) => intentData(intent) === 'worker') &&
    !components.some((component) => (component.surface?.data ?? 'embedded') === 'worker')
  ) {
    issues.push(surfacePolicyIssue(
      'surface-policy-tier-requirement',
      'Worker SurfacePolicy requires at least one worker-backed grant or component',
    ));
  }
  if (
    policy.tier === 'approval' &&
    !intents.some((intent) => intentAuthority(intent) === 'approval-gated')
  ) {
    issues.push(surfacePolicyIssue(
      'surface-policy-tier-requirement',
      'Approval SurfacePolicy requires at least one approval-gated grant',
    ));
  }
}

function planForPolicy(
  policy: NormalizedSurfacePolicy,
  intents: IntentSpec[],
  components: ComponentPack['components'],
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
        ...intents.map(intentData),
        ...components.map((component) => component.surface?.data ?? 'embedded'),
      ]);
  const authority = policy.tier === 'approval'
    ? 'approval-gated'
    : strongestAuthority([
        ...intents.map(intentAuthority),
        ...components.map((component) => component.surface?.authority ?? 'none'),
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

function narrowCapabilityPack(
  pack: CapabilityPack | null,
  intents: IntentSpec[],
  selectedGrantNames: string[],
): CapabilityPack | null {
  if (!pack || intents.length === 0) return null;
  const grants = new Set(selectedGrantNames);
  const patterns = (pack.patterns ?? []).filter((pattern) =>
    pattern.intent === undefined || grants.has(pattern.intent),
  );
  return {
    intents,
    ...(patterns.length > 0 ? { patterns } : {}),
  };
}

function intentData(intent: IntentSpec): SurfaceData {
  return intent.surface?.data ??
    (intent.kind === 'resource' ? 'host-resource' : 'embedded');
}

function intentAuthority(intent: IntentSpec): SurfaceAuthority {
  return intent.surface?.authority ??
    (intent.kind === 'resource' ? 'read' : 'host-action');
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

function exactCeiling(plan: SurfacePlan): SurfaceCeiling {
  return {
    purposes: [plan.purpose],
    runtimes: [plan.runtime],
    data: [plan.data],
    authorities: [plan.authority],
    persistences: [plan.persistence],
    networks: [plan.network ?? 'none'],
  };
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
