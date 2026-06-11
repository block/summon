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
  type RepairFeedbackMetaValue,
  type SurfaceContractView,
} from '@summon-internal/engine';
import { buildEditBlock } from './edit.js';
import {
  normalizeRepairOptions,
  runRepairForTarget,
  type NormalizedRepairOptions,
  type QueuedRepairTarget,
} from './repair.js';
import { writeFinalSummaries } from './summary.js';
import type {
  RepairStats,
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
  private readonly repair: NormalizedRepairOptions;
  private readonly repairStats: RepairStats = {
    queued: 0,
    cancelled: 0,
    repaired: 0,
    failed: 0,
  };
  private readonly repairQueue = new Map<string, QueuedRepairTarget>();
  private blocked = false;

  constructor(
    private readonly input: SurfaceGenerationInput,
    private readonly emit: (line: ProtocolLine) => void | Promise<void>,
  ) {
    const editBlock = input.edit ? buildEditBlock(input.edit) : input.editBlock ?? null;
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
      ghostPrompt: input.ghostPrompt ?? null,
      layout: input.layout ?? null,
      editBlock,
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
        experimentalFragmentMode: input.experimentalFragmentMode ?? 'section',
      },
      layout: input.layout ?? null,
      initialScreenSections: input.initialScreenSections ?? input.edit?.sections.map((section) => section.id),
      allowedSectionIds: input.allowedSectionIds ?? input.edit?.targetSections,
    });

    this.validationIssues = [
      ...(this.surfacePolicy?.issues ?? []),
      ...this.systemContracts.issues,
    ];
    this.repair = normalizeRepairOptions(input.repair);
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

  async runQueuedRepairs(): Promise<void> {
    if (!this.repair.enabled || this.blocked || this.repairQueue.size === 0) return;

    const targets = Array.from(this.repairQueue.values()).slice(0, this.repair.maxTargets);
    for (const target of targets) {
      if (this.blocked) break;
      if (!this.repairQueue.has(target.target)) continue;
      const repaired = await runRepairForTarget({
        target,
        input: this.input,
        promptBlocks: this.systemContracts.promptBlocks,
        hardenRawLine: (raw) => this.hardenRawRepairLine(raw),
        acceptRepairResult: (result) => this.acceptHardenedResult(result, { cancelQueuedRepairs: false }),
        writeProtocolLine: (line) => this.writeProtocolLine(line),
        writeRepairFeedback: (feedback) => this.writeRepairFeedback(feedback),
        repair: this.repair,
      });
      this.repairQueue.delete(target.target);
      if (repaired) this.repairStats.repaired += 1;
      else {
        this.repairStats.failed += 1;
        await this.blockGeneration(target.issue);
      }
    }
  }

  async finalize(): Promise<SurfaceGenerationSummary> {
    await writeFinalSummaries({
      writeProtocolLine: (line) => this.writeProtocolLine(line),
      validationIssues: this.validationIssues,
      streamGraph: this.streamGraph,
      repair: this.repair,
      repairStats: this.repairStats,
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
    if (this.repair.enabled) {
      for (const feedback of result.repairFeedback ?? []) {
        await this.writeRepairFeedback(feedback);
      }
    }
    if (result.blocked) {
      if (this.enqueueRepair(result.rejectedLine, result.blocked, result.repairFeedback?.[0])) return;
      await this.blockGeneration(result.blocked);
      return;
    }

    await this.acceptHardenedResult(result, { cancelQueuedRepairs: true });
  }

  private async hardenRawRepairLine(raw: string): Promise<ProtocolHardenerResult> {
    const result = this.hardener.processRawLine(raw);
    this.validationIssues.push(...result.issues);
    for (const feedback of result.repairFeedback ?? []) {
      await this.writeRepairFeedback(feedback);
    }
    return result;
  }

  private async acceptHardenedResult(
    result: Pick<ProtocolHardenerResult, 'acceptedLines' | 'outboundLines'>,
    options: { cancelQueuedRepairs: boolean },
  ): Promise<void> {
    this.acceptedLines.push(...result.acceptedLines);
    if (options.cancelQueuedRepairs) {
      this.cancelQueuedRepairsForAcceptedLines(result.acceptedLines);
    }
    for (const line of result.outboundLines) {
      await this.writeProtocolLine(line);
    }
  }

  private enqueueRepair(
    line: ProtocolLine | undefined,
    issue: ContractIssue,
    feedback: RepairFeedbackMetaValue | undefined,
  ): boolean {
    if (!this.repair.enabled || !line || line.op !== 'add' || !feedback?.retryable) return false;
    if (this.repairQueue.size >= this.repair.maxTargets && !this.repairQueue.has(line.path)) return false;
    this.repairQueue.set(line.path, { target: line.path, line, issue, feedback });
    this.repairStats.queued += 1;
    return true;
  }

  private cancelQueuedRepairsForAcceptedLines(lines: ProtocolLine[]): void {
    for (const line of lines) {
      if (line.op !== 'add') continue;
      if (!this.repairQueue.delete(line.path)) continue;
      this.repairStats.cancelled += 1;
    }
  }

  private async writeProtocolLine(line: ProtocolLine): Promise<void> {
    this.emittedLines.push(line);
    this.streamGraph.applyLine(line);
    await this.emit(line);
  }

  private async writeRepairFeedback(feedback: RepairFeedbackMetaValue): Promise<void> {
    await this.writeProtocolLine({ op: 'meta', path: '/repair-feedback', value: feedback });
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
      repairStats: this.repair.enabled ? this.repairStats : null,
    };
  }
}
