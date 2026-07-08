// Host-owned @font-face installation. Contract: docs/adoption/fonts.md.
// Covers sanitization (only @font-face blocks survive), document-level
// install (faces are document-scoped; shadow-root declarations load nothing),
// content-hash dedup across surfaces, and refcounted teardown.

import { Window } from 'happy-dom';

const window = new Window({ url: 'http://localhost/' });
const g = globalThis as unknown as Record<string, unknown>;
g.window = window;
g.document = window.document;
g.HTMLStyleElement = window.HTMLStyleElement;

import assert from 'node:assert/strict';
import test from 'node:test';
import { installFontFaces, sanitizeFontFacesCss } from '../src/font-faces.ts';

const doc = window.document as unknown as Document;

const FACE_A = `@font-face {
  font-family: "HK Grotesk";
  src: url(/fonts/HKGrotesk-Regular.woff2) format("woff2");
  font-weight: 400;
}`;

const FACE_B = `@font-face { font-family: "HK Grotesk"; src: url(/fonts/HKGrotesk-Bold.woff2) format("woff2"); font-weight: 700; }`;

function installedElements(): Element[] {
  return [...doc.head.querySelectorAll('style[data-summon-font-faces]')];
}

test('sanitizeFontFacesCss keeps @font-face blocks and drops everything else', () => {
  const hostile = [
    FACE_A,
    '@import url("https://evil.example/steal.css");',
    'body { background: red !important; }',
    '@media screen { .x { color: blue; } }',
    FACE_B,
    '/* @font-face { font-family: commented; } */',
  ].join('\n');
  const sanitized = sanitizeFontFacesCss(hostile);
  assert.equal((sanitized.match(/@font-face/g) ?? []).length, 2);
  assert.ok(sanitized.includes('HKGrotesk-Regular'));
  assert.ok(sanitized.includes('HKGrotesk-Bold'));
  assert.ok(!sanitized.includes('@import'));
  assert.ok(!sanitized.includes('background'));
  assert.ok(!sanitized.includes('@media'));
  assert.ok(!sanitized.includes('commented'));
});

test('sanitizeFontFacesCss drops blocks with nested braces rather than guessing', () => {
  const nested = '@font-face { font-family: x; @supports (a: b) { src: url(/x.woff2); } }';
  // The inner brace makes the "block" not a plain declaration list; the outer
  // match closes at the first balanced brace, leaving an unmodeled construct.
  const sanitized = sanitizeFontFacesCss(nested);
  assert.ok(!sanitized.includes('@supports'));
});

test('installFontFaces installs into document head and releases at zero refs', () => {
  const handle = installFontFaces(FACE_A, doc);
  assert.ok(handle);
  assert.equal(installedElements().length, 1);
  assert.ok(installedElements()[0]!.textContent!.includes('HK Grotesk'));

  handle!.release();
  assert.equal(installedElements().length, 0);
  // Idempotent release.
  handle!.release();
  assert.equal(installedElements().length, 0);
});

test('installFontFaces dedupes identical CSS across surfaces via refcount', () => {
  const first = installFontFaces(FACE_A, doc);
  const second = installFontFaces(FACE_A, doc);
  assert.ok(first && second);
  assert.equal(first!.key, second!.key);
  assert.equal(installedElements().length, 1);

  first!.release();
  assert.equal(installedElements().length, 1, 'element survives while second surface lives');
  second!.release();
  assert.equal(installedElements().length, 0);
});

test('installFontFaces returns null when nothing survives sanitization', () => {
  assert.equal(installFontFaces('body { color: red; }', doc), null);
  assert.equal(installFontFaces('', doc), null);
  assert.equal(installFontFaces(null, doc), null);
  assert.equal(installedElements().length, 0);
});

test('distinct font CSS installs distinct elements', () => {
  const a = installFontFaces(FACE_A, doc);
  const b = installFontFaces(FACE_B, doc);
  assert.ok(a && b);
  assert.notEqual(a!.key, b!.key);
  assert.equal(installedElements().length, 2);
  a!.release();
  b!.release();
  assert.equal(installedElements().length, 0);
});
