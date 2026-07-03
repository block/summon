import {
  hintsForContractIssue,
  type ContractIssue,
} from '@summon-internal/engine';
import type { RuntimeContext, RuntimeStrategy } from './strategy.js';
import { nowMs } from './strategy.js';

export interface RuntimeValidationResult {
  accepted: boolean;
  issues: ContractIssue[];
  blocker: ContractIssue;
  /** The accepted artifact source, present only when `accepted` is true. Lets
   * the loop run an optional design-fidelity review on the committed source. */
  acceptedSource?: Record<string, string>;
}

export interface BundleRepairRequest {
  schema: Record<string, unknown>;
  previousBundle: unknown;
  issues: ContractIssue[];
  attempt: number;
}

export interface BundleRuntimeStrategy extends RuntimeStrategy {
  readonly draftLabel: string;
  readonly receivedLabel: string;
  readonly repairLabel: string;
  readonly draftingHeartbeatMessages: string[];
  readonly repairHeartbeatMessages: string[];
  schema(): Record<string, unknown>;
  missingProviderIssue(ctx: RuntimeContext): ContractIssue | null;
  generate(ctx: RuntimeContext, schema: Record<string, unknown>): Promise<unknown>;
  canRepair(ctx: RuntimeContext): boolean;
  repair(ctx: RuntimeContext, request: BundleRepairRequest): Promise<unknown>;
  repairOutputMode(attempt: number, issues: readonly ContractIssue[]): Record<string, unknown>;
  validate(ctx: RuntimeContext, bundle: unknown, attempt: number): Promise<RuntimeValidationResult>;
}

export async function runBundleStrategy(
  strategy: BundleRuntimeStrategy,
  ctx: RuntimeContext,
): Promise<void> {
  if (!ctx.input.playground) {
    await ctx.emitServerPreviewScaffold();
  }
  const missingProviderIssue = strategy.missingProviderIssue(ctx);
  if (missingProviderIssue) {
    await ctx.blockGeneration(missingProviderIssue);
    return;
  }

  await ctx.writePhase('drafting', strategy.draftLabel);
  await ctx.writeTiming('drafting', strategy.draftLabel);
  const providerStartedAt = nowMs();
  const schema = strategy.schema();
  const initialBundle = await ctx.withStatusHeartbeat({
    status: 'drafting',
    messages: strategy.draftingHeartbeatMessages,
    run: () => strategy.generate(ctx, schema),
  });
  await ctx.writeTiming(
    'bundle-received',
    strategy.receivedLabel,
    nowMs() - providerStartedAt,
  );
  await runBundleRepairLoop(strategy, ctx, initialBundle, schema);
}

export function bundleDiagnostic(bundle: unknown, attempt: number): Record<string, unknown> {
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
    return {
      attempt,
      shape: Array.isArray(bundle) ? 'array' : bundle === null ? 'null' : typeof bundle,
      sourceKeys: [],
      entryKeys: [],
    };
  }
  const input = bundle as Record<string, unknown>;
  const source = input.source;
  const sourceKeys = source && typeof source === 'object' && !Array.isArray(source)
    ? Object.keys(source as Record<string, unknown>).sort()
    : [];
  const entryKeys = sourceKeys.filter((key) => key === 'main.ts' || key === 'main.js');
  const rootKeys = Object.keys(input).sort();
  const topLevelEntryKeys = rootKeys.filter((key) => key === 'main.ts' || key === 'main.js');
  const sourceShape = source === null
    ? 'null'
    : Array.isArray(source)
      ? 'array'
      : typeof source;
  const diagnostic: Record<string, unknown> = {
    attempt,
    shape: 'object',
    schema: typeof input.schema === 'string' ? input.schema : null,
    rootKeys,
    topLevelEntryKeys,
    hasSource: Boolean(source && typeof source === 'object' && !Array.isArray(source)),
    sourceShape,
    sourceKeys,
    entryKeys,
  };
  if (typeof source === 'string') {
    diagnostic.sourceStringPreview = previewString(source);
  }
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    diagnostic.sourceObjectKeys = Object.keys(source as Record<string, unknown>).sort();
  }
  return diagnostic;
}

async function runBundleRepairLoop(
  strategy: BundleRuntimeStrategy,
  ctx: RuntimeContext,
  initialBundle: unknown,
  schema: Record<string, unknown>,
): Promise<void> {
  let bundle: unknown = initialBundle;
  const maxRepairAttempts = Math.max(0, Math.floor(ctx.input.maxRepairAttempts ?? 1));
  // A fidelity pass reuses the same repair mechanism as validation repairs, but
  // its issues come from a design reviewer, not the runtime validators. Its
  // budget is separate so a design nudge never eats the safety-repair budget.
  const maxFidelityRepairs = ctx.input.fidelityReviewer
    ? Math.max(0, Math.floor(ctx.input.maxFidelityRepairs ?? 0))
    : 0;
  let fidelityRepairsUsed = 0;
  // Combined ceiling so a runaway loop can never exceed the two budgets summed.
  const hardCeiling = maxRepairAttempts + maxFidelityRepairs;

  for (let attempt = 0; attempt <= hardCeiling; attempt++) {
    if (ctx.isBlocked()) return;
    const result = await strategy.validate(ctx, bundle, attempt);

    if (result.accepted) {
      // Runtime/safety validation passed. Optionally run one design-fidelity
      // review on the committed source; block-severity design issues trigger a
      // repair pass (bounded by the fidelity budget). Any reviewer failure is
      // swallowed — a fidelity check must never fail an otherwise-valid run.
      if (!result.acceptedSource || fidelityRepairsUsed >= maxFidelityRepairs) return;
      let fidelityIssues: ContractIssue[] = [];
      try {
        fidelityIssues = await runFidelityReview(strategy, ctx, result.acceptedSource);
      } catch {
        fidelityIssues = [];
      }
      const blockers = fidelityIssues.filter((issue) => issue.severity === 'block');
      if (blockers.length === 0 || !strategy.canRepair(ctx)) return;

      fidelityRepairsUsed += 1;
      ctx.recordRepairAttempt();
      await ctx.writeProtocolLine({
        op: 'meta',
        path: '/model-output-mode',
        value: {
          ...strategy.repairOutputMode(attempt + 1, blockers),
          fidelityRepair: fidelityRepairsUsed,
        },
      });
      await ctx.writePhase('validating', 'Refining fingerprint fidelity');
      bundle = await ctx.withStatusHeartbeat({
        status: 'validating',
        messages: ['Refining fingerprint fidelity', 'Re-aligning to the design fingerprint'],
        run: () => strategy.repair(ctx, {
          schema,
          previousBundle: bundle,
          issues: blockers,
          attempt: attempt + 1,
        }),
      });
      continue;
    }

    if (attempt >= hardCeiling || !strategy.canRepair(ctx)) {
      await ctx.blockGeneration(result.blocker);
      return;
    }
    if (!isRepairable(result.issues, ctx.input.repairIssueCodes)) {
      await ctx.blockGeneration(result.blocker);
      return;
    }
    ctx.recordRepairAttempt();
    await ctx.writeProtocolLine({
      op: 'meta',
      path: '/model-output-mode',
      value: strategy.repairOutputMode(attempt + 1, result.issues),
    });
    await ctx.writePhase('validating', strategy.repairLabel);
    bundle = await ctx.withStatusHeartbeat({
      status: 'validating',
      messages: strategy.repairHeartbeatMessages,
      run: () => strategy.repair(ctx, {
        schema,
        previousBundle: bundle,
        issues: result.issues,
        attempt: attempt + 1,
      }),
    });
  }
}

/** Run the app-supplied design-fidelity reviewer against the accepted source
 * and surface its findings as ContractIssues. Emits a diagnostic line so the
 * fidelity verdict is visible in the stream. */
async function runFidelityReview(
  _strategy: BundleRuntimeStrategy,
  ctx: RuntimeContext,
  source: Record<string, string>,
): Promise<ContractIssue[]> {
  const reviewer = ctx.input.fidelityReviewer;
  if (!reviewer) return [];
  await ctx.writePhase('validating', 'Reviewing fingerprint fidelity');
  const issues = await reviewer(source);
  await ctx.writeProtocolLine({
    op: 'meta',
    path: '/fidelity-review',
    value: {
      schema: 'summon.fidelity-review/v1',
      issues: issues.length,
      blocking: issues.filter((issue) => issue.severity === 'block').length,
      codes: [...new Set(issues.map((issue) => issue.code))].sort(),
    },
  });
  ctx.addValidationIssues(issues.filter((issue) => issue.severity !== 'block'));
  return issues;
}

export function hintsForIssues(issues: readonly ContractIssue[]): string[] {
  return issues.flatMap((issue) => hintsForContractIssue(issue));
}

function isRepairable(issues: ContractIssue[], allowedCodes?: readonly string[]): boolean {
  const repairable = new Set([
    'invalid-surface-document-artifact',
    'invalid-surface-document-runtime',
    'invalid-surface-document-source',
    'invalid-surface-document-source-path',
    'invalid-surface-document-source-file',
    'missing-surface-document-file',
    'surface-document-source-limit',
    'surface-document-html-forbidden-tag',
    'surface-document-html-inline-handler',
    'surface-document-html-javascript-url',
    'surface-document-css-import',
    'surface-document-css-external-url',
    'surface-document-network-not-granted',
    'surface-document-unsupported-api',
    'invalid-surface-document-bundle',
    'invalid-surface-document-bundle-schema',
    'missing-surface-document-bundle-html',
    'missing-surface-document-bundle-css',
    'invalid-surface-document-source-syntax',
  ]);
  const allowed = allowedCodes && allowedCodes.length > 0 ? new Set(allowedCodes) : null;
  return issues.some((issue) => (
    issue.severity === 'block' &&
    repairable.has(issue.code) &&
    (!allowed || allowed.has(issue.code))
  ));
}

function previewString(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length > 500 ? `${compact.slice(0, 500)}...` : compact;
}
