import {
  StreamGraph,
  compileSurfacePolicy,
  surfaceContractViewFromCompiledPolicy,
  compileSystemContracts,
  DEFAULT_SUMMON_OUTPUT_RUNTIME,
  type CompiledSurfacePolicy,
  type CompiledSystemContracts,
  type ContractIssue,
  type ProtocolLine,
  type SurfaceContractView,
  type SurfaceEventLine,
  type SurfacePlan,
  type SummonOutputRuntime,
} from '@summon-internal/engine';
import {
  createRuntimeStrategy,
  nowMs,
  roundMs,
  type RuntimeContext,
  type RuntimeStrategy,
  type ServerTimingPhase,
  type SurfacePhase,
} from './runtime/strategy.js';
import { writeFinalSummaries } from './summary.js';
import type {
  SurfaceGenerationInput,
  SurfaceGenerationSummary,
} from './types.js';

export class SurfaceGenerationSession {
  private readonly systemContracts: CompiledSystemContracts;
  private readonly strategy: RuntimeStrategy;
  private readonly surfacePolicy: CompiledSurfacePolicy | null;
  private readonly surfaceContract: SurfaceContractView | null;
  private readonly acceptedLines: ProtocolLine[] = [];
  private readonly emittedLines: ProtocolLine[] = [];
  private readonly validationIssues: ContractIssue[];
  private readonly streamGraph = new StreamGraph();
  private readonly timingStartedAt: number;
  private repairAttempts = 0;
  private blocked = false;

  constructor(
    private readonly input: SurfaceGenerationInput,
    private readonly emit: (line: ProtocolLine) => void | Promise<void>,
  ) {
    this.timingStartedAt = timingStartedAtFromSeedLines(input.seedLines) ?? nowMs();
    const runtimeTarget = this.runtimeTarget();
    this.strategy = createRuntimeStrategy(runtimeTarget);
    this.surfacePolicy = input.surfacePolicy
      ? compileSurfacePolicy(input.surfacePolicy, {
          tools: input.tools ?? null,
        })
      : null;
    this.surfaceContract = this.surfacePolicy
      ? surfaceContractViewFromCompiledPolicy(this.surfacePolicy, input.layout ?? null)
      : null;
    this.systemContracts = compileSystemContracts({
      mode: this.surfacePolicy?.mode ?? 'static',
      outputRuntime: runtimeTarget,
      ghost: input.ghost ?? null,
      layout: input.layout ?? null,
      experimentalPromptBlock: input.experimentalPromptBlock ?? null,
      tools: this.surfacePolicy?.tools ?? input.tools ?? null,
      surfacePlan: this.surfacePolicy?.surfacePlan ?? null,
      surfaceContract: this.surfaceContract,
      activeTokensCss: input.activeTokensCss ?? null,
    });

    this.validationIssues = [
      ...(this.surfacePolicy?.issues ?? []),
      ...this.systemContracts.issues,
    ];
  }

  async writeStartupLines(): Promise<void> {
    for (const line of this.input.seedLines ?? []) {
      this.emittedLines.push(line);
      this.streamGraph.applyLine(line);
    }
    for (const line of this.input.preludeLines ?? []) {
      await this.writeProtocolLine(line);
    }
    if (this.surfacePolicy) {
      await this.writeProtocolLine({ op: 'meta', path: '/surface-policy', value: this.surfacePolicy.policy });
    }
    if (this.surfacePolicy?.surfacePlan) {
      await this.writeProtocolLine({ op: 'meta', path: '/surface-plan', value: this.surfacePolicy.surfacePlan });
    }
    if (this.surfaceContract) {
      await this.writeProtocolLine({ op: 'meta', path: '/surface-contract', value: this.surfaceContract });
    }
    await this.strategy.writeInitialOutputMode(this.runtimeContext());
    for (const line of this.systemContracts.startupLines) {
      this.acceptedLines.push(line);
      await this.writeProtocolLine(line);
    }
  }

  async blockPreflightIssueIfNeeded(): Promise<boolean> {
    const blockers = this.validationIssues.filter((issue) => issue.severity === 'block');
    if (blockers.length === 0) return false;
    if (this.isObserveValidation()) {
      for (const issue of blockers) {
        await this.writeObservedValidationIssue(issue);
      }
      return false;
    }
    await this.blockGeneration(blockers[0]!);
    return true;
  }

  async consumeProvider(): Promise<void> {
    await this.strategy.consume(this.runtimeContext());
  }

  async finalize(): Promise<SurfaceGenerationSummary> {
    if (!this.blocked && !this.acceptedLines.some((line) => line.op === 'artifact')) {
      await this.blockGeneration(this.strategy.missingArtifactIssue());
    }
    await this.writePhase('finalizing', 'Finalizing diagnostics');
    await writeFinalSummaries({
      writeProtocolLine: (line) => this.writeProtocolLine(line),
      validationIssues: this.validationIssues,
      streamGraph: this.streamGraph,
    });
    await this.writeProtocolLine({
      op: 'meta',
      path: '/run-metrics',
      value: buildRunMetrics({
        runtime: this.strategy.profile.runtime,
        repairs: this.repairAttempts,
        blocked: this.blocked,
        validationIssues: this.validationIssues,
      }),
    });
    await this.writeTiming(
      'complete',
      this.blocked ? 'Generation blocked' : 'Generation complete',
      nowMs() - this.timingStartedAt,
    );
    return this.summary();
  }

  private async emitServerPreviewScaffold(): Promise<void> {
    for (const line of buildServerPreviewScaffold({
      prompt: this.input.prompt,
      surfacePlan: this.surfacePolicy?.surfacePlan ?? null,
      surfaceContract: this.surfaceContract,
      layoutId: this.input.layout?.id ?? null,
      ghostProduct: this.input.ghost?.product ?? null,
    })) {
      this.acceptedLines.push(line);
      await this.writeProtocolLine(line);
    }
  }

  private runtimeContext(): RuntimeContext {
    return {
      input: this.input,
      systemContracts: this.systemContracts,
      profile: this.strategy.profile,
      addValidationIssues: (issues) => {
        this.validationIssues.push(...issues);
      },
      blockGeneration: (issue) => this.blockGeneration(issue),
      emitServerPreviewScaffold: () => this.emitServerPreviewScaffold(),
      isBlocked: () => this.blocked,
      isObserveValidation: () => this.isObserveValidation(),
      recordRepairAttempt: () => {
        this.repairAttempts += 1;
      },
      withStatusHeartbeat: (options) => this.withStatusHeartbeat(options),
      writeAcceptedLine: (line) => this.writeAcceptedLine(line),
      writeObservedValidationIssue: (issue) => this.writeObservedValidationIssue(issue),
      writePhase: (status, text) => this.writePhase(status, text),
      writeProtocolLine: (line) => this.writeProtocolLine(line),
      writeTiming: (phase, label, durationMs) => this.writeTiming(phase, label, durationMs),
    };
  }

  private async withStatusHeartbeat<T>({
    status,
    messages,
    run,
  }: {
    status: 'drafting' | 'validating';
    messages: string[];
    run: () => Promise<T>;
  }): Promise<T> {
    const intervalMs = Math.max(0, Math.floor(this.input.heartbeatIntervalMs ?? 3000));
    if (intervalMs === 0) return run();
    let done = false;
    let tick = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatWrites: Promise<void> = Promise.resolve();

    const schedule = () => {
      timer = setTimeout(() => {
        if (done || this.input.signal?.aborted) return;
        const message = messages[tick % messages.length] ?? messages.at(-1) ?? 'Still working';
        tick += 1;
        heartbeatWrites = heartbeatWrites.then(() => this.writePhase(status, message));
        schedule();
      }, intervalMs);
    };

    schedule();
    try {
      return await run();
    } finally {
      done = true;
      if (timer) clearTimeout(timer);
      await heartbeatWrites;
    }
  }

  private async writePhase(
    status: SurfacePhase,
    text: string,
  ): Promise<void> {
    await this.writeProtocolLine({
      op: 'event',
      path: '/surface',
      value: { type: 'surface.status', status, text },
    });
    await this.writeProtocolLine({ op: 'meta', path: '/status', value: status });
  }

  private async writeTiming(
    phase: ServerTimingPhase,
    label: string,
    durationMs?: number,
  ): Promise<void> {
    await this.writeProtocolLine({
      op: 'meta',
      path: '/timing',
      value: {
        phase,
        label,
        elapsedMs: roundMs(nowMs() - this.timingStartedAt),
        ...(durationMs === undefined ? {} : { durationMs: roundMs(durationMs) }),
        source: 'server',
      },
    });
  }

  private async writeProtocolLine(line: ProtocolLine): Promise<void> {
    this.emittedLines.push(line);
    this.streamGraph.applyLine(line);
    await this.emit(line);
  }

  private async writeAcceptedLine(line: ProtocolLine): Promise<void> {
    this.acceptedLines.push(line);
    await this.writeProtocolLine(line);
  }

  private async blockGeneration(issue: ContractIssue): Promise<void> {
    if (this.blocked) return;
    this.blocked = true;
    if (!this.validationIssues.includes(issue)) this.validationIssues.push(issue);
    await this.writeProtocolLine({ op: 'meta', path: '/validation-blocked', value: issue });
    await this.writeProtocolLine({
      op: 'meta',
      path: '/error',
      value: `generation blocked: ${issue.message}`,
    });
  }

  private isObserveValidation(): boolean {
    return this.input.validationMode === 'observe';
  }

  private runtimeTarget(): SummonOutputRuntime {
    return this.input.experimentalRuntime ?? DEFAULT_SUMMON_OUTPUT_RUNTIME;
  }

  private async writeObservedValidationIssue(issue: ContractIssue): Promise<void> {
    await this.writeProtocolLine({ op: 'meta', path: '/validation-observed', value: issue });
  }

  private summary(): SurfaceGenerationSummary {
    return {
      acceptedLines: this.acceptedLines,
      emittedLines: this.emittedLines,
      validationIssues: this.validationIssues,
      streamGraph: this.streamGraph.snapshot(),
      blocked: this.blocked,
    };
  }
}

const SAFETY_VIOLATION_CODES = new Set([
  'unsafe-tag',
  'external-url',
  'inline-handler',
  'static-script',
  'html-script-not-enabled',
  'unsafe-html-script',
  'arrow-network-not-granted',
  'invalid-arrow-network',
]);

function buildRunMetrics(input: {
  runtime: SummonOutputRuntime;
  repairs: number;
  blocked: boolean;
  validationIssues: readonly ContractIssue[];
}): Record<string, unknown> {
  const safetyIssueCodes = input.validationIssues
    .filter((issue) => issue.severity === 'block' && SAFETY_VIOLATION_CODES.has(issue.code))
    .map((issue) => issue.code);
  return {
    schema: 'summon.run-metrics/v1',
    runtime: input.runtime,
    repairs: input.repairs,
    blocked: input.blocked,
    validationCount: input.validationIssues.length,
    safetyViolations: safetyIssueCodes.length,
    safetyViolationCodes: [...new Set(safetyIssueCodes)].sort(),
  };
}

function buildServerPreviewScaffold(input: {
  prompt: string;
  surfacePlan: SurfacePlan | null;
  surfaceContract: SurfaceContractView | null;
  layoutId: string | null;
  ghostProduct: string | null;
}): SurfaceEventLine[] {
  const purpose = input.surfacePlan?.purpose ?? 'surface';
  const title = input.ghostProduct ?? titleFromPrompt(input.prompt);
  const toolCount = input.surfaceContract?.tools.length ?? 0;
  const authority = input.surfacePlan?.authority ?? 'none';
  const data = input.surfacePlan?.data ?? 'embedded';
  const layoutText = input.layoutId ? `Layout ${input.layoutId}` : 'Free composition';
  return [
    {
      op: 'event',
      path: '/surface',
      value: {
        type: 'surface.start',
        id: 'main',
        kind: purpose,
        title,
      },
    },
    {
      op: 'event',
      path: '/surface',
      value: {
        type: 'region.add',
        id: 'progress',
        parent: 'main',
        role: 'status',
        label: 'Preparing surface',
      },
    },
    {
      op: 'event',
      path: '/surface',
      value: {
        type: 'node.add',
        id: 'progress-text',
        parent: 'progress',
        kind: 'text',
        props: {
          text: `Host contract bound: ${data}/${authority}; tools=${toolCount}; ${layoutText}.`,
        },
      },
    },
  ];
}

function titleFromPrompt(prompt: string): string {
  const compact = prompt.replace(/\s+/g, ' ').trim();
  if (!compact) return 'Building surface';
  const withoutPrefix = compact.replace(/^(build|create|make|draft|show|generate)\s+(me\s+)?/i, '');
  const title = withoutPrefix.charAt(0).toUpperCase() + withoutPrefix.slice(1);
  return title.length > 64 ? `${title.slice(0, 61)}...` : title;
}

function timingStartedAtFromSeedLines(lines: readonly ProtocolLine[] | undefined): number | null {
  let latestElapsed: number | null = null;
  for (const line of lines ?? []) {
    if (line.op !== 'meta' || line.path !== '/timing') continue;
    const value = line.value;
    if (!value || typeof value !== 'object') continue;
    const elapsedMs = (value as { elapsedMs?: unknown }).elapsedMs;
    if (typeof elapsedMs !== 'number' || !Number.isFinite(elapsedMs)) continue;
    latestElapsed = Math.max(latestElapsed ?? 0, elapsedMs);
  }
  return latestElapsed === null ? null : nowMs() - latestElapsed;
}
