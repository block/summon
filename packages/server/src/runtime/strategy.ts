import {
  contractIssue,
  runtimeProfile,
  type CompiledSystemContracts,
  type ContractIssue,
  type ProtocolLine,
  type RuntimeProfile,
  type SummonOutputRuntime,
} from '@summon-internal/engine';
import type { SurfaceGenerationInput } from '../types.js';
import { ArrowControlStrategy } from './arrow-control.js';
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
    case 'html-script':
      return new HtmlBundleStrategy('html-script');
    case 'html-stream':
      return new HtmlStreamStrategy();
    case 'unsafe-html-raw-stream':
      return new UnsupportedRuntimeStrategy(runtime);
  }
}

export async function writeInitialOutputMode(ctx: RuntimeContext): Promise<void> {
  await ctx.writeProtocolLine({
    op: 'meta',
    path: '/model-output-mode',
    value: {
      format: ctx.profile.format === 'arrow' ? 'arrow-bundle' : 'html-bundle',
      schema: ctx.profile.format === 'arrow'
        ? 'summon.arrow-bundle/v1'
        : 'summon.html-bundle/v0',
      runtime: ctx.profile.runtime,
      repairAttempts: 0,
    },
  });
}

export function missingArtifactIssueForProfile(profile: RuntimeProfile): ContractIssue {
  const missingArrowArtifact = profile.format === 'arrow';
  return contractIssue({
    source: 'protocol',
    severity: 'block',
    code: missingArrowArtifact ? 'missing-arrow-artifact' : 'missing-html-artifact',
    message: missingArrowArtifact
      ? 'Generation completed without a valid Arrow artifact'
      : 'Generation completed without a valid HTML artifact',
    path: '/artifact',
  });
}

export function nowMs(): number {
  return performance.now();
}

export function roundMs(value: number): number {
  return Math.max(0, Math.round(value));
}

class UnsupportedRuntimeStrategy implements RuntimeStrategy {
  readonly profile: RuntimeProfile;

  constructor(runtime: Extract<SummonOutputRuntime, 'unsafe-html-raw-stream'>) {
    this.profile = runtimeProfile(runtime);
  }

  async writeInitialOutputMode(ctx: RuntimeContext): Promise<void> {
    await writeInitialOutputMode(ctx);
  }

  async consume(ctx: RuntimeContext): Promise<void> {
    await ctx.blockGeneration(contractIssue({
      source: 'system',
      severity: 'block',
      code: 'unsupported-output-runtime',
      message: `Experimental runtime "${this.profile.runtime}" is not wired in the server strategy layer`,
      path: '/model-provider',
    }));
  }

  missingArtifactIssue(): ContractIssue {
    return missingArtifactIssueForProfile(this.profile);
  }
}
