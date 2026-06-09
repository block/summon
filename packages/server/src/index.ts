export { generateSurfaceStream } from './compat.js';
export { buildEditBlock } from './edit.js';
export { resolveSurfaceGenerationPlan } from './plan.js';
export { runSurfaceGeneration } from './runner.js';
export { summarizeContractIssues } from './summary.js';

export type {
  GenerateEditInput,
  GenerateSurfaceInput,
  GenerationSummary,
  GhostGenerationContext,
  RepairOptions,
  RepairStats,
  ResolvedSurfaceGenerationPlan,
  ResolveSurfaceGenerationPlanInput,
  SummonModelChunk,
  SummonModelProvider,
  SummonModelRequest,
  SummonRepairProvider,
  SummonRepairRequest,
  SurfaceGenerationInput,
  SurfaceGenerationSummary,
} from './types.js';

export type {
  ContractIssue,
  ContractPromptBlock,
  ProtocolLine,
  ProtocolSkipMetaValue,
  RepairFeedbackMetaValue,
} from '@summon-internal/engine';
