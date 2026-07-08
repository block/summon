import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MEDIAN_TELLS,
  deriveSanctionedTells,
  scoreMedianTells,
} from '../src/ghost/median-tells.js';

const MEDIAN_CSS = `
:root { --accent: #4f46e5; }
body {
  background: linear-gradient(135deg, #667eea, #764ba2);
  font-family: Inter, 'Segoe UI', sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}
header { position: sticky; top: 0; }
.card { backdrop-filter: blur(12px); }
.card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,.2); }
.avatar { border-radius: 50%; }
`;

const MEDIAN_HTML = `
<h1>Simple, transparent pricing</h1>
<p>Welcome back 🎉</p>
`;

const CLEAN_CSS = `
.brief { color: var(--color-text); background: var(--color-bg); padding: 24px; }
.brief h1 { font: inherit; }
button:hover { background: var(--color-surface-hover); }
`;

test('scoreMedianTells flags a median-styled artifact heavily', () => {
  const report = scoreMedianTells({
    artifactSource: { 'main.css': MEDIAN_CSS, 'main.html': MEDIAN_HTML },
  });
  assert.equal(report.schema, 'summon.median-tells/v1');
  const hitIds = report.hits.map((hit) => hit.id).sort();
  assert.deepEqual(hitIds, [
    'chat-bubble-avatar',
    'emoji-icons',
    'glassmorphism',
    'gradient-background',
    'hover-lift',
    'indigo-blue-default-accent',
    'inter-font-default',
    'segoe-font-default',
    'sticky-top-header',
    'stock-pricing-copy',
    'viewport-centered-card',
    'welcome-back-copy',
  ]);
  assert.ok(report.score >= 15, `expected heavy score, got ${report.score}`);
  assert.equal(report.sanctioned.length, 0);
  const hover = report.hits.find((hit) => hit.id === 'hover-lift');
  assert.deepEqual(hover?.files, ['main.css']);
  assert.ok(hover?.evidence.includes('translateY'));
});

test('scoreMedianTells scores a token-disciplined artifact zero', () => {
  const report = scoreMedianTells({
    artifactSource: { 'main.css': CLEAN_CSS, 'main.html': '<div class="brief"><h1>Q3 spend brief</h1></div>' },
  });
  assert.equal(report.score, 0);
  assert.deepEqual(report.hits, []);
});

test('scoreMedianTells sanctions excluded tells and reduces maxScore', () => {
  const dark = { 'main.css': 'body { background: #111111; color: #eee; }' };
  const unsanctioned = scoreMedianTells({ artifactSource: dark });
  assert.ok(unsanctioned.hits.some((hit) => hit.id === 'unprompted-dark-theme'));

  const sanctionedReport = scoreMedianTells({
    artifactSource: dark,
    sanctionedTellIds: ['unprompted-dark-theme'],
  });
  assert.equal(sanctionedReport.hits.length, 0);
  assert.deepEqual(sanctionedReport.sanctioned, ['unprompted-dark-theme']);
  assert.equal(sanctionedReport.maxScore, unsanctioned.maxScore - 2);
});

test('scoreMedianTells ignores non-design files', () => {
  const report = scoreMedianTells({
    artifactSource: { 'main.js': 'const accent = "#4f46e5"; // Welcome back' },
  });
  assert.equal(report.score, 0);
});

test('deriveSanctionedTells sanctions unprompted-dark for dark fingerprints only', () => {
  assert.deepEqual(
    deriveSanctionedTells(':root { --color-bg: #000000; --color-text: #ffffff; }'),
    ['unprompted-dark-theme'],
  );
  assert.deepEqual(
    deriveSanctionedTells(':root { --color-bg: #2b2622; }'),
    ['unprompted-dark-theme'],
  );
  assert.deepEqual(deriveSanctionedTells(':root { --color-bg: #f2efe7; }'), []);
  assert.deepEqual(deriveSanctionedTells(':root { --color-bg: #ffffff; }'), []);
  assert.deepEqual(deriveSanctionedTells(null), []);
  assert.deepEqual(deriveSanctionedTells(''), []);
});

test('every tell compiles and carries provenance', () => {
  for (const tell of MEDIAN_TELLS) {
    assert.ok(tell.antimedianCount > 0, `${tell.id} missing corpus count`);
    assert.ok(tell.weight >= 1 && tell.weight <= 3, `${tell.id} weight out of range`);
    // Compilation is exercised implicitly by scoring an empty artifact.
  }
  const report = scoreMedianTells({ artifactSource: { 'main.css': '' } });
  assert.equal(report.score, 0);
});
