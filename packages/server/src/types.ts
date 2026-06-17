import type {
  ToolPack,
  ComponentPack,
  ContractIssue,
  ContractPromptBlock,
  DirectionContractInput,
  GhostGenerationContext,
  ProtocolLine,
  StreamGraphSnapshot,
  SummonLayout,
  SurfacePolicy,
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

export interface SurfaceGenerationInput {
  prompt: string;
  modelProvider: SummonModelProvider;
  direction?: DirectionContractInput | null;
  ghost?: GhostGenerationContext | null;
  layout?: SummonLayout | null;
  experimentalPromptBlock?: ContractPromptBlock | null;
  tools?: ToolPack | null;
  components?: ComponentPack | null;
  surfacePolicy?: SurfacePolicy | null;
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
