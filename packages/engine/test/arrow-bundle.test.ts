import assert from 'node:assert/strict';
import test from 'node:test';
import {
  arrowArtifactFromBundle,
  createArrowBundleJsonSchema,
  normalizeArrowBundle,
} from '../src/index.ts';

test('normalizeArrowBundle accepts a valid TypeScript bundle', () => {
  const result = normalizeArrowBundle({
    schema: 'summon.arrow-bundle/v1',
    preview: {
      kind: 'comparison',
      title: 'Decision',
      regions: [{ id: 'verdict', role: 'summary', label: 'Verdict' }],
    },
    source: {
      'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<p>Hello</p>`;',
      'main.css': 'p { color: var(--color-text); }',
    },
    shadowDOM: true,
  });

  assert.deepEqual(result.issues, []);
  assert.equal(result.bundle?.schema, 'summon.arrow-bundle/v1');
  assert.equal(result.bundle?.preview?.regions?.[0]?.id, 'verdict');
  assert.deepEqual(arrowArtifactFromBundle(result.bundle!), {
    runtime: 'arrow',
    source: {
      'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<p>Hello</p>`;',
      'main.css': 'p { color: var(--color-text); }',
    },
  });
});

test('normalizeArrowBundle requires exactly one entry file', () => {
  const none = normalizeArrowBundle({
    schema: 'summon.arrow-bundle/v1',
    source: { 'main.css': 'p {}' },
  });
  assert.equal(none.bundle, null);
  assert.deepEqual(none.issues.map((issue) => issue.code), ['invalid-arrow-bundle-entry']);

  const both = normalizeArrowBundle({
    schema: 'summon.arrow-bundle/v1',
    source: { 'main.ts': 'export {}', 'main.js': 'export {}' },
  });
  assert.equal(both.bundle, null);
  assert.deepEqual(both.issues.map((issue) => issue.code), ['invalid-arrow-bundle-entry']);
});

test('normalizeArrowBundle rejects unsupported files and invalid preview', () => {
  const result = normalizeArrowBundle({
    schema: 'summon.arrow-bundle/v1',
    preview: { title: 'Missing kind' },
    source: { 'main.ts': 'export {}', 'extra.ts': 'export {}' },
  });
  assert.equal(result.bundle, null);
  assert.deepEqual(result.issues.map((issue) => issue.code), [
    'arrow-bundle-extra-file',
    'invalid-arrow-bundle-preview',
  ]);
});

test('createArrowBundleJsonSchema exposes the structured bundle contract', () => {
  const schema = createArrowBundleJsonSchema();
  assert.equal(schema.type, 'object');
  assert.deepEqual((schema.properties as Record<string, unknown>).schema, {
    type: 'string',
    const: 'summon.arrow-bundle/v1',
    enum: ['summon.arrow-bundle/v1'],
  });
});
