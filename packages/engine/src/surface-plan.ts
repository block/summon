export type SurfacePurpose =
  | 'inform'
  | 'compare'
  | 'collect'
  | 'explore'
  | 'operate'
  | 'review'
  | 'export';

type SurfaceRuntime = 'surface-document';
export type SurfaceData = 'embedded' | 'host-resource' | 'worker';
export type SurfaceAuthority = 'none' | 'read' | 'host-action' | 'approval-gated';
export type SurfacePersistence = 'ephemeral' | 'replayable';
export type SurfacePlanMode = 'static' | 'interactive';
export type SurfaceNetwork = 'none' | 'restricted-fetch';

export const SURFACE_PURPOSE_VALUES = [
  'inform',
  'compare',
  'collect',
  'explore',
  'operate',
  'review',
  'export',
] as const satisfies readonly SurfacePurpose[];

const SURFACE_RUNTIME_VALUES = [
  'surface-document',
] as const satisfies readonly SurfaceRuntime[];

export const SURFACE_NETWORK_VALUES = [
  'none',
  'restricted-fetch',
] as const satisfies readonly SurfaceNetwork[];

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
  network?: SurfaceNetwork;
}

export interface ToolSurface {
  data?: Extract<SurfaceData, 'host-resource' | 'worker'>;
  authority?: Extract<SurfaceAuthority, 'read' | 'host-action' | 'approval-gated'>;
}

export const DEFAULT_SURFACE_PLAN: SurfacePlan = {
  purpose: 'inform',
  runtime: 'surface-document',
  data: 'embedded',
  authority: 'none',
  persistence: 'replayable',
  network: 'none',
};

const PURPOSES = new Set<SurfacePurpose>(SURFACE_PURPOSE_VALUES);
const RUNTIMES = new Set<SurfaceRuntime>(SURFACE_RUNTIME_VALUES);
const DATA = new Set<SurfaceData>(SURFACE_DATA_VALUES);
const AUTHORITIES = new Set<SurfaceAuthority>(SURFACE_AUTHORITY_VALUES);
const PERSISTENCES = new Set<SurfacePersistence>(SURFACE_PERSISTENCE_VALUES);
const NETWORKS = new Set<SurfaceNetwork>(SURFACE_NETWORK_VALUES);

export function normalizeSurfacePlan(raw: unknown): SurfacePlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Partial<Record<keyof SurfacePlan, unknown>>;
  const purpose = enumValue(input.purpose, PURPOSES);
  const runtime = enumValue(input.runtime, RUNTIMES);
  const data = enumValue(input.data, DATA);
  const authority = enumValue(input.authority, AUTHORITIES);
  const persistence = enumValue(input.persistence, PERSISTENCES);
  const network = enumValue(input.network, NETWORKS) ?? 'none';
  if (!purpose || !runtime || !data || !authority || !persistence) return null;
  return { purpose, runtime, data, authority, persistence, network };
}

function enumValue<T extends string>(raw: unknown, values: ReadonlySet<T>): T | null {
  return typeof raw === 'string' && values.has(raw as T) ? raw as T : null;
}
