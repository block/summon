import type { CapabilityPack, ScriptPolicy } from './prompt.js';

export type SurfacePurpose =
  | 'inform'
  | 'compare'
  | 'collect'
  | 'explore'
  | 'operate'
  | 'review'
  | 'export';

export type SurfaceRuntime = 'static' | 'declarative' | 'worker';
export type SurfaceData = 'embedded' | 'host-resource' | 'worker';
export type SurfaceAuthority = 'none' | 'read' | 'host-action' | 'approval-gated';
export type SurfacePersistence = 'ephemeral' | 'replayable';
export type SurfacePlanMode = 'static' | 'interactive';

export const SURFACE_PURPOSE_VALUES = [
  'inform',
  'compare',
  'collect',
  'explore',
  'operate',
  'review',
  'export',
] as const satisfies readonly SurfacePurpose[];

export const SURFACE_RUNTIME_VALUES = [
  'static',
  'declarative',
  'worker',
] as const satisfies readonly SurfaceRuntime[];

export const SURFACE_DATA_VALUES = [
  'embedded',
  'host-resource',
  'worker',
] as const satisfies readonly SurfaceData[];

export const SURFACE_AUTHORITY_VALUES = [
  'none',
  'read',
  'host-action',
  'approval-gated',
] as const satisfies readonly SurfaceAuthority[];

export const SURFACE_PERSISTENCE_VALUES = [
  'ephemeral',
  'replayable',
] as const satisfies readonly SurfacePersistence[];

export interface SurfacePlan {
  purpose: SurfacePurpose;
  runtime: SurfaceRuntime;
  data: SurfaceData;
  authority: SurfaceAuthority;
  persistence: SurfacePersistence;
}

export interface CapabilitySurface {
  data?: Extract<SurfaceData, 'host-resource' | 'worker'>;
  authority?: Extract<SurfaceAuthority, 'read' | 'host-action' | 'approval-gated'>;
}

export interface ComponentSurface {
  data?: SurfaceData;
  authority?: SurfaceAuthority;
}

export interface SurfaceCeiling {
  purposes?: SurfacePurpose[];
  runtimes?: SurfaceRuntime[];
  data?: SurfaceData[];
  authorities?: SurfaceAuthority[];
  persistences?: SurfacePersistence[];
}

export interface SurfacePlanInferenceInput {
  prompt: string;
  mode: 'static' | 'interactive';
  scriptPolicy?: ScriptPolicy;
  capabilities?: CapabilityPack | null;
  persistence?: SurfacePersistence;
}

export interface SurfacePlanControls {
  mode: SurfacePlanMode;
  scriptPolicy: ScriptPolicy;
}

export const DEFAULT_SURFACE_PLAN: SurfacePlan = {
  purpose: 'inform',
  runtime: 'static',
  data: 'embedded',
  authority: 'none',
  persistence: 'replayable',
};

export const DEFAULT_SURFACE_CEILING: Required<SurfaceCeiling> = {
  purposes: [...SURFACE_PURPOSE_VALUES],
  runtimes: ['static', 'declarative'],
  data: ['embedded', 'host-resource'],
  authorities: ['none', 'read', 'host-action'],
  persistences: ['ephemeral', 'replayable'],
};

const PURPOSES = new Set<SurfacePurpose>(SURFACE_PURPOSE_VALUES);
const RUNTIMES = new Set<SurfaceRuntime>(SURFACE_RUNTIME_VALUES);
const DATA = new Set<SurfaceData>(SURFACE_DATA_VALUES);
const AUTHORITIES = new Set<SurfaceAuthority>(SURFACE_AUTHORITY_VALUES);
const PERSISTENCES = new Set<SurfacePersistence>(SURFACE_PERSISTENCE_VALUES);

export function normalizeSurfacePlan(raw: unknown): SurfacePlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Partial<Record<keyof SurfacePlan, unknown>>;
  const purpose = enumValue(input.purpose, PURPOSES);
  const runtime = enumValue(input.runtime, RUNTIMES);
  const data = enumValue(input.data, DATA);
  const authority = enumValue(input.authority, AUTHORITIES);
  const persistence = enumValue(input.persistence, PERSISTENCES);
  if (!purpose || !runtime || !data || !authority || !persistence) return null;
  return { purpose, runtime, data, authority, persistence };
}

export function normalizeSurfaceCeiling(raw: unknown): SurfaceCeiling | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;
  return {
    purposes: enumList(input.purposes, PURPOSES),
    runtimes: enumList(input.runtimes, RUNTIMES),
    data: enumList(input.data, DATA),
    authorities: enumList(input.authorities, AUTHORITIES),
    persistences: enumList(input.persistences, PERSISTENCES),
  };
}

export function surfacePlanWithinCeiling(plan: SurfacePlan, ceiling: SurfaceCeiling): boolean {
  return (
    allowed(plan.purpose, ceiling.purposes, DEFAULT_SURFACE_CEILING.purposes) &&
    allowed(plan.runtime, ceiling.runtimes, DEFAULT_SURFACE_CEILING.runtimes) &&
    allowed(plan.data, ceiling.data, DEFAULT_SURFACE_CEILING.data) &&
    allowed(plan.authority, ceiling.authorities, DEFAULT_SURFACE_CEILING.authorities) &&
    allowed(plan.persistence, ceiling.persistences, DEFAULT_SURFACE_CEILING.persistences)
  );
}

export function constrainSurfacePlan(plan: SurfacePlan, ceiling: SurfaceCeiling): SurfacePlan {
  return {
    purpose: constrain(plan.purpose, ceiling.purposes, DEFAULT_SURFACE_CEILING.purposes),
    runtime: constrainRuntime(plan.runtime, ceiling.runtimes),
    data: constrainData(plan.data, ceiling.data),
    authority: constrainAuthority(plan.authority, ceiling.authorities),
    persistence: constrain(
      plan.persistence,
      ceiling.persistences,
      DEFAULT_SURFACE_CEILING.persistences,
    ),
  };
}

export function suggestSurfacePlan(input: SurfacePlanInferenceInput): SurfacePlan {
  if (input.mode === 'static') {
    return {
      purpose: inferPurpose(input.prompt),
      runtime: 'static',
      data: 'embedded',
      authority: 'none',
      persistence: input.persistence ?? 'replayable',
    };
  }

  const intents = input.capabilities?.intents ?? [];
  const promptText = input.prompt.toLowerCase();
  const wantsWorker = /\b(analy[sz]e|calculate|compute|forecast|simulate|score|worker|batch)\b/.test(promptText);
  const wantsApproval = /\b(approve|approval|confirm|publish|commit|send|update|delete|change)\b/.test(promptText);
  const wantsResource = /\b(search|lookup|fetch|load|find|explore|browse|filter|data)\b/.test(promptText);
  const hasWorker = wantsWorker && intents.some((intent) => intent.surface?.data === 'worker');
  const hasApproval = wantsApproval && intents.some((intent) => intent.surface?.authority === 'approval-gated');
  const hasResource = wantsResource && intents.some((intent) => intent.kind === 'resource');
  const hasAction = intents.some((intent) => (intent.kind ?? 'action') === 'action');

  return {
    purpose: inferPurpose(input.prompt),
    runtime: hasWorker ? 'worker' : 'declarative',
    data: hasWorker ? 'worker' : hasResource ? 'host-resource' : 'embedded',
    authority: hasApproval ? 'approval-gated' : hasAction ? 'host-action' : hasResource ? 'read' : 'none',
    persistence: input.persistence ?? 'replayable',
  };
}

/**
 * @deprecated Use suggestSurfacePlan(). Surface plan heuristics are advisory
 * host UI scaffolding only; generation authority should use a host-selected
 * explicit SurfacePlan.
 */
export function inferSurfacePlan(input: SurfacePlanInferenceInput): SurfacePlan {
  return suggestSurfacePlan(input);
}

export function surfacePlanScriptPolicy(_plan: SurfacePlan): ScriptPolicy {
  return 'forbid';
}

export function deriveSurfacePlanControls(plan: SurfacePlan): SurfacePlanControls {
  return {
    mode: plan.runtime === 'static' ? 'static' : 'interactive',
    scriptPolicy: surfacePlanScriptPolicy(plan),
  };
}

export function buildSurfacePlanBlock(plan: SurfacePlan): string {
  return `## Surface plan — host-owned runtime contract

The host has selected this minimum safe surface plan:

- Purpose: \`${plan.purpose}\`
- Runtime: \`${plan.runtime}\`
- Data: \`${plan.data}\`
- Authority: \`${plan.authority}\`
- Persistence: \`${plan.persistence}\`

This plan is a host decision, not part of your generated artifact. Do not emit a \`/surface-plan\` meta line and do not imply capabilities outside this plan.

Runtime rules:

- \`static\`: render read-only HTML. Do not emit scripts, intents, resources, forms, or controls that require host action.
- \`declarative\`: use only \`data-summon-*\` bindings and host-granted capabilities.
- \`worker\`: use only capabilities the host describes as worker-backed; the worker remains host-owned.

Authority rules:

- \`none\`: no emitted intents.
- \`read\`: read-oriented data resources only.
- \`host-action\`: host-owned actions and resources may run after schema validation.
- \`approval-gated\`: use only capabilities explicitly marked approval-gated; approval happens outside the artifact.`;
}

function inferPurpose(prompt: string): SurfacePurpose {
  const text = prompt.toLowerCase();
  if (/\b(compare|comparison|versus|vs\.?|pros|cons|trade-?offs?)\b/.test(text)) return 'compare';
  if (/\b(export|download|csv|spreadsheet|table file)\b/.test(text)) return 'export';
  if (/\b(approve|approval|review|audit|confirm|verify)\b/.test(text)) return 'review';
  if (/\b(collect|intake|form|survey|questionnaire|submit)\b/.test(text)) return 'collect';
  if (/\b(search|find|explore|browse|filter|lookup|discover)\b/.test(text)) return 'explore';
  if (/\b(update|create|delete|save|send|publish|change|operate|run)\b/.test(text)) return 'operate';
  return 'inform';
}

function enumValue<T extends string>(raw: unknown, values: ReadonlySet<T>): T | null {
  return typeof raw === 'string' && values.has(raw as T) ? raw as T : null;
}

function enumList<T extends string>(raw: unknown, values: ReadonlySet<T>): T[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw.filter((value): value is T => typeof value === 'string' && values.has(value as T));
  return out.length > 0 ? Array.from(new Set(out)) : undefined;
}

function allowed<T extends string>(value: T, rawAllowed: T[] | undefined, fallback: readonly T[]): boolean {
  return (rawAllowed ?? fallback).includes(value);
}

function constrain<T extends string>(value: T, rawAllowed: T[] | undefined, fallback: readonly T[]): T {
  const allowedValues = rawAllowed && rawAllowed.length > 0 ? rawAllowed : fallback;
  return allowedValues.includes(value) ? value : allowedValues[0]!;
}

function constrainRuntime(value: SurfaceRuntime, rawAllowed: SurfaceRuntime[] | undefined): SurfaceRuntime {
  const allowedValues = rawAllowed && rawAllowed.length > 0 ? rawAllowed : DEFAULT_SURFACE_CEILING.runtimes;
  if (allowedValues.includes(value)) return value;
  if (value === 'worker' && allowedValues.includes('declarative')) {
    return 'declarative';
  }
  return allowedValues[0]!;
}

function constrainData(value: SurfaceData, rawAllowed: SurfaceData[] | undefined): SurfaceData {
  const allowedValues = rawAllowed && rawAllowed.length > 0 ? rawAllowed : DEFAULT_SURFACE_CEILING.data;
  if (allowedValues.includes(value)) return value;
  if (value === 'worker' && allowedValues.includes('host-resource')) return 'host-resource';
  return allowedValues[0]!;
}

function constrainAuthority(
  value: SurfaceAuthority,
  rawAllowed: SurfaceAuthority[] | undefined,
): SurfaceAuthority {
  const allowedValues = rawAllowed && rawAllowed.length > 0 ? rawAllowed : DEFAULT_SURFACE_CEILING.authorities;
  if (allowedValues.includes(value)) return value;
  if (value === 'approval-gated' && allowedValues.includes('host-action')) return 'host-action';
  if ((value === 'approval-gated' || value === 'host-action') && allowedValues.includes('read')) {
    return 'read';
  }
  return allowedValues[0]!;
}
