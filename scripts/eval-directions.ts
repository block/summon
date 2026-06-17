#!/usr/bin/env tsx
/**
 * eval-directions — drive a fixed prompt pool × directions matrix through the
 * generation engine, then score each Arrow artifact for token-contract
 * violations and artifact validity. Emits per-run JSON + a human-readable markdown report
 * under `apps/server/directions/.eval/<timestamp>/`.
 *
 *   pnpm eval-directions [--prompts N] [--directions id,id] [--seed N] [--dry]
 *
 * --prompts    how many prompts to sample from the pool (default 5)
 * --directions which directions to run (default: all)
 * --seed       deterministic prompt sample seed (default 1)
 * --dry        validate plumbing without making any LLM calls (cost: $0)
 *
 * Each artifact is scored on:
 *
 *   phantomTokens — `var(--*)` references in emitted Arrow source that the direction
 *                   does NOT define. The most expensive failure mode (silent
 *                   un-themed render); zero is the bar.
 *   literalDrift — raw `#rrggbb` hex literals in emitted Arrow source, classified
 *                  against the direction's tokens.css and (when present)
 *                  bucket.json. Three tiers:
 *                    drift        — hex matches a value in tokens.css
 *                                   (LLM hard-coded a value the design has a
 *                                    token for; prompt-tightening signal)
 *                    knownSource  — hex is in bucket.json but not tokens.css
 *                                   (upstream brand has it, Summon's token
 *                                    contract doesn't capture the slot)
 *                    hallucinated — hex is in neither (LLM invented a value
 *                                   outside the brand entirely; treated like
 *                                   phantom-token, fails the run)
 *   artifactMissing — no accepted Arrow `/artifact` line was emitted.
 *
 * This is a Summon smoke tool, not a design-fidelity judge. External review
 * tooling owns expression fidelity and perceptual design scoring.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SUMMON_FIXED_INSTRUCTIONS,
  buildDirectionBlock,
  coerceOpts,
  compileTokenContract,
  parseTokenValues,
  type DirectionOpts,
} from '../packages/engine/src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');
const SERVER_ROOT = join(REPO_ROOT, 'apps', 'server');
const DIRECTIONS_ROOT = join(SERVER_ROOT, 'directions');
const EVAL_ROOT = join(DIRECTIONS_ROOT, '.eval');
const SAMPLES_PATH = join(REPO_ROOT, 'apps', 'demo', 'src', 'prompts.ts');
const MODEL = process.env.SUMMON_EVAL_MODEL ?? 'claude-sonnet-4-6';

loadDotEnv(join(SERVER_ROOT, '.env'));

const argv = parseArgs(process.argv.slice(2));

if (!argv.dry && !process.env.ANTHROPIC_API_KEY) {
  console.error(
    '[eval-directions] ANTHROPIC_API_KEY is not set. Use --dry to skip the LLM calls.',
  );
  process.exit(1);
}

const directions = loadDirections().filter((d) =>
  argv.directions.length === 0 ? true : argv.directions.includes(d.id),
);
if (directions.length === 0) {
  console.error('[eval-directions] no directions matched the filter');
  process.exit(1);
}

const prompts = sample(loadSamples(), argv.prompts, argv.seed);
console.log(
  `[eval-directions] ${directions.length} direction(s) × ${prompts.length} prompt(s) = ${directions.length * prompts.length} runs (model=${MODEL}, dry=${argv.dry})`,
);

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = join(EVAL_ROOT, timestamp);
if (!argv.dry) mkdirSync(outDir, { recursive: true });

const client = argv.dry ? null : new Anthropic();
const allRuns: RunResult[] = [];

for (const dir of directions) {
  for (const prompt of prompts) {
    const run = await runOne(client, dir, prompt);
    allRuns.push(run);
    const summary = run.skipped
      ? 'SKIP'
      : (() => {
          const halluc = run.literalDrift.filter((l) => l.tier === 'hallucinated').length;
          const drift = run.literalDrift.filter((l) => l.tier === 'drift').length;
          return `phantom=${run.phantomTokens.length} hallucinated=${halluc} drift=${drift} artifact=${run.artifactFiles.join(',') || 'missing'}`;
        })();
    console.log(
      `[${dir.id}] ${prompt.slice(0, 60).padEnd(62, ' ')} ${summary}`,
    );
  }
}

if (!argv.dry) {
  writeFileSync(join(outDir, 'runs.json'), JSON.stringify(allRuns, null, 2));
  writeFileSync(join(outDir, 'report.md'), buildReport(allRuns, directions));
  console.log(`\n[eval-directions] wrote ${outDir}`);
}

const phantomTotal = allRuns.reduce((n, r) => n + r.phantomTokens.length, 0);
const hallucinatedTotal = allRuns.reduce(
  (n, r) => n + r.literalDrift.filter((l) => l.tier === 'hallucinated').length,
  0,
);
const driftTotal = allRuns.reduce(
  (n, r) => n + r.literalDrift.filter((l) => l.tier === 'drift').length,
  0,
);
const knownSourceTotal = allRuns.reduce(
  (n, r) => n + r.literalDrift.filter((l) => l.tier === 'knownSource').length,
  0,
);
const artifactMissing = allRuns.filter((r) => !r.skipped && r.artifactMissing).length;
console.log(
  `\nsummary: ${phantomTotal} phantom · ${hallucinatedTotal} hallucinated · ${driftTotal} drift · ${knownSourceTotal} known-source · ${artifactMissing} missing artifact(s) across ${allRuns.length} runs`,
);
if (phantomTotal > 0 || hallucinatedTotal > 0) process.exitCode = 1;

// ---------------------------------------------------------------------------

interface RunResult {
  directionId: string;
  prompt: string;
  skipped: boolean;
  artifactFiles: string[];
  artifactMissing: boolean;
  phantomTokens: PhantomIncident[];
  literalDrift: LiteralIncident[];
  errors: string[];
}

interface PhantomIncident {
  token: string;
  file: string;
}

type LiteralTier = 'drift' | 'knownSource' | 'hallucinated';

interface LiteralIncident {
  hex: string;
  tier: LiteralTier;
  file: string;
}

interface DirectionRow {
  id: string;
  name: string;
  tokensCss: string;
  prompt: string;
  exemplars: ExemplarRow[];
  opts: DirectionOpts;
  liveOpportunistic: string[];
  defined: Set<string>;
  /** Hex literals (`#rrggbb`, lowercased) declared in tokens.css. Used to
   *  classify a raw hex in emitted Arrow source as "drift" (LLM bypassed the var). */
  tokenHexValues: Set<string>;
  /** Hex literals from the source bucket.json, when present. Used to
   *  classify the in-between tier — bucket has it, tokens.css doesn't. */
  bucketColors: Set<string>;
}

interface ExemplarRow {
  name: string;
  content: string;
  kind: 'atom' | 'shape';
  shape?: string;
}

async function runOne(
  client: Anthropic | null,
  dir: DirectionRow,
  prompt: string,
): Promise<RunResult> {
  if (!client) {
    return {
      directionId: dir.id,
      prompt,
      skipped: true,
      artifactFiles: [],
      artifactMissing: false,
      phantomTokens: [],
      literalDrift: [],
      errors: [],
    };
  }

  const directionBlock = buildDirectionBlock({
    prompt: dir.prompt,
    exemplars: dir.exemplars,
    opts: dir.opts,
    liveOpportunistic: dir.liveOpportunistic,
    shape: null,
  });

  const errors: string[] = [];
  let raw = '';
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: [
        { type: 'text', text: SUMMON_FIXED_INSTRUCTIONS, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: directionBlock, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: prompt }],
    });
    const block = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    raw = block?.text ?? '';
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  const artifactFiles = parseArtifact(raw);
  const phantomTokens = scanPhantomTokens(artifactFiles, dir.defined);
  const literalDrift = scanLiteralDrift(artifactFiles, dir.tokenHexValues, dir.bucketColors);

  return {
    directionId: dir.id,
    prompt,
    skipped: false,
    artifactFiles: artifactFiles.map((file) => file.name),
    artifactMissing: artifactFiles.length === 0,
    phantomTokens,
    literalDrift,
    errors,
  };
}

function parseArtifact(raw: string): Array<{ name: string; text: string }> {
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!parsed || typeof parsed !== 'object') continue;
    const obj = parsed as Record<string, unknown>;
    if (obj.op === 'artifact' && obj.path === '/artifact' && obj.value && typeof obj.value === 'object') {
      const value = obj.value as { runtime?: unknown; source?: unknown };
      if (value.runtime !== 'arrow' || !value.source || typeof value.source !== 'object' || Array.isArray(value.source)) {
        continue;
      }
      return Object.entries(value.source as Record<string, unknown>)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
        .map(([name, text]) => ({ name, text }));
    }
  }
  return [];
}

function scanPhantomTokens(
  files: Array<{ name: string; text: string }>,
  defined: Set<string>,
): PhantomIncident[] {
  const incidents: PhantomIncident[] = [];
  const re = /var\(--([a-zA-Z0-9_-]+)/g;
  for (const file of files) {
    const seen = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = re.exec(file.text)) !== null) {
      const name = match[1]!;
      if (defined.has(name) || seen.has(name)) continue;
      seen.add(name);
      incidents.push({ token: name, file: file.name });
    }
  }
  return incidents;
}

/**
 * Scans for raw `#rrggbb` hex literals in emitted Arrow source. Hex inside a
 * `var(--name, #fallback)` expression is intentional and ignored — the
 * LLM's primary tool there is the var, not the fallback.
 *
 * Each hex is classified into a tier based on whether it resolves to a
 * declared token value, the upstream brand bucket, or neither. Tiers map
 * to remediation: drift → tighten the prompt, knownSource → expand the
 * token contract, hallucinated → treat as a regression.
 *
 * Only `#rrggbb` (6-char) is matched today. Shorthand `#rgb`, alpha hex
 * `#rrggbbaa`, and rgba()/oklch()/hsl() are deferred to v2 — bucket.json
 * carries those formats but the comparison gets fiddly fast and we want
 * a tight false-positive baseline first.
 */
function scanLiteralDrift(
  files: Array<{ name: string; text: string }>,
  tokenHex: Set<string>,
  bucketColors: Set<string>,
): LiteralIncident[] {
  const incidents: LiteralIncident[] = [];
  const re = /#([0-9a-fA-F]{6})\b/g;
  for (const file of files) {
    const cleaned = file.text.replace(/var\([^)]*\)/g, '');
    const seen = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = re.exec(cleaned)) !== null) {
      const hex = `#${match[1]!.toLowerCase()}`;
      if (seen.has(hex)) continue;
      seen.add(hex);
      const tier: LiteralTier = tokenHex.has(hex)
        ? 'drift'
        : bucketColors.has(hex)
          ? 'knownSource'
          : 'hallucinated';
      incidents.push({ hex, tier, file: file.name });
    }
  }
  return incidents;
}

function buildReport(runs: RunResult[], dirs: DirectionRow[]): string {
  const lines: string[] = [];
  lines.push(`# Direction eval — ${new Date().toISOString()}\n`);
  lines.push(`Model: \`${MODEL}\`\n`);
  lines.push(`Runs: ${runs.length}\n`);
  for (const dir of dirs) {
    const dirRuns = runs.filter((r) => r.directionId === dir.id);
    const phantoms = dirRuns.flatMap((r) =>
      r.phantomTokens.map((p) => ({ ...p, prompt: r.prompt })),
    );
    const missingArtifacts = dirRuns.filter((r) => r.artifactMissing);
    const literals = dirRuns.flatMap((r) =>
      r.literalDrift.map((l) => ({ ...l, prompt: r.prompt })),
    );
    const hallucinated = literals.filter((l) => l.tier === 'hallucinated');
    const drift = literals.filter((l) => l.tier === 'drift');
    const knownSource = literals.filter((l) => l.tier === 'knownSource');
    const bucketState = dir.bucketColors.size > 0
      ? `bucket.json present (${dir.bucketColors.size} colors)`
      : 'no bucket.json — knownSource tier disabled';
    lines.push(`\n## ${dir.name} (\`${dir.id}\`)\n`);
    lines.push(`- Phantom-token incidents: **${phantoms.length}**`);
    lines.push(`- Hallucinated hex literals: **${hallucinated.length}**`);
    lines.push(`- Drift hex literals (in tokens.css): **${drift.length}**`);
    lines.push(`- Known-source hex literals (in bucket.json only): **${knownSource.length}**`);
    lines.push(`- Missing Arrow artifacts: **${missingArtifacts.length}**`);
    lines.push(`- Source: ${bucketState}`);
    if (phantoms.length > 0) {
      lines.push('\nPhantom tokens:');
      for (const p of phantoms) {
        lines.push(
          `- \`--${p.token}\` in \`${p.file}\` (prompt: "${p.prompt.slice(0, 60)}…")`,
        );
      }
    }
    if (hallucinated.length > 0) {
      lines.push('\nHallucinated hex literals (not in tokens.css or bucket.json):');
      for (const l of hallucinated) {
        lines.push(
          `- \`${l.hex}\` in \`${l.file}\` (prompt: "${l.prompt.slice(0, 60)}…")`,
        );
      }
    }
    if (drift.length > 0) {
      lines.push('\nDrift hex literals (LLM bypassed `var(--*)`):');
      for (const l of drift) {
        lines.push(
          `- \`${l.hex}\` in \`${l.file}\` (prompt: "${l.prompt.slice(0, 60)}…")`,
        );
      }
    }
    if (knownSource.length > 0) {
      lines.push('\nKnown-source hex literals (gap in token contract — bucket has it, tokens.css does not):');
      for (const l of knownSource) {
        lines.push(
          `- \`${l.hex}\` in \`${l.file}\` (prompt: "${l.prompt.slice(0, 60)}…")`,
        );
      }
    }
    if (missingArtifacts.length > 0) {
      lines.push('\nMissing Arrow artifacts:');
      for (const r of missingArtifacts) {
        lines.push(
          `- no /artifact line (prompt: "${r.prompt.slice(0, 60)}…")`,
        );
      }
    }
  }
  return lines.join('\n') + '\n';
}

// --- mini-loader (avoids depending on apps/server's loader from a root script) ---

function loadDirections(): DirectionRow[] {
  if (!existsSync(DIRECTIONS_ROOT)) return [];
  const ids = readdirSync(DIRECTIONS_ROOT).filter((id) => {
    if (id.startsWith('.')) return false;
    return statSync(join(DIRECTIONS_ROOT, id)).isDirectory();
  });
  const out: DirectionRow[] = [];
  for (const id of ids) {
    const dir = join(DIRECTIONS_ROOT, id);
    const promptPath = join(dir, 'prompt.md');
    const tokensPath = join(dir, 'tokens.css');
    if (!existsSync(promptPath) || !existsSync(tokensPath)) continue;
    const tokensCss = readFileSync(tokensPath, 'utf-8');
    const meta = readMeta(dir);
    const opts = coerceOpts(meta.opts);
    const validation = compileTokenContract({ css: tokensCss, opts });
    const blocking = validation.issues.filter((issue) => issue.severity === 'block');
    if (blocking.length > 0) {
      console.warn(
        `[eval-directions] skipping "${id}" — token contract violations:\n  ${blocking.map((issue) => issue.message).join('\n  ')}`,
      );
      continue;
    }
    out.push({
      id,
      name: meta.name ?? id,
      tokensCss,
      prompt: readFileSync(promptPath, 'utf-8'),
      exemplars: readExemplars(dir),
      opts,
      liveOpportunistic: validation.liveOpportunistic,
      defined: validation.definedTokens,
      tokenHexValues: extractHexValues(tokensCss),
      bucketColors: readBucketColors(dir),
    });
  }
  return out;
}

/**
 * Pulls the hex literals declared in tokens.css into a Set, so the
 * literal-drift scanner can ask "did the LLM hard-code a value the
 * design language already has a token for?" Lowercased, `#rrggbb` only
 * (matches the scanner's recognition shape).
 */
function extractHexValues(css: string): Set<string> {
  const values = parseTokenValues(css);
  const out = new Set<string>();
  for (const value of values.values()) {
    const m = value.match(/^#([0-9a-fA-F]{6})$/);
    if (m) out.add(`#${m[1]!.toLowerCase()}`);
  }
  return out;
}

/**
 * Reads the optional `bucket.json` snapshot co-located with the direction.
 * Returns the set of `#rrggbb` color values from the bucket, lowercased.
 * Missing or malformed file → empty set (knownSource tier silently
 * disabled for that direction).
 */
function readBucketColors(dir: string): Set<string> {
  const path = join(dir, 'bucket.json');
  if (!existsSync(path)) return new Set();
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8')) as {
      values?: { kind?: string; value?: string }[];
    };
    const out = new Set<string>();
    for (const entry of data.values ?? []) {
      if (entry.kind !== 'color' || typeof entry.value !== 'string') continue;
      const m = entry.value.match(/^#([0-9a-fA-F]{6})$/);
      if (m) out.add(`#${m[1]!.toLowerCase()}`);
    }
    return out;
  } catch {
    return new Set();
  }
}

function readMeta(dir: string): { name?: string; description?: string; opts?: unknown } {
  const path = join(dir, 'meta.json');
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return {};
  }
}

function readExemplars(dir: string): ExemplarRow[] {
  const exDir = join(dir, 'exemplars');
  if (!existsSync(exDir)) return [];
  return readdirSync(exDir)
    .filter((f) => f.endsWith('.html'))
    .sort()
    .map((f) => {
      const content = readFileSync(join(exDir, f), 'utf-8');
      const head = content.slice(0, 400);
      const m = /<!--\s*summon:\s*([^>]+?)\s*-->/.exec(head);
      let kind: 'atom' | 'shape' = 'shape';
      let shape: string | undefined;
      if (m) {
        for (const part of m[1]!.split(';')) {
          const [k, v] = part.split('=').map((s) => s.trim());
          if (k === 'kind' && v === 'atom') kind = 'atom';
          else if (k === 'shape' && v) shape = v;
        }
      }
      return { name: f.replace(/\.html$/, ''), content, kind, shape };
    });
}

function loadSamples(): string[] {
  const src = readFileSync(SAMPLES_PATH, 'utf-8');
  const match = src.match(/SAMPLES:\s*string\[\]\s*=\s*\[([\s\S]*?)\];/);
  if (!match) {
    console.error('[eval-directions] could not parse SAMPLES from prompts.ts');
    process.exit(1);
  }
  const body = match[1]!;
  const lines = body.match(/(["'])([\s\S]*?)\1/g) ?? [];
  return lines.map((s) => s.slice(1, -1));
}

function sample<T>(pool: T[], n: number, seed: number): T[] {
  const rng = mulberry32(seed >>> 0);
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = copy[i]!;
    const b = copy[j]!;
    copy[i] = b;
    copy[j] = a;
  }
  return copy.slice(0, Math.min(n, copy.length));
}

function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadDotEnv(envPath: string): void {
  try {
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
    // No .env — fall through.
  }
}

interface ParsedArgs {
  prompts: number;
  directions: string[];
  seed: number;
  dry: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
  const out: ParsedArgs = { prompts: 5, directions: [], seed: 1, dry: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--prompts') out.prompts = Number(args[++i] ?? '5');
    else if (a === '--directions') out.directions = (args[++i] ?? '').split(',').filter(Boolean);
    else if (a === '--seed') out.seed = Number(args[++i] ?? '1');
    else if (a === '--dry') out.dry = true;
  }
  return out;
}
