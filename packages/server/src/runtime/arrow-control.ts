import * as ts from 'typescript';
import {
  arrowArtifactFromBundle,
  contractIssue,
  createArrowBundleJsonSchema,
  normalizeArrowBundle,
  runtimeProfile,
  validateProtocolLine,
  type ContractIssue,
  type ProtocolLine,
} from '@summon-internal/engine';
import {
  bundleDiagnostic,
  hintsForIssues,
  previewLinesFromBundle,
  runBundleStrategy,
  type BundleRepairRequest,
  type BundleRuntimeStrategy,
  type RuntimeValidationResult,
} from './bundle.js';
import {
  missingArtifactIssueForProfile,
  nowMs,
  writeInitialOutputMode,
  type RuntimeContext,
} from './strategy.js';

export class ArrowControlStrategy implements BundleRuntimeStrategy {
  readonly profile = runtimeProfile('arrow-control');
  readonly draftLabel = 'Composing Arrow bundle';
  readonly receivedLabel = 'Received structured Arrow bundle';
  readonly repairLabel = 'Repairing Arrow bundle';
  readonly draftingHeartbeatMessages = [
    'Still composing Arrow bundle',
    'Waiting for structured Arrow bundle',
    'Keeping host contract bound while composing',
  ];
  readonly repairHeartbeatMessages = [
    'Still repairing Arrow bundle',
    'Applying validation hints',
    'Waiting for repaired Arrow bundle',
  ];

  async writeInitialOutputMode(ctx: RuntimeContext): Promise<void> {
    await writeInitialOutputMode(ctx);
  }

  async consume(ctx: RuntimeContext): Promise<void> {
    await runBundleStrategy(this, ctx);
  }

  missingArtifactIssue(): ContractIssue {
    return missingArtifactIssueForProfile(this.profile);
  }

  schema(): Record<string, unknown> {
    return createArrowBundleJsonSchema();
  }

  missingProviderIssue(): ContractIssue | null {
    return null;
  }

  generate(ctx: RuntimeContext, schema: Record<string, unknown>): Promise<unknown> {
    return ctx.input.modelProvider.generateArrowBundle({
      prompt: ctx.input.prompt,
      promptBlocks: ctx.systemContracts.promptBlocks,
      schema,
      signal: ctx.input.signal,
    });
  }

  canRepair(ctx: RuntimeContext): boolean {
    return Boolean(ctx.input.modelProvider.repairArrowBundle);
  }

  repair(ctx: RuntimeContext, request: BundleRepairRequest): Promise<unknown> {
    return ctx.input.modelProvider.repairArrowBundle!({
      prompt: ctx.input.prompt,
      promptBlocks: ctx.systemContracts.promptBlocks,
      schema: request.schema,
      previousBundle: request.previousBundle,
      issues: request.issues,
      hints: hintsForIssues(request.issues, 'arrow-control'),
      attempt: request.attempt,
      signal: ctx.input.signal,
    });
  }

  repairOutputMode(attempt: number, issues: readonly ContractIssue[]): Record<string, unknown> {
    return {
      format: 'arrow-bundle',
      schema: 'summon.arrow-bundle/v1',
      repairAttempts: attempt,
      repairing: issues.map((issue) => issue.code),
    };
  }

  async validate(ctx: RuntimeContext, bundle: unknown, attempt: number): Promise<RuntimeValidationResult> {
    await ctx.writePhase('validating', 'Validating Arrow bundle');
    const validationStartedAt = nowMs();
    const diagnostic = bundleDiagnostic(bundle, attempt);
    await ctx.writeProtocolLine({ op: 'meta', path: '/arrow-bundle-diagnostic', value: diagnostic });
    const normalized = normalizeArrowBundle(bundle);
    const issues = [...normalized.issues];
    const artifact = normalized.bundle ? arrowArtifactFromBundle(normalized.bundle) : null;
    if (artifact) {
      issues.push(...validateProtocolLine({
        op: 'artifact',
        path: '/artifact',
        value: artifact,
      }, ctx.systemContracts.validationContext));
      issues.push(...validateArrowSourceSyntax(artifact.source));
    }

    ctx.addValidationIssues(issues);
    const blocker = issues.find((issue) => issue.severity === 'block');
    const runtimeBlocker = issues.find((issue) => issue.severity === 'block' && isAlwaysBlockingRuntimeIssue(issue));
    const observeValidation = ctx.isObserveValidation();
    await ctx.writeTiming(
      'validating',
      blocker && (!observeValidation || runtimeBlocker) ? 'Blocked Arrow bundle' : 'Validated Arrow bundle',
      nowMs() - validationStartedAt,
    );
    if (!artifact) {
      const invalidBundleIssue = contractIssue({
        source: 'protocol',
        severity: 'block',
        code: 'invalid-arrow-bundle',
        message: 'Model output did not produce a valid Arrow bundle',
        path: '/bundle',
      });
      return {
        accepted: false,
        issues: issues.length > 0 ? issues : [invalidBundleIssue],
        blocker: blocker ?? invalidBundleIssue,
      };
    }
    if (blocker && (!observeValidation || runtimeBlocker)) {
      return {
        accepted: false,
        issues,
        blocker: runtimeBlocker ?? blocker,
      };
    }
    if (blocker && observeValidation) {
      for (const issue of issues.filter((item) => item.severity === 'block')) {
        await ctx.writeObservedValidationIssue(issue);
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
    if (!ctx.input.playground) {
      for (const line of previewLinesFromBundle(acceptedBundle, 'Arrow')) {
        await ctx.writeAcceptedLine(line);
      }
    }
    await ctx.writePhase('rendering', 'Rendering accepted artifact');
    const renderStartedAt = nowMs();
    const artifactLine: ProtocolLine = { op: 'artifact', path: '/artifact', value: artifact };
    await ctx.writeAcceptedLine(artifactLine);
    await ctx.writeTiming('rendering', 'Rendered accepted artifact', nowMs() - renderStartedAt);
    return { accepted: true, issues: [], blocker: null as never };
  }
}

function validateArrowSourceSyntax(source: Record<string, string>): ContractIssue[] {
  const issues: ContractIssue[] = [];
  for (const [path, contents] of Object.entries(source)) {
    if (!path.endsWith('.ts') && !path.endsWith('.js') && !path.endsWith('.mjs')) continue;
    const diagnostics = ts.transpileModule(contents, {
      fileName: path,
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        isolatedModules: true,
        noEmitOnError: false,
      },
    }).diagnostics ?? [];
    for (const diagnostic of diagnostics) {
      if (diagnostic.category !== ts.DiagnosticCategory.Error) continue;
      const position = diagnostic.file && diagnostic.start !== undefined
        ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
        : null;
      const location = position
        ? `${path}:${position.line + 1}:${position.character + 1}`
        : path;
      const excerpt = sourceExcerpt(contents, position?.line ?? null);
      const flattened = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
      issues.push(contractIssue({
        source: 'protocol',
        severity: 'block',
        code: 'invalid-arrow-source-syntax',
        message: `Arrow source syntax error in ${location}: ${flattened}${excerpt ? `\n\nSource excerpt:\n${excerpt}` : ''}`,
        path: `/artifact/${path}`,
        hint: 'Fix the TypeScript/JavaScript syntax error before the Arrow sandbox compiles this entry file.',
      }));
    }
  }
  return issues;
}

function sourceExcerpt(source: string, zeroBasedLine: number | null, radius = 3): string {
  if (zeroBasedLine === null) return '';
  const lines = source.split(/\r?\n/);
  const start = Math.max(0, zeroBasedLine - radius);
  const end = Math.min(lines.length, zeroBasedLine + radius + 1);
  const lineNumberWidth = String(end).length;
  return lines.slice(start, end).map((line, index) => {
    const lineNumber = start + index + 1;
    const marker = lineNumber === zeroBasedLine + 1 ? '>' : ' ';
    return `${marker} ${String(lineNumber).padStart(lineNumberWidth, ' ')} | ${line}`;
  }).join('\n');
}

function isAlwaysBlockingRuntimeIssue(issue: ContractIssue): boolean {
  return issue.code === 'invalid-arrow-source-syntax';
}
