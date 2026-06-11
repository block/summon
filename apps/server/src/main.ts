import express from 'express';
import cors from 'cors';
import {
  compileSurfacePolicy,
  parseTokenValues,
  type CapabilityPack,
  type ProtocolLine,
  type ScriptPolicy,
  type SummonLayout,
  type SurfacePlan,
  type TokenOverride,
} from '@anarchitecture/summon/engine';
import {
  planAgentSurface,
  resolveSurfaceGenerationPlan,
  runSurfaceGeneration,
  summarizeContractIssues,
  type AgentSurfacePlanResult,
  type GenerateEditInput,
  type RepairOptions as SurfaceRepairOptions,
  type SurfaceGenerationSummary,
} from '@anarchitecture/summon-server';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  defaultDirectionId,
  loadDirections,
  PREFERRED_DEFAULT_DIRECTION_ID,
  type Direction,
} from './directions-loader.js';
import { registerDemoRoutes } from './demo-routes.js';
import {
  buildGhostReviewPacket,
  ghostCapsuleMeta,
  ghostContextMeta,
  ghostTokenSourceMeta,
  parseGhostRequest,
  parseGhostRoots,
  prepareGhostSurfacePrompt,
  publicGhostRoots,
  resolveGhostGenerationContext,
  type ResolvedGhostSteer,
} from './ghost-adapter.js';
import { inferPack } from './infer-capabilities.js';
import { inferShape, type ResponseShape } from './infer-shape.js';
import { parseCapabilityPack } from './capability-pack.js';
import { parseComponentPack } from './component-pack.js';
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

const EXPERIMENTAL_BLOCK_FRAGMENT_PROMPT = `## Experimental block fragments

This run is using Summon's experimental block-fragment protocol. Keep sections as the outer structure, but stream complete blocks inside each section.

Rules:

- Emit \`set /screen\` first with the stable section ids.
- For each section, emit \`set /section/<section-id>\` with \`{"blocks":["block-id"]}\` before adding blocks.
- Emit complete block replacement lines at \`add /section/<section-id>/block/<block-id>\`.
- Use lowercase kebab-case ids. Each section may declare 1 to 8 blocks.
- Treat every block as a complete subtree. Do not split a form, table, data resource scope, component placeholder, script lifecycle, or closely coupled control group across blocks.
- For perceived streaming, emit cheap block placeholders first, then final replacement \`add\` lines for the same block ids.
- Do not emit whole-section \`add /section/<section-id>\` lines unless you cannot satisfy the block contract.`;

const EXPERIMENTAL_HTML_NODE_PROMPT = `## Experimental HTML node patches

This run is using Summon's experimental html-node-v0 protocol. Keep sections as the outer structure, but stream small complete raw-HTML DOM nodes inside each section.

Rules:

- Emit \`set /screen\` first with stable section ids.
- Then emit \`add /section/<section-id>/node/<node-id>\` lines. Each node line must include one complete raw HTML element with \`data-summon-node="<node-id>"\` on that root element.
- Use lowercase kebab-case ids for sections and nodes.
- Omit \`parent\` to append a node directly under the section wrapper. Set \`parent\` to an earlier node id to append inside that parent node.
- Emit a root visual container first, then useful child nodes such as headers, metric cards, rows, list items, action groups, chart shells, status panels, and notes.
- When a card, panel, list, or table shell will receive child node patches, include an empty child slot inside it, such as \`<div data-summon-node-children></div>\`, and set those child lines' \`parent\` to that shell's node id.
- Do not emit content that visually belongs inside a card or panel as a sibling of that card or the root container.
- Each node patch should usually be 500-2000 bytes and visually meaningful immediately. Prefer many small useful patches over one large section.
- Do not put \`data-summon-node\` on nested elements inside a node patch. Child nodes must arrive as their own later protocol lines.
- Do not emit scripts, inline event handlers, external URLs, or whole-section \`add /section/<section-id>\` lines unless you cannot satisfy the node-patch contract.`;

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

type GenerateEditRequest = GenerateEditInput;

interface ParsedRepairOptions {
  enabled: boolean;
  maxAttempts: number;
  maxTargets: number;
}

function parseEditRequest(raw: unknown): { edit: GenerateEditRequest | null; error?: string } {
  if (raw === undefined || raw === null) return { edit: null };
  if (!raw || typeof raw !== 'object') {
    return { edit: null, error: 'edit must be an object' };
  }
  const obj = raw as Record<string, unknown>;
  const rawSections = obj.sections;
  if (!Array.isArray(rawSections) || rawSections.length < 1 || rawSections.length > 5) {
    return { edit: null, error: 'edit.sections must contain 1-5 section snapshots' };
  }

  const sections: GenerateEditRequest['sections'] = [];
  const seen = new Set<string>();
  let totalHtmlBytes = 0;
  for (const rawSection of rawSections) {
    if (!rawSection || typeof rawSection !== 'object') {
      return { edit: null, error: 'each edit section must be an object' };
    }
    const section = rawSection as Record<string, unknown>;
    if (typeof section.id !== 'string' || !SECTION_ID_RE.test(section.id)) {
      return { edit: null, error: 'edit section ids must be lowercase kebab-case and 1-20 chars' };
    }
    if (seen.has(section.id)) {
      return { edit: null, error: `duplicate edit section "${section.id}"` };
    }
    if (typeof section.html !== 'string') {
      return { edit: null, error: `edit section "${section.id}" html must be a string` };
    }
    totalHtmlBytes += section.html.length;
    if (section.html.length > 80000 || totalHtmlBytes > 240000) {
      return { edit: null, error: 'edit section snapshots are too large' };
    }
    seen.add(section.id);
    sections.push({ id: section.id, html: section.html });
  }

  let targetSections: string[] | undefined;
  if (obj.targetSections !== undefined) {
    if (!Array.isArray(obj.targetSections) || obj.targetSections.length < 1 || obj.targetSections.length > 5) {
      return { edit: null, error: 'edit.targetSections must contain 1-5 section ids' };
    }
    targetSections = [];
    const targetSeen = new Set<string>();
    for (const rawTarget of obj.targetSections) {
      if (typeof rawTarget !== 'string' || !SECTION_ID_RE.test(rawTarget)) {
        return { edit: null, error: 'edit.targetSections contains an invalid section id' };
      }
      if (targetSeen.has(rawTarget)) continue;
      targetSeen.add(rawTarget);
      targetSections.push(rawTarget);
    }
  }

  const baseRevision = Number.isInteger(obj.baseRevision)
    ? Number(obj.baseRevision)
    : null;
  const issues = Array.isArray(obj.issues) ? obj.issues.slice(0, 20) : undefined;
  return { edit: { baseRevision, sections, targetSections, issues } };
}

function parseRepairOptions(raw: unknown): ParsedRepairOptions {
  if (!raw || typeof raw !== 'object') {
    return { enabled: false, maxAttempts: 1, maxTargets: 2 };
  }
  const obj = raw as Record<string, unknown>;
  const enabled = obj.enabled === true;
  const maxAttempts = clampInt(obj.maxAttempts, 1, 3, 1);
  const maxTargets = clampInt(obj.maxTargets, 1, 5, 2);
  return { enabled, maxAttempts, maxTargets };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

/**
 * Conservative two-signal heuristic for "this static-mode prompt actually wants
 * interactivity". Requires BOTH an interactive verb AND user-action framing,
 * so passive list requests like "pick a name for my puppy" don't trip it.
 *
 * Tunable knob: tighten ACTION_FRAMING for false-positives; loosen for
 * false-negatives.
 */
const INTERACTIVE_VERBS =
  /\b(pick|choose|select|submit|filter|toggle|track|count|tally|vote|rate|swipe|drag|search\s+for|let\s+me\s+(pick|choose|search|filter|select))\b/i;
const ACTION_FRAMING =
  /\b(let\s+me|i\s+can|lets?\s+the\s+user|so\s+i\s+can|that\s+i\s+can|where\s+i\s+can|i\s+(want\s+to|need\s+to)\s+(pick|choose|select|filter|track|count|search|toggle)|with\s+\d+\s+(options?|choices?|cards?|tabs?)|from\s+\d+\s+(options?|choices?|cards?|tabs?)|help\s+me\s+(pick|choose|select|filter|find|track|count|toggle))\b/i;

function detectsInteractiveIntent(prompt: string): boolean {
  return INTERACTIVE_VERBS.test(prompt) && ACTION_FRAMING.test(prompt);
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

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    directions: directions.map((d) => d.id),
    defaultModelProvider: defaultModelProvider.id,
    modelProviders: modelProviders.info(),
    generationApi: typeof runSurfaceGeneration === 'function',
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
 * included so the client can apply the right tokens.css when spawning its
 * sandbox iframe. Prompt text is NOT included — stays server-side.
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
      defaultBaseDirectionId: directionsById.has(PREFERRED_DEFAULT_DIRECTION_ID)
        ? PREFERRED_DEFAULT_DIRECTION_ID
        : DEFAULT_DIRECTION_ID ?? null,
    })),
  );
});

/**
 * Streams LLM output as raw text — the client parses JSONL out of it. Each
 * completed newline-terminated line should be one protocol message.
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
    res.status(400).json({ error: 'tokenOverrides are not supported with Ghost product memory' });
    return;
  }

  const requestedGhostBaseDirectionId =
    ghostRequest
      ? (ghostRequest.baseDirectionId ?? (directionsById.has(PREFERRED_DEFAULT_DIRECTION_ID) ? PREFERRED_DEFAULT_DIRECTION_ID : null))
      : null;
  const ghostBaseDirection = requestedGhostBaseDirectionId
    ? directionsById.get(requestedGhostBaseDirectionId)
    : undefined;
  if (ghostRequest && requestedGhostBaseDirectionId && !ghostBaseDirection) {
    res.status(400).json({ error: `unknown Ghost base direction "${requestedGhostBaseDirectionId}"` });
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
    ? ghostContext.baseDirectionId ?? undefined
    : ((typeof req.body?.directionId === 'string' ? req.body.directionId : undefined) ??
      DEFAULT_DIRECTION_ID);
  const direction = ghostContext
    ? ghostBaseDirection
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
  const parsedEdit = parseEditRequest(req.body?.edit);
  if (parsedEdit.error) {
    res.status(400).json({ error: parsedEdit.error });
    return;
  }
  const edit = parsedEdit.edit;
  const fragmentMode =
    req.body?.fragmentMode === 'block-v0'
      ? 'block-v0'
      : req.body?.fragmentMode === 'html-node-v0'
        ? 'html-node-v0'
        : 'section';
  const repairOptions = parseRepairOptions(req.body?.repair);
  const rawAgentOptions = req.body?.agent;
  const agentOptions = rawAgentOptions && typeof rawAgentOptions === 'object'
    ? rawAgentOptions as Record<string, unknown>
    : null;
  const agentPlanningEnabled = agentOptions?.enabled === true;

  const hasSurfacePolicy =
    req.body?.surfacePolicy !== undefined && req.body.surfacePolicy !== null;
  const requestedMode: 'static' | 'interactive' =
    req.body?.mode === 'interactive' ? 'interactive' : 'static';
  let scriptPolicy: ScriptPolicy | undefined =
    req.body?.scriptPolicy === 'allow' ? 'allow' : req.body?.scriptPolicy === 'forbid' ? 'forbid' : undefined;
  const capabilityCeiling = parseCapabilityPack(req.body?.capabilities);
  const componentPack = parseComponentPack(req.body?.components);

  let mode: 'static' | 'interactive' = requestedMode;
  let pack: CapabilityPack | null = null;
  let modeUpgraded = false;
  let inferenceUsed = false;
  let surfacePlan: SurfacePlan;
  let agentPlan: AgentSurfacePlanResult | null = null;

  // Shape classification — picks ONE response shape so the per-direction
  // block ships only the matching shape exemplar (atoms always ship). Falls
  // through to null on timeout/ambiguity, in which case all shape exemplars
  // ship (legacy behavior). Skipped when no direction is selected — there
  // are no exemplars to filter. Also skipped when the host supplies a layout:
  // the layout is the composition anchor, and exemplars become visual-only.
  let shape: ResponseShape | null = null;
  if (!layout && direction && process.env.SUMMON_INFER_SHAPE !== '0') {
    shape = await inferShape({
      completeText: (request) => modelProvider.completeText(request, modelSelection),
    }, prompt);
  }

  if (hasSurfacePolicy) {
    const compiledPolicy = compileSurfacePolicy(req.body.surfacePolicy, {
      capabilities: capabilityCeiling,
      components: componentPack,
    });
    mode = compiledPolicy.mode;
    scriptPolicy = compiledPolicy.scriptPolicy;
    pack = compiledPolicy.capabilities;
    surfacePlan = compiledPolicy.surfacePlan;
  } else if (agentPlanningEnabled) {
    agentPlan = await planAgentSurface({
      prompt,
      capabilities: capabilityCeiling,
      components: componentPack,
      intentModel: process.env.SUMMON_AGENT_INTENT_MODEL === '0' || agentOptions?.intentModel === 'off'
        ? null
        : {
            completeText: (request) => modelProvider.completeText(request, modelSelection),
          },
      intentTimeoutMs: clampInt(agentOptions?.intentTimeoutMs, 250, 5000, 1800),
    });
    mode = agentPlan.compiledPolicy.mode;
    scriptPolicy = agentPlan.compiledPolicy.scriptPolicy;
    pack = agentPlan.compiledPolicy.capabilities;
    surfacePlan = agentPlan.compiledPolicy.surfacePlan;
    modeUpgraded = requestedMode === 'static' && mode === 'interactive';
  } else {
    // Layer 3: utility-model capability inference. Decides mode + narrows the
    // pack to the minimal subset of intents the prompt actually needs. The
    // pack is treated as a ceiling — inference can only narrow, never expand.
    // Falls through to the Layer 2 regex on timeout or error.
    if (process.env.SUMMON_INFER_CAPABILITIES === '1' && capabilityCeiling) {
      const inferred = await inferPack({
        completeText: (request) => modelProvider.completeText(request, modelSelection),
      }, prompt, capabilityCeiling);
      if (inferred) {
        inferenceUsed = true;
        if (requestedMode === 'interactive') {
          // Respect the user's explicit interactive choice. Inference may narrow
          // the pack, but won't downgrade to static.
          mode = 'interactive';
          pack = inferred.pack ?? capabilityCeiling;
        } else {
          mode = inferred.mode;
          pack = inferred.pack;
          modeUpgraded = mode === 'interactive';
        }
      }
    }

    // Layer 2 regex fallback — runs when inference is disabled, ceiling is
    // missing, or inference returned null (timeout/parse failure). Only upgrades
    // when a ceiling exists; without one there's no Capabilities block to emit.
    if (!inferenceUsed) {
      if (requestedMode === 'static' && capabilityCeiling && detectsInteractiveIntent(prompt)) {
        mode = 'interactive';
        modeUpgraded = true;
      }
      pack = mode === 'interactive' ? capabilityCeiling : null;
    }

    const resolvedSurface = resolveSurfaceGenerationPlan({
      prompt,
      mode,
      scriptPolicy,
      capabilities: pack,
      rawSurfacePlan: req.body?.surfacePlan,
      rawSurfaceCeiling: req.body?.surfaceCeiling,
    });
    if (mode !== resolvedSurface.mode) {
      modeUpgraded = mode === 'static' && resolvedSurface.mode === 'interactive' ? true : modeUpgraded;
      mode = resolvedSurface.mode;
      pack = mode === 'interactive' ? pack ?? capabilityCeiling : null;
    }
    scriptPolicy = resolvedSurface.scriptPolicy;
    surfacePlan = resolvedSurface.surfacePlan;
  }

  if (ghostContext) {
    ghostContext = prepareGhostSurfacePrompt(ghostContext, {
      userPrompt: prompt,
      mode,
      surfacePlan,
      shape,
      capabilities: hasSurfacePolicy
        ? capabilityCeiling
        : agentPlan
          ? agentPlan.compiledPolicy.capabilities
          : pack,
      components: componentPack,
    });
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');

  const preludeLines: ProtocolLine[] = [];

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
    if (ghostContext.source === 'root' && ghostContext.capsule) {
      preludeLines.push({
        op: 'meta',
        path: '/ghost-capsule',
        value: ghostCapsuleMeta(ghostContext.capsule),
      });
    }
  }
  // Emit the mode-upgrade signal before agent diagnostics. The client respawns
  // its sandbox into interactive mode in response, so this should land before
  // any broker or artifact bytes that assume the upgraded mode.
  if (modeUpgraded) {
    preludeLines.push({ op: 'meta', path: '/mode-upgraded', value: 'static→interactive' });
  }
  if (agentPlan) {
    preludeLines.push({
      op: 'meta',
      path: '/agent-intent',
      value: agentPlan.intent,
    });
    preludeLines.push({
      op: 'meta',
      path: '/agent-policy-resolution',
      value: {
        source: agentPlan.policyResolution.source,
        proposedSurfacePolicy: agentPlan.policyResolution.proposedSurfacePolicy,
        surfacePolicy: agentPlan.policyResolution.surfacePolicy,
        rejectedCapabilities: agentPlan.policyResolution.rejectedCapabilities,
        rejectedComponents: agentPlan.policyResolution.rejectedComponents,
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
  if (fragmentMode !== 'section' && !edit) {
    preludeLines.push({
      op: 'meta',
      path: '/experimental-fragments',
      value: { mode: fragmentMode },
    });
  }
  if (edit) {
    preludeLines.push({
      op: 'meta',
      path: '/edit',
      value: {
        mode: 'section-replace',
        baseRevision: edit.baseRevision,
        targetSections: edit.targetSections ?? edit.sections.map((section) => section.id),
      },
    });
  }
  if (overrides.applied.length > 0) {
    // Surface the resolved overrides so the client can paint them into the
    // iframe stylesheet. Rejected entries are surfaced too — a host that
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
    try {
      let usage: ProviderUsageSnapshot | null = null;
      const repair: SurfaceRepairOptions = repairOptions.enabled
        ? { ...repairOptions, provider: (request) => modelProvider.repairSurfaceSection(request, modelSelection) }
        : { enabled: false };
      const summary: SurfaceGenerationSummary = await runSurfaceGeneration({
        prompt,
        mode,
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
        layout,
        edit,
        experimentalPromptBlock: fragmentMode !== 'section' && !edit
          ? {
              id: `experimental-fragments:${fragmentMode}`,
              text: fragmentMode === 'html-node-v0'
                ? EXPERIMENTAL_HTML_NODE_PROMPT
                : EXPERIMENTAL_BLOCK_FRAGMENT_PROMPT,
              cache: 'ephemeral',
            }
          : null,
        experimentalFragmentMode: !edit ? fragmentMode : 'section',
        capabilities: hasSurfacePolicy || agentPlan ? capabilityCeiling : pack,
        components: componentPack,
        surfacePolicy: hasSurfacePolicy
          ? req.body.surfacePolicy
          : agentPlan
            ? agentPlan.surfacePolicy
            : null,
        scriptPolicy: hasSurfacePolicy || agentPlan ? undefined : scriptPolicy,
        surfacePlan: hasSurfacePolicy || agentPlan ? null : surfacePlan,
        tokenOverrides: overrides.applied,
        activeTokensCss: ghostContext?.tokenSource.css ?? direction?.tokensCss ?? null,
        preludeLines,
        repair,
        modelProvider: (request) => modelProvider.streamSurfaceGeneration(request, (nextUsage) => {
          usage = nextUsage;
        }, modelSelection),
      }, (line) => {
        res.write(`${JSON.stringify(line)}\n`);
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
        res.write(`${JSON.stringify(reviewLine)}\n`);
      }
      const finalUsage = usage ?? {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      };
      const stats = summary.repairStats ?? { queued: 0, cancelled: 0, repaired: 0, failed: 0 };
      const upgradeTag = modeUpgraded ? ` (upgraded ${inferenceUsed ? 'via inference' : 'via regex'})` : '';
      console.log(
        `[generate] provider=${modelProvider.id}/${modelSelection.generationModel} utility=${modelSelection.utilityModel} dir=${directionId ?? 'none'} ghost=${ghostContext ? ghostLogId(ghostContext) : 'none'} mode=${mode}${upgradeTag}` +
          ` shape=${shape ?? 'all'}` +
          ` layout=${layout?.id ?? 'none'}` +
          ` edit=${edit ? 'yes' : 'no'}` +
          ` surface=${surfacePlan.purpose}/${surfacePlan.runtime}/${surfacePlan.data}/${surfacePlan.authority}/${surfacePlan.persistence}` +
          ` intents=${pack?.intents.length ?? 0}/${capabilityCeiling?.intents.length ?? 0}` +
          ` components=${componentPack?.components.length ?? 0}` +
          ` scripts=${scriptPolicy}` +
          ` overrides=${overrides.applied.length}` +
          ` repair=${repairOptions.enabled ? `${stats.repaired}/${stats.queued}` : 'off'}` +
          ` options=max:${modelSelection.options.maxOutputTokens}/repair:${modelSelection.options.repairMaxOutputTokens}` +
          (modelSelection.options.anthropicThinking ? ` thinking=${modelSelection.options.anthropicThinking}` : '') +
          (modelSelection.options.effort ? ` effort=${modelSelection.options.effort}` : '') +
          (modelSelection.customModel ? ' customModel=yes' : '') +
          ` validation=${summary.validationIssues.length}${summary.blocked ? '(blocked)' : ''}` +
          (overrides.rejected.length > 0 ? `(rejected ${overrides.rejected.length})` : '') +
          ` usage in=${finalUsage.input_tokens} out=${finalUsage.output_tokens}` +
          ` cache_read=${finalUsage.cache_read_input_tokens ?? 0}` +
          ` cache_write=${finalUsage.cache_creation_input_tokens ?? 0}`
      );
      res.end();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[generate] error:', msg);
      res.write(`${JSON.stringify({ op: 'meta', path: '/error', value: msg } satisfies ProtocolLine)}\n`);
      res.end();
    }
  });
});

function ghostLogId(context: ResolvedGhostSteer): string {
  return context.source === 'root'
    ? context.request.rootId
    : (context.request.id ?? 'resolved-context');
}

app.listen(PORT, () => {
  console.log(`[summon-server] listening on http://localhost:${PORT}`);
  console.log(`[summon-server] CORS origin: ${ALLOWED_ORIGIN}`);
});
