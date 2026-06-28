#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const bakeoffRoot = join(rootDir, 'apps/server/.bakeoff');

const runtimeValues = [
  'arrow-control',
  'html-static',
  'html-stream',
];
const streamRuntimes = new Set(['html-stream']);

const bundles = [
  {
    id: 'redline-cinema',
    promptFile: 'apps/server/fingerprints/bundles/redline-cinema/fingerprint/sources/curation/dogfood-prompts-2026-06-22.md',
  },
  {
    id: 'console-chrome-2001',
    promptFile: 'apps/server/fingerprints/bundles/console-chrome-2001/fingerprint/sources/curation/dogfood-eval-prompts-2026-06-22.md',
  },
  {
    id: 'signal-stream',
    promptFile: 'apps/server/fingerprints/bundles/signal-stream/examples/dogfood/prompts.md',
  },
  {
    id: 'technical-contrast',
    promptFile: 'apps/server/fingerprints/bundles/technical-contrast/examples/dogfood/prompts.md',
  },
];

const argv = parseArgs(process.argv.slice(2));
const prompts = sample(
  (await loadPrompts()).filter((prompt) => (
    argv.fingerprints.length === 0 || argv.fingerprints.includes(prompt.fingerprint)
  )),
  argv.prompts,
  argv.seed,
);
const runtimes = argv.runtimes.length > 0 ? argv.runtimes : runtimeValues;
const matrix = prompts.flatMap((prompt) =>
  runtimes.map((runtime) => ({
    id: `${prompt.id}-${runtime}`,
    runtime,
    fingerprint: prompt.fingerprint,
    prompt: prompt.prompt,
    promptFile: prompt.promptFile,
  })),
);

if (prompts.length === 0) {
  console.error('[runtime-bakeoff] no prompts matched the selected fingerprints');
  process.exit(1);
}
if (runtimes.length === 0) {
  console.error('[runtime-bakeoff] no runtimes selected');
  process.exit(1);
}

console.log(
  `[runtime-bakeoff] ${prompts.length} prompt(s) × ${runtimes.length} runtime(s) = ${matrix.length} run(s) base=${argv.baseUrl} dry=${argv.dry}`,
);

if (argv.dry) {
  for (const run of matrix) {
    console.log(`- ${run.id}`);
  }
  process.exit(0);
}

const runs = [];
for (const item of matrix) {
  const run = await runOne(item, argv.baseUrl);
  runs.push(run);
  const blocked = run.metrics.blocked ? ' blocked' : '';
  const ok = run.ok ? 'ok' : 'fail';
  console.log(
    `[${run.runtime}] ${run.fingerprint}/${run.promptId} ${ok}${blocked} ttfp=${formatMetricMs(run.metrics.ttfp)} tti=${formatMetricMs(run.metrics.tti)}`,
  );
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = join(bakeoffRoot, timestamp);
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'runs.json'), `${JSON.stringify({
  schema: 'summon.runtime-bakeoff-runs/v1',
  generatedAt: new Date().toISOString(),
  baseUrl: argv.baseUrl,
  seed: argv.seed,
  prompts: argv.prompts,
  runtimes,
  runs,
}, null, 2)}\n`);
await writeFile(join(outDir, 'report.md'), buildReport(runs, { baseUrl: argv.baseUrl, seed: argv.seed }));
console.log(`\n[runtime-bakeoff] wrote ${outDir}`);

async function runOne(item, baseUrl) {
  const startedAt = performance.now();
  let firstByteSeen = false;
  let bytes = 0;
  let buffer = '';
  let serverMetrics = null;
  let ttfb = null;
  let ttfp = null;
  let artifactTti = null;
  let patchTti = null;
  let artifactSeen = false;
  const errors = [];
  const decoder = new TextDecoder();

  let status = 0;
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: item.prompt,
        experimentalRuntime: item.runtime,
        fingerprint: {
          id: item.fingerprint,
          targetPath: '.',
        },
        agent: { enabled: true },
      }),
    });
    status = response.status;
    if (!response.ok) {
      errors.push(`HTTP ${response.status}: ${await response.text().catch(() => response.statusText)}`);
    } else if (!response.body) {
      errors.push('response body missing');
    } else {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!value) continue;
          if (!firstByteSeen) {
            firstByteSeen = true;
            ttfb = roundMs(performance.now() - startedAt);
          }
          bytes += value.byteLength;
          buffer += decoder.decode(value, { stream: true });
          let nl = buffer.indexOf('\n');
          while (nl !== -1) {
            const raw = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 1);
            applyProtocolLine(raw);
            nl = buffer.indexOf('\n');
          }
        }
      } finally {
        reader.releaseLock();
      }
      buffer += decoder.decode();
      const tail = buffer.trim();
      if (tail) applyProtocolLine(tail);
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  const complete = roundMs(performance.now() - startedAt);
  const metrics = {
    runtime: item.runtime,
    ttfb,
    ttfp,
    tti: streamRuntimes.has(item.runtime) ? patchTti ?? artifactTti : artifactTti,
    complete,
    repairs: readCount(serverMetrics?.repairs, 0),
    blocked: serverMetrics?.blocked === true,
    validationCount: readCount(serverMetrics?.validationCount, 0),
    safetyViolations: readCount(serverMetrics?.safetyViolations, 0),
    bytes,
  };
  return {
    promptId: item.id.replace(`-${item.runtime}`, ''),
    prompt: item.prompt,
    promptFile: item.promptFile,
    fingerprint: item.fingerprint,
    runtime: item.runtime,
    ok: errors.length === 0 && artifactSeen && !metrics.blocked,
    httpStatus: status,
    artifactSeen,
    metrics,
    errors,
  };

  function applyProtocolLine(raw) {
    const line = parseProtocolLine(raw);
    if (!line) return;
    const elapsed = roundMs(performance.now() - startedAt);
    if (line.op === 'meta' && line.path === '/run-metrics') {
      serverMetrics = line.value && typeof line.value === 'object' ? line.value : null;
      return;
    }
    if (line.op === 'meta' && line.path === '/html-stream-preview' && ttfp === null) {
      ttfp = elapsed;
      return;
    }
    if (line.op === 'event' && line.path === '/surface' && isPaintEvent(line.value) && ttfp === null) {
      ttfp = elapsed;
      return;
    }
    if (line.op === 'artifact' && line.path === '/artifact') {
      artifactSeen = true;
      if (artifactTti === null) artifactTti = elapsed;
      return;
    }
    if (line.op === 'patch' && line.path === '/artifact/html-patch' && patchTti === null) {
      patchTti = elapsed;
    }
  }
}

async function loadPrompts() {
  const prompts = [];
  for (const bundle of bundles) {
    const text = await readFile(join(rootDir, bundle.promptFile), 'utf8');
    for (const [index, prompt] of extractPrompts(text).entries()) {
      prompts.push({
        id: `${bundle.id}-${String(index + 1).padStart(2, '0')}`,
        fingerprint: bundle.id,
        prompt,
        promptFile: bundle.promptFile,
      });
    }
  }
  return prompts;
}

function buildReport(runs, options) {
  const rows = aggregateRows(runs);
  return [
    '# Runtime Bakeoff Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Base URL: ${options.baseUrl}`,
    `Seed: ${options.seed}`,
    '',
    '| Runtime | Runs | Success | Block | TTFB | TTFP | TTI | Complete | Bytes | Repairs | Safety |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows.map((row) => [
      row.runtime,
      row.runs,
      formatRate(row.ok, row.runs),
      formatRate(row.blocked, row.runs),
      formatMetricMs(row.avgTtfb),
      formatMetricMs(row.avgTtfp),
      formatMetricMs(row.avgTti),
      formatMetricMs(row.avgComplete),
      `${Math.round(row.avgBytes)} B`,
      formatAverage(row.avgRepairs),
      row.safetyViolations,
    ].join(' | ')).map((row) => `| ${row} |`),
    '',
    '## Kill Criteria Notes',
    '',
    '- Keep `html-stream` only if TTFP is at least 40% lower than `html-static` and block rate is at most 1.5x `html-static`.',
    '- `arrow-control` is the secure default. `html-static` (inert) and `html-stream` remain experiments.',
    '',
  ].join('\n');
}

function aggregateRows(runs) {
  return runtimeValues
    .map((runtime) => {
      const items = runs.filter((run) => run.runtime === runtime);
      if (items.length === 0) return null;
      return {
        runtime,
        runs: items.length,
        ok: items.filter((run) => run.ok).length,
        blocked: items.filter((run) => run.metrics.blocked).length,
        avgTtfb: averageMetric(items, (run) => run.metrics.ttfb),
        avgTtfp: averageMetric(items, (run) => run.metrics.ttfp),
        avgTti: averageMetric(items, (run) => run.metrics.tti),
        avgComplete: averageMetric(items, (run) => run.metrics.complete),
        avgBytes: averageNumber(items.map((run) => run.metrics.bytes)),
        avgRepairs: averageNumber(items.map((run) => run.metrics.repairs)),
        safetyViolations: items.reduce((sum, run) => sum + run.metrics.safetyViolations, 0),
      };
    })
    .filter(Boolean);
}

function parseArgs(args) {
  const parsed = {
    baseUrl: 'http://localhost:3001',
    prompts: 5,
    seed: 1,
    fingerprints: [],
    runtimes: [],
    dry: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dry') {
      parsed.dry = true;
    } else if (arg === '--base-url') {
      parsed.baseUrl = requireValue(args, ++index, arg);
    } else if (arg === '--prompts') {
      parsed.prompts = Math.max(1, Number(requireValue(args, ++index, arg)) || parsed.prompts);
    } else if (arg === '--seed') {
      parsed.seed = Number(requireValue(args, ++index, arg)) || parsed.seed;
    } else if (arg === '--fingerprints') {
      parsed.fingerprints = splitList(requireValue(args, ++index, arg));
    } else if (arg === '--runtimes') {
      parsed.runtimes = splitList(requireValue(args, ++index, arg));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  const invalidRuntimes = parsed.runtimes.filter((runtime) => !runtimeValues.includes(runtime));
  if (invalidRuntimes.length > 0) {
    throw new Error(`Unsupported runtime(s): ${invalidRuntimes.join(', ')}`);
  }
  return parsed;
}

function requireValue(args, index, flag) {
  const value = args[index];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
}

function splitList(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function extractPrompts(markdown) {
  const fenced = markdown.matchAll(/```(?:prompt|text)?\n([\s\S]*?)```/g);
  const fromFences = Array.from(fenced, (match) => cleanPrompt(match[1])).filter(Boolean);
  if (fromFences.length > 0) return fromFences;

  const explicit = Array.from(
    markdown.matchAll(/(?:^|\n)\s*(?:[-*]\s*)?(?:\*\*)?(?:Exact prompt|Prompt)(?:\*\*)?\s*:\s*(.+)/gi),
    (match) => cleanPrompt(match[1]),
  ).filter(Boolean);
  if (explicit.length > 0) return explicit;

  const bullets = markdown
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, '').trim())
    .map(cleanPrompt)
    .filter(isPromptLikeLine);
  return bullets.length > 0 ? bullets : [markdown.trim()].filter(Boolean);
}

function cleanPrompt(value) {
  return String(value ?? '')
    .trim()
    .replace(/^\*\*/, '')
    .replace(/\*\*$/, '')
    .replace(/^["'“”`]+/, '')
    .replace(/["'“”`]+$/, '')
    .trim();
}

function isPromptLikeLine(line) {
  if (line.length < 20 || line.startsWith('#')) return false;
  if (/^(use these|score each|claims under test|eval axis|expected|strong output|likely failure)/i.test(line)) {
    return false;
  }
  return /^(create|design|build|make|generate)\b/i.test(line);
}

function parseProtocolLine(raw) {
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if (typeof parsed.op !== 'string' || typeof parsed.path !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function isPaintEvent(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.type !== 'surface.status',
  );
}

function sample(items, count, seed) {
  const rng = mulberry32(seed >>> 0);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = copy[i];
    copy[i] = copy[j];
    copy[j] = a;
  }
  return copy.slice(0, Math.min(count, copy.length));
}

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function averageMetric(items, getter) {
  const values = items.map(getter).filter((value) => typeof value === 'number');
  if (values.length === 0) return null;
  return averageNumber(values);
}

function averageNumber(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatMetricMs(value) {
  if (value === null) return 'n/a';
  return `${Math.round(value)}ms`;
}

function formatAverage(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatRate(value, total) {
  if (total <= 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

function readCount(value, fallback) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function roundMs(value) {
  return Math.max(0, Math.round(value));
}
