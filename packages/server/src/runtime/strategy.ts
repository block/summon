import {
  contractIssue,
  type CompiledSystemContracts,
  type ContractIssue,
  type ProtocolLine,
  type RuntimeProfile,
  type SummonOutputRuntime,
} from '@summon-internal/engine';
import type { SurfaceGenerationInput } from '../types.js';
import { ArrowControlStrategy } from './arrow-control.js';
import { DomjsControlStrategy } from './domjs-control.js';
import { HtmlBundleStrategy } from './html-bundle.js';
import { HtmlStreamStrategy } from './html-stream.js';

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
  profile: RuntimeProfile;
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
  readonly profile: RuntimeProfile;
  writeInitialOutputMode(ctx: RuntimeContext): Promise<void>;
  consume(ctx: RuntimeContext): Promise<void>;
  missingArtifactIssue(): ContractIssue;
}

export function createRuntimeStrategy(runtime: SummonOutputRuntime): RuntimeStrategy {
  switch (runtime) {
    case 'arrow-control':
      return new ArrowControlStrategy();
    case 'html-static':
      return new HtmlBundleStrategy('html-static');
    case 'html-stream':
      return new HtmlStreamStrategy();
    case 'domjs-control':
      return new DomjsControlStrategy();
  }
}

function outputModeFormat(format: string): string {
  if (format === 'arrow') return 'arrow-bundle';
  if (format === 'domjs') return 'domjs-bundle';
  return 'html-bundle';
}

function outputModeSchema(format: string): string {
  if (format === 'arrow') return 'summon.arrow-bundle/v1';
  if (format === 'domjs') return 'summon.domjs-bundle/v1';
  return 'summon.html-bundle/v0';
}

export async function writeInitialOutputMode(ctx: RuntimeContext): Promise<void> {
  await ctx.writeProtocolLine({
    op: 'meta',
    path: '/model-output-mode',
    value: {
      format: outputModeFormat(ctx.profile.format),
      schema: outputModeSchema(ctx.profile.format),
      runtime: ctx.profile.runtime,
      repairAttempts: 0,
    },
  });
}

export function missingArtifactIssueForProfile(profile: RuntimeProfile): ContractIssue {
  const code = profile.format === 'arrow'
    ? 'missing-arrow-artifact'
    : profile.format === 'domjs'
      ? 'missing-domjs-artifact'
      : 'missing-html-artifact';
  const label = profile.format === 'arrow' ? 'Arrow' : profile.format === 'domjs' ? 'domjs' : 'HTML';
  return contractIssue({
    source: 'protocol',
    severity: 'block',
    code,
    message: `Generation completed without a valid ${label} artifact`,
    path: '/artifact',
  });
}

export function nowMs(): number {
  return performance.now();
}

export function roundMs(value: number): number {
  return Math.max(0, Math.round(value));
}
