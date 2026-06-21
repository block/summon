import type {
  ToolPack,
  ContractIssue,
  ContractPromptBlock,
  DirectionContractInput,
  GhostGenerationContext,
  ProtocolLine,
  StreamGraphSnapshot,
  SummonLayout,
  SurfacePolicy,
  ProtocolValidationMode,
} from '@summon-internal/engine';

export type { GhostGenerationContext } from '@summon-internal/engine';

export interface SurfaceModelRequest {
  prompt: string;
  promptBlocks: ContractPromptBlock[];
  signal?: AbortSignal;
}

export interface ArrowBundleRequest extends SurfaceModelRequest {
  schema: Record<string, unknown>;
}

export interface ArrowBundleRepairRequest extends ArrowBundleRequest {
  previousBundle: unknown;
  issues: ContractIssue[];
  hints: string[];
  attempt: number;
}

export interface SurfaceModelProvider {
  generateArrowBundle(request: ArrowBundleRequest): Promise<unknown>;
  repairArrowBundle?(request: ArrowBundleRepairRequest): Promise<unknown>;
}

export interface SurfaceGenerationInput {
  prompt: string;
  modelProvider: SurfaceModelProvider;
  direction?: DirectionContractInput | null;
  ghost?: GhostGenerationContext | null;
  layout?: SummonLayout | null;
  experimentalPromptBlock?: ContractPromptBlock | null;
  tools?: ToolPack | null;
  surfacePolicy?: SurfacePolicy | null;
  activeTokensCss?: string | null;
  preludeLines?: ProtocolLine[];
  seedLines?: ProtocolLine[];
  validationMode?: ProtocolValidationMode;
  playground?: boolean;
  maxRepairAttempts?: number;
  repairIssueCodes?: string[];
  heartbeatIntervalMs?: number;
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
