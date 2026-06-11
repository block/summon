import type {
  CapabilityPack,
  ComponentPack,
  ContractIssue,
  ContractPromptBlock,
  DirectionContractInput,
  GhostGenerationContext,
  ProtocolLine,
  RepairFeedbackMetaValue,
  ScriptPolicy,
  SectionAccumulatorSnapshot,
  StreamGraphSnapshot,
  SummonLayout,
  SurfacePolicy,
  SurfaceCeiling,
  SurfacePlan,
  TokenOverride,
} from '@summon-internal/engine';

export type { GhostGenerationContext } from '@summon-internal/engine';

export interface SummonModelRequest {
  prompt: string;
  promptBlocks: ContractPromptBlock[];
  signal?: AbortSignal;
}

export type SummonModelChunk =
  | string
  | { type: 'text'; text: string }
  | { type: 'meta'; path: string; value: unknown };

export type SummonModelProvider = (
  request: SummonModelRequest,
) => AsyncIterable<SummonModelChunk> | Promise<AsyncIterable<SummonModelChunk>>;

export interface GenerateEditInput {
  baseRevision: number | null;
  sections: SectionAccumulatorSnapshot['sections'];
  targetSections?: string[];
  issues?: unknown[];
}

export interface SummonRepairRequest {
  prompt: string;
  promptBlocks: ContractPromptBlock[];
  target: string;
  sectionId: string;
  issue: ContractIssue;
  rejectedLine: ProtocolLine;
  feedback: RepairFeedbackMetaValue;
  attempt: number;
  signal?: AbortSignal;
}

export type SummonRepairProvider = (
  request: SummonRepairRequest,
) =>
  | string
  | Promise<string>
  | AsyncIterable<SummonModelChunk>
  | Promise<AsyncIterable<SummonModelChunk>>;

export interface RepairOptions {
  enabled: boolean;
  maxAttempts?: number;
  maxTargets?: number;
  provider?: SummonRepairProvider;
}

export interface ResolvedSurfaceGenerationPlan {
  mode: 'static' | 'interactive';
  scriptPolicy: ScriptPolicy;
  surfacePlan: SurfacePlan;
  ceiling: SurfaceCeiling;
  explicitAccepted: boolean;
  source: 'explicit' | 'default';
}

export interface ResolveSurfaceGenerationPlanInput {
  /** @deprecated Ignored by plan resolution. Hosts must pass rawSurfacePlan to select authority. */
  prompt: string;
  mode: 'static' | 'interactive';
  scriptPolicy?: ScriptPolicy;
  /** @deprecated Ignored by plan resolution. Capability metadata is not authority. */
  capabilities?: CapabilityPack | null;
  rawSurfacePlan?: unknown;
  rawSurfaceCeiling?: unknown;
}

export interface SurfaceGenerationInput {
  prompt: string;
  modelProvider: SummonModelProvider;
  mode?: 'static' | 'interactive';
  direction?: DirectionContractInput | null;
  ghost?: GhostGenerationContext | null;
  /** @deprecated Use `ghost` with a first-class GhostGenerationContext. */
  ghostPrompt?: string | null;
  layout?: SummonLayout | null;
  edit?: GenerateEditInput | null;
  editBlock?: string | null;
  experimentalPromptBlock?: ContractPromptBlock | null;
  capabilities?: CapabilityPack | null;
  components?: ComponentPack | null;
  surfacePolicy?: SurfacePolicy | null;
  scriptPolicy?: ScriptPolicy;
  surfacePlan?: SurfacePlan | null;
  tokenOverrides?: TokenOverride[];
  activeTokensCss?: string | null;
  preludeLines?: ProtocolLine[];
  repair?: RepairOptions | null;
  initialScreenSections?: string[];
  allowedSectionIds?: Iterable<string>;
  signal?: AbortSignal;
}

export interface RepairStats {
  queued: number;
  cancelled: number;
  repaired: number;
  failed: number;
}

export interface SurfaceGenerationSummary {
  acceptedLines: ProtocolLine[];
  emittedLines: ProtocolLine[];
  validationIssues: ContractIssue[];
  streamGraph: StreamGraphSnapshot;
  blocked: boolean;
  repairStats: RepairStats | null;
}

export type GenerationSummary = SurfaceGenerationSummary;
export type GenerateSurfaceInput = SurfaceGenerationInput;
