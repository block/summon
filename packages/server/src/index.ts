export { generateSurfaceStream } from './compat.js';
export {
  defaultHostPolicyResolver,
  inferSurfaceIntent,
  planAgentSurface,
  policyFromIntent,
  runAgentSurfaceGeneration,
} from './agent-broker.js';
export { buildEditBlock } from './edit.js';
export { resolveSurfaceGenerationPlan } from './plan.js';
export { runSurfaceGeneration } from './runner.js';
export { summarizeContractIssues } from './summary.js';

export type {
  AgentIntentProvider,
  AgentIntentRequest,
  AgentIntentTextClient,
  AgentIntentTextRequest,
  AgentPolicyResolution,
  AgentSurfaceGenerationInput,
  AgentSurfaceGenerationSummary,
  AgentSurfacePlanResult,
  AgentSurfacePlanningInput,
  AgentSurfacePlanningOptions,
  HostPolicyResolutionRequest,
  HostPolicyResolver,
  SurfaceIntent,
  SurfaceIntentDataNeed,
  SurfaceIntentInteraction,
  SurfaceIntentSideEffect,
} from './agent-broker.js';

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
