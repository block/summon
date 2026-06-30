import type { ApprovalRequest, SurfacePolicy } from '@anarchitecture/summon';
import type { SurfaceStreamResult } from '@anarchitecture/summon/browser';
import type { SummonLayout, SummonOutputRuntime, SurfacePlan } from '@anarchitecture/summon/engine';
import type { ActiveContract } from '../../showcase.js';

export interface GhostRootInfo {
  id: string;
  name?: string;
  summary?: string;
  status?: string;
  version?: string;
  tags?: string[];
  previewColors?: string[];
  defaultTargetPath?: string;
  source?: string;
}

export interface ModelProviderInfo {
  id: string;
  name: string;
  configured: boolean;
  model: string;
  utilityModel: string;
  models: ModelCatalogEntry[];
  utilityModels: ModelCatalogEntry[];
  defaults?: ModelProviderDefaults;
  controls?: ModelProviderControls;
  missingEnv?: string;
}

export interface ModelCatalogEntry {
  id: string;
  label: string;
  status: 'stable' | 'preview' | 'latest' | 'legacy';
  tier: 'fast' | 'balanced' | 'frontier';
  maxOutputTokens: number;
  description?: string;
  anthropicThinking?: 'optional' | 'always';
}

export interface ModelProviderControls {
  customModels: boolean;
  maxOutputTokens: { default: number; presets: number[] };
  anthropicThinking?: { default: 'adaptive' | 'off'; options: Array<'adaptive' | 'off'> };
  effort?: { default: 'low' | 'medium' | 'high' | 'max'; options: Array<'low' | 'medium' | 'high' | 'max'> };
}

export interface ModelProviderDefaults {
  generationModel: string;
  utilityModel: string;
  modelOptions: ModelOptions;
}

export interface ModelOptions {
  maxOutputTokens?: number;
  anthropicThinking?: 'adaptive' | 'off';
  effort?: 'low' | 'medium' | 'high' | 'max';
}

export type ModelProfileKey =
  | 'arrow-control'
  | 'html-static'
  | 'html-stream'
  | 'domjs-control'
  | 'utility';

export type RuntimeModelProfileKey = Exclude<ModelProfileKey, 'utility'>;

export const MODEL_PROFILE_KEYS: ModelProfileKey[] = [
  'arrow-control',
  'html-static',
  'html-stream',
  'domjs-control',
  'utility',
];

export interface ModelProfileState {
  modelProvider?: string;
  generationModel: string;
  utilityModel: string;
  customModel: string;
  customModelEnabled: boolean;
  maxOutputTokens: number;
  anthropicThinking: 'adaptive' | 'off';
  effort: 'low' | 'medium' | 'high' | 'max';
}

export interface ModelSelectionPayload {
  modelProvider?: string;
  generationModel?: string;
  utilityModel?: string;
  customModel?: boolean;
  modelOptions?: ModelOptions;
  modelProfiles?: Partial<Record<ModelProfileKey, ModelSelectionPayload>>;
}

export type DiagnosticsTab = 'stream' | 'devtools' | 'timing' | 'history' | 'safety';

export type RunProfile = 'fast' | 'quality' | 'custom';

export interface TimingEntry {
  id: number;
  at: number;
  source: 'client' | 'server';
  phase: string;
  label: string;
  elapsedMs: number;
  durationMs?: number;
}

export interface RunMetrics {
  runtime: SummonOutputRuntime;
  ttfb: number | null;
  ttfp: number | null;
  tti: number | null;
  complete: number | null;
  repairs: number;
  blocked: boolean;
  validationCount: number;
  safetyViolations: number;
  bytes: number;
}

export interface StreamOptions {
  prompt: string;
  active: ActiveContract;
  fingerprintId: string | null;
  experimentalRuntime: SummonOutputRuntime;
  fingerprintTargetPath: string;
  layout?: SummonLayout | null;
  playgroundMode: boolean;
  signal: AbortSignal;
}

export interface StreamResult extends SurfaceStreamResult {
  surfacePlan: SurfacePlan | null;
  metrics: RunMetrics;
}

export interface StreamOptionsPayload {
  surfacePolicy?: SurfacePolicy;
}

export interface LogEntry {
  cls: string;
  text: string;
}

export interface ApprovalCard {
  request: ApprovalRequest;
}

export interface ChildSurfaceModel {
  id: number;
  prompt: string;
  title?: string;
  fingerprintId: string | null;
  fingerprintTargetPath: string;
  tokensSource: string;
  modelSelection: ModelSelectionPayload;
  agentWard: boolean;
}
