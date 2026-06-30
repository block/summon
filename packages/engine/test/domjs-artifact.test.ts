import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  normalizeDomjsSurfaceArtifact,
  validateDomjsSurfaceArtifact,
  type DomjsSurfaceArtifact,
} from '../src/domjs-artifact.ts';
import {
  normalizeDomjsBundle,
  domjsArtifactFromBundle,
  SUMMON_DOMJS_BUNDLE_SCHEMA,
} from '../src/domjs-bundle.ts';

function codes(issues: { code: string }[]): string[] {
  return issues.map((i) => i.code).sort();
}

const GOOD_SOURCE = `
  const root = document.createElement('div');
  const label = document.createTextNode('hi');
  root.append(label);
  const btn = document.createElement('button');
  btn.addEventListener('click', () => { label.textContent = 'clicked'; });
  root.append(btn);
  export default root;
`;

test('a valid domjs artifact normalizes and validates clean', () => {
  const { artifact, issues } = normalizeDomjsSurfaceArtifact({
    runtime: 'domjs',
    source: { 'main.js': GOOD_SOURCE, 'main.css': '.x { color: red; }' },
  });
  assert.ok(artifact);
  assert.equal(issues.length, 0);
  assert.deepEqual(validateDomjsSurfaceArtifact(artifact!), []);
});

test('missing main.js entry is a block issue', () => {
  const { artifact, issues } = normalizeDomjsSurfaceArtifact({ runtime: 'domjs', source: { 'main.css': 'x{}' } });
  assert.equal(artifact, null);
  assert.ok(codes(issues).includes('invalid-domjs-entry'));
});

test('each unsupported API surfaces a repairable domjs-unsupported-api code', () => {
  const cases: Array<[string, string]> = [
    ['const d = document.createElement("div"); d.innerHTML = "<b>x</b>"; export default d;', 'innerHTML'],
    ['const d = document.createElement("div"); d.querySelector("x"); export default d;', 'querySelector'],
    ['document.getElementById("x"); export default document.createElement("div");', 'getElementById'],
    ['const d = document.createElement("div"); d.style.color = "red"; export default d;', 'style'],
    ['const w = window.location; export default document.createElement("div");', 'window'],
    ['const d = document.createElement("div"); d.insertBefore(d, d); export default d;', 'insertBefore'],
  ];
  for (const [src, api] of cases) {
    const issues = validateDomjsSurfaceArtifact({ runtime: 'domjs', source: { 'main.js': src } });
    assert.ok(
      issues.some((i) => i.code === 'domjs-unsupported-api' && i.message.includes(api)),
      `expected domjs-unsupported-api for ${api}, got: ${issues.map((i) => i.message).join(' | ')}`,
    );
  }
});

test('network APIs are flagged as not granted', () => {
  const issues = validateDomjsSurfaceArtifact({
    runtime: 'domjs',
    source: { 'main.js': 'fetch("https://x"); export default document.createElement("div");' },
  });
  assert.ok(issues.some((i) => i.code === 'domjs-network-not-granted'));
});

test('supported usage (createElement/append/region) produces no issues', () => {
  const issues = validateDomjsSurfaceArtifact({
    runtime: 'domjs',
    source: {
      'main.js': `
        const ul = document.createElement('ul');
        const list = region(() => getState().items.map((t) => {
          const li = document.createElement('li');
          li.textContent = t;
          return li;
        }));
        ul.append(list);
        export default ul;
      `,
    },
  });
  assert.deepEqual(issues, []);
});

test('source over the byte limit is flagged', () => {
  const big = 'const d = document.createElement("div");'.repeat(10000);
  const issues = validateDomjsSurfaceArtifact(
    { runtime: 'domjs', source: { 'main.js': big + '\nexport default document.createElement("div");' } },
    { maxSourceBytes: 1024 },
  );
  assert.ok(issues.some((i) => i.code === 'domjs-source-limit'));
});

test('domjs bundle normalizes and converts to an artifact', () => {
  const { bundle, issues } = normalizeDomjsBundle({
    schema: SUMMON_DOMJS_BUNDLE_SCHEMA,
    source: { 'main.js': GOOD_SOURCE },
  });
  assert.ok(bundle);
  assert.equal(issues.length, 0);
  const artifact: DomjsSurfaceArtifact = domjsArtifactFromBundle(bundle!);
  assert.equal(artifact.runtime, 'domjs');
  assert.equal(artifact.source['main.js'], GOOD_SOURCE);
});

test('domjs bundle coerces aliased source fields with a warning', () => {
  const { bundle, issues } = normalizeDomjsBundle({
    schema: SUMMON_DOMJS_BUNDLE_SCHEMA,
    source: { js: GOOD_SOURCE, style: '.x{}' },
  });
  assert.ok(bundle);
  assert.equal(bundle!.source['main.js'], GOOD_SOURCE);
  assert.equal(bundle!.source['main.css'], '.x{}');
  assert.ok(issues.some((i) => i.code === 'coerced-domjs-bundle-source' && i.severity === 'warn'));
});

test('domjs bundle without an entry is a block issue', () => {
  const { bundle, issues } = normalizeDomjsBundle({ schema: SUMMON_DOMJS_BUNDLE_SCHEMA, source: { 'main.css': 'x{}' } });
  assert.equal(bundle, null);
  assert.ok(codes(issues).includes('missing-domjs-bundle-entry'));
});

test('wrong schema is flagged', () => {
  const { issues } = normalizeDomjsBundle({ schema: 'nope', source: { 'main.js': GOOD_SOURCE } });
  assert.ok(codes(issues).includes('invalid-domjs-bundle-schema'));
});
