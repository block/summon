export { spawnSandbox } from './sandbox-spawner.js';
export type { SpawnOptions } from './sandbox-spawner.js';
export { PolicyEngine, defineIntent, IntentArgsError } from './policy-engine.js';
export type {
  IntentContext,
  IntentEntry,
  IntentHandler,
  PolicyEngineOptions,
  TypedIntentEntry,
} from './policy-engine.js';
export {
  createCapabilityRegistry,
  defineAction,
  defineApprovalAction,
  defineCapability,
  defineDataResource,
  defineWorkerAction,
  defineWorkerResource,
} from './capability-registry.js';
export type {
  ActionDefinition,
  ActionStateKeys,
  ApprovalActionDefinition,
  ApprovalDecision,
  ApprovalPrepared,
  ApprovalRequest,
  ApprovalStateKeys,
  CapabilityDefinition,
  CapabilityRegistry,
  DataResourceDefinition,
  ResourceStateKeys,
  StateShapeDescriptor,
} from './capability-registry.js';
export {
  createComponentRegistry,
  defineComponent,
} from './component-registry.js';
export type {
  ComponentDefinition,
  ComponentDestroyer,
  ComponentPropsParseResult,
  ComponentRegistry,
  ComponentRenderContext,
  ComponentRenderer,
} from './component-registry.js';
export {
  createComponentIslandRegistry,
} from './component-islands.js';
export type {
  ComponentIslandErrorCode,
  ComponentIslandError,
  ComponentIslandRegistry,
  ComponentIslandRegistryOptions,
  ComponentIslandSyncContext,
} from './component-islands.js';
export { bindEndpoint } from './bind-endpoint.js';
export type {
  EndpointBinding,
  EndpointStateKeys,
} from './bind-endpoint.js';
export {
  SUMMON_SURFACE_ENVELOPE_VERSION,
  createSurfaceEnvelope,
  isSurfaceEnvelope,
  parseSurfaceEnvelope,
} from './surface-envelope.js';
export type {
  CreateSurfaceEnvelopeInput,
  SurfaceEnvelope,
} from './surface-envelope.js';
export { consumeSurfaceStream } from './surface-stream.js';
export type {
  SurfaceStreamContext,
  SurfaceStreamLineDecision,
  SurfaceStreamOptions,
  SurfaceStreamParseError,
  SurfaceStreamRenderMode,
  SurfaceStreamResult,
  SurfaceStreamSource,
} from './surface-stream.js';
export { createStrictInputRegistry } from './strict-input.js';
export type {
  StrictInputBounds,
  StrictInputController,
  StrictInputFactory,
  StrictInputFactoryArgs,
  StrictInputRegistry,
  StrictInputRegistryOptions,
} from './strict-input.js';
export type {
  Artifact,
  ComponentIslandBounds,
  ComponentIslandDescriptor,
  ComponentsMessage,
  SandboxHandle,
  StateMessage,
  IntentMessage,
  ReadyMessage,
  FatalMessage,
  SandboxInboundMessage,
} from './types.js';
