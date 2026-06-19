import express from 'express';
import cors from 'cors';
import {
  compileSurfacePolicy,
  parseTokenValues,
  type ToolPack,
  type ProtocolLine,
  type SurfaceStatus,
  type SummonLayout,
  type SurfacePlan,
  type SurfacePolicy,
  type ContractPromptBlock,
  type TokenOverride,
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
import {
  defaultDirectionId,
  loadDirections,
  type Direction,
} from './directions-loader.js';
import { registerDemoRoutes } from './demo-routes.js';
import {
  buildGhostReviewPacket,
  ghostContextMeta,
  ghostTokenSourceMeta,
  parseGhostRequest,
  parseGhostRoots,
  prepareGhostSurfacePrompt,
  publicGhostRoots,
  resolveGhostGenerationContext,
  type ResolvedGhostSteer,
} from './ghost-adapter.js';
import { inferShape, type ResponseShape } from './infer-shape.js';
import { parseToolPack } from './tool-pack.js';
import {
  createModelProviderRegistry,
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

const directions = loadDirections();
const directionsById = new Map<string, Direction>(directions.map((d) => [d.id, d]));
const DEFAULT_DIRECTION_ID = defaultDirectionId(directions);
const ghostRoots = parseGhostRoots(process.env.SUMMON_GHOST_ROOTS);

console.log(
  `[summon-server] loaded ${directions.length} direction(s): ${directions.map((d) => d.id).join(', ') || '(none)'}`
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

/**
 * Validates a host's token-override payload against the direction's
 * `overridable` allow-list. Rejected entries are surfaced to the client so
 * an embedder can see when its override wasn't honored.
 *
 * Rules:
 *   - Token name (with or without `--` prefix; we strip if present).
 *   - Must appear in `direction.overridable` — no allow-list entry, no override.
 *   - Value is treated as a CSS string and capped at 200 chars to keep payloads
 *     bounded and to keep the prompt block from ballooning.
 *   - Empty string and non-strings are rejected.
 */
interface ResolvedOverrides {
  applied: TokenOverride[];
  rejected: { token: string; reason: string }[];
}

function resolveTokenOverrides(
  direction: Direction,
  raw: unknown,
): ResolvedOverrides {
  const applied: TokenOverride[] = [];
  const rejected: { token: string; reason: string }[] = [];
  if (!raw || typeof raw !== 'object') return { applied, rejected };

  const allow = new Set(direction.overridable);
  if (allow.size === 0) {
    // Direction does not opt into overrides at all — reject everything but
    // still tell the host *why*, so they don't silently keep sending.
    for (const k of Object.keys(raw as object)) {
      rejected.push({ token: k, reason: 'direction declares no overridable tokens' });
    }
    return { applied, rejected };
  }

  const baseValues = parseTokenValues(direction.tokensCss);
  const seen = new Set<string>();
  for (const [rawKey, rawValue] of Object.entries(raw as Record<string, unknown>)) {
    const token = rawKey.startsWith('--') ? rawKey.slice(2) : rawKey;
    if (seen.has(token)) continue;
    seen.add(token);
    if (!allow.has(token)) {
      rejected.push({ token, reason: 'not in direction.overridable' });
      continue;
    }
    if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
      rejected.push({ token, reason: 'value must be a non-empty string' });
      continue;
    }
    const newValue = rawValue.slice(0, 200);
    const baseValue = baseValues.get(token) ?? '(undefined)';
    applied.push({ token, baseValue, newValue });
    if (applied.length >= 16) break;
  }
  return { applied, rejected };
}

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

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
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
    directions: directions.map((d) => d.id),
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

/**
 * Exposes the list of directions to the client. Tokens and exemplars are
 * included so the client can apply the right tokens.css when mounting its
 * inline Arrow surface. Prompt text is NOT included — stays server-side.
 */
app.get('/api/directions', (_req, res) => {
  res.json(
    directions.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      tokensCss: d.tokensCss,
      overridable: d.overridable,
      sourceExpression: d.sourceExpression,
    }))
  );
});

app.get('/api/ghost-roots', (_req, res) => {
  res.json(
    publicGhostRoots(ghostRoots).map(({ id }) => ({
      id,
      defaultTargetPath: '.',
      defaultBaseDirectionId: null,
    })),
  );
});

/**
 * Generates a structured Arrow bundle, validates it, and streams server-owned
 * protocol lines to the client.
 */
app.post('/api/generate', async (req, res) => {
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (!prompt) {
    res.status(400).json({ error: 'prompt required' });
    return;
  }
  const resolvedProvider = modelProviders.resolve(req.body?.modelProvider ?? req.body?.provider, req.body);
  if (!resolvedProvider.ok) {
    res.status(400).json({ error: resolvedProvider.error });
    return;
  }
  const modelProvider = resolvedProvider.provider;
  const modelSelection = resolvedProvider.selection;

  const parsedGhost = parseGhostRequest(req.body?.ghost, ghostRoots);
  if (!parsedGhost.ok) {
    res.status(400).json({ error: parsedGhost.error });
    return;
  }
  const ghostRequest = parsedGhost.request;
  if (
    ghostRequest &&
    req.body?.tokenOverrides !== undefined &&
    req.body.tokenOverrides !== null
  ) {
    res.status(400).json({ error: 'tokenOverrides are not supported with Ghost fingerprints' });
    return;
  }

  const requestedGhostBaseDirectionId =
    ghostRequest
      ? ghostRequest.baseDirectionId
      : null;
  const ghostBaseDirection = requestedGhostBaseDirectionId
    ? directionsById.get(requestedGhostBaseDirectionId)
    : undefined;
  if (ghostRequest && requestedGhostBaseDirectionId && !ghostBaseDirection) {
    res.status(400).json({ error: `unknown fingerprint token fallback direction "${requestedGhostBaseDirectionId}"` });
    return;
  }

  let ghostContext: ResolvedGhostSteer | null = null;
  try {
    ghostContext = ghostRequest
      ? await resolveGhostGenerationContext(
          { ...ghostRequest, baseDirectionId: requestedGhostBaseDirectionId },
          ghostRoots,
          ghostBaseDirection ?? null,
        )
      : null;
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  const directionId = ghostContext
    ? undefined
    : ((typeof req.body?.directionId === 'string' ? req.body.directionId : undefined) ??
      DEFAULT_DIRECTION_ID);
  const direction = ghostContext
    ? undefined
    : directionId
      ? directionsById.get(directionId)
      : undefined;

  const overrides = !ghostContext && direction
    ? resolveTokenOverrides(direction, req.body?.tokenOverrides)
    : { applied: [], rejected: [] };
  const parsedLayout = parseSummonLayout(req.body?.layout);
  if (parsedLayout.error) {
    res.status(400).json({ error: parsedLayout.error });
    return;
  }
  const layout = parsedLayout.layout;
  const legacyGenerationFields = [
    'edit',
    'fragmentMode',
    'repair',
    'mode',
    'scriptPolicy',
    'surfacePlan',
    'surfaceCeiling',
  ];
  const legacyField = legacyGenerationFields.find((field) => req.body?.[field] !== undefined && req.body?.[field] !== null);
  if (legacyField) {
    res.status(400).json({ error: `${legacyField} is not supported in Arrow-only policy mode` });
    return;
  }
  const rawAgentOptions = req.body?.agent;
  const agentOptions = rawAgentOptions && typeof rawAgentOptions === 'object'
    ? rawAgentOptions as Record<string, unknown>
    : null;

  const playgroundMode = req.body?.playground === true;
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

    // Shape classification — picks ONE response shape so the per-direction
    // block ships only the matching shape exemplar (atoms always ship). Falls
    // through to null on timeout/ambiguity, in which case all shape exemplars
    // ship (legacy behavior). Skipped when no direction is selected — there
    // are no exemplars to filter. Also skipped when the host supplies a layout:
    // the layout is the composition anchor, and exemplars become visual-only.
    let shape: ResponseShape | null = null;
    if (!playgroundMode && !layout && (direction || ghostContext) && process.env.SUMMON_INFER_SHAPE !== '0') {
      writeGeneratePhase(res, seedLines, 'planning', 'Inferring response shape');
      const startedAt = performance.now();
      shape = await inferShape({
        completeText: (request) => modelProvider.completeText(request, modelSelection),
      }, prompt);
      writeGenerateTiming(
        res,
        seedLines,
        timingStartedAt,
        'shape',
        shape ? `Inferred response shape: ${shape}` : 'Response shape inference skipped',
        performance.now() - startedAt,
      );
    }

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
        goalModel: process.env.SUMMON_AGENT_GOAL_MODEL === '0' || agentOptions?.goalModel === 'off'
          ? null
          : {
              completeText: (request) => modelProvider.completeText(request, modelSelection),
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
      ghostContext = prepareGhostSurfacePrompt(ghostContext, {
        userPrompt: prompt,
        mode,
        surfacePlan,
        shape,
        tools: hasSurfacePolicy
          ? toolCeiling
          : agentPlan
            ? agentPlan.compiledPolicy.tools
            : pack,
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

    const playgroundRepairIssueCodes = ['invalid-arrow-source-syntax'];

    if (playgroundMode) {
      preludeLines.push({
        op: 'meta',
        path: '/playground-mode',
        value: {
          enabled: true,
          validation: 'observe',
          broker: 'off',
          shapeInference: 'off',
          repairs: 1,
          repairIssueCodes: playgroundRepairIssueCodes,
        },
      });
    }

    if (ghostContext) {
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
    if (shape) {
      preludeLines.push({ op: 'meta', path: '/shape', value: shape });
    }
    if (layout) {
      preludeLines.push({ op: 'meta', path: '/layout', value: layout.id });
    }
    if (overrides.applied.length > 0) {
      // Surface the resolved overrides so the client can paint them into the
      // inline surface stylesheet. Rejected entries are surfaced too — a host that
      // tried to override a non-allowlisted token gets a visible signal.
      preludeLines.push({
        op: 'meta',
        path: '/token-overrides',
        value: {
          applied: overrides.applied.map((o) => ({ token: o.token, value: o.newValue })),
          rejected: overrides.rejected,
        },
      });
    }

    await withConcurrencyCap(async () => {
      let usage: ProviderUsageSnapshot | null = null;
      const commonGenerationInput = {
        prompt,
        direction: direction
          ? {
              id: direction.id,
              tokensCss: direction.tokensCss,
              prompt: direction.prompt,
              exemplars: direction.exemplars,
              opts: direction.opts,
              shape,
              layout,
            }
          : null,
        ghost: ghostContext ?? null,
        activeTokensCss: ghostContext?.tokenSource.css ?? null,
        layout,
        tools: playgroundMode
          ? pack
          : hasSurfacePolicy || agentPlan
            ? toolCeiling
            : pack,
        surfacePolicy: generationSurfacePolicy,
        tokenOverrides: overrides.applied,
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
          generateArrowBundle: (request) => modelProvider.generateArrowBundle(request, modelSelection),
          repairArrowBundle: (request) => modelProvider.repairArrowBundle(request, modelSelection),
        },
      }, (line) => {
        writeGenerateLine(res, line);
      });

      if (ghostContext) {
        const reviewLine: ProtocolLine = {
          op: 'meta',
          path: '/ghost-review-packet',
          value: buildGhostReviewPacket({
            context: ghostContext,
            mode,
            layoutId: layout?.id ?? null,
            validation: summarizeContractIssues(summary.validationIssues),
            acceptedLines: summary.acceptedLines,
            prompt,
          }),
        };
        writeGenerateLine(res, reviewLine);
      }
      const finalUsage = usage ?? {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      };
      console.log(
        `[generate] provider=${modelProvider.id}/${modelSelection.generationModel} utility=${modelSelection.utilityModel} dir=${directionId ?? 'none'} ghost=${ghostContext ? ghostLogId(ghostContext) : 'none'} mode=${mode}` +
          ` shape=${shape ?? 'all'}` +
          ` layout=${layout?.id ?? 'none'}` +
          ` surface=${surfacePlan.purpose}/${surfacePlan.runtime}/${surfacePlan.data}/${surfacePlan.authority}/${surfacePlan.persistence}` +
          ` tools=${pack?.tools.length ?? 0}/${toolCeiling?.tools.length ?? 0}` +
          ` overrides=${overrides.applied.length}` +
          ` options=max:${modelSelection.options.maxOutputTokens}` +
          (modelSelection.options.anthropicThinking ? ` thinking=${modelSelection.options.anthropicThinking}` : '') +
          (modelSelection.options.effort ? ` effort=${modelSelection.options.effort}` : '') +
          (modelSelection.customModel ? ' customModel=yes' : '') +
          ` playground=${playgroundMode ? 'yes' : 'no'}` +
          ` validation=${summary.validationIssues.length}${summary.blocked ? '(blocked)' : ''}` +
          (overrides.rejected.length > 0 ? `(rejected ${overrides.rejected.length})` : '') +
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
  return context.request.rootId;
}

const playgroundPromptBlock: ContractPromptBlock = {
  id: 'playground-mode',
  cache: 'none',
  text: [
    '## Playground mode',
    '',
    'This run is a best-effort local generative UI playground. Prioritize returning one renderable Arrow bundle over satisfying production policy posture.',
    '',
    'Hard requirement: return a structured bundle with exactly one entry file in the source object:',
    '',
    '```json',
    '{ "schema": "summon.arrow-bundle/v1", "source": { "main.ts": "import { html } from \\"@arrow-js/core\\";\\nexport default html`<main>...</main>`;" } }',
    '```',
    '',
    'Prefer self-contained static or local reactive Arrow UI. Use host tools only when a Tools block explicitly lists them. Do not return source as prose, markdown, or a bare string if you can return source.main.ts.',
  ].join('\n'),
};

type GenerateTimingPhase = 'shape' | 'policy' | 'ghost-brief';

function roundMs(value: number): number {
  return Math.max(0, Math.round(value));
}

app.listen(PORT, () => {
  console.log(`[summon-server] listening on http://localhost:${PORT}`);
  console.log(`[summon-server] CORS origin: ${ALLOWED_ORIGIN}`);
});
