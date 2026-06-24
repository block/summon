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

test('coerces malformed HTML preview regions without blocking the artifact', () => {
  const normalized = normalizeHtmlBundle({
    schema: SUMMON_HTML_BUNDLE_SCHEMA,
    preview: {
      kind: 'brief',
      title: 'Signal report',
      regions: ['Hero', { id: 'summary' }, null],
    },
    source: {
      'body.html': '<section id="hero"><h1>Signal report</h1></section>',
    },
  });

  assert.equal(normalized.bundle?.preview?.regions?.[0]?.id, 'hero');
  assert.equal(normalized.bundle?.preview?.regions?.[0]?.role, 'content');
  assert.equal(normalized.bundle?.preview?.regions?.[1]?.id, 'summary');
  assert.equal(normalized.bundle?.preview?.regions?.[1]?.role, 'content');
  assert.equal(normalized.bundle?.preview?.regions?.length, 2);
  assert.deepEqual(uniqueCodes(normalized.issues), [
    'coerced-html-preview-region',
    'ignored-html-preview-region',
  ]);
  assert.deepEqual(htmlArtifactFromBundle(normalized.bundle!).runtime, 'html');
});

test('blocks unsafe HTML, external URLs, inline handlers, and legacy bindings', () => {
  const issues = validateHtmlSurfaceArtifact({
    runtime: 'html',
    source: {
      'body.html': [
        '<section id="hero" onclick="save()" data-summon-bind="title" style="background:url(javascript:evil)">',
        '<a href="javascript:alert(1)">Bad link</a>',
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
        'main.js': [
          'fetch("https://example.test");',
          'new XMLHttpRequest();',
          'new WebSocket("wss://example.test");',
          'new EventSource("/events");',
          'new Worker("worker.js");',
          'localStorage.setItem("x", "1");',
          'sessionStorage.clear();',
          'indexedDB.open("x");',
          'document.cookie = "x=1";',
          'window.parent.document.body.textContent = "x";',
          'globalThis.top.location.href = "https://example.test";',
          'navigator.serviceWorker.register("/sw.js");',
          'eval("1");',
          'Function("return 1")();',
          'import("/x.js");',
        ].join('\n'),
      },
    }, { allowScript: true })),
    ['unsafe-html-script'],
  );
});

test('enforces HTML source, CSS, depth, and node limits', () => {
  assert.deepEqual(
    codes(validateHtmlSurfaceArtifact({
      runtime: 'html',
      source: {
        'body.html': '<section id="hero">too large</section>',
      },
    }, { maxSourceBytes: 20 })),
    ['html-source-limit'],
  );

  assert.deepEqual(
    codes(validateHtmlSurfaceArtifact({
      runtime: 'html',
      source: {
        'body.html': '<main><section><div><p>deep</p></div></section></main>',
      },
    }, { maxDomDepth: 2 })),
    ['html-dom-depth-limit'],
  );

  assert.deepEqual(
    codes(validateHtmlSurfaceArtifact({
      runtime: 'html',
      source: {
        'body.html': '<main><span>1</span><span>2</span><span>3</span></main>',
      },
    }, { maxDomNodes: 3 })),
    ['html-dom-limit'],
  );

  assert.deepEqual(
    codes(validateHtmlSurfaceArtifact({
      runtime: 'html',
      source: {
        'body.html': '<section id="hero">CSS</section>',
        'main.css': '.x { color: red; }',
      },
    }, { maxCssBytes: 5 })),
    ['html-css-limit'],
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
    html: '<script>alert(1)</script><img src="https://example.test/a.png" alt="x"><button onclick="evil()">Bad</button>',
  }, { allowScript: true });

  assert.deepEqual(uniqueCodes(issues), [
    'external-url',
    'inline-handler',
    'invalid-html-patch-target',
    'static-script',
    'unsafe-tag',
  ]);
});
