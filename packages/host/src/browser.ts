export { spawnSandbox } from './sandbox-spawner.js';
export type { SpawnOptions } from './sandbox-spawner.js';
export { consumeSurfaceStream } from './surface-stream.js';
export type {
  SurfaceStreamContext,
  SurfaceStreamLineDecision,
  SurfaceStreamOptions,
  SurfaceStreamParseError,
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
export { createComponentIslandRegistry } from './component-islands.js';
export type {
  ComponentIslandErrorCode,
  ComponentIslandError,
  ComponentIslandRegistry,
  ComponentIslandRegistryOptions,
  ComponentIslandSyncContext,
} from './component-islands.js';
export type {
  Artifact,
  ComponentIslandBounds,
  ComponentIslandDescriptor,
  ComponentsMessage,
  FatalMessage,
  ToolCallMessage,
  ToolResultMessage,
  ReadyMessage,
  SandboxHandle,
  SandboxInboundMessage,
  StateMessage,
} from './types.js';
