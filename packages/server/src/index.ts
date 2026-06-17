export {
  defaultHostPolicyResolver,
  inferSurfaceIntent,
  planAgentSurface,
  policyFromIntent,
  runAgentSurfaceGeneration,
} from './agent-broker.js';
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
  SurfaceIntentSource,
} from './agent-broker.js';

export type {
  GenerateSurfaceInput,
  GenerationSummary,
  GhostGenerationContext,
  ResolvedSurfaceGenerationPlan,
  ResolveSurfaceGenerationPlanInput,
  SummonModelChunk,
  SummonModelProvider,
  SummonModelRequest,
  SurfaceGenerationInput,
  SurfaceGenerationSummary,
} from './types.js';

export type {
  ContractIssue,
  ContractPromptBlock,
  ProtocolLine,
  ProtocolSkipMetaValue,
} from '@summon-internal/engine';
