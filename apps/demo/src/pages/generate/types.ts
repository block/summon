import type { ApprovalRequest, SurfacePolicy } from '@anarchitecture/summon';
import type { SurfaceStreamResult } from '@anarchitecture/summon/browser';
import type { SummonLayout, SurfacePlan } from '@anarchitecture/summon/engine';
import type { ActiveContract } from '../../showcase.js';

export interface DirectionInfo {
  id: string;
  name: string;
  description: string;
  tokensCss: string;
}

export interface GhostRootInfo {
  id: string;
  defaultTargetPath?: string;
  defaultBaseDirectionId?: string | null;
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
  repairMaxOutputTokens: { default: number; presets: number[] };
  anthropicThinking?: { default: 'adaptive' | 'off'; options: Array<'adaptive' | 'off'> };
  effort?: { default: 'low' | 'medium' | 'high'; options: Array<'low' | 'medium' | 'high'> };
}

export interface ModelProviderDefaults {
  generationModel: string;
  utilityModel: string;
  modelOptions: ModelOptions;
}

export interface ModelOptions {
  maxOutputTokens?: number;
  repairMaxOutputTokens?: number;
  anthropicThinking?: 'adaptive' | 'off';
  effort?: 'low' | 'medium' | 'high';
}

export interface ModelSelectionPayload {
  modelProvider?: string;
  generationModel?: string;
  utilityModel?: string;
  customModel?: boolean;
  modelOptions?: ModelOptions;
}

export type FragmentMode = 'section' | 'block-v0' | 'html-node-v0';

export type DiagnosticsTab = 'stream' | 'devtools' | 'history' | 'safety';

export interface StreamOptions {
  prompt: string;
  active: ActiveContract;
  directionId: string | null;
  ghostTargetPath: string;
  ghostBaseDirectionId: string | null;
  layout?: SummonLayout | null;
  fragmentMode?: FragmentMode;
  signal: AbortSignal;
  edit?: {
    baseRevision: number;
    sections: { id: string; html: string }[];
    targetSections?: string[];
  };
}

export interface StreamResult extends SurfaceStreamResult {
  surfacePlan: SurfacePlan | null;
  shape: string | null;
}

export interface StreamOptionsPayload {
  surfacePolicy?: SurfacePolicy;
  surfacePlan?: SurfacePlan;
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
  directionId: string | null;
  tokensSource: string;
  modelSelection: ModelSelectionPayload;
  agentBroker: boolean;
}
