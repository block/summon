import {
  contractIssue,
  type ContractIssue,
} from './contracts.js';
import type {
  ToolPack,
  ToolSpec,
} from './prompt.js';
import type { ToolKind } from './tool-contract.js';
import {
  SURFACE_AUTHORITY_VALUES,
  SURFACE_DATA_VALUES,
  SURFACE_PERSISTENCE_VALUES,
  SURFACE_PURPOSE_VALUES,
  type SurfaceAuthority,
  type SurfaceData,
  type SurfacePersistence,
  type SurfacePlan,
  type SurfacePlanMode,
  type SurfacePurpose,
} from './surface-plan.js';

/**
 * Display names for the four named ceiling presets. Tier is *derived* from
 * the capability axes for chrome and prompts — it is not a policy input.
 * See docs/spec/surface-policy-ceilings.md.
 */
export type SurfaceTier = 'static' | 'declarative' | 'worker' | 'approval';

/**
 * A point in the (data × authority) capability lattice. Grants whose
 * capability exceeds the ceiling are rejected at compile time. Omitted axes
 * fail closed to the weakest value.
 */
export interface SurfaceCeiling {
  data?: SurfaceData;
  authority?: SurfaceAuthority;
}

export interface NormalizedSurfaceCeiling {
  data: SurfaceData;
  authority: SurfaceAuthority;
}

/**
 * Named ceiling presets — the blessed authoring path. These map onto the
 * historical tier names. Note `approval` includes `data: 'worker'` (stated
 * decision: gives the presets a total order and makes compute-then-commit
 * expressible; `data` is sandbox compute locality, a smaller hazard than
 * `authority`).
 */
export const ceilings = {
  static: { data: 'embedded', authority: 'none' },
  declarative: { data: 'host-resource', authority: 'host-action' },
  worker: { data: 'worker', authority: 'host-action' },
  approval: { data: 'worker', authority: 'approval-gated' },
} as const satisfies Record<SurfaceTier, NormalizedSurfaceCeiling>;

export interface SurfacePolicy {
  /** Capability ceiling. Omitted = `ceilings.static` (fail closed). */
  ceiling?: SurfaceCeiling;
  purpose?: SurfacePurpose;
  grants?: string[];
  persistence?: SurfacePersistence;
}

export interface NormalizedSurfacePolicy {
  ceiling: NormalizedSurfaceCeiling;
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
  /** Least ceiling preset covering the policy's ceiling — for chrome/prompts. */
  displayTier: SurfaceTier;
  issues: ContractIssue[];
}

const PURPOSES = new Set<SurfacePurpose>(SURFACE_PURPOSE_VALUES);
const PERSISTENCES = new Set<SurfacePersistence>(SURFACE_PERSISTENCE_VALUES);
const DATA = new Set<SurfaceData>(SURFACE_DATA_VALUES);
const AUTHORITIES = new Set<SurfaceAuthority>(SURFACE_AUTHORITY_VALUES);

const DEFAULT_POLICY: NormalizedSurfacePolicy = {
  ceiling: ceilings.static,
  purpose: 'inform',
  grants: [],
  persistence: 'replayable',
};

const DATA_RANK: Record<SurfaceData, number> = {
  embedded: 0,
  'host-resource': 1,
  worker: 2,
};

const AUTHORITY_RANK: Record<SurfaceAuthority, number> = {
  none: 0,
  read: 1,
  'host-action': 2,
  'approval-gated': 3,
};

/**
 * Minimal tool shape needed to derive the capability a grant implies.
 * Structurally compatible with ToolSpec, SurfaceContractTool input specs,
 * and ValidationTool.
 */
export interface GrantCapabilitySource {
  name: string;
  kind?: ToolKind;
  surface?: {
    data?: SurfaceData;
    authority?: SurfaceAuthority;
  };
}

export interface ToolCapability {
  data: SurfaceData;
  authority: SurfaceAuthority;
}

/**
 * The capability a granted tool implies. Single source of truth for the
 * kind-based defaults (resources read host data; actions act on the host).
 */
export function capabilityForTool(tool: GrantCapabilitySource): ToolCapability {
  const kind: ToolKind = tool.kind ?? 'action';
  return {
    data: tool.surface?.data ?? (kind === 'resource' ? 'host-resource' : 'embedded'),
    authority: tool.surface?.authority ?? (kind === 'resource' ? 'read' : 'host-action'),
  };
}

/** True when `capability` is at-or-below `ceiling` on both axes. */
export function capabilityCovers(
  ceiling: ToolCapability | NormalizedSurfaceCeiling,
  capability: ToolCapability,
): boolean {
  return (
    DATA_RANK[ceiling.data] >= DATA_RANK[capability.data] &&
    AUTHORITY_RANK[ceiling.authority] >= AUTHORITY_RANK[capability.authority]
  );
}

/**
 * Lattice join: the strongest capability on each axis independently. The
 * single source of truth for capability ordering — consumers must not
 * re-encode the axis order.
 */
export function joinCapabilities(capabilities: readonly ToolCapability[]): ToolCapability {
  let data: SurfaceData = 'embedded';
  let authority: SurfaceAuthority = 'none';
  for (const capability of capabilities) {
    if (DATA_RANK[capability.data] > DATA_RANK[data]) data = capability.data;
    if (AUTHORITY_RANK[capability.authority] > AUTHORITY_RANK[authority]) {
      authority = capability.authority;
    }
  }
  return { data, authority };
}

/**
 * Least ceiling preset name covering the given axes — a display label only.
 * Accepts partial or absent ceilings; omitted axes fail closed to the
 * weakest value, matching normalizeCeiling.
 */
export function displayTier(axes?: SurfaceCeiling | ToolCapability): SurfaceTier {
  const data = axes?.data ?? 'embedded';
  const authority = axes?.authority ?? 'none';
  if (authority === 'approval-gated') return 'approval';
  if (data === 'worker') return 'worker';
  if (data === 'embedded' && authority === 'none') return 'static';
  return 'declarative';
}

export function normalizeSurfacePolicy(raw: unknown): NormalizedSurfacePolicy | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;
  // `tier` was removed as a policy input (docs/spec/surface-policy-ceilings.md).
  // Reject rather than silently ignore, so stale callers surface immediately.
  if ('tier' in input) return null;
  const ceiling = normalizeCeiling(input.ceiling);
  const purpose = input.purpose === undefined
    ? DEFAULT_POLICY.purpose
    : enumValue(input.purpose, PURPOSES);
  const persistence = input.persistence === undefined
    ? DEFAULT_POLICY.persistence
    : enumValue(input.persistence, PERSISTENCES);
  if (!ceiling || !purpose || !persistence) return null;
  return {
    ceiling,
    purpose,
    grants: dedupeStrings(input.grants),
    persistence,
  };
}

function normalizeCeiling(raw: unknown): NormalizedSurfaceCeiling | null {
  if (raw === undefined) return ceilings.static;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const data = input.data === undefined ? 'embedded' : enumValue(input.data, DATA);
  const authority = input.authority === undefined
    ? 'none'
    : enumValue(input.authority, AUTHORITIES);
  if (!data || !authority) return null;
  return { data, authority };
}

export function compileSurfacePolicy(
  policy: SurfacePolicy | unknown,
  options: CompileSurfacePolicyOptions = {},
): CompiledSurfacePolicy {
  const issues: ContractIssue[] = [];
  const normalized = normalizeSurfacePolicy(policy);
  const effective = normalized ?? DEFAULT_POLICY;
  if (!normalized) {
    const hasLegacyTier = Boolean(
      policy && typeof policy === 'object' && 'tier' in (policy as Record<string, unknown>),
    );
    issues.push(surfacePolicyIssue(
      'surface-policy-invalid',
      hasLegacyTier
        ? 'surfacePolicy.tier was removed; author a capability ceiling (see docs/spec/surface-policy-ceilings.md)'
        : 'surfacePolicy must include a valid capability ceiling',
    ));
  }

  const toolPack = options.tools ?? null;
  const toolsByName = new Map((toolPack?.tools ?? []).map((tool) => [tool.name, tool]));

  // Grants exceeding the ceiling are excluded from the narrowed pack (fail
  // closed) in addition to raising a blocking issue.
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
    const capability = capabilityForTool(tool);
    if (!capabilityCovers(effective.ceiling, capability)) {
      issues.push(surfacePolicyIssue(
        'surface-policy-ceiling-exceeded',
        `Grant "${grant}" (data=${capability.data}, authority=${capability.authority}) exceeds the ceiling (data=${effective.ceiling.data}, authority=${effective.ceiling.authority})`,
      ));
      continue;
    }
    selectedTools.push(tool);
  }

  validateCeilingFloors(effective, selectedTools, issues);

  const surfacePlan = planForPolicy(effective, selectedTools);
  return {
    policy: effective,
    tools: narrowToolPack(toolPack, selectedTools, effective.grants),
    mode: selectedTools.length > 0 ? 'interactive' : 'static',
    surfacePlan,
    displayTier: displayTier(effective.ceiling),
    issues,
  };
}

/**
 * A ceiling whose *display label* names a capability no grant reaches is
 * noise; require the floor so the label stays truthful. Keyed off the label,
 * not each raw axis: `ceilings.approval` deliberately includes worker-data
 * headroom (total-order decision, see spec), and unused headroom below the
 * label's distinguishing capability grants nothing and misleads no one.
 */
function validateCeilingFloors(
  policy: NormalizedSurfacePolicy,
  tools: ToolSpec[],
  issues: ContractIssue[],
): void {
  const capabilities = tools.map(capabilityForTool);
  const label = displayTier(policy.ceiling);
  if (
    label === 'approval' &&
    !capabilities.some((capability) => capability.authority === 'approval-gated')
  ) {
    issues.push(surfacePolicyIssue(
      'surface-policy-ceiling-requirement',
      'An approval-gated ceiling requires at least one approval-gated grant',
    ));
  }
  if (
    label === 'worker' &&
    !capabilities.some((capability) => capability.data === 'worker')
  ) {
    issues.push(surfacePolicyIssue(
      'surface-policy-ceiling-requirement',
      'A worker-data ceiling requires at least one worker-backed grant',
    ));
  }
}

/**
 * The plan reports reality: a uniform lattice join over the granted tools.
 * The ceiling gates grant selection; it never inflates the plan.
 */
function planForPolicy(
  policy: NormalizedSurfacePolicy,
  tools: ToolSpec[],
): SurfacePlan {
  const joined = joinCapabilities(tools.map(capabilityForTool));
  return {
    purpose: policy.purpose,
    runtime: 'surface-document',
    data: joined.data,
    authority: joined.authority,
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

/**
 * Verify a SurfacePlan does not understate the capability implied by its
 * grants. Plans are derived from policy at compile time (planForPolicy), but
 * that invariant evaporates at deserialization: a crafted envelope can claim
 * `authority: 'none'` while carrying approval-gated grants, and any trust
 * chrome rendered from the plan would display attacker-controlled metadata.
 * Re-derive the capability floor from the grants and require the claimed
 * plan to meet it. Overstatement is tolerated (it errs toward scarier
 * chrome, never toward hiding privilege); understatement is rejected.
 *
 * Grants without a matching tool entry fail closed to the action defaults
 * (`data: 'embedded'`, `authority: 'host-action'`), mirroring
 * capabilityForTool.
 */
export function surfacePlanCoversGrants(
  plan: SurfacePlan,
  grantNames: readonly string[],
  tools?: readonly GrantCapabilitySource[] | null,
): boolean {
  if (grantNames.length === 0) return true;
  const byName = new Map((tools ?? []).map((tool) => [tool.name, tool]));
  let dataFloor = 0;
  let authorityFloor = 0;
  for (const name of grantNames) {
    const capability = capabilityForTool(byName.get(name) ?? { name });
    dataFloor = Math.max(dataFloor, DATA_RANK[capability.data]);
    authorityFloor = Math.max(authorityFloor, AUTHORITY_RANK[capability.authority]);
  }
  return (
    DATA_RANK[plan.data] >= dataFloor &&
    AUTHORITY_RANK[plan.authority] >= authorityFloor
  );
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
