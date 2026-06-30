#!/usr/bin/env node
// Complexity + quality probe. Same model (opus, server default). For each graded
// prompt, generate on arrow + domjs, capture the artifact, compute objective
// complexity proxies, and score quality with model-as-judge (Anthropic).
//
// Measures the CEILING vectors the bakeoff skipped:
//   - complexity handled: a trivial -> very-hard ladder; where does each degrade?
//   - quality: does it actually work + match intent (judge rubric), not just "valid".
//
// Env: ANTHROPIC_API_KEY (judge), BASE_URL (default :3001), JUDGE_MODEL.

import { readFile } from 'node:fs/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:3001';
const FINGERPRINT = process.env.FINGERPRINT ?? 'signal-stream';
const RUNTIMES = ['arrow-control', 'domjs-control'];
const JUDGE_MODEL = process.env.JUDGE_MODEL ?? 'claude-opus-4-8';
const KEY = process.env.ANTHROPIC_API_KEY ?? (await loadKeyFromEnvFile());

// Graded complexity ladder. Each tier adds interactive/state burden.
const LADDER = [
  {
    id: 'L1-trivial',
    tier: 1,
    prompt: 'Show a single card with a title and a short status line.',
    expects: 'A static card with a title and one status line. No interactivity required.',
  },
  {
    id: 'L2-basic-interactive',
    tier: 2,
    prompt: 'Build a counter: a number that starts at 0, with increment and decrement buttons, and a reset button.',
    expects: 'Three working buttons that change a displayed number; reset returns it to 0.',
  },
  {
    id: 'L3-list-state',
    tier: 3,
    prompt: 'Build a task list: an input and Add button to append tasks, each task has a checkbox to mark done (visually struck through), and a Clear Completed button. Show a live count of remaining tasks.',
    expects: 'Add appends; checkbox toggles done styling; clear removes done items; remaining count updates live.',
  },
  {
    id: 'L4-multi-region',
    tier: 4,
    prompt: 'Build a kanban board with three columns (To Do, In Progress, Done). Each column lists cards. Provide a control to move a card to the next column. Show a per-column count and a total. Seed each column with two cards.',
    expects: 'Three columns with seeded cards; a move control relocates a card to the next column; per-column and total counts update on every move.',
  },
  {
    id: 'L5-compound',
    tier: 5,
    prompt: 'Build a mini expense tracker: a form to add an expense (description + amount + category select), a live list of expenses with per-row delete, a running total, and a category filter that re-renders the list and recomputes the visible total. Seed three expenses.',
    expects: 'Add inserts a row; delete removes it; total updates; category filter narrows the list AND recomputes the shown total; select control works.',
  },
];

async function generate(runtime, prompt) {
  const res = await fetch(`${BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      experimentalRuntime: runtime,
      fingerprint: { id: FINGERPRINT, targetPath: '.' },
      maxRepairAttempts: 1,
    }),
  });
  let metrics = null;
  let artifact = null;
  const decoder = new TextDecoder();
  const reader = res.body.getReader();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl = buf.indexOf('\n');
    while (nl !== -1) {
      const raw = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (raw) {
        try {
          const line = JSON.parse(raw);
          if (line.op === 'artifact' && line.path === '/artifact') artifact = line.value;
          if (line.op === 'meta' && line.path === '/run-metrics') metrics = line.value;
        } catch { /* ignore */ }
      }
      nl = buf.indexOf('\n');
    }
  }
  return { metrics, artifact };
}

// Objective complexity proxies from the source (no judgment, just structure).
function complexityProxies(artifact) {
  if (!artifact?.source) return null;
  const code = Object.entries(artifact.source)
    .filter(([p]) => p.endsWith('.js') || p.endsWith('.ts'))
    .map(([, c]) => c).join('\n');
  const count = (re) => (code.match(re) ?? []).length;
  return {
    codeBytes: code.length,
    lines: code.split('\n').length,
    eventListeners: count(/addEventListener|@click|@input|on[A-Z]\w+=/g),
    stateRefs: count(/\bstate\b|\breactive\b|getState|\.value\b/g),
    dynamicRegions: count(/\bregion\b|\.map\s*\(/g),
    handlers: count(/=>|function\b/g),
  };
}

async function judge(prompt, expects, runtime, artifact) {
  if (!artifact?.source) {
    return { worksScore: 0, fidelityScore: 0, completeness: 0, verdict: 'no-artifact', notes: 'no artifact produced' };
  }
  const code = JSON.stringify(artifact.source).slice(0, 18000);
  const sys = `You are a strict senior frontend reviewer scoring a generated UI surface by reading its source. You cannot run it; reason about whether the code WOULD work and meets the request. Score 0-5 integers. Be critical; reserve 5 for flawless. Return ONLY JSON: {"worksScore":int,"fidelityScore":int,"completeness":int,"verdict":"works|partial|broken","notes":"one sentence"}.
- worksScore: would the interactivity actually function as described (handlers wired, state updates, list re-renders)?
- fidelityScore: does it fulfill the specific requirements in "expected"?
- completeness: are all requested features present (not stubbed/omitted)?`;
  const user = `Request: ${prompt}\n\nExpected behavior: ${expects}\n\nRuntime: ${runtime}\nGenerated source (JSON of files):\n${code}`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      max_tokens: 400,
      system: sys,
      messages: [{ role: 'user', content: user }],
    }),
  });
  const data = await res.json();
  const text = (data.content ?? []).map((b) => b.text ?? '').join('');
  try {
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
    return json;
  } catch {
    return { worksScore: 0, fidelityScore: 0, completeness: 0, verdict: 'judge-parse-fail', notes: text.slice(0, 120) };
  }
}

const rows = [];
for (const item of LADDER) {
  for (const runtime of RUNTIMES) {
    process.stdout.write(`[${item.id}] ${runtime} ... `);
    const { metrics, artifact } = await generate(runtime, item.prompt);
    const proxies = complexityProxies(artifact);
    const blocked = metrics?.blocked === true;
    const q = blocked ? { worksScore: 0, fidelityScore: 0, completeness: 0, verdict: 'blocked', notes: 'blocked by validation' } : await judge(item.prompt, item.expects, runtime, artifact);
    const row = {
      id: item.id, tier: item.tier, runtime,
      blocked, repairs: metrics?.repairs ?? 0, safety: metrics?.safetyViolations ?? 0,
      proxies, quality: q,
    };
    rows.push(row);
    console.log(`${blocked ? 'BLOCKED' : `works=${q.worksScore} fidelity=${q.fidelityScore} complete=${q.completeness} (${q.verdict})`}`);
  }
}

// Summary
console.log('\n=== complexity x quality summary (same model: opus) ===\n');
console.log('tier  prompt              | arrow works/fid/comp  | domjs works/fid/comp');
for (const item of LADDER) {
  const a = rows.find((r) => r.id === item.id && r.runtime === 'arrow-control');
  const d = rows.find((r) => r.id === item.id && r.runtime === 'domjs-control');
  const fmt = (r) => r.blocked ? 'BLOCKED      ' : `${r.quality.worksScore}/${r.quality.fidelityScore}/${r.quality.completeness}        `;
  console.log(`T${item.tier}    ${item.id.padEnd(20)}| ${fmt(a)}         | ${fmt(d)}`);
}
console.log('');
for (const runtime of RUNTIMES) {
  const g = rows.filter((r) => r.runtime === runtime);
  const avg = (k) => (g.reduce((s, r) => s + (r.quality[k] ?? 0), 0) / g.length).toFixed(2);
  const avgBytes = Math.round(g.reduce((s, r) => s + (r.proxies?.codeBytes ?? 0), 0) / g.length);
  console.log(`${runtime}: avg works=${avg('worksScore')} fidelity=${avg('fidelityScore')} completeness=${avg('completeness')}  blocked=${g.filter((r) => r.blocked).length}/${g.length}  avgCodeBytes=${avgBytes}`);
}

const outDir = join('apps/server/.bakeoff', `complexity-quality-${new Date().toISOString().replace(/[:.]/g, '-')}`);
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'rows.json'), JSON.stringify({ generatedAt: new Date().toISOString(), fingerprint: FINGERPRINT, judgeModel: JUDGE_MODEL, rows }, null, 2));
console.log(`\nwrote ${outDir}/rows.json`);

async function loadKeyFromEnvFile() {
  try {
    const env = await readFile('apps/server/.env', 'utf8');
    const m = env.match(/ANTHROPIC_API_KEY=(.+)/);
    return m ? m[1].trim() : '';
  } catch { return ''; }
}
