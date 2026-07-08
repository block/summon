// Structural materials layer (vessel-light, bridged). Contract:
// docs/integration-with-ghost.md "Structural materials layer".
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveMaterialsAssetPath, structuralMaterials } from './materials.js';

test('structuralMaterials composes bridge before primitives', () => {
  const materials = structuralMaterials();
  const bridgeAt = materials.css.indexOf('--background: var(--color-bg)');
  const primitivesAt = materials.css.indexOf('.surface {');
  assert.ok(bridgeAt >= 0, 'bridge mapping present');
  assert.ok(primitivesAt > bridgeAt, 'primitives follow the bridge');
});

test('bridge maps every vessel token the primitives consume', () => {
  const materials = structuralMaterials();
  const primitivesStart = materials.css.indexOf('.surface {');
  const bridge = materials.css.slice(0, primitivesStart);
  const primitives = materials.css.slice(primitivesStart);
  const consumed = new Set(
    [...primitives.matchAll(/var\((--[a-z0-9-]+)/g)].map((match) => match[1]!),
  );
  const defined = new Set(
    [...bridge.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]!),
  );
  // Tokens the fingerprints themselves define (the shared dialect) are the
  // bridge's *inputs*, not its outputs.
  const fingerprintDialect = /^--(color-|radius-sm|radius-md|radius-lg|font-sans|font-mono|space-)/;
  const missing = [...consumed].filter(
    (token) => !defined.has(token) && !fingerprintDialect.test(token),
  );
  assert.deepEqual(missing, [], `unbridged vessel tokens: ${missing.join(', ')}`);
});

test('font faces CSS carries HK Grotesk faces pointing at the materials route', () => {
  const materials = structuralMaterials();
  const faces = materials.fontFacesCss.match(/@font-face/g) ?? [];
  assert.ok(faces.length >= 5, `expected full weight range, got ${faces.length}`);
  assert.ok(materials.fontFacesCss.includes('/api/fingerprint-materials/vessel-light/fonts/'));
});

test('brief names the primitive families and preserves fingerprint authority', () => {
  const { brief } = structuralMaterials();
  for (const family of ['surface', 'stack', 'button', 'input', 'text']) {
    assert.ok(brief.includes(`\`${family}\``), `brief missing ${family}`);
  }
  assert.ok(brief.includes('design authority'));
});

test('resolveMaterialsAssetPath rejects traversal and absolute escapes', () => {
  assert.ok(resolveMaterialsAssetPath('vessel-light/fonts/HKGrotesk-Regular.woff2'));
  assert.equal(resolveMaterialsAssetPath('../bundles/technical-noir/.ghost/index.md'), null);
  assert.equal(resolveMaterialsAssetPath('vessel-light/../../secrets'), null);
  assert.equal(resolveMaterialsAssetPath('/etc/passwd'), null);
});
