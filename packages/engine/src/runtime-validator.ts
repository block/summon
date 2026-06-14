export { validateProtocolLine } from './runtime-validator/protocol.js';
export {
  ARTIFACT_COMPILER_VERSION,
  compileArtifactHtml,
  validateHtmlFragment,
} from './runtime-validator/html.js';
export type {
  ArtifactCompileResult,
  CompiledArtifactHtml,
  CompiledHtmlNodePatch,
  ValidationContext,
  ValidationCapability,
  ValidationComponent,
} from './runtime-validator/types.js';
