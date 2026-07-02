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
  SurfaceScale,
  SurfaceGoalProvenance,
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

export interface DomjsBundleRequest extends SurfaceModelRequest {
  schema: Record<string, unknown>;
}

export interface DomjsBundleRepairRequest extends DomjsBundleRequest {
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
  generateDomjsBundle?(request: DomjsBundleRequest): Promise<unknown>;
  repairDomjsBundle?(request: DomjsBundleRepairRequest): Promise<unknown>;
}

export interface SurfaceGenerationInput {
  prompt: string;
  modelProvider: SurfaceModelProvider;
  ghost?: GhostGenerationContext | null;
  layout?: SummonLayout | null;
  scale?: SurfaceScale | null;
  experimentalPromptBlock?: ContractPromptBlock | null;
  tools?: ToolPack | null;
  surfacePolicy?: SurfacePolicy | null;
  /**
   * Optional provenance for the inferred surface goal. Affects only how firmly
   * the surface-contract prompt voices the `purpose` hint — never the
   * capability boundaries. Supplied by the agent ward path; omitted for
   * host-authored policies (hint then voiced at the conservative default
   * firmness).
   */
  goalProvenance?: SurfaceGoalProvenance | null;
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
  /**
   * Optional design-fidelity reviewer. After a bundle passes runtime/safety
   * validation, the loop hands its accepted source to this reviewer; any
   * returned issues (severity `block`) trigger up to `maxFidelityRepairs`
   * additional repair passes with design hints, so a technically-valid but
   * off-fingerprint surface can be regenerated instead of shipped as-is.
   *
   * Provider-neutral by construction: the app closes over the Ghost context and
   * a utility model (e.g. Ghost conformance) and returns plain ContractIssues.
   * Omitted ⇒ no fidelity loop (behaviour unchanged).
   */
  fidelityReviewer?: (
    source: Record<string, string>,
  ) => Promise<ContractIssue[]>;
  /** Max design-fidelity repair passes (separate budget from validation
   * repairs). Defaults to 0 when a reviewer is present but no budget is set. */
  maxFidelityRepairs?: number;
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
