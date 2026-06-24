import assert from 'node:assert/strict';
import test from 'node:test';
import { loadFingerprintCatalog, publicFingerprints } from './fingerprint-catalog.js';

test('public fingerprints expose compact token preview colors', () => {
  const fingerprints = publicFingerprints(loadFingerprintCatalog());
  const editorialMono = fingerprints.find((fingerprint) => fingerprint.id === 'editorial-mono');

  assert.ok(editorialMono);
  assert.ok(editorialMono.previewColors.length >= 3);
  assert.ok(editorialMono.previewColors.every((color) => (
    /^#[0-9a-f]{3,8}$/i.test(color) ||
    /^rgba?\(/i.test(color)
  )));
});
