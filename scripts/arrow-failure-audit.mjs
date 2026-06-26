#!/usr/bin/env node
// Arrow failure audit (experiment 2026-06-25)
//
// Measures what percentage of first-pass Arrow bundles from the LLM are
// accepted vs blocked, and buckets every blocking/validation issue by code.
//
// Runs the matrix twice per prompt:
//   - maxRepairAttempts=0  -> raw first-pass result + first-pass block code(s)
//   - maxRepairAttempts=1  -> final result after one repair (today's behavior)
//
// Usage:
//   node scripts/arrow-failure-audit.mjs --prompts 12 --base http://localhost:3001
//
// Requires the demo server running (pnpm dev:server) with API keys set.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const outRoot = join(rootDir, 'apps/server/.arrow-audit');

const bundles = [
  { id: 'redline-cinema', promptFile: 'apps/server/fingerprints/bundles/redline-cinema/fingerprint/sources/curation/dogfood-prompts-2026-06-22.md' },
  { id: 'console-chrome-2001', promptFile: 'apps/server/fingerprints/bundles/console-chrome-2001/fingerprint/sources/curation/dogfood-eval-prompts-2026-06-22.md' },
  { id: 'signal-stream', promptFile: 'apps/server/fingerprints/bundles/signal-stream/examples/dogfood/prompts.md' },
  { id: 'technical-contrast', promptFile: 'apps/server/fingerprints/bundles/technical-contrast/examples/dogfood/prompts.md' },
];

const argv = parseArgs(process.argv.slice(2));
const allPrompts = await loadPrompts();
const prompts = sample(
  allPrompts.filter((p) => argv.fingerprints.length === 0 || argv.fingerprints.includes(p.fingerprint)),
  argv.prompts,
  argv.seed,
);

if (prompts.length === 0) {
  console.error('[arrow-audit] no prompts matched');
  process.exit(1);
}

console.log(`[arrow-audit] ${prompts.length} prompt(s) × 2 repair settings = ${prompts.length * 2} run(s) base=${argv.baseUrl}`);

const runs = [];
for (const phase of [{ repair: 0, label: 'first-pass' }, { repair: 1, label: 'after-repair' }]) {
  for (const prompt of prompts) {
    const run = await runOne(prompt, phase, argv.baseUrl);
    runs.push(run);
    const codes = run.blockCodes.length ? ` block=[${run.blockCodes.join(',')}]` : '';
    console.log(
      `[${phase.label}] ${prompt.id} ${run.accepted ? 'OK ' : 'FAIL'} repairs=${run.repairs}${codes}`,
    );
  }
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = join(outRoot, timestamp);
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'runs.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl: argv.baseUrl, seed: argv.seed, prompts: prompts.length, runs }, null, 2)}\n`);
const report = buildReport(runs);
await writeFile(join(outDir, 'report.md'), report);
console.log(`\n${report}`);
console.log(`[arrow-audit] wrote ${outDir}`);

async function runOne(prompt, phase, baseUrl) {
  const startedAt = performance.now();
  const blockCodes = [];
  const observedCodes = [];
  const allValidationCodes = [];
  const errors = [];
  let serverMetrics = null;
  let artifactSeen = false;
  let diagnostic = null;
  let httpStatus = 0;
  const decoder = new TextDecoder();

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt.prompt,
        experimentalRuntime: 'arrow-control',
        maxRepairAttempts: phase.repair,
        fingerprint: { id: prompt.fingerprint, targetPath: '.' },
        agent: { enabled: true },
      }),
    });
    httpStatus = response.status;
    if (!response.ok) {
      errors.push(`HTTP ${response.status}: ${await response.text().catch(() => response.statusText)}`);
    } else if (response.body) {
      const reader = response.body.getReader();
      let buffer = '';
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!value) continue;
          buffer += decoder.decode(value, { stream: true });
          let nl = buffer.indexOf('\n');
          while (nl !== -1) {
            apply(buffer.slice(0, nl));
            buffer = buffer.slice(nl + 1);
            nl = buffer.indexOf('\n');
          }
        }
      } finally {
        reader.releaseLock();
      }
      buffer += decoder.decode();
      if (buffer.trim()) apply(buffer.trim());
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  const blocked = serverMetrics?.blocked === true;
  return {
    phase: phase.label,
    maxRepairAttempts: phase.repair,
    promptId: prompt.id,
    fingerprint: prompt.fingerprint,
    prompt: prompt.prompt,
    httpStatus,
    accepted: artifactSeen && !blocked && errors.length === 0,
    blocked,
    artifactSeen,
    repairs: readCount(serverMetrics?.repairs, 0),
    validationCount: readCount(serverMetrics?.validationCount, 0),
    blockCodes,
    observedCodes,
    allValidationCodes: [...new Set(allValidationCodes)],
    diagnostic,
    durationMs: Math.round(performance.now() - startedAt),
    errors,
  };

  function apply(raw) {
    const line = parseLine(raw);
    if (!line) return;
    if (line.op === 'meta' && line.path === '/run-metrics') {
      serverMetrics = line.value && typeof line.value === 'object' ? line.value : serverMetrics;
    } else if (line.op === 'meta' && line.path === '/validation-blocked') {
      const code = issueCode(line.value);
      if (code) { blockCodes.push(code); allValidationCodes.push(code); }
    } else if (line.op === 'meta' && line.path === '/validation-observed') {
      const code = issueCode(line.value);
      if (code) { observedCodes.push(code); allValidationCodes.push(code); }
    } else if (line.op === 'meta' && line.path === '/arrow-bundle-diagnostic') {
      diagnostic = line.value ?? diagnostic;
    } else if (line.op === 'artifact' && line.path === '/artifact') {
      artifactSeen = true;
    }
  }
}

function buildReport(runs) {
  const lines = ['# Arrow Failure Audit', '', `Generated: ${new Date().toISOString()}`, ''];
  for (const phase of ['first-pass', 'after-repair']) {
    const phaseRuns = runs.filter((r) => r.phase === phase);
    if (phaseRuns.length === 0) continue;
    const ok = phaseRuns.filter((r) => r.accepted).length;
    const total = phaseRuns.length;
    const pct = total ? Math.round((ok / total) * 1000) / 10 : 0;
    lines.push(`## ${phase}`, '', `- Runs: ${total}`, `- Accepted: ${ok} (${pct}%)`, `- Failed: ${total - ok} (${Math.round((100 - pct) * 10) / 10}%)`, '');
    const codeCounts = new Map();
    for (const r of phaseRuns) {
      for (const c of r.blockCodes) codeCounts.set(c, (codeCounts.get(c) ?? 0) + 1);
    }
    if (codeCounts.size > 0) {
      lines.push('### Blocking issue codes', '', '| Code | Count |', '| --- | ---: |');
      for (const [code, count] of [...codeCounts].sort((a, b) => b[1] - a[1])) {
        lines.push(`| ${code} | ${count} |`);
      }
      lines.push('');
    }
    // per-fingerprint
    lines.push('### By fingerprint', '', '| Fingerprint | Runs | Accepted | Rate |', '| --- | ---: | ---: | ---: |');
    const fps = [...new Set(phaseRuns.map((r) => r.fingerprint))];
    for (const fp of fps) {
      const fpr = phaseRuns.filter((r) => r.fingerprint === fp);
      const fok = fpr.filter((r) => r.accepted).length;
      lines.push(`| ${fp} | ${fpr.length} | ${fok} | ${Math.round((fok / fpr.length) * 1000) / 10}% |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function issueCode(value) {
  if (value && typeof value === 'object' && typeof value.code === 'string') return value.code;
  return null;
}
function readCount(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
function parseLine(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); } catch { return null; }
}

async function loadPrompts() {
  const prompts = [];
  for (const bundle of bundles) {
    let text;
    try { text = await readFile(join(rootDir, bundle.promptFile), 'utf8'); } catch { continue; }
    for (const [index, prompt] of extractPrompts(text).entries()) {
      prompts.push({ id: `${bundle.id}-${String(index + 1).padStart(2, '0')}`, fingerprint: bundle.id, prompt, promptFile: bundle.promptFile });
    }
  }
  return prompts;
}

function extractPrompts(markdown) {
  const fenced = markdown.matchAll(/```(?:prompt|text)?\n([\s\S]*?)```/g);
  const fromFences = Array.from(fenced, (m) => cleanPrompt(m[1])).filter(Boolean);
  if (fromFences.length > 0) return fromFences;
  const explicit = Array.from(
    markdown.matchAll(/(?:^|\n)\s*(?:[-*]\s*)?(?:\*\*)?(?:Exact prompt|Prompt)(?:\*\*)?\s*:\s*(.+)/gi),
    (m) => cleanPrompt(m[1]),
  ).filter(Boolean);
  if (explicit.length > 0) return explicit;
  const bullets = markdown.split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-*]|\d+[.)])\s+/, '').trim()).map(cleanPrompt).filter(isPromptLikeLine);
  return bullets.length > 0 ? bullets : [markdown.trim()].filter(Boolean);
}
function cleanPrompt(s) { return (s ?? '').replace(/\s+/g, ' ').trim(); }
function isPromptLikeLine(s) { return s.length >= 24 && /\s/.test(s) && !s.startsWith('#') && !s.startsWith('|'); }

function sample(items, count, seed) {
  if (count <= 0 || count >= items.length) return items;
  let s = seed >>> 0 || 1;
  const rand = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function parseArgs(args) {
  const out = { prompts: 12, seed: 1, baseUrl: 'http://localhost:3001', fingerprints: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--prompts') out.prompts = Number(args[++i]);
    else if (a === '--seed') out.seed = Number(args[++i]);
    else if (a === '--base') out.baseUrl = args[++i];
    else if (a === '--fingerprint') out.fingerprints.push(args[++i]);
  }
  return out;
}
