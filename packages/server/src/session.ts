import {
  StreamGraph,
  compileSurfacePolicy,
  surfaceContractViewFromCompiledPolicy,
  compileSystemContracts,
  createProtocolHardener,
  type CompiledSurfacePolicy,
  type CompiledSystemContracts,
  type ContractIssue,
  type ProtocolHardener,
  type ProtocolHardenerResult,
  type ProtocolLine,
  type SurfaceContractView,
} from '@summon-internal/engine';
import { writeFinalSummaries } from './summary.js';
import type {
  SurfaceGenerationInput,
  SurfaceGenerationSummary,
} from './types.js';

export class SurfaceGenerationSession {
  private readonly systemContracts: CompiledSystemContracts;
  private readonly surfacePolicy: CompiledSurfacePolicy | null;
  private readonly surfaceContract: SurfaceContractView | null;
  private readonly hardener: ProtocolHardener;
  private readonly acceptedLines: ProtocolLine[] = [];
  private readonly emittedLines: ProtocolLine[] = [];
  private readonly validationIssues: ContractIssue[];
  private readonly streamGraph = new StreamGraph();
  private readonly timingStartedAt: number;
  private blocked = false;

  constructor(
    private readonly input: SurfaceGenerationInput,
    private readonly emit: (line: ProtocolLine) => void | Promise<void>,
  ) {
    this.timingStartedAt = timingStartedAtFromSeedLines(input.seedLines) ?? nowMs();
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
      direction: input.direction ?? null,
      ghost: input.ghost ?? null,
      layout: input.layout ?? null,
      experimentalPromptBlock: input.experimentalPromptBlock ?? null,
      tools: this.surfacePolicy?.tools ?? input.tools ?? null,
      surfacePlan: this.surfacePolicy?.surfacePlan ?? null,
      surfaceContract: this.surfaceContract,
      tokenOverrides: input.tokenOverrides,
      activeTokensCss: input.activeTokensCss ?? null,
    });

    this.hardener = createProtocolHardener({
      validationContext: {
        ...this.systemContracts.validationContext,
      },
      validationMode: input.validationMode,
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
    for (const line of this.systemContracts.startupLines) {
      this.acceptedLines.push(line);
      await this.writeProtocolLine(line);
    }
  }

  async blockPreflightIssueIfNeeded(): Promise<boolean> {
    const blocker = this.validationIssues.find((issue) => issue.severity === 'block');
    if (!blocker) return false;
    await this.blockGeneration(blocker);
    return true;
  }

  async consumeProvider(): Promise<void> {
    await this.writePhase('drafting', 'Drafting Arrow artifact');
    await this.writeTiming('drafting', 'Drafting Arrow artifact');
    const providerStartedAt = nowMs();
    const provider = await this.input.modelProvider({
      prompt: this.input.prompt,
      promptBlocks: this.systemContracts.promptBlocks,
      signal: this.input.signal,
    });
    const textState = { buffer: '' };
    let firstChunkSeen = false;

    for await (const chunk of provider) {
      if (this.blocked) break;
      if (!firstChunkSeen) {
        firstChunkSeen = true;
        await this.writeTiming(
          'first-provider-chunk',
          'Received first provider chunk',
          nowMs() - providerStartedAt,
        );
      }
      if (typeof chunk === 'string') {
        await this.handleText(textState, chunk);
      } else if (chunk.type === 'text') {
        await this.handleText(textState, chunk.text);
      } else {
        await this.writeProtocolLine({ op: 'meta', path: chunk.path, value: chunk.value });
      }
    }

    if (!this.blocked && textState.buffer.trim()) {
      await this.handleModelLine(textState.buffer.trim());
    }
  }

  async finalize(): Promise<SurfaceGenerationSummary> {
    await writeFinalSummaries({
      writeProtocolLine: (line) => this.writeProtocolLine(line),
      validationIssues: this.validationIssues,
      streamGraph: this.streamGraph,
    });
    await this.writeTiming(
      'complete',
      this.blocked ? 'Generation blocked' : 'Generation complete',
      nowMs() - this.timingStartedAt,
    );
    return this.summary();
  }

  private async handleText(state: { buffer: string }, text: string): Promise<void> {
    if (this.blocked) return;
    state.buffer += text;
    let nl = state.buffer.indexOf('\n');
    while (nl !== -1) {
      const raw = state.buffer.slice(0, nl);
      state.buffer = state.buffer.slice(nl + 1);
      await this.handleModelLine(raw);
      nl = state.buffer.indexOf('\n');
    }
  }

  private async handleModelLine(raw: string): Promise<void> {
    if (this.blocked) return;
    const isArtifact = isArtifactProtocolLine(raw);
    const validationStartedAt = isArtifact ? nowMs() : null;
    if (isArtifact) {
      await this.writePhase('validating', 'Validating Arrow artifact');
    }
    const result = this.hardener.processRawLine(raw);
    this.validationIssues.push(...result.issues);
    if (validationStartedAt !== null) {
      const observedBlocker = !result.blocked && result.issues.some((issue) => issue.severity === 'block');
      await this.writeTiming(
        'validating',
        result.blocked
          ? 'Blocked Arrow artifact'
          : observedBlocker
            ? 'Observed blocked Arrow artifact'
            : 'Validated Arrow artifact',
        nowMs() - validationStartedAt,
      );
    }
    if (result.blocked) {
      await this.blockGeneration(result.blocked);
      return;
    }

    await this.acceptHardenedResult(result);
  }

  private async acceptHardenedResult(
    result: Pick<ProtocolHardenerResult, 'acceptedLines' | 'outboundLines'>,
  ): Promise<void> {
    this.acceptedLines.push(...result.acceptedLines);
    for (const line of result.outboundLines) {
      if (line.op === 'artifact') {
        await this.writePhase('rendering', 'Rendering accepted artifact');
        const renderStartedAt = nowMs();
        await this.writeProtocolLine(line);
        await this.writeTiming(
          'rendering',
          'Rendered accepted artifact',
          nowMs() - renderStartedAt,
        );
        continue;
      }
      await this.writeProtocolLine(line);
    }
  }

  private async writePhase(
    status: 'planning' | 'contract' | 'drafting' | 'validating' | 'rendering' | 'finalizing',
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

type ServerTimingPhase =
  | 'drafting'
  | 'first-provider-chunk'
  | 'validating'
  | 'rendering'
  | 'complete';

function nowMs(): number {
  return performance.now();
}

function roundMs(value: number): number {
  return Math.max(0, Math.round(value));
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

function isArtifactProtocolLine(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return !!parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      (parsed as { op?: unknown; path?: unknown }).op === 'artifact' &&
      (parsed as { path?: unknown }).path === '/artifact';
  } catch {
    return false;
  }
}
