import type {
  CapabilityPack,
  ComponentPack,
  ContractIssue,
  ContractPromptBlock,
  DirectionContractInput,
  GhostGenerationContext,
  ProtocolLine,
  ScriptPolicy,
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
  layout?: SummonLayout | null;
  experimentalPromptBlock?: ContractPromptBlock | null;
  capabilities?: CapabilityPack | null;
  components?: ComponentPack | null;
  surfacePolicy?: SurfacePolicy | null;
  scriptPolicy?: ScriptPolicy;
  surfacePlan?: SurfacePlan | null;
  tokenOverrides?: TokenOverride[];
  activeTokensCss?: string | null;
  preludeLines?: ProtocolLine[];
  signal?: AbortSignal;
}

export interface SurfaceGenerationSummary {
  acceptedLines: ProtocolLine[];
  emittedLines: ProtocolLine[];
  validationIssues: ContractIssue[];
  streamGraph: StreamGraphSnapshot;
  blocked: boolean;
}

export type GenerationSummary = SurfaceGenerationSummary;
export type GenerateSurfaceInput = SurfaceGenerationInput;
