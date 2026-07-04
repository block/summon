import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SUMMON_SURFACE_DOCUMENT_BUNDLE_SCHEMA,
  normalizeSurfaceDocumentBundle,
  type SummonSurfaceDocumentBundle,
} from '../src/surface-document-bundle.ts';
import {
  parseSurfaceDocumentText,
  serializeSurfaceDocumentText,
} from '../src/surface-document-text.ts';

function codes(issues: Array<{ code: string }>): string[] {
  return issues.map((issue) => issue.code);
}

function bundleOf(source: SummonSurfaceDocumentBundle['source']): SummonSurfaceDocumentBundle {
  return { schema: SUMMON_SURFACE_DOCUMENT_BUNDLE_SCHEMA, source };
}

test('surface-document text round-trips a two-file bundle', () => {
  const bundle = bundleOf({
    'main.html': '<main id="app">\n  <p>hello</p>\n</main>',
    'main.css': '#app{color:red}\n.x { margin: 0; }',
  });
  const { source, issues } = parseSurfaceDocumentText(serializeSurfaceDocumentText(bundle));
  assert.deepEqual(issues, []);
  assert.deepEqual(source, bundle.source);
});

test('surface-document text round-trips a three-file bundle', () => {
  const bundle = bundleOf({
    'main.html': '<main id="app"></main>',
    'main.css': '#app{}',
    'main.js': 'const el = document.getElementById("app");\nel.textContent = "hi";',
  });
  const { source, issues } = parseSurfaceDocumentText(serializeSurfaceDocumentText(bundle));
  assert.deepEqual(issues, []);
  assert.deepEqual(source, bundle.source);
});

test('surface-document text round-trips content with fence-lookalike lines', () => {
  const bundle = bundleOf({
    'main.html': '<pre>\n  === FILE: main.css ===\n=== FILE: main.css === trailing text\n</pre>',
    'main.css': '/* === END SUMMON-BUNDLE === not really */\n.y{content:"=== SUMMON-BUNDLE v1 === x"}',
  });
  const { source, issues } = parseSurfaceDocumentText(serializeSurfaceDocumentText(bundle));
  assert.deepEqual(issues, []);
  assert.deepEqual(source, bundle.source);
});

test('surface-document text rejects a prose preamble', () => {
  const text = [
    'Sure! Here is your bundle:',
    '=== SUMMON-BUNDLE v1 ===',
    'files: main.html, main.css',
    '=== FILE: main.html ===',
    '<main></main>',
    '=== FILE: main.css ===',
    '.x{}',
    '=== END SUMMON-BUNDLE ===',
  ].join('\n');
  const { source, issues } = parseSurfaceDocumentText(text);
  assert.equal(source, null);
  const issue = issues.find((entry) => entry.code === 'invalid-surface-document-bundle');
  assert.ok(issue);
  assert.equal(issue!.severity, 'block');
});

test('surface-document text rejects a missing END fence as truncation', () => {
  const text = [
    '=== SUMMON-BUNDLE v1 ===',
    'files: main.html, main.css',
    '=== FILE: main.html ===',
    '<main></main>',
    '=== FILE: main.css ===',
    '.x{}',
  ].join('\n');
  const { source, issues } = parseSurfaceDocumentText(text);
  assert.equal(source, null);
  const issue = issues.find((entry) => entry.code === 'invalid-surface-document-bundle');
  assert.ok(issue);
  assert.equal(issue!.severity, 'block');
  assert.match(issue!.message, /truncated/);
});

test('surface-document text with a missing main.css fence fails downstream with missing-css', () => {
  const text = [
    '=== SUMMON-BUNDLE v1 ===',
    'files: main.html',
    '=== FILE: main.html ===',
    '<main></main>',
    '=== END SUMMON-BUNDLE ===',
  ].join('\n');
  // Text parse succeeds — the required-file check lives downstream.
  const parsed = parseSurfaceDocumentText(text);
  assert.deepEqual(parsed.source, { 'main.html': '<main></main>' });
  const { bundle, issues } = normalizeSurfaceDocumentBundle(text);
  assert.equal(bundle, null);
  const issue = issues.find((entry) => entry.code === 'missing-surface-document-bundle-css');
  assert.ok(issue);
  assert.equal(issue!.severity, 'block');
});

test('surface-document text rejects duplicate file fences', () => {
  const text = [
    '=== SUMMON-BUNDLE v1 ===',
    'files: main.html, main.css',
    '=== FILE: main.html ===',
    '<main></main>',
    '=== FILE: main.html ===',
    '<div></div>',
    '=== FILE: main.css ===',
    '.x{}',
    '=== END SUMMON-BUNDLE ===',
  ].join('\n');
  const { source, issues } = parseSurfaceDocumentText(text);
  assert.equal(source, null);
  const issue = issues.find((entry) => entry.code === 'invalid-surface-document-bundle');
  assert.ok(issue);
  assert.equal(issue!.severity, 'block');
  assert.match(issue!.message, /duplicate/);
});

test('surface-document text rejects empty input', () => {
  const { source, issues } = parseSurfaceDocumentText('');
  assert.equal(source, null);
  const issue = issues.find((entry) => entry.code === 'invalid-surface-document-bundle');
  assert.ok(issue);
  assert.equal(issue!.severity, 'block');
});

test('surface-document text warns on prose after the END fence', () => {
  const text = [
    '=== SUMMON-BUNDLE v1 ===',
    'files: main.html, main.css',
    '=== FILE: main.html ===',
    '<main></main>',
    '=== FILE: main.css ===',
    '.x{}',
    '=== END SUMMON-BUNDLE ===',
    'Hope this helps!',
  ].join('\n');
  const { source, issues } = parseSurfaceDocumentText(text);
  assert.deepEqual(source, { 'main.html': '<main></main>', 'main.css': '.x{}' });
  const issue = issues.find((entry) => entry.code === 'trailing-surface-document-bundle-content');
  assert.ok(issue);
  assert.equal(issue!.severity, 'warn');
});

test('surface-document text tolerates trailing whitespace on fence lines', () => {
  const text = [
    '=== SUMMON-BUNDLE v1 ===  ',
    'files: main.html, main.css',
    '=== FILE: main.html === ',
    '<main></main>',
    '=== FILE: main.css ===\t',
    '.x{}',
    '=== END SUMMON-BUNDLE ===  ',
  ].join('\n');
  const { source, issues } = parseSurfaceDocumentText(text);
  assert.deepEqual(issues, []);
  assert.deepEqual(source, { 'main.html': '<main></main>', 'main.css': '.x{}' });
});

test('normalizeSurfaceDocumentBundle accepts fenced text input', () => {
  const bundle = bundleOf({
    'main.html': '<main id="app"></main>',
    'main.css': '#app{}',
    'main.js': 'document.getElementById("app");',
  });
  const { bundle: parsed, issues } = normalizeSurfaceDocumentBundle(serializeSurfaceDocumentText(bundle));
  assert.deepEqual(issues, []);
  assert.deepEqual(parsed, bundle);
});

test('normalizeSurfaceDocumentBundle coerces alias file names in fenced text with warnings', () => {
  const text = [
    '=== SUMMON-BUNDLE v1 ===',
    'files: html, styles',
    '=== FILE: html ===',
    '<main></main>',
    '=== FILE: styles ===',
    '.x{}',
    '=== END SUMMON-BUNDLE ===',
  ].join('\n');
  const { bundle, issues } = normalizeSurfaceDocumentBundle(text);
  assert.ok(bundle);
  assert.equal(bundle!.source['main.html'], '<main></main>');
  assert.equal(bundle!.source['main.css'], '.x{}');
  assert.equal(codes(issues).filter((code) => code === 'coerced-surface-document-bundle-source').length, 2);
});

test('normalizeSurfaceDocumentBundle returns text-parse issues on block failure', () => {
  const { bundle, issues } = normalizeSurfaceDocumentBundle('not a bundle at all');
  assert.equal(bundle, null);
  assert.ok(codes(issues).includes('invalid-surface-document-bundle'));
});
