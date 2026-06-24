import {
  hintsForContractIssue,
  type ContractIssue,
  type ProtocolLine,
  type SurfaceEventLine,
  type SummonArrowBundle,
  type SummonHtmlBundle,
  type SummonOutputRuntime,
} from '@summon-internal/engine';
import type { RuntimeContext, RuntimeStrategy } from './strategy.js';
import { nowMs } from './strategy.js';

export interface RuntimeValidationResult {
  accepted: boolean;
  issues: ContractIssue[];
  blocker: ContractIssue;
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

export function previewLinesFromBundle(
  bundle: SummonArrowBundle | SummonHtmlBundle,
  runtimeLabel: 'Arrow' | 'HTML',
): SurfaceEventLine[] {
  const preview = bundle.preview;
  if (!preview) {
    return [{
      op: 'event',
      path: '/surface',
      value: {
        type: 'surface.status',
        status: 'rendering',
        text: `Rendering accepted ${runtimeLabel} artifact`,
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

async function runBundleRepairLoop(
  strategy: BundleRuntimeStrategy,
  ctx: RuntimeContext,
  initialBundle: unknown,
  schema: Record<string, unknown>,
): Promise<void> {
  let bundle: unknown = initialBundle;
  const maxRepairAttempts = Math.max(0, Math.floor(ctx.input.maxRepairAttempts ?? 1));
  for (let attempt = 0; attempt <= maxRepairAttempts; attempt++) {
    if (ctx.isBlocked()) return;
    const result = await strategy.validate(ctx, bundle, attempt);
    if (result.accepted) return;
    if (attempt >= maxRepairAttempts || !strategy.canRepair(ctx)) {
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

export function hintsForIssues(
  issues: readonly ContractIssue[],
  outputRuntime: SummonOutputRuntime,
): string[] {
  return issues.flatMap((issue) => hintsForContractIssue(issue, { outputRuntime }));
}

function isRepairable(issues: ContractIssue[], allowedCodes?: readonly string[]): boolean {
  const repairable = new Set([
    'invalid-arrow-entry',
    'invalid-arrow-source',
    'invalid-arrow-source-path',
    'arrow-source-limit',
    'arrow-network-not-granted',
    'unsupported-arrow-idl-binding',
    'unsupported-arrow-open-tag-expression',
    'unsupported-legacy-data-summon-binding',
    'invalid-arrow-source-syntax',
    'invalid-arrow-network',
    'invalid-arrow-bundle',
    'invalid-arrow-bundle-schema',
    'missing-arrow-bundle-source',
    'invalid-arrow-bundle-entry',
    'arrow-bundle-extra-file',
    'invalid-arrow-bundle-source-file',
    'invalid-html-bundle',
    'invalid-html-bundle-schema',
    'missing-html-bundle-source',
    'missing-html-body',
    'html-bundle-extra-file',
    'invalid-html-bundle-source-file',
    'html-source-limit',
    'html-css-limit',
    'invalid-css',
    'invalid-html-fragment',
    'unsafe-tag',
    'static-script',
    'inline-handler',
    'external-url',
    'unsupported-html-attribute',
    'unsupported-legacy-data-summon-binding',
    'html-script-not-enabled',
    'unsafe-html-script',
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
