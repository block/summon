import type { ToolPack } from './prompt.js';

export type SurfacePurpose =
  | 'inform'
  | 'compare'
  | 'collect'
  | 'explore'
  | 'operate'
  | 'review'
  | 'export';

type SurfaceRuntime = 'arrow';
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
  'arrow',
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

export interface SurfacePlanInferenceInput {
  prompt: string;
  mode: 'static' | 'interactive';
  tools?: ToolPack | null;
  persistence?: SurfacePersistence;
}

export const DEFAULT_SURFACE_PLAN: SurfacePlan = {
  purpose: 'inform',
  runtime: 'arrow',
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

export function suggestSurfacePlan(input: SurfacePlanInferenceInput): SurfacePlan {
  if (input.mode === 'static') {
    return {
      purpose: inferPurpose(input.prompt),
      runtime: 'arrow',
      data: 'embedded',
      authority: 'none',
      persistence: input.persistence ?? 'replayable',
      network: 'none',
    };
  }

  const tools = input.tools?.tools ?? [];
  const promptText = input.prompt.toLowerCase();
  const wantsWorker = /\b(analy[sz]e|calculate|compute|forecast|simulate|score|worker|batch)\b/.test(promptText);
  const wantsApproval = /\b(approve|approval|confirm|publish|commit|send|update|delete|change)\b/.test(promptText);
  const wantsResource = /\b(search|lookup|fetch|load|find|explore|browse|filter|data)\b/.test(promptText);
  const hasWorker = wantsWorker && tools.some((tool) => tool.surface?.data === 'worker');
  const hasApproval = wantsApproval && tools.some((tool) => tool.surface?.authority === 'approval-gated');
  const hasResource = wantsResource && tools.some((tool) => tool.kind === 'resource');
  const hasAction = tools.some((tool) => (tool.kind ?? 'action') === 'action');

  return {
    purpose: inferPurpose(input.prompt),
    runtime: 'arrow',
    data: hasWorker ? 'worker' : hasResource ? 'host-resource' : 'embedded',
    authority: hasApproval ? 'approval-gated' : hasAction ? 'host-action' : hasResource ? 'read' : 'none',
    persistence: input.persistence ?? 'replayable',
    network: 'none',
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
