#!/usr/bin/env node
// ss-03 repeat probe: run the SAME interactive prompt N times per runtime and
// measure block rate, to turn run 2's single non-deterministic arrow block into
// an actual rate. Hits the live server directly (the bakeoff harness doesn't
// support repeats of one prompt).

const BASE = process.env.BASE_URL ?? 'http://localhost:3001';
const N = Number(process.env.SAMPLES ?? 6);
const PROMPT = 'Build a panel with three tabs (Overview, Activity, Settings). Clicking a tab switches the visible content. On the Activity tab, include a counter with increment and reset buttons that updates a displayed total.';
const FINGERPRINT = 'signal-stream';
const RUNTIMES = ['arrow-control', 'domjs-control'];

async function runOne(runtime) {
  const res = await fetch(`${BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: PROMPT,
      experimentalRuntime: runtime,
      fingerprint: { id: FINGERPRINT, targetPath: '.' },
      maxRepairAttempts: 1,
    }),
  });
  let metrics = null;
  let artifactSeen = false;
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
          if (line.op === 'artifact' && line.path === '/artifact') artifactSeen = true;
          if (line.op === 'meta' && line.path === '/run-metrics') metrics = line.value;
        } catch { /* ignore */ }
      }
      nl = buf.indexOf('\n');
    }
  }
  return {
    blocked: metrics?.blocked === true,
    repairs: metrics?.repairs ?? 0,
    artifactSeen,
    safety: metrics?.safetyViolations ?? 0,
  };
}

const results = {};
for (const runtime of RUNTIMES) {
  results[runtime] = [];
  for (let i = 0; i < N; i++) {
    try {
      const r = await runOne(runtime);
      results[runtime].push(r);
      const tag = r.blocked ? 'BLOCKED' : (r.repairs > 0 ? `ok(repair ${r.repairs})` : 'ok');
      console.log(`[${runtime}] sample ${i + 1}/${N}: ${tag} artifact=${r.artifactSeen} safety=${r.safety}`);
    } catch (e) {
      console.log(`[${runtime}] sample ${i + 1}/${N}: ERROR ${e.message}`);
      results[runtime].push({ blocked: true, repairs: 0, artifactSeen: false, safety: 0, error: String(e.message) });
    }
  }
}

console.log('\n=== ss-03 repeat probe summary ===');
console.log(`prompt: tabs + counter (interactive), fingerprint=${FINGERPRINT}, N=${N} per runtime\n`);
for (const runtime of RUNTIMES) {
  const g = results[runtime];
  const blocked = g.filter((r) => r.blocked).length;
  const firstPass = g.filter((r) => !r.blocked && r.repairs === 0).length;
  const repairs = g.reduce((s, r) => s + r.repairs, 0);
  const safety = g.reduce((s, r) => s + r.safety, 0);
  console.log(`${runtime}: accepted=${g.length - blocked}/${g.length}  blocked=${blocked} (${Math.round((blocked / g.length) * 100)}%)  first-pass=${firstPass}/${g.length}  total-repairs=${repairs}  safety=${safety}`);
}
