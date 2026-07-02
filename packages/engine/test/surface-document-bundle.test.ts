import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SUMMON_SURFACE_DOCUMENT_BUNDLE_SCHEMA,
  createSurfaceDocumentBundleJsonSchema,
  createSurfaceDocumentBundleToolDefinition,
  isSummonSurfaceDocumentBundle,
  normalizeSurfaceDocumentBundle,
  surfaceDocumentArtifactFromBundle,
} from '../src/surface-document-bundle.ts';

function codes(issues: Array<{ code: string }>): string[] {
  return issues.map((issue) => issue.code);
}

test('surface-document bundle normalizes and converts to an artifact', () => {
  const { bundle, issues } = normalizeSurfaceDocumentBundle({
    schema: SUMMON_SURFACE_DOCUMENT_BUNDLE_SCHEMA,
    source: {
      'main.html': '<main id="app"></main>',
      'main.css': '#app{}',
      'main.js': 'document.getElementById("app");',
    },
  });
  assert.deepEqual(issues, []);
  assert.ok(bundle);
  assert.equal(isSummonSurfaceDocumentBundle(bundle), true);
  assert.deepEqual(surfaceDocumentArtifactFromBundle(bundle!), {
    runtime: 'surface-document',
    source: {
      'main.html': '<main id="app"></main>',
      'main.css': '#app{}',
      'main.js': 'document.getElementById("app");',
    },
  });
});

test('surface-document bundle coerces aliases with warnings', () => {
  const { bundle, issues } = normalizeSurfaceDocumentBundle({
    schema: SUMMON_SURFACE_DOCUMENT_BUNDLE_SCHEMA,
    source: {
      markup: '<main></main>',
      styles: '.x{}',
      behavior: 'const x = 1;',
    },
  });
  assert.ok(bundle);
  assert.equal(bundle!.source['main.html'], '<main></main>');
  assert.equal(bundle!.source['main.css'], '.x{}');
  assert.equal(bundle!.source['main.js'], 'const x = 1;');
  assert.equal(codes(issues).filter((code) => code === 'coerced-surface-document-bundle-source').length, 3);
});

test('surface-document bundle requires html and css entries', () => {
  const { bundle, issues } = normalizeSurfaceDocumentBundle({
    schema: SUMMON_SURFACE_DOCUMENT_BUNDLE_SCHEMA,
    source: { 'main.html': '<main></main>' },
  });
  assert.equal(bundle, null);
  assert.ok(codes(issues).includes('missing-surface-document-bundle-css'));
});

test('surface-document bundle schema and tool definition expose the file triple', () => {
  const schema = createSurfaceDocumentBundleJsonSchema();
  const source = ((schema.properties as Record<string, unknown>).source as { properties: Record<string, unknown>; required: string[] });
  assert.deepEqual(source.required, ['main.html', 'main.css']);
  assert.match((source.properties['main.html'] as { description: string }).description, /inert semantic HTML structure/);
  assert.match((source.properties['main.html'] as { description: string }).description, /inline on\* handlers/);
  assert.match((source.properties['main.css'] as { description: string }).description, /Ghost fingerprint/);
  assert.match((source.properties['main.css'] as { description: string }).description, /No @import/);
  assert.match((source.properties['main.js'] as { description: string }).description, /scoped DOM APIs, state\(\), region\(\).*callTool\(\)/);
  assert.match((source.properties['main.js'] as { description: string }).description, /No fetch\/XHR\/WebSocket/);

  const tool = createSurfaceDocumentBundleToolDefinition();
  assert.equal(tool.name, 'emit_surface_document');
  assert.deepEqual(tool.input_schema, schema);
});
