export {
  SUMMON_PROTOCOL_VERSION,
  ProtocolParseError,
  isProtocolLine,
  parseProtocolLine,
  parseProtocolLineStrict,
} from './protocol.js';
export type {
  ProtocolLine,
  AddLine,
  SetLine,
  MetaLine,
  ProtocolParseErrorCode,
  ProtocolParseOptions,
} from './protocol.js';
export {
  DEFAULT_VALIDATION_LIMITS,
  normalizeValidationLimits,
} from './validation-limits.js';
export type { ValidationLimits } from './validation-limits.js';
export { SectionAccumulator } from './section-accumulator.js';
export type {
  SectionAccumulatorSnapshot,
  SectionApplyKind,
  SectionApplyResult,
  SectionSnapshotEntry,
} from './section-accumulator.js';
export { StreamGraph } from './stream-graph.js';
export type {
  StreamGraphEdge,
  StreamGraphHealth,
  StreamGraphSection,
  StreamGraphSnapshot,
} from './stream-graph.js';
export {
  SUMMON_SYSTEM_PROMPT,
  SUMMON_FIXED_INSTRUCTIONS,
  buildDirectionBlock,
  buildLayoutBlock,
  buildCapabilitiesBlock,
  buildComponentsBlock,
  buildOverrideBlock,
  buildPosturesBlock,
  buildSurfaceContractBlock,
} from './prompt.js';
export type {
  Exemplar,
  DirectionInput,
  SummonLayout,
  SummonLayoutSlot,
  IntentSpec,
  DataResourceSpec,
  CapabilityPattern,
  CapabilityPack,
  ComponentExample,
  ComponentPack,
  ComponentSizing,
  ComponentSpec,
  CapabilitiesBlockOptions,
  ScriptPolicy,
  TokenOverride,
  PostureContract,
  PostureRegistry,
} from './prompt.js';
export {
  compileTokenContract,
  compileDirectionContract,
  compileCapabilityContract,
  compileComponentContract,
  compileSystemContracts,
  contractIssue,
  hintsForContractIssue,
  withIssueSeverity,
} from './contracts.js';
export type {
  CompiledCapabilityContract,
  CompiledComponentContract,
  CompiledDirectionContract,
  CompiledSystemContracts,
  CompiledTokenContract,
  ContractIssue,
  ContractIssueSeverity,
  ContractIssueSource,
  ContractPromptBlock,
  CapabilityContractOptions,
  DirectionContractInput,
  GhostGenerationContext,
  GhostGenerationSource,
  GhostTokenSourceKind,
  SystemContractInput,
  TokenContractInput,
} from './contracts.js';
export {
  CAPABILITY_BINDING_SPECS,
  CAPABILITY_TRIGGER_SPECS,
  defaultTriggersForKind,
  formatCapabilityProtocolContract,
  hasCompleteResourceStateKeys,
} from './capability-contract.js';
export type {
  CapabilityBindingSpec,
  CapabilityKind,
  CapabilityStateKeys,
  CapabilityTrigger,
  CapabilityTriggerSpec,
} from './capability-contract.js';
export {
  TOKEN_CONTRACT,
  REQUIRED_TOKENS,
  OPPORTUNISTIC_TOKENS,
  OPT_OUT_GROUPS,
  OPT_OUT_TOKENS,
  SHADOW_TOKENS,
  formatTokenContract,
} from './token-contract.js';
export type {
  TokenKind,
  TokenSpec,
  OptOutGroup,
  TokenContract,
} from './token-contract.js';
export {
  parseDefinedTokens,
  parseTokenValues,
  validateDirection,
  coerceOpts,
} from './direction-validator.js';
export type {
  DirectionOpts,
  OptOutValue,
  ValidationResult,
} from './direction-validator.js';
export {
  validateProtocolLine,
  validateHtmlFragment,
} from './runtime-validator.js';
export type {
  ValidationContext,
  ValidationCapability,
  ValidationComponent,
} from './runtime-validator.js';
export {
  DEFAULT_SURFACE_CEILING,
  DEFAULT_SURFACE_PLAN,
  SURFACE_AUTHORITY_VALUES,
  SURFACE_DATA_VALUES,
  SURFACE_PERSISTENCE_VALUES,
  SURFACE_PURPOSE_VALUES,
  SURFACE_RUNTIME_VALUES,
  buildSurfacePlanBlock,
  constrainSurfacePlan,
  deriveSurfacePlanControls,
  inferSurfacePlan,
  normalizeSurfaceCeiling,
  normalizeSurfacePlan,
  suggestSurfacePlan,
  surfacePlanScriptPolicy,
  surfacePlanWithinCeiling,
} from './surface-plan.js';
export type {
  CapabilitySurface,
  ComponentSurface,
  SurfaceAuthority,
  SurfaceCeiling,
  SurfaceData,
  SurfacePersistence,
  SurfacePlan,
  SurfacePlanControls,
  SurfacePlanInferenceInput,
  SurfacePlanMode,
  SurfacePurpose,
  SurfaceRuntime,
} from './surface-plan.js';
export {
  compileSurfacePolicy,
  normalizeSurfacePolicy,
  SURFACE_TIER_VALUES,
} from './surface-policy.js';
export type {
  CompiledSurfacePolicy,
  CompileSurfacePolicyOptions,
  NormalizedSurfacePolicy,
  SurfacePolicy,
  SurfaceTier,
} from './surface-policy.js';
export {
  compileSurfaceContractView,
  surfaceContractViewFromCompiledPolicy,
} from './surface-contract.js';
export type {
  CompileSurfaceContractViewOptions,
  SurfaceContractComponent,
  SurfaceContractLayout,
  SurfaceContractSurface,
  SurfaceContractTool,
  SurfaceContractView,
} from './surface-contract.js';
export { createProtocolHardener } from './protocol-hardener.js';
export type {
  ProtocolHardener,
  ProtocolHardenerOptions,
  ProtocolHardenerResult,
  ProtocolSkipMetaValue,
  RepairFeedbackMetaValue,
  ScreenSynthesizedMetaValue,
} from './protocol-hardener.js';
