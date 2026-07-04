import express from 'express';
import cors from 'cors';
import {
  compileSurfacePolicy,
  type ToolPack,
  type ProtocolLine,
  type SurfaceStatus,
  type SummonLayout,
  type SurfacePlan,
  type SurfacePolicy,
  type SurfaceScale,
  type SurfaceSize,
  type SurfaceComplexity,
  type ContractPromptBlock,
  type ContractIssue,
} from '@anarchitecture/summon/engine';
import {
  planAgentSurface,
  runSurfaceGeneration,
  summarizeContractIssues,
  type AgentSurfacePlanResult,
  type SurfaceGenerationSummary,
} from '@anarchitecture/summon-server';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerDemoRoutes } from './demo-routes.js';
import {
  buildGhostReceipt,
  ghostContextMeta,
  ghostTokenSourceMeta,
  parseGhostRequest,
  parseGhostRoots,
  prepareGhostSurfacePrompt,
  publicGhostRoots,
  resolveCatalogGhostGenerationContext,
  resolveGhostGenerationContext,
  type ConjurorStrategyOption,
  type ResolvedGhostSteer,
} from './ghost-adapter.js';
import { evaluateConformance, emptyConformanceVerdict, type ConformanceVerdict } from './ghost-conformance.js';
import {
  loadFingerprintCatalog,
  parseFingerprintRequest,
  publicFingerprints,
} from './fingerprint-catalog.js';
import { parseToolPack } from './tool-pack.js';
import {
  createModelProviderRegistry,
  type ModelProfileKey,
  type ProviderUsageSnapshot,
} from './model-providers.js';

// Minimal .env loader — picks up apps/server/.env without pulling in dotenv.
try {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
  const raw = readFileSync(envPath, 'utf-8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, '$1');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
} catch {
  // No .env — fall through to process.env.
}

const PORT = Number(process.env.PORT) || 3001;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
const modelProviders = createModelProviderRegistry(process.env);
const defaultModelProvider = modelProviders.defaultProvider;

if (!defaultModelProvider) {
  console.error(
    '[summon-server] no model provider is configured. Copy apps/server/.env.example to .env and set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY.'
  );
  process.exit(1);
}
if (!defaultModelProvider.configured) {
  console.error(
    `[summon-server] SUMMON_MODEL_PROVIDER=${defaultModelProvider.id} is selected but not configured. Set ${defaultModelProvider.missingEnv}.`
  );
  process.exit(1);
}

const ghostRoots = parseGhostRoots(process.env.SUMMON_GHOST_ROOTS);
const fingerprintCatalog = loadFingerprintCatalog();

// Playground is a dev-only convenience (relaxed validation, no agent ward),
// NOT part of the governed generation path. It is enabled by default for local
// dev but can be fenced off with SUMMON_ENABLE_PLAYGROUND=0 (e.g. in any hosted
// or governed deployment), in which case `playground: true` requests fall back
// to a normal governed run.
const PLAYGROUND_ENABLED = process.env.SUMMON_ENABLE_PLAYGROUND !== '0';

console.log(
  '[summon-server] Ghost fingerprint mode enabled; directions are not used for generation'
);
console.log(
  `[summon-server] loaded ${fingerprintCatalog.entries.length} fingerprint(s): ${fingerprintCatalog.entries.map((entry) => entry.id).join(', ') || '(none)'}`
);
console.log(
  `[summon-server] loaded ${ghostRoots.size} Ghost root(s): ${[...ghostRoots.keys()].join(', ') || '(none)'}`
);
console.log(
  `[summon-server] model providers: ${modelProviders.info().map((provider) => `${provider.id}${provider.configured ? '*' : ''}=${provider.model}`).join(', ')}; default=${defaultModelProvider.id}`
);

const app = express();
app.use(express.json({ limit: '512kb' }));
app.use(cors({ origin: ALLOWED_ORIGIN }));

const LAYOUT_ID_RE = /^[a-z][a-z0-9-]{0,79}$/;
const SECTION_ID_RE = /^[a-z][a-z0-9-]{0,19}$/;

function parseSummonLayout(raw: unknown): { layout: SummonLayout | null; error?: string } {
  if (raw === undefined || raw === null) return { layout: null };
  if (!raw || typeof raw !== 'object') {
    return { layout: null, error: 'layout must be an object' };
  }

  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== 'string' || !LAYOUT_ID_RE.test(obj.id)) {
    return {
      layout: null,
      error: 'layout.id must be lowercase kebab-case, start with a letter, and be 1-80 chars',
    };
  }
  if (!Array.isArray(obj.slots)) {
    return { layout: null, error: 'layout.slots must be an array' };
  }
  if (obj.slots.length < 1 || obj.slots.length > 5) {
    return { layout: null, error: 'layout.slots must contain 1-5 slots' };
  }

  const seen = new Set<string>();
  const slots: SummonLayout['slots'] = [];
  for (const rawSlot of obj.slots) {
    if (!rawSlot || typeof rawSlot !== 'object') {
      return { layout: null, error: 'each layout slot must be an object' };
    }
    const slot = rawSlot as Record<string, unknown>;
    if (typeof slot.id !== 'string' || !SECTION_ID_RE.test(slot.id)) {
      return {
        layout: null,
        error: 'layout slot ids must be lowercase kebab-case, start with a letter, and be 1-20 chars',
      };
    }
    if (seen.has(slot.id)) {
      return { layout: null, error: `duplicate layout slot "${slot.id}"` };
    }
    const purpose = typeof slot.purpose === 'string' ? slot.purpose.trim() : '';
    if (!purpose) {
      return { layout: null, error: `layout slot "${slot.id}" must include a purpose` };
    }
    seen.add(slot.id);
    slots.push({ id: slot.id, purpose: purpose.slice(0, 400) });
  }

  return { layout: { id: obj.id, slots } };
}

const SURFACE_SIZE_VALUES: readonly SurfaceSize[] = ['small', 'medium', 'large'];
const SURFACE_COMPLEXITY_VALUES: readonly SurfaceComplexity[] = ['simple', 'moderate', 'rich'];

function parseSurfaceScale(raw: unknown): { scale: SurfaceScale | null; error?: string } {
  if (raw === undefined || raw === null) return { scale: null };
  if (typeof raw !== 'object') {
    return { scale: null, error: 'scale must be an object' };
  }
  const obj = raw as Record<string, unknown>;
  const scale: SurfaceScale = {};
  if (obj.size !== undefined) {
    if (!SURFACE_SIZE_VALUES.includes(obj.size as SurfaceSize)) {
      return { scale: null, error: 'scale.size must be small, medium, or large' };
    }
    scale.size = obj.size as SurfaceSize;
  }
  if (obj.complexity !== undefined) {
    if (!SURFACE_COMPLEXITY_VALUES.includes(obj.complexity as SurfaceComplexity)) {
      return { scale: null, error: 'scale.complexity must be simple, moderate, or rich' };
    }
    scale.complexity = obj.complexity as SurfaceComplexity;
  }
  if (scale.size === undefined && scale.complexity === undefined) {
    return { scale: null };
  }
  return { scale };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function readEnvInt(name: string): number | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readConjurorOptions(env: NodeJS.ProcessEnv): {
  strategy?: ConjurorStrategyOption;
  fullPullNodeLimit?: number;
  maxNodes?: number;
  maxChars?: number;
} {
  if (env.SUMMON_CONJUROR === '0') return { strategy: 'full-corpus' };
  const rawStrategy = env.SUMMON_CONJUROR_STRATEGY;
  const strategy = rawStrategy === 'auto' || rawStrategy === 'full-corpus' || rawStrategy === 'compiled'
    ? rawStrategy
    : undefined;
  const fullPullNodeLimit = readEnvInt('SUMMON_CONJUROR_FULL_PULL_NODE_LIMIT');
  const maxNodes = readEnvInt('SUMMON_CONJUROR_MAX_NODES');
  const maxChars = readEnvInt('SUMMON_CONJUROR_MAX_CHARS');
  return {
    ...(strategy ? { strategy } : {}),
    ...(fullPullNodeLimit !== undefined ? { fullPullNodeLimit } : {}),
    ...(maxNodes !== undefined ? { maxNodes } : {}),
    ...(maxChars !== undefined ? { maxChars } : {}),
  };
}

// Simple concurrency cap for /api/generate — protects against a runaway batch
// page firing too many parallel streams at the selected model API.
const MAX_CONCURRENT_GENERATIONS = 12;
let inFlight = 0;
const waitingQueue: Array<() => void> = [];
async function withConcurrencyCap<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_CONCURRENT_GENERATIONS) {
    await new Promise<void>((resolve) => waitingQueue.push(resolve));
  }
  inFlight++;
  try {
    return await fn();
  } finally {
    inFlight--;
    const next = waitingQueue.shift();
    if (next) next();
  }
}

function writeGenerateLine(res: { write(chunk: string): unknown }, line: ProtocolLine): void {
  res.write(`${JSON.stringify(line)}\n`);
}

function writeGeneratePhase(
  res: { write(chunk: string): unknown },
  seedLines: ProtocolLine[],
  status: SurfaceStatus,
  text: string,
): void {
  const lines: ProtocolLine[] = [
    {
      op: 'event',
      path: '/surface',
      value: { type: 'surface.status', status, text },
    },
    { op: 'meta', path: '/status', value: status },
  ];
  for (const line of lines) {
    seedLines.push(line);
    writeGenerateLine(res, line);
  }
}

function writeGenerateTiming(
  res: { write(chunk: string): unknown },
  seedLines: ProtocolLine[],
  startedAt: number,
  phase: GenerateTimingPhase,
  label: string,
  durationMs?: number,
): void {
  const line: ProtocolLine = {
    op: 'meta',
    path: '/timing',
    value: {
      phase,
      label,
      elapsedMs: roundMs(performance.now() - startedAt),
      ...(durationMs === undefined ? {} : { durationMs: roundMs(durationMs) }),
      source: 'server',
    },
  };
  seedLines.push(line);
  writeGenerateLine(res, line);
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    ghostFingerprintMode: true,
    defaultModelProvider: defaultModelProvider.id,
    modelProviders: modelProviders.info(),
    generationApi: true,
  });
});

registerDemoRoutes(app, modelProviders);

app.get('/api/model-providers', (_req, res) => {
  res.json({
    defaultProvider: defaultModelProvider.id,
    providers: modelProviders.info(),
  });
});

app.get('/api/fingerprints', (_req, res) => {
  res.json(publicFingerprints(fingerprintCatalog));
});

app.get('/api/ghost-roots', (_req, res) => {
  res.json(
    publicGhostRoots(ghostRoots).map(({ id }) => ({
      id,
      name: id,
      summary: 'External Ghost root',
      status: 'external',
      version: '',
      tags: [],
      previewColors: [],
      defaultTargetPath: '.',
      source: 'external',
    })),
  );
});

/**
 * Generates a structured Surface Document bundle, validates it, and streams server-owned
 * protocol lines to the client.
 */
app.post('/api/generate', async (req, res) => {
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (!prompt) {
    res.status(400).json({ error: 'prompt required' });
    return;
  }
  if (req.body?.experimentalRuntime !== undefined && req.body.experimentalRuntime !== 'surface-document') {
    res.status(400).json({ error: 'experimentalRuntime is retired; the server always generates surface-document bundles' });
    return;
  }
  const runtimeProfileKey: ModelProfileKey = 'surface-document';
  const utilityProfileKey: ModelProfileKey = 'utility';
  const resolvedRuntimeProvider = modelProviders.resolve(req.body?.modelProvider ?? req.body?.provider, req.body, runtimeProfileKey);
  if (!resolvedRuntimeProvider.ok) {
    res.status(400).json({ error: resolvedRuntimeProvider.error });
    return;
  }
  const resolvedUtilityProvider = modelProviders.resolve(req.body?.modelProvider ?? req.body?.provider, req.body, utilityProfileKey);
  if (!resolvedUtilityProvider.ok) {
    res.status(400).json({ error: resolvedUtilityProvider.error });
    return;
  }
  const modelProvider = resolvedRuntimeProvider.provider;
  const modelSelection = resolvedRuntimeProvider.selection;
  const utilityModelProvider = resolvedUtilityProvider.provider;
  const utilityModelSelection = resolvedUtilityProvider.selection;

  if (req.body?.ghost !== undefined && req.body?.fingerprint !== undefined) {
    res.status(400).json({ error: 'Use either fingerprint or ghost, not both' });
    return;
  }
  const parsedFingerprint = parseFingerprintRequest(req.body?.fingerprint, fingerprintCatalog);
  if (!parsedFingerprint.ok) {
    res.status(400).json({ error: parsedFingerprint.error });
    return;
  }
  const parsedGhost = parseGhostRequest(req.body?.ghost, ghostRoots);
  if (!parsedGhost.ok) {
    res.status(400).json({ error: parsedGhost.error });
    return;
  }
  const fingerprintRequest = parsedFingerprint.request;
  const ghostRequest = parsedGhost.request;
  if (!fingerprintRequest && !ghostRequest) {
    res.status(400).json({ error: 'Summon generation requires a Ghost fingerprint. Provide fingerprint or ghost.' });
    return;
  }

  let ghostContext: ResolvedGhostSteer | null = null;
  try {
    ghostContext = fingerprintRequest
      ? await resolveCatalogGhostGenerationContext(fingerprintRequest, fingerprintCatalog)
      : ghostRequest
        ? await resolveGhostGenerationContext(ghostRequest, ghostRoots)
        : null;
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  const parsedLayout = parseSummonLayout(req.body?.layout);
  if (parsedLayout.error) {
    res.status(400).json({ error: parsedLayout.error });
    return;
  }
  const layout = parsedLayout.layout;
  const parsedScale = parseSurfaceScale(req.body?.scale);
  if (parsedScale.error) {
    res.status(400).json({ error: parsedScale.error });
    return;
  }
  const scale = parsedScale.scale;
  const unsupportedGenerationFields = [
    'edit',
    'fragmentMode',
    'repair',
    'mode',
    'scriptPolicy',
    'surfacePlan',
    'surfaceCeiling',
  ];
  const unsupportedField = unsupportedGenerationFields.find((field) => req.body?.[field] !== undefined && req.body?.[field] !== null);
  if (unsupportedField) {
    res.status(400).json({ error: `${unsupportedField} is not supported in Surface Document policy mode` });
    return;
  }
  const rawAgentOptions = req.body?.agent;
  const agentOptions = rawAgentOptions && typeof rawAgentOptions === 'object'
    ? rawAgentOptions as Record<string, unknown>
    : null;

  const playgroundMode = PLAYGROUND_ENABLED && req.body?.playground === true;
  const hasSurfacePolicy =
    !playgroundMode && req.body?.surfacePolicy !== undefined && req.body.surfacePolicy !== null;
  const toolCeiling = parseToolPack(req.body?.tools);
  const validationMode: 'observe' | 'enforce' = playgroundMode
    ? 'observe'
    : req.body?.validationMode === 'observe'
      ? 'observe'
      : 'enforce';

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  const seedLines: ProtocolLine[] = [];
  const timingStartedAt = performance.now();
  writeGeneratePhase(res, seedLines, 'planning', 'Preparing generation request');

  try {
    let mode: 'static' | 'interactive' = 'static';
    let pack: ToolPack | null = null;
    let surfacePlan: SurfacePlan;
    let agentPlan: AgentSurfacePlanResult | null = null;
    let generationSurfacePolicy: SurfacePolicy | null = null;

    if (playgroundMode) {
      writeGeneratePhase(res, seedLines, 'contract', 'Preparing playground run');
      const startedAt = performance.now();
      const grantedTools = (toolCeiling?.tools ?? []).map((tool) => tool.name);
      const playgroundPolicy: SurfacePolicy = grantedTools.length > 0
        ? { tier: 'declarative', purpose: 'explore', persistence: 'ephemeral', grants: grantedTools }
        : { tier: 'static', purpose: 'explore', persistence: 'ephemeral' };
      generationSurfacePolicy = playgroundPolicy;
      const compiledPolicy = compileSurfacePolicy(playgroundPolicy, {
        tools: toolCeiling,
      });
      mode = compiledPolicy.mode;
      pack = compiledPolicy.tools;
      surfacePlan = compiledPolicy.surfacePlan;
      writeGenerateTiming(
        res,
        seedLines,
        timingStartedAt,
        'policy',
        'Prepared playground run',
        performance.now() - startedAt,
      );
    } else if (hasSurfacePolicy) {
      writeGeneratePhase(res, seedLines, 'contract', 'Compiling host contract');
      const startedAt = performance.now();
      generationSurfacePolicy = req.body.surfacePolicy as SurfacePolicy;
      const compiledPolicy = compileSurfacePolicy(req.body.surfacePolicy, {
        tools: toolCeiling,
      });
      mode = compiledPolicy.mode;
      pack = compiledPolicy.tools;
      surfacePlan = compiledPolicy.surfacePlan;
      writeGenerateTiming(
        res,
        seedLines,
        timingStartedAt,
        'policy',
        'Compiled host contract',
        performance.now() - startedAt,
      );
    } else {
      writeGeneratePhase(res, seedLines, 'contract', 'Resolving host policy');
      const startedAt = performance.now();
      agentPlan = await planAgentSurface({
        prompt,
        tools: toolCeiling,
        goalModel: process.env.SUMMON_AGENT_GOAL_SELECT === '0' || agentOptions?.goalModel === 'off'
          ? null
          : {
              completeText: (request) => utilityModelProvider.completeText(request, utilityModelSelection),
            },
        goalTimeoutMs: clampInt(agentOptions?.goalTimeoutMs, 250, 5000, 1800),
      });
      generationSurfacePolicy = agentPlan.surfacePolicy;
      mode = agentPlan.compiledPolicy.mode;
      pack = agentPlan.compiledPolicy.tools;
      surfacePlan = agentPlan.compiledPolicy.surfacePlan;
      writeGenerateTiming(
        res,
        seedLines,
        timingStartedAt,
        'policy',
        `Resolved host policy (${agentPlan.goalSource})`,
        performance.now() - startedAt,
      );
    }

    if (ghostContext) {
      writeGeneratePhase(res, seedLines, 'contract', 'Preparing Ghost surface brief');
      const startedAt = performance.now();
      ghostContext = await prepareGhostSurfacePrompt(ghostContext, {
        userPrompt: prompt,
        mode,
        surfacePlan,
        tools: hasSurfacePolicy
          ? toolCeiling
          : agentPlan
            ? agentPlan.compiledPolicy.tools
            : pack,
        completeText: process.env.SUMMON_GHOST_SURFACE_SELECT === '0'
          ? undefined
          : (request) => utilityModelProvider.completeText(request, utilityModelSelection),
        conjuror: readConjurorOptions(process.env),
      });
      writeGenerateTiming(
        res,
        seedLines,
        timingStartedAt,
        'ghost-brief',
        'Prepared Ghost surface brief',
        performance.now() - startedAt,
      );
    }

    const preludeLines: ProtocolLine[] = [];

    // Let the playground repair loop recover the "valid schema, runtime-fatal"
    // class (bundle shape, syntax, unsupported facade API, ungranted network)
    // instead of blocking. Mirrors the repairable codes in runtime/bundle.ts.
    const playgroundRepairIssueCodes = [
      'invalid-surface-document-bundle',
      'invalid-surface-document-bundle-schema',
      'missing-surface-document-bundle-html',
      'missing-surface-document-bundle-css',
      'missing-surface-document-file',
      'invalid-surface-document-source',
      'invalid-surface-document-source-file',
      'invalid-surface-document-source-path',
      'invalid-surface-document-source-syntax',
      'surface-document-source-limit',
      'surface-document-unsupported-api',
      'surface-document-network-not-granted',
    ];

    if (playgroundMode) {
      preludeLines.push({
        op: 'meta',
        path: '/playground-mode',
        value: {
          enabled: true,
          validation: 'observe',
          ward: 'off',
          repairs: 1,
          repairIssueCodes: playgroundRepairIssueCodes,
        },
      });
    }

    if (ghostContext) {
      if (ghostContext.conjuror) {
        preludeLines.push({
          op: 'meta',
          path: '/conjuror',
          value: ghostContext.conjuror,
        });
      }
      preludeLines.push({
        op: 'meta',
        path: '/ghost-context',
        value: ghostContextMeta(ghostContext),
      });
      preludeLines.push({
        op: 'meta',
        path: '/ghost-token-source',
        value: ghostTokenSourceMeta(ghostContext.tokenSource),
      });
    }
    if (agentPlan) {
      preludeLines.push({
        op: 'meta',
        path: '/agent-goal',
        value: agentPlan.goal,
      });
      preludeLines.push({
        op: 'meta',
        path: '/agent-policy-resolution',
        value: {
          source: agentPlan.policyResolution.source,
          goalSource: agentPlan.goalSource,
          proposedSurfacePolicy: agentPlan.policyResolution.proposedSurfacePolicy,
          surfacePolicy: agentPlan.policyResolution.surfacePolicy,
          rejectedTools: agentPlan.policyResolution.rejectedTools,
          fallback: agentPlan.policyResolution.fallback,
        },
      });
    }
    if (layout) {
      preludeLines.push({ op: 'meta', path: '/layout', value: layout.id });
    }

    // Design-fidelity loop (opt-in). When SUMMON_GHOST_FIDELITY_REPAIR is set to
    // a positive integer and we have a Ghost context, the generation loop hands
    // the accepted artifact source to the same conformance evaluator used for
    // the advisory receipt — but here a failed HIGH-severity check becomes a
    // block-severity design issue that triggers a bounded repair pass. This is
    // the one place a bland-but-valid surface can be sent back for another try.
    // Default 0 ⇒ behaviour unchanged (review stays purely advisory post-pass).
    const fidelityBudget = ghostContext
      ? clampInt(process.env.SUMMON_GHOST_FIDELITY_REPAIR, 0, 2, 0)
      : 0;
    const fidelityReviewer = fidelityBudget > 0 && ghostContext
      ? async (source: Record<string, string>): Promise<ContractIssue[]> => {
          const verdict = await evaluateConformance({
            checks: ghostContext!.checks,
            catalog: ghostContext!.catalog,
            surface: ghostContext!.surface,
            artifactSource: source,
            completeText: (request) =>
              utilityModelProvider.completeText(request, utilityModelSelection),
          });
          return verdict.checks
            .filter((check) => check.verdict === 'fail' && check.severity === 'high')
            .map((check): ContractIssue => ({
              source: 'direction',
              severity: 'block',
              code: 'fingerprint-fidelity',
              message: `Design fidelity check "${check.name}" failed: ${check.reason}`,
              hint: `Revise the surface so it satisfies the "${check.name}" fingerprint rule while keeping the user task intact.`,
            }));
        }
      : undefined;

    await withConcurrencyCap(async () => {
      let usage: ProviderUsageSnapshot | null = null;
      const commonGenerationInput = {
        prompt,
        ghost: ghostContext ?? null,
        activeTokensCss: ghostContext?.tokenSource.css ?? null,
        ...(fidelityReviewer ? { fidelityReviewer, maxFidelityRepairs: fidelityBudget } : {}),
        layout,
        scale,
        tools: playgroundMode
          ? pack
          : hasSurfacePolicy || agentPlan
            ? toolCeiling
            : pack,
        surfacePolicy: generationSurfacePolicy,
        // Goal provenance scales how firmly the surface-contract prompt voices
        // the `purpose` hint (never the capability boundaries). Only the ward
        // path infers a goal; host-authored policies leave this undefined so the
        // hint is voiced at the conservative default firmness.
        ...(agentPlan
          ? { goalProvenance: { source: agentPlan.goalSource, confidence: agentPlan.goal.confidence } }
          : {}),
        preludeLines,
        seedLines,
        validationMode,
        playground: playgroundMode,
        experimentalPromptBlock: playgroundMode ? playgroundPromptBlock : null,
      };
      const summary: SurfaceGenerationSummary = await runSurfaceGeneration({
        ...commonGenerationInput,
        maxRepairAttempts: playgroundMode ? 1 : clampInt(req.body?.maxRepairAttempts, 0, 3, 1),
        ...(playgroundMode ? { repairIssueCodes: playgroundRepairIssueCodes } : {}),
        modelProvider: {
          generateSurfaceDocumentBundle: (request) => modelProvider.generateSurfaceDocumentBundle(request, modelSelection),
          repairSurfaceDocumentBundle: (request) => modelProvider.repairSurfaceDocumentBundle(request, modelSelection),
        },
      }, (line) => {
        writeGenerateLine(res, line);
      });

      if (ghostContext) {
        // Step 5 — conformance verdict (advisory, post-pass on the accepted
        // artifact). Computed FIRST so it can be folded into the receipt. The
        // granular /ghost-conformance line still streams (live diagnostics);
        // the verdict is purely additive and a failure here must never fail the
        // generation response.
        let verdict: ConformanceVerdict = emptyConformanceVerdict(ghostContext.surface);
        if (!summary.blocked && process.env.SUMMON_GHOST_CONFORMANCE !== '0') {
          try {
            const artifactSource = extractArtifactSource(summary.emittedLines);
            verdict = await evaluateConformance({
              checks: ghostContext.checks,
              catalog: ghostContext.catalog,
              surface: ghostContext.surface,
              artifactSource,
              completeText: (request) =>
                utilityModelProvider.completeText(request, utilityModelSelection),
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[generate] conformance skipped:', msg);
          }
        }
        try {
          writeGenerateLine(res, {
            op: 'meta',
            path: '/ghost-conformance',
            value: verdict,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[generate] conformance line skipped:', msg);
        }

        // Step 6 — the receipt. The LAST ghost meta emitted: it consolidates
        // spec-in + what-happened + the folded conformance verdict, built after
        // generation (artifact + run-metrics already flushed) so it can include
        // everything. A failure here must never fail the response.
        try {
          const runMetrics = readRunMetrics(summary.emittedLines);
          writeGenerateLine(res, {
            op: 'meta',
            path: '/ghost-receipt',
            value: buildGhostReceipt({
              context: ghostContext,
              mode,
              layoutId: layout?.id ?? null,
              grantedTools: toolCeiling?.tools?.map((tool) => tool.name) ?? [],
              validation: summarizeContractIssues(summary.validationIssues),
              acceptedLines: summary.emittedLines,
              runtime: runMetrics.runtime ?? 'surface-document',
              repairs: runMetrics.repairs ?? 0,
              blocked: summary.blocked,
              safetyViolations: runMetrics.safetyViolationCodes ?? [],
              conformance: verdict,
            }),
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[generate] receipt skipped:', msg);
        }
      }
      const finalUsage = usage ?? {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      };
      console.log(
        `[generate] provider=${modelProvider.id}/${modelSelection.generationModel} utility=${utilityModelProvider.id}/${utilityModelSelection.utilityModel} ghost=${ghostContext ? ghostLogId(ghostContext) : 'none'} mode=${mode}` +
          ` layout=${layout?.id ?? 'none'}` +
          ` surface=${surfacePlan.purpose}/${surfacePlan.runtime}/${surfacePlan.data}/${surfacePlan.authority}/${surfacePlan.persistence}` +
          ` tools=${pack?.tools.length ?? 0}/${toolCeiling?.tools.length ?? 0}` +
          ` options=max:${modelSelection.options.maxOutputTokens}` +
          (modelSelection.options.anthropicThinking ? ` thinking=${modelSelection.options.anthropicThinking}` : '') +
          (modelSelection.options.effort ? ` effort=${modelSelection.options.effort}` : '') +
          (modelSelection.customModel ? ' customModel=yes' : '') +
          ` playground=${playgroundMode ? 'yes' : 'no'}` +
          ` validation=${summary.validationIssues.length}${summary.blocked ? '(blocked)' : ''}` +
          ` usage in=${finalUsage.input_tokens} out=${finalUsage.output_tokens}` +
          ` cache_read=${finalUsage.cache_read_input_tokens ?? 0}` +
          ` cache_write=${finalUsage.cache_creation_input_tokens ?? 0}`
      );
      res.end();
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[generate] error:', msg);
    writeGenerateLine(res, { op: 'meta', path: '/error', value: msg });
    res.end();
  }
});

function ghostLogId(context: ResolvedGhostSteer): string {
  return context.source === 'root' ? context.request.rootId : context.request.fingerprintId;
}

/**
 * Extract the accepted Surface Document artifact source from the emitted protocol lines:
 * the last `artifact` line whose `value.runtime === 'surface-document'`,
 * returning its `value.source` file map or null.
 */
function extractArtifactSource(lines: ProtocolLine[]): Record<string, string> | null {
  for (let index = lines.length - 1; index >= 0; index--) {
    const line = lines[index];
    if (line?.op !== 'artifact') continue;
    const value = line.value as { runtime?: unknown; source?: unknown } | undefined;
    if (
      value?.runtime !== 'surface-document' ||
      !value.source ||
      typeof value.source !== 'object' ||
      Array.isArray(value.source)
    ) {
      continue;
    }
    const source: Record<string, string> = {};
    for (const [file, content] of Object.entries(value.source as Record<string, unknown>)) {
      if (typeof content === 'string') source[file] = content;
    }
    return source;
  }
  return null;
}

interface RunMetricsView {
  runtime?: string;
  repairs?: number;
  safetyViolationCodes?: string[];
}

/** Pull the already-emitted /run-metrics meta to source the receipt's
 * runtime/repairs/safety fields (single source of truth — no re-plumbing). */
function readRunMetrics(lines: ProtocolLine[]): RunMetricsView {
  for (let index = lines.length - 1; index >= 0; index--) {
    const line = lines[index];
    if (line?.op !== 'meta' || line.path !== '/run-metrics') continue;
    const value = line.value as Record<string, unknown> | undefined;
    if (!value || typeof value !== 'object') continue;
    return {
      runtime: typeof value.runtime === 'string' ? value.runtime : undefined,
      repairs: typeof value.repairs === 'number' ? value.repairs : undefined,
      safetyViolationCodes: Array.isArray(value.safetyViolationCodes)
        ? value.safetyViolationCodes.filter((code): code is string => typeof code === 'string')
        : undefined,
    };
  }
  return {};
}

const playgroundPromptBlock: ContractPromptBlock = {
  id: 'playground-mode',
  cache: 'none',
  text: [
    '## Playground mode',
    '',
    'This run is a best-effort local generative UI playground. Prioritize returning one renderable Surface Document bundle over satisfying production policy posture.',
    '',
    'Hard requirement: return a structured Surface Document bundle with main.html and main.css source entries:',
    '',
    '```json',
    '{ "schema": "summon.surface-document-bundle/v1", "source": { "main.html": "<main>...</main>", "main.css": "main { color: var(--color-text); }" } }',
    '```',
    '',
    'Prefer self-contained Surface Document UI. Use host tools only when a Tools block explicitly lists them. Do not return source as prose, markdown, or a bare string if you can return structured source files.',
  ].join('\n'),
};

type GenerateTimingPhase = 'policy' | 'ghost-brief';

function roundMs(value: number): number {
  return Math.max(0, Math.round(value));
}

app.listen(PORT, () => {
  console.log(`[summon-server] listening on http://localhost:${PORT}`);
  console.log(`[summon-server] CORS origin: ${ALLOWED_ORIGIN}`);
});
