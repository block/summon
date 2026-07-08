// Structural materials layer (vessel-light, bridged). Contract:
// docs/integration-with-ghost.md "Structural materials layer".
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { materialsRoot, resolveMaterialsAssetPath, structuralMaterials } from './materials.js';

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
  // Tokens the fingerprints themselves define — the shared dialect plus the
  // Vessel-named tokens all 8 bundles carry natively (--shadow-card/popover/
  // modal, --radius-pill) — are the bridge's *inputs*, not its outputs.
  const fingerprintOwned = sharedFingerprintTokens();
  const fingerprintDialect = /^--(color-|radius-sm|radius-md|radius-lg|font-sans|font-mono|space-)/;
  const missing = [...consumed].filter(
    (token) => !defined.has(token) && !fingerprintDialect.test(token) && !fingerprintOwned.has(token),
  );
  assert.deepEqual(missing, [], `unbridged vessel tokens: ${missing.join(', ')}`);
});

test('bridge never redefines a token the fingerprints own', () => {
  // The bridge is appended AFTER the fingerprint token block in the same
  // :root scope: a collision silently overrides the design authority with a
  // generic default. Every bridge-defined name must be absent from every
  // fingerprint's own token block.
  const materials = structuralMaterials();
  const primitivesStart = materials.css.indexOf('.surface {');
  const bridge = materials.css.slice(0, primitivesStart);
  const bridgeDefined = new Set(
    [...bridge.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((match) => match[1]!),
  );
  const collisions: string[] = [];
  for (const [bundleId, tokens] of fingerprintTokenBlocks()) {
    for (const token of tokens) {
      if (bridgeDefined.has(token)) collisions.push(`${bundleId}:${token}`);
    }
  }
  assert.deepEqual(collisions, [], `bridge overrides fingerprint tokens: ${collisions.join(', ')}`);
});

/** Token names defined by every vendored fingerprint's index ```css block. */
function sharedFingerprintTokens(): Set<string> {
  const blocks = fingerprintTokenBlocks();
  assert.ok(blocks.length >= 8, 'expected all vendored fingerprints');
  let shared: Set<string> = new Set(blocks[0]![1]);
  for (const [, tokens] of blocks.slice(1)) {
    shared = new Set([...shared].filter((token) => tokens.has(token)));
  }
  return shared;
}

function fingerprintTokenBlocks(): Array<[string, Set<string>]> {
  const bundlesRoot = join(materialsRoot(), '..', 'bundles');
  return readdirSync(bundlesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry): [string, Set<string>] => {
      const indexMd = readFileSync(join(bundlesRoot, entry.name, '.ghost', 'index.md'), 'utf-8');
      const fenced = indexMd.match(/```css\n([\s\S]*?)```/)?.[1] ?? '';
      const tokens = new Set(
        [...fenced.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((match) => match[1]!),
      );
      return [entry.name, tokens];
    });
}

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
