import type {
  ArrowNetworkPolicy,
  ArrowSurfaceArtifact,
  ValidationTool,
} from '@summon-internal/engine';

export type {
  ArrowNetworkPolicy,
  ArrowSurfaceArtifact,
} from '@summon-internal/engine';

/** Artifact — generated HTML plus advisory declarations used for diagnostics and replay. */
export interface Artifact {
  runtime?: 'arrow';
  /** Tools the artifact declares it may emit. Execution is governed by host grants. */
  tools: string[];
  /** Advisory validation metadata for tools the artifact claims to use. */
  validationTools?: ValidationTool[];
  /** Arrow source artifact to render inside the inline Arrow sandbox. */
  arrow?: ArrowSurfaceArtifact;
  /** Optional initial state pushed before the artifact renders. */
  initialState?: Record<string, unknown>;
}
