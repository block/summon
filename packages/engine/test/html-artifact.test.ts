import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SUMMON_HTML_BUNDLE_SCHEMA,
  createHtmlBundleJsonSchema,
  htmlArtifactFromBundle,
  normalizeHtmlBundle,
  parseProtocolLineStrict,
  validateHtmlSurfaceArtifact,
  validateHtmlSurfacePatch,
  validateProtocolLine,
} from '../src/index.ts';
import { baseContext, codes } from './runtime-validator-fixtures.ts';

function uniqueCodes(issues: Parameters<typeof codes>[0]): string[] {
  return Array.from(new Set(codes(issues)));
}

test('normalizes a summon.html-bundle/v0 artifact with required body.html', () => {
  const normalized = normalizeHtmlBundle({
    schema: SUMMON_HTML_BUNDLE_SCHEMA,
    preview: {
      kind: 'brief',
      title: 'Signal report',
      regions: [{ id: 'hero', role: 'summary', summary: 'First read.' }],
    },
    source: {
      'body.html': '<section id="hero"><h1>Signal report</h1></section>',
      'main.css': '#hero { color: var(--color-text); }',
    },
  });

  assert.deepEqual(codes(normalized.issues), []);
  assert.equal(normalized.bundle?.source['body.html'].includes('Signal report'), true);
  assert.deepEqual(htmlArtifactFromBundle(normalized.bundle!).runtime, 'html');
  assert.deepEqual((createHtmlBundleJsonSchema().properties as Record<string, unknown>).schema, {
    type: 'string',
    const: SUMMON_HTML_BUNDLE_SCHEMA,
    enum: [SUMMON_HTML_BUNDLE_SCHEMA],
  });
});

test('blocks unsafe HTML, external URLs, inline handlers, and legacy bindings', () => {
  const issues = validateHtmlSurfaceArtifact({
    runtime: 'html',
    source: {
      'body.html': [
        '<section id="hero" onclick="save()" data-summon-bind="title">',
        '<img src="https://example.test/pixel.png" alt="pixel">',
        '<iframe srcdoc="<p>x</p>"></iframe>',
        '<script>alert(1)</script>',
        '</section>',
      ].join(''),
      'main.css': '@import url("https://example.test/app.css"); .x { background: url(/asset.png); }',
    },
  });

  assert.deepEqual(uniqueCodes(issues), [
    'external-url',
    'inline-handler',
    'static-script',
    'unsafe-tag',
    'unsupported-html-attribute',
    'unsupported-legacy-data-summon-binding',
  ]);
});

test('gates optional main.js behind the scripted iframe experiment', () => {
  const artifact = {
    runtime: 'html' as const,
    source: {
      'body.html': '<section id="hero">Hi</section>',
      'main.js': 'window.summon.callTool("save", {});',
    },
  };

  assert.deepEqual(codes(validateHtmlSurfaceArtifact(artifact)), ['html-script-not-enabled']);
  assert.deepEqual(codes(validateHtmlSurfaceArtifact(artifact, { allowScript: true })), []);

  assert.deepEqual(
    codes(validateHtmlSurfaceArtifact({
      runtime: 'html',
      source: {
        'body.html': '<section id="hero">Hi</section>',
        'main.js': 'fetch("https://example.test"); window.parent.document.body.textContent = "x";',
      },
    }, { allowScript: true })),
    ['unsafe-html-script'],
  );
});

test('validates complete HTML patch fragments through the protocol', () => {
  const line = parseProtocolLineStrict(JSON.stringify({
    op: 'patch',
    path: '/artifact/html-patch',
    value: {
      runtime: 'html',
      action: 'replace',
      target: 'hero',
      html: '<section id="hero"><h2>Updated</h2></section>',
    },
  }));

  assert.deepEqual(validateProtocolLine(line, baseContext), []);
  assert.deepEqual(validateHtmlSurfacePatch(line.value as never), []);
});

test('rejects invalid HTML patch targets and unsafe fragments', () => {
  const issues = validateHtmlSurfacePatch({
    runtime: 'html',
    action: 'append',
    target: '../hero',
    html: '<img src="https://example.test/a.png" alt="x">',
  });

  assert.deepEqual(codes(issues), ['external-url', 'invalid-html-patch-target']);
});
