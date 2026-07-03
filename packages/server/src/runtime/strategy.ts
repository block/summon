import {
  contractIssue,
  type CompiledSystemContracts,
  type ContractIssue,
  type ProtocolLine,
} from '@summon-internal/engine';
import type { SurfaceGenerationInput } from '../types.js';

export type SurfacePhase =
  | 'planning'
  | 'contract'
  | 'drafting'
  | 'validating'
  | 'rendering'
  | 'finalizing';

export type ServerTimingPhase =
  | 'drafting'
  | 'bundle-received'
  | 'validating'
  | 'rendering'
  | 'complete';

export interface RuntimeContext {
  input: SurfaceGenerationInput;
  systemContracts: CompiledSystemContracts;
  addValidationIssues(issues: readonly ContractIssue[]): void;
  blockGeneration(issue: ContractIssue): Promise<void>;
  emitServerPreviewScaffold(): Promise<void>;
  isBlocked(): boolean;
  isObserveValidation(): boolean;
  recordRepairAttempt(): void;
  withStatusHeartbeat<T>(options: {
    status: 'drafting' | 'validating';
    messages: string[];
    run: () => Promise<T>;
  }): Promise<T>;
  writeAcceptedLine(line: ProtocolLine): Promise<void>;
  writeObservedValidationIssue(issue: ContractIssue): Promise<void>;
  writePhase(status: SurfacePhase, text: string): Promise<void>;
  writeProtocolLine(line: ProtocolLine): Promise<void>;
  writeTiming(phase: ServerTimingPhase, label: string, durationMs?: number): Promise<void>;
}

export interface RuntimeStrategy {
  writeInitialOutputMode(ctx: RuntimeContext): Promise<void>;
  consume(ctx: RuntimeContext): Promise<void>;
  missingArtifactIssue(): ContractIssue;
}

export async function writeInitialOutputMode(ctx: RuntimeContext): Promise<void> {
  await ctx.writeProtocolLine({
    op: 'meta',
    path: '/model-output-mode',
    value: {
      format: 'surface-document-bundle',
      schema: 'summon.surface-document-bundle/v1',
      runtime: 'surface-document',
      repairAttempts: 0,
    },
  });
}

export function missingArtifactIssue(): ContractIssue {
  return contractIssue({
    source: 'protocol',
    severity: 'block',
    code: 'missing-surface-document-artifact',
    message: 'Generation completed without a valid Surface Document artifact',
    path: '/artifact',
  });
}

export function nowMs(): number {
  return performance.now();
}

export function roundMs(value: number): number {
  return Math.max(0, Math.round(value));
}
