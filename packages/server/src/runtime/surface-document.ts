import * as ts from 'typescript';
import {
  contractIssue,
  createSurfaceDocumentBundleJsonSchema,
  normalizeSurfaceDocumentBundle,
  surfaceDocumentArtifactFromBundle,
  validateProtocolLine,
  validateSurfaceDocumentArtifact,
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
  missingArtifactIssue,
  nowMs,
  writeInitialOutputMode,
  type RuntimeContext,
} from './strategy.js';

export class SurfaceDocumentStrategy implements BundleRuntimeStrategy {
  readonly draftLabel = 'Composing Surface Document bundle';
  readonly receivedLabel = 'Received structured Surface Document bundle';
  readonly repairLabel = 'Repairing Surface Document bundle';
  readonly draftingHeartbeatMessages = [
    'Still composing Surface Document bundle',
    'Waiting for structured Surface Document bundle',
    'Keeping host contract bound while composing',
  ];
  readonly repairHeartbeatMessages = [
    'Still repairing Surface Document bundle',
    'Applying validation hints',
    'Waiting for repaired Surface Document bundle',
  ];

  async writeInitialOutputMode(ctx: RuntimeContext): Promise<void> {
    await writeInitialOutputMode(ctx);
  }

  async consume(ctx: RuntimeContext): Promise<void> {
    await runBundleStrategy(this, ctx);
  }

  missingArtifactIssue(): ContractIssue {
    return missingArtifactIssue();
  }

  schema(): Record<string, unknown> {
    return createSurfaceDocumentBundleJsonSchema();
  }

  missingProviderIssue(ctx: RuntimeContext): ContractIssue | null {
    if (typeof ctx.input.modelProvider.generateSurfaceDocumentBundle === 'function') return null;
    return contractIssue({
      source: 'protocol',
      severity: 'block',
      code: 'missing-surface-document-provider',
      message: 'Surface Document generation requires a model provider with generateSurfaceDocumentBundle()',
      path: '/runtime',
    });
  }

  generate(ctx: RuntimeContext, schema: Record<string, unknown>): Promise<unknown> {
    return ctx.input.modelProvider.generateSurfaceDocumentBundle({
      prompt: ctx.input.prompt,
      promptBlocks: ctx.systemContracts.promptBlocks,
      schema,
      signal: ctx.input.signal,
    });
  }

  canRepair(ctx: RuntimeContext): boolean {
    return Boolean(ctx.input.modelProvider.repairSurfaceDocumentBundle);
  }

  repair(ctx: RuntimeContext, request: BundleRepairRequest): Promise<unknown> {
    return ctx.input.modelProvider.repairSurfaceDocumentBundle!({
      prompt: ctx.input.prompt,
      promptBlocks: ctx.systemContracts.promptBlocks,
      schema: request.schema,
      previousBundle: request.previousBundle,
      issues: request.issues,
      hints: hintsForIssues(request.issues),
      attempt: request.attempt,
      signal: ctx.input.signal,
    });
  }

  repairOutputMode(attempt: number, issues: readonly ContractIssue[]): Record<string, unknown> {
    return {
      format: 'surface-document-bundle',
      schema: 'summon.surface-document-bundle/v1',
      repairAttempts: attempt,
      repairing: issues.map((issue) => issue.code),
    };
  }

  async validate(ctx: RuntimeContext, bundle: unknown, attempt: number): Promise<RuntimeValidationResult> {
    await ctx.writePhase('validating', 'Validating Surface Document bundle');
    const validationStartedAt = nowMs();
    const diagnostic = bundleDiagnostic(bundle, attempt);
    await ctx.writeProtocolLine({ op: 'meta', path: '/surface-document-bundle-diagnostic', value: diagnostic });
    const normalized = normalizeSurfaceDocumentBundle(bundle);
    const issues = [...normalized.issues];
    const artifact = normalized.bundle ? surfaceDocumentArtifactFromBundle(normalized.bundle) : null;
    if (artifact) {
      issues.push(...validateProtocolLine({
        op: 'artifact',
        path: '/artifact',
        value: artifact,
      }, ctx.systemContracts.validationContext));
      issues.push(...validateSurfaceDocumentArtifact(artifact));
      if (artifact.source['main.js']) {
        issues.push(...validateMainJsSyntax(artifact.source['main.js']));
      }
    }

    ctx.addValidationIssues(issues);
    const blocker = issues.find((issue) => issue.severity === 'block');
    const runtimeBlocker = issues.find((issue) => issue.severity === 'block' && isAlwaysBlockingRuntimeIssue(issue));
    const observeValidation = ctx.isObserveValidation();
    await ctx.writeTiming(
      'validating',
      blocker && (!observeValidation || runtimeBlocker) ? 'Blocked Surface Document bundle' : 'Validated Surface Document bundle',
      nowMs() - validationStartedAt,
    );

    const invalidBundle = (): ContractIssue => contractIssue({
      source: 'protocol',
      severity: 'block',
      code: 'invalid-surface-document-bundle',
      message: 'Model output did not produce a valid Surface Document bundle',
      path: '/bundle',
    });

    if (!artifact) {
      const invalid = invalidBundle();
      return { accepted: false, issues: issues.length > 0 ? issues : [invalid], blocker: blocker ?? invalid };
    }
    if (blocker && (!observeValidation || runtimeBlocker)) {
      await ctx.writeProtocolLine({
        op: 'meta',
        path: '/surface-document-blocked-source',
        value: { attempt, source: artifact.source },
      });
      return { accepted: false, issues, blocker: runtimeBlocker ?? blocker };
    }
    if (blocker && observeValidation) {
      for (const issue of issues.filter((item) => item.severity === 'block')) {
        await ctx.writeObservedValidationIssue(issue);
      }
    }

    const acceptedBundle = normalized.bundle;
    if (!acceptedBundle) return { accepted: false, issues, blocker: invalidBundle() };
    if (!ctx.input.playground) {
      await ctx.writeAcceptedLine({
        op: 'event',
        path: '/surface',
        value: { type: 'surface.status', status: 'rendering', text: 'Rendering accepted Surface Document artifact' },
      });
    }
    await ctx.writePhase('rendering', 'Rendering accepted artifact');
    const renderStartedAt = nowMs();
    const artifactLine: ProtocolLine = { op: 'artifact', path: '/artifact', value: artifact };
    await ctx.writeAcceptedLine(artifactLine);
    await ctx.writeTiming('rendering', 'Rendered accepted artifact', nowMs() - renderStartedAt);
    return { accepted: true, issues: [], blocker: null as never, acceptedSource: artifact.source };
  }
}

function validateMainJsSyntax(contents: string): ContractIssue[] {
  const path = 'main.js';
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
  const issues: ContractIssue[] = [];
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
      code: 'invalid-surface-document-source-syntax',
      message: `Surface Document source syntax error in ${location}: ${flattened}`,
      path: `/artifact/${path}`,
      hint: 'Fix the JavaScript syntax error before the surface-vm sandbox executes main.js.',
    }));
  }
  return issues;
}

function isAlwaysBlockingRuntimeIssue(issue: ContractIssue): boolean {
  return issue.code === 'invalid-surface-document-source-syntax';
}
