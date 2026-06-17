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
  private blocked = false;

  constructor(
    private readonly input: SurfaceGenerationInput,
    private readonly emit: (line: ProtocolLine) => void | Promise<void>,
  ) {
    this.surfacePolicy = input.surfacePolicy
      ? compileSurfacePolicy(input.surfacePolicy, {
          capabilities: input.capabilities ?? null,
          components: input.components ?? null,
        })
      : null;
    this.surfaceContract = this.surfacePolicy
      ? surfaceContractViewFromCompiledPolicy(this.surfacePolicy, input.layout ?? null)
      : null;
    this.systemContracts = compileSystemContracts({
      mode: this.surfacePolicy?.mode ?? input.mode ?? 'static',
      direction: input.direction ?? null,
      ghost: input.ghost ?? null,
      layout: input.layout ?? null,
      experimentalPromptBlock: input.experimentalPromptBlock ?? null,
      capabilities: this.surfacePolicy?.capabilities ?? input.capabilities ?? null,
      components: this.surfacePolicy?.components ?? input.components ?? null,
      scriptPolicy: this.surfacePolicy?.scriptPolicy ?? input.scriptPolicy,
      surfacePlan: this.surfacePolicy?.surfacePlan ?? input.surfacePlan ?? null,
      surfaceContract: this.surfaceContract,
      tokenOverrides: input.tokenOverrides,
      activeTokensCss: input.activeTokensCss ?? null,
    });

    this.hardener = createProtocolHardener({
      validationContext: {
        ...this.systemContracts.validationContext,
      },
    });

    this.validationIssues = [
      ...(this.surfacePolicy?.issues ?? []),
      ...this.systemContracts.issues,
    ];
  }

  async writeStartupLines(): Promise<void> {
    for (const line of this.input.preludeLines ?? []) {
      await this.writeProtocolLine(line);
    }
    if (this.surfacePolicy) {
      await this.writeProtocolLine({ op: 'meta', path: '/surface-policy', value: this.surfacePolicy.policy });
    }
    const surfacePlan = this.surfacePolicy?.surfacePlan ?? this.input.surfacePlan;
    if (surfacePlan) {
      await this.writeProtocolLine({ op: 'meta', path: '/surface-plan', value: surfacePlan });
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
    const provider = await this.input.modelProvider({
      prompt: this.input.prompt,
      promptBlocks: this.systemContracts.promptBlocks,
      signal: this.input.signal,
    });
    const textState = { buffer: '' };

    for await (const chunk of provider) {
      if (this.blocked) break;
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
    const result = this.hardener.processRawLine(raw);
    this.validationIssues.push(...result.issues);
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
      await this.writeProtocolLine(line);
    }
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
