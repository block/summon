import * as ts from 'typescript';
import {
  contractIssue,
  createDomjsBundleJsonSchema,
  domjsArtifactFromBundle,
  normalizeDomjsBundle,
  runtimeProfile,
  validateProtocolLine,
  type ContractIssue,
  type ProtocolLine,
} from '@summon-internal/engine';
import {
  bundleDiagnostic,
  hintsForIssues,
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

// domjs runtime: model authors imperative HTML/JS, executed in the surface-vm
// capability sandbox. Structurally mirrors ArrowControlStrategy; the differences
// are the bundle/validator (domjs) and the JS-only syntax check.
export class DomjsControlStrategy implements BundleRuntimeStrategy {
  readonly profile = runtimeProfile('domjs-control');
  readonly draftLabel = 'Composing HTML/JS surface';
  readonly receivedLabel = 'Received structured domjs bundle';
  readonly repairLabel = 'Repairing HTML/JS surface';
  readonly draftingHeartbeatMessages = [
    'Still composing HTML/JS surface',
    'Waiting for structured domjs bundle',
    'Keeping host contract bound while composing',
  ];
  readonly repairHeartbeatMessages = [
    'Still repairing HTML/JS surface',
    'Applying validation hints',
    'Waiting for repaired domjs bundle',
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
    return createDomjsBundleJsonSchema();
  }

  missingProviderIssue(ctx: RuntimeContext): ContractIssue | null {
    if (ctx.input.modelProvider.generateDomjsBundle) return null;
    return contractIssue({
      source: 'protocol',
      severity: 'block',
      code: 'missing-domjs-provider',
      message: `Experimental runtime "${this.profile.runtime}" requires a model provider with generateDomjsBundle()`,
      path: '/runtime',
    });
  }

  generate(ctx: RuntimeContext, schema: Record<string, unknown>): Promise<unknown> {
    return ctx.input.modelProvider.generateDomjsBundle!({
      prompt: ctx.input.prompt,
      promptBlocks: ctx.systemContracts.promptBlocks,
      schema,
      signal: ctx.input.signal,
    });
  }

  canRepair(ctx: RuntimeContext): boolean {
    return Boolean(ctx.input.modelProvider.repairDomjsBundle);
  }

  repair(ctx: RuntimeContext, request: BundleRepairRequest): Promise<unknown> {
    return ctx.input.modelProvider.repairDomjsBundle!({
      prompt: ctx.input.prompt,
      promptBlocks: ctx.systemContracts.promptBlocks,
      schema: request.schema,
      previousBundle: request.previousBundle,
      issues: request.issues,
      hints: hintsForIssues(request.issues, 'domjs-control'),
      attempt: request.attempt,
      signal: ctx.input.signal,
    });
  }

  repairOutputMode(attempt: number, issues: readonly ContractIssue[]): Record<string, unknown> {
    return {
      format: 'domjs-bundle',
      schema: 'summon.domjs-bundle/v1',
      repairAttempts: attempt,
      repairing: issues.map((issue) => issue.code),
    };
  }

  async validate(ctx: RuntimeContext, bundle: unknown, attempt: number): Promise<RuntimeValidationResult> {
    await ctx.writePhase('validating', 'Validating HTML/JS surface');
    const validationStartedAt = nowMs();
    const diagnostic = bundleDiagnostic(bundle, attempt);
    await ctx.writeProtocolLine({ op: 'meta', path: '/domjs-bundle-diagnostic', value: diagnostic });
    const normalized = normalizeDomjsBundle(bundle);
    const issues = [...normalized.issues];
    const artifact = normalized.bundle ? domjsArtifactFromBundle(normalized.bundle) : null;
    if (artifact) {
      issues.push(...validateProtocolLine({
        op: 'artifact',
        path: '/artifact',
        value: artifact,
      }, ctx.systemContracts.validationContext));
      issues.push(...validateDomjsSourceSyntax(artifact.source));
    }

    ctx.addValidationIssues(issues);
    const blocker = issues.find((issue) => issue.severity === 'block');
    const runtimeBlocker = issues.find((issue) => issue.severity === 'block' && isAlwaysBlockingRuntimeIssue(issue));
    const observeValidation = ctx.isObserveValidation();
    await ctx.writeTiming(
      'validating',
      blocker && (!observeValidation || runtimeBlocker) ? 'Blocked domjs bundle' : 'Validated domjs bundle',
      nowMs() - validationStartedAt,
    );

    const invalidBundle = (): ContractIssue => contractIssue({
      source: 'protocol',
      severity: 'block',
      code: 'invalid-domjs-bundle',
      message: 'Model output did not produce a valid domjs bundle',
      path: '/bundle',
    });

    if (!artifact) {
      const invalid = invalidBundle();
      return { accepted: false, issues: issues.length > 0 ? issues : [invalid], blocker: blocker ?? invalid };
    }
    if (blocker && (!observeValidation || runtimeBlocker)) {
      return { accepted: false, issues, blocker: runtimeBlocker ?? blocker };
    }
    if (blocker && observeValidation) {
      for (const issue of issues.filter((item) => item.severity === 'block')) {
        await ctx.writeObservedValidationIssue(issue);
      }
    }

    const acceptedBundle = normalized.bundle;
    if (!acceptedBundle) {
      return { accepted: false, issues, blocker: invalidBundle() };
    }
    if (!ctx.input.playground) {
      // domjs bundles carry no preview; the surface-vm render tree drives the
      // live preview. Emit a single rendering-status line.
      await ctx.writeAcceptedLine({
        op: 'event',
        path: '/surface',
        value: { type: 'surface.status', status: 'rendering', text: 'Rendering accepted domjs artifact' },
      });
    }
    await ctx.writePhase('rendering', 'Rendering accepted artifact');
    const renderStartedAt = nowMs();
    const artifactLine: ProtocolLine = { op: 'artifact', path: '/artifact', value: artifact };
    await ctx.writeAcceptedLine(artifactLine);
    await ctx.writeTiming('rendering', 'Rendered accepted artifact', nowMs() - renderStartedAt);
    return { accepted: true, issues: [], blocker: null as never };
  }
}

function validateDomjsSourceSyntax(source: Record<string, string>): ContractIssue[] {
  const issues: ContractIssue[] = [];
  for (const [path, contents] of Object.entries(source)) {
    if (!path.endsWith('.js')) continue;
    const diagnostics = ts.transpileModule(contents, {
      fileName: path,
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        isolatedModules: true,
        allowJs: true,
        noEmitOnError: false,
      },
    }).diagnostics ?? [];
    for (const diagnostic of diagnostics) {
      if (diagnostic.category !== ts.DiagnosticCategory.Error) continue;
      const position = diagnostic.file && diagnostic.start !== undefined
        ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
        : null;
      const location = position ? `${path}:${position.line + 1}:${position.character + 1}` : path;
      const flattened = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
      issues.push(contractIssue({
        source: 'protocol',
        severity: 'block',
        code: 'invalid-domjs-source-syntax',
        message: `domjs source syntax error in ${location}: ${flattened}`,
        path: `/artifact/${path}`,
        hint: 'Fix the JavaScript syntax error before the surface-vm sandbox executes this entry file.',
      }));
    }
  }
  return issues;
}

function isAlwaysBlockingRuntimeIssue(issue: ContractIssue): boolean {
  return issue.code === 'invalid-domjs-source-syntax';
}
