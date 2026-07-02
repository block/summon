import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isSurfaceDocumentArtifact,
  normalizeSurfaceDocumentArtifact,
  validateSurfaceDocumentArtifact,
} from '../src/surface-document-artifact.ts';

function codes(issues: Array<{ code: string }>): string[] {
  return issues.map((issue) => issue.code);
}

test('surface-document artifact requires main.html and main.css; main.js is optional', () => {
  const valid = {
    runtime: 'surface-document',
    source: {
      'main.html': '<main id="app"><h1>Hello</h1></main>',
      'main.css': '.app{color:var(--color-text)}',
    },
  };
  const { artifact, issues } = normalizeSurfaceDocumentArtifact(valid);
  assert.deepEqual(issues, []);
  assert.ok(artifact);
  assert.equal(artifact!.source['main.js'], undefined);
  assert.equal(isSurfaceDocumentArtifact(valid), true);

  const missing = normalizeSurfaceDocumentArtifact({ runtime: 'surface-document', source: { 'main.html': '<main></main>' } });
  assert.equal(missing.artifact, null);
  assert.ok(codes(missing.issues).includes('missing-surface-document-file'));
});

test('surface-document artifact rejects unexpected files and non-string source files', () => {
  const { artifact, issues } = normalizeSurfaceDocumentArtifact({
    runtime: 'surface-document',
    source: {
      'main.html': '<main></main>',
      'main.css': '',
      '../escape.js': 'x',
      'main.js': 42,
    },
  });
  assert.equal(artifact, null);
  assert.ok(codes(issues).includes('invalid-surface-document-source-path'));
  assert.ok(codes(issues).includes('invalid-surface-document-source-file'));
});

test('surface-document HTML validator keeps structure inert', () => {
  const cases: Array<[string, string]> = [
    ['<script>alert(1)</script>', 'surface-document-html-forbidden-tag'],
    ['<button onclick="x()">x</button>', 'surface-document-html-inline-handler'],
    ['<a href="javascript:alert(1)">x</a>', 'surface-document-html-javascript-url'],
  ];
  for (const [html, code] of cases) {
    const issues = validateSurfaceDocumentArtifact({
      runtime: 'surface-document',
      source: { 'main.html': html, 'main.css': '.x{}' },
    });
    assert.ok(codes(issues).includes(code), `expected ${code}, got ${codes(issues).join(', ')}`);
  }
});

test('surface-document CSS validator blocks imports and external urls', () => {
  for (const css of ['@import url("https://x");', '.x{background:url(data:image/png;base64,abc)}']) {
    const issues = validateSurfaceDocumentArtifact({
      runtime: 'surface-document',
      source: { 'main.html': '<main></main>', 'main.css': css },
    });
    assert.ok(issues.some((issue) => issue.code.startsWith('surface-document-css-')));
  }
});

test('surface-document JS allows scoped queries but blocks ambient authority and runtime HTML injection', () => {
  const valid = validateSurfaceDocumentArtifact({
    runtime: 'surface-document',
    source: {
      'main.html': '<main><button id="go" data-ref="go">Go</button></main>',
      'main.css': '.x{}',
      'main.js': `
        const button = document.getElementById('go');
        const same = document.querySelector('[data-ref="go"]');
        button.onclick = () => { same.textContent = 'Done'; };
      `,
    },
  });
  assert.deepEqual(codes(valid), []);

  const cases = [
    ['fetch("https://x")', 'surface-document-network-not-granted'],
    ['document.body.append(document.createElement("p"))', 'surface-document-unsupported-api'],
    ['el.innerHTML = "<b>x</b>"', 'surface-document-unsupported-api'],
    ['window.location.href = "/"', 'surface-document-unsupported-api'],
    ['eval("1+1")', 'surface-document-unsupported-api'],
  ];
  for (const [js, code] of cases) {
    const issues = validateSurfaceDocumentArtifact({
      runtime: 'surface-document',
      source: { 'main.html': '<main></main>', 'main.css': '.x{}', 'main.js': js },
    });
    assert.ok(codes(issues).includes(code), `expected ${code}, got ${codes(issues).join(', ')}`);
  }
});
