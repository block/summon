import {
  StreamGraph,
  compileSurfacePolicy,
  surfaceContractViewFromCompiledPolicy,
  compileSystemContracts,
  createArrowBundleJsonSchema,
  normalizeArrowBundle,
  arrowArtifactFromBundle,
  validateArrowSurfaceArtifact,
  validateProtocolLine,
  hintsForContractIssue,
  contractIssue,
  type CompiledSurfacePolicy,
  type CompiledSystemContracts,
  type ContractIssue,
  type ProtocolLine,
  type SurfaceContractView,
  type SurfaceEventLine,
  type SurfacePlan,
  type SummonArrowBundle,
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
    await this.writeProtocolLine({
      op: 'meta',
      path: '/model-output-mode',
      value: {
        format: 'arrow-bundle',
        schema: 'summon.arrow-bundle/v1',
        repairAttempts: 0,
      },
    });
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
    await this.emitServerPreviewScaffold();
    await this.writePhase('drafting', 'Composing Arrow bundle');
    await this.writeTiming('drafting', 'Composing Arrow bundle');
    const providerStartedAt = nowMs();
    const schema = createArrowBundleJsonSchema();
    const bundle = await this.withStatusHeartbeat({
      status: 'drafting',
      messages: [
        'Still composing Arrow bundle',
        'Waiting for structured Arrow bundle',
        'Keeping host contract bound while composing',
      ],
      run: () => this.input.modelProvider.generateArrowBundle({
        prompt: this.input.prompt,
        promptBlocks: this.systemContracts.promptBlocks,
        schema,
        signal: this.input.signal,
      }),
    });
    await this.writeTiming(
      'bundle-received',
      'Received structured Arrow bundle',
      nowMs() - providerStartedAt,
    );
    await this.acceptBundleWithRepair(bundle, schema);
  }

  async finalize(): Promise<SurfaceGenerationSummary> {
    if (!this.blocked && !this.acceptedLines.some((line) => line.op === 'artifact')) {
      await this.blockGeneration(contractIssue({
        source: 'protocol',
        severity: 'block',
        code: 'missing-arrow-artifact',
        message: 'Generation completed without a valid Arrow artifact',
        path: '/artifact',
      }));
    }
    await this.writePhase('finalizing', 'Finalizing diagnostics');
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

  private async acceptBundleWithRepair(
    initialBundle: SummonArrowBundle,
    schema: Record<string, unknown>,
  ): Promise<void> {
    let bundle: SummonArrowBundle | null = initialBundle;
    const maxRepairAttempts = Math.max(0, Math.floor(this.input.maxRepairAttempts ?? 1));
    for (let attempt = 0; attempt <= maxRepairAttempts; attempt++) {
      if (this.blocked || !bundle) return;
      const result = await this.validateAndAcceptBundle(bundle);
      if (result.accepted) return;
      if (attempt >= maxRepairAttempts || !this.input.modelProvider.repairArrowBundle) {
        await this.blockGeneration(result.blocker);
        return;
      }
      if (!isRepairable(result.issues)) {
        await this.blockGeneration(result.blocker);
        return;
      }
      await this.writeProtocolLine({
        op: 'meta',
        path: '/model-output-mode',
        value: {
          format: 'arrow-bundle',
          schema: 'summon.arrow-bundle/v1',
          repairAttempts: attempt + 1,
          repairing: result.issues.map((issue) => issue.code),
        },
      });
      await this.writePhase('validating', 'Repairing Arrow bundle');
      bundle = await this.withStatusHeartbeat({
        status: 'validating',
        messages: [
          'Still repairing Arrow bundle',
          'Applying validation hints',
          'Waiting for repaired Arrow bundle',
        ],
        run: () => this.input.modelProvider.repairArrowBundle!({
          prompt: this.input.prompt,
          promptBlocks: this.systemContracts.promptBlocks,
          schema,
          previousBundle: bundle,
          issues: result.issues,
          hints: result.issues.flatMap((issue) => hintsForContractIssue(issue)),
          attempt: attempt + 1,
          signal: this.input.signal,
        }),
      });
    }
  }

  private async validateAndAcceptBundle(bundle: SummonArrowBundle): Promise<{
    accepted: boolean;
    issues: ContractIssue[];
    blocker: ContractIssue;
  }> {
    await this.writePhase('validating', 'Validating Arrow bundle');
    const validationStartedAt = nowMs();
    const normalized = normalizeArrowBundle(bundle);
    const issues = [...normalized.issues];
    const artifact = normalized.bundle ? arrowArtifactFromBundle(normalized.bundle) : null;
    if (artifact) {
      issues.push(...validateArrowSurfaceArtifact(artifact, {
        network: this.systemContracts.validationContext.surfacePlan?.network ?? 'none',
      }));
      issues.push(...validateProtocolLine({
        op: 'artifact',
        path: '/artifact',
        value: artifact,
      }, this.systemContracts.validationContext));
    }

    this.validationIssues.push(...issues);
    const blocker = issues.find((issue) => issue.severity === 'block');
    const observeValidation = this.isObserveValidation();
    await this.writeTiming(
      'validating',
      blocker && !observeValidation ? 'Blocked Arrow bundle' : 'Validated Arrow bundle',
      nowMs() - validationStartedAt,
    );
    if (!artifact) {
      return {
        accepted: false,
        issues: issues.length > 0 ? issues : [contractIssue({
          source: 'protocol',
          severity: 'block',
          code: 'invalid-arrow-bundle',
          message: 'Model output did not produce a valid Arrow bundle',
          path: '/bundle',
        })],
        blocker: blocker ?? contractIssue({
          source: 'protocol',
          severity: 'block',
          code: 'invalid-arrow-bundle',
          message: 'Model output did not produce a valid Arrow bundle',
          path: '/bundle',
        }),
      };
    }
    if (blocker && !observeValidation) {
      return {
        accepted: false,
        issues,
        blocker,
      };
    }
    if (blocker && observeValidation) {
      for (const issue of issues.filter((item) => item.severity === 'block')) {
        await this.writeObservedValidationIssue(issue);
      }
    }

    const acceptedBundle = normalized.bundle;
    if (!acceptedBundle) {
      return {
        accepted: false,
        issues,
        blocker: contractIssue({
          source: 'protocol',
          severity: 'block',
          code: 'invalid-arrow-bundle',
          message: 'Model output did not produce a valid Arrow bundle',
          path: '/bundle',
        }),
      };
    }
    for (const line of previewLinesFromBundle(acceptedBundle)) {
      this.acceptedLines.push(line);
      await this.writeProtocolLine(line);
    }
    await this.writePhase('rendering', 'Rendering accepted artifact');
    const renderStartedAt = nowMs();
    const artifactLine: ProtocolLine = { op: 'artifact', path: '/artifact', value: artifact };
    this.acceptedLines.push(artifactLine);
    await this.writeProtocolLine(artifactLine);
    await this.writeTiming('rendering', 'Rendered accepted artifact', nowMs() - renderStartedAt);
    return { accepted: true, issues: [], blocker: null as never };
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

  private isObserveValidation(): boolean {
    return this.input.validationMode === 'observe';
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

type ServerTimingPhase =
  | 'drafting'
  | 'bundle-received'
  | 'validating'
  | 'rendering'
  | 'complete';

function previewLinesFromBundle(bundle: SummonArrowBundle): SurfaceEventLine[] {
  const preview = bundle.preview;
  if (!preview) {
    return [{
      op: 'event',
      path: '/surface',
      value: {
        type: 'surface.status',
        status: 'rendering',
        text: 'Rendering accepted Arrow artifact',
      },
    }];
  }
  const lines: SurfaceEventLine[] = [{
    op: 'event',
    path: '/surface',
    value: {
      type: 'surface.start',
      id: 'main',
      kind: preview.kind,
      ...(preview.title ? { title: preview.title } : {}),
    },
  }];
  for (const region of preview.regions ?? []) {
    lines.push({
      op: 'event',
      path: '/surface',
      value: {
        type: 'region.add',
        id: region.id,
        parent: 'main',
        role: region.role,
        ...(region.label ? { label: region.label } : {}),
      },
    });
    if (region.summary) {
      lines.push({
        op: 'event',
        path: '/surface',
        value: {
          type: 'node.add',
          id: `${region.id}-summary`,
          parent: region.id,
          kind: 'text',
          props: { text: region.summary },
        },
      });
    }
  }
  return lines;
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

function isRepairable(issues: ContractIssue[]): boolean {
  const repairable = new Set([
    'invalid-arrow-entry',
    'invalid-arrow-source',
    'invalid-arrow-source-path',
    'arrow-source-limit',
    'arrow-network-not-granted',
    'unsupported-arrow-idl-binding',
    'unsupported-arrow-open-tag-expression',
    'unsupported-legacy-data-summon-binding',
    'invalid-arrow-network',
    'invalid-arrow-bundle',
    'invalid-arrow-bundle-schema',
    'missing-arrow-bundle-source',
    'invalid-arrow-bundle-entry',
    'arrow-bundle-extra-file',
    'invalid-arrow-bundle-source-file',
  ]);
  return issues.some((issue) => issue.severity === 'block' && repairable.has(issue.code));
}

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
