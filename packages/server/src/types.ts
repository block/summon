import type {
  ToolPack,
  ContractIssue,
  ContractPromptBlock,
  GhostGenerationContext,
  ProtocolLine,
  StreamGraphSnapshot,
  SummonLayout,
  SummonOutputRuntime,
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

export interface HtmlBundleRequest extends SurfaceModelRequest {
  schema: Record<string, unknown>;
  runtime: SummonOutputRuntime;
  allowScript?: boolean;
}

export interface HtmlStreamRequest extends SurfaceModelRequest {
  runtime: 'html-stream';
}

export interface ArrowBundleRepairRequest extends ArrowBundleRequest {
  previousBundle: unknown;
  issues: ContractIssue[];
  hints: string[];
  attempt: number;
}

export interface HtmlBundleRepairRequest extends HtmlBundleRequest {
  previousBundle: unknown;
  issues: ContractIssue[];
  hints: string[];
  attempt: number;
}

export interface SurfaceModelProvider {
  generateArrowBundle(request: ArrowBundleRequest): Promise<unknown>;
  repairArrowBundle?(request: ArrowBundleRepairRequest): Promise<unknown>;
  generateHtmlBundle?(request: HtmlBundleRequest): Promise<unknown>;
  repairHtmlBundle?(request: HtmlBundleRepairRequest): Promise<unknown>;
  streamHtmlSurface?(request: HtmlStreamRequest): AsyncIterable<string>;
}

export interface SurfaceGenerationInput {
  prompt: string;
  modelProvider: SurfaceModelProvider;
  ghost?: GhostGenerationContext | null;
  layout?: SummonLayout | null;
  experimentalPromptBlock?: ContractPromptBlock | null;
  tools?: ToolPack | null;
  surfacePolicy?: SurfacePolicy | null;
  activeTokensCss?: string | null;
  preludeLines?: ProtocolLine[];
  seedLines?: ProtocolLine[];
  validationMode?: ProtocolValidationMode;
  experimentalRuntime?: SummonOutputRuntime;
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
