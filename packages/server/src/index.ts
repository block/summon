export {
  defaultHostPolicyResolver,
  inferSurfaceGoal,
  planAgentSurface,
  policyFromGoal,
  runAgentSurfaceGeneration,
} from './agent-broker.js';
export { runSurfaceGeneration } from './runner.js';
export { summarizeContractIssues } from './summary.js';

export type {
  AgentGoalProvider,
  AgentGoalRequest,
  AgentGoalTextClient,
  AgentGoalTextRequest,
  AgentPolicyResolution,
  AgentSurfaceGenerationInput,
  AgentSurfaceGenerationSummary,
  AgentSurfacePlanResult,
  AgentSurfacePlanningInput,
  AgentSurfacePlanningOptions,
  HostPolicyResolutionRequest,
  HostPolicyResolver,
  SurfaceGoal,
  SurfaceGoalDataNeed,
  SurfaceGoalInteraction,
  SurfaceGoalSideEffect,
  SurfaceGoalSource,
} from './agent-broker.js';

export type {
  GenerateSurfaceInput,
  GenerationSummary,
  GhostGenerationContext,
  ArrowBundleRequest,
  ArrowBundleRepairRequest,
  HtmlBundleRequest,
  HtmlBundleRepairRequest,
  HtmlStreamRequest,
  SurfaceModelProvider,
  SurfaceModelRequest,
  SurfaceGenerationInput,
  SurfaceGenerationSummary,
} from './types.js';

export type {
  ContractIssue,
  ContractPromptBlock,
  ProtocolLine,
  ProtocolSkipMetaValue,
} from '@summon-internal/engine';
