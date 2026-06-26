import {
  contractIssue,
  createHtmlBundleJsonSchema,
  htmlArtifactFromBundle,
  normalizeHtmlBundle,
  runtimeProfile,
  validateProtocolLine,
  type ContractIssue,
  type ProtocolLine,
  type SummonOutputRuntime,
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

type HtmlBundleRuntime = Extract<SummonOutputRuntime, 'html-static'>;

export class HtmlBundleStrategy implements BundleRuntimeStrategy {
  readonly profile;
  readonly allowScript = false;
  readonly draftLabel = 'Composing HTML bundle';
  readonly receivedLabel = 'Received structured HTML bundle';
  readonly repairLabel = 'Repairing HTML bundle';
  readonly draftingHeartbeatMessages = [
    'Still composing HTML bundle',
    'Waiting for structured HTML bundle',
    'Keeping host contract bound while composing',
  ];
  readonly repairHeartbeatMessages = [
    'Still repairing HTML bundle',
    'Applying validation hints',
    'Waiting for repaired HTML bundle',
  ];

  constructor(runtime: HtmlBundleRuntime) {
    this.profile = runtimeProfile(runtime);
  }

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
    return createHtmlBundleJsonSchema({ allowScript: this.allowScript });
  }

  missingProviderIssue(ctx: RuntimeContext): ContractIssue | null {
    if (ctx.input.modelProvider.generateHtmlBundle) return null;
    return contractIssue({
      source: 'system',
      severity: 'block',
      code: 'missing-html-provider',
      message: `Experimental runtime "${this.profile.runtime}" requires a model provider with generateHtmlBundle()`,
      path: '/model-provider',
    });
  }

  generate(ctx: RuntimeContext, schema: Record<string, unknown>): Promise<unknown> {
    return ctx.input.modelProvider.generateHtmlBundle!({
      prompt: ctx.input.prompt,
      promptBlocks: ctx.systemContracts.promptBlocks,
      schema,
      runtime: this.profile.runtime,
      allowScript: this.allowScript,
      signal: ctx.input.signal,
    });
  }

  canRepair(ctx: RuntimeContext): boolean {
    return Boolean(ctx.input.modelProvider.repairHtmlBundle);
  }

  repair(ctx: RuntimeContext, request: BundleRepairRequest): Promise<unknown> {
    return ctx.input.modelProvider.repairHtmlBundle!({
      prompt: ctx.input.prompt,
      promptBlocks: ctx.systemContracts.promptBlocks,
      schema: request.schema,
      runtime: this.profile.runtime,
      allowScript: this.allowScript,
      previousBundle: request.previousBundle,
      issues: request.issues,
      hints: hintsForIssues(request.issues, this.profile.runtime),
      attempt: request.attempt,
      signal: ctx.input.signal,
    });
  }

  repairOutputMode(attempt: number, issues: readonly ContractIssue[]): Record<string, unknown> {
    return {
      format: 'html-bundle',
      schema: 'summon.html-bundle/v0',
      runtime: this.profile.runtime,
      repairAttempts: attempt,
      repairing: issues.map((issue) => issue.code),
    };
  }

  validate(ctx: RuntimeContext, bundle: unknown, attempt: number): Promise<RuntimeValidationResult> {
    return validateAndAcceptHtmlBundle(ctx, bundle, attempt, this.allowScript);
  }
}

export async function validateAndAcceptHtmlBundle(
  ctx: RuntimeContext,
  bundle: unknown,
  attempt: number,
  allowScript: boolean,
  options: { strict?: boolean } = {},
): Promise<RuntimeValidationResult> {
  await ctx.writePhase('validating', 'Validating HTML bundle');
  const validationStartedAt = nowMs();
  const diagnostic = bundleDiagnostic(bundle, attempt);
  await ctx.writeProtocolLine({ op: 'meta', path: '/html-bundle-diagnostic', value: diagnostic });
  const normalized = normalizeHtmlBundle(bundle);
  const issues = [...normalized.issues];
  const artifact = normalized.bundle ? htmlArtifactFromBundle(normalized.bundle) : null;
  if (artifact) {
    issues.push(...validateProtocolLine({
      op: 'artifact',
      path: '/artifact',
      value: artifact,
    }, {
      ...ctx.systemContracts.validationContext,
      experimentalHtmlScript: allowScript,
    }));
  }

  ctx.addValidationIssues(issues);
  const blocker = issues.find((issue) => issue.severity === 'block');
  const observeValidation = !options.strict && ctx.isObserveValidation();
  await ctx.writeTiming(
    'validating',
    blocker && !observeValidation ? 'Blocked HTML bundle' : 'Validated HTML bundle',
    nowMs() - validationStartedAt,
  );
  if (!artifact) {
    const invalidBundleIssue = contractIssue({
      source: 'protocol',
      severity: 'block',
      code: 'invalid-html-bundle',
      message: 'Model output did not produce a valid HTML bundle',
      path: '/bundle',
    });
    return {
      accepted: false,
      issues: issues.length > 0 ? issues : [invalidBundleIssue],
      blocker: blocker ?? invalidBundleIssue,
    };
  }
  if (blocker && !observeValidation) {
    return { accepted: false, issues, blocker };
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
        code: 'invalid-html-bundle',
        message: 'Model output did not produce a valid HTML bundle',
        path: '/bundle',
      }),
    };
  }
  if (!ctx.input.playground) {
    for (const line of previewLinesFromBundle(acceptedBundle, 'HTML')) {
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
