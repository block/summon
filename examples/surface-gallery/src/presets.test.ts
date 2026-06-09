import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  deriveSurfacePlanControls,
  normalizeSurfacePlan,
  surfacePlanWithinCeiling,
} from '@anarchitecture/summon';
import { allGalleryCapabilityNames } from './capabilities.js';
import { allGalleryComponentNames } from './components.js';
import { GALLERY_PRESETS } from './presets.js';

test('gallery presets are explicit, valid, and contract-complete', () => {
  const capabilityNames = new Set(allGalleryCapabilityNames());
  const componentNames = new Set(allGalleryComponentNames());
  const seen = new Set<string>();

  assert.equal(GALLERY_PRESETS.length, 6);

  for (const preset of GALLERY_PRESETS) {
    assert.equal(seen.has(preset.id), false, `duplicate preset ${preset.id}`);
    seen.add(preset.id);
    assert.deepEqual(normalizeSurfacePlan(preset.surfacePlan), preset.surfacePlan);
    assert.equal(surfacePlanWithinCeiling(preset.surfacePlan, preset.surfaceCeiling), true);
    assert.equal(preset.scriptPolicy, deriveSurfacePlanControls(preset.surfacePlan).scriptPolicy);

    for (const capability of preset.capabilityNames) {
      assert.equal(capabilityNames.has(capability), true, `${preset.id} references unknown capability ${capability}`);
    }
    for (const component of preset.componentNames ?? []) {
      assert.equal(componentNames.has(component), true, `${preset.id} references unknown component ${component}`);
    }
  }
});

test('surface gallery source imports public Summon packages only', () => {
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  for (const entry of readdirSync(sourceDir)) {
    if (!entry.endsWith('.ts')) continue;
    if (entry.endsWith('.test.ts')) continue;
    const text = readFileSync(join(sourceDir, entry), 'utf8');
    assert.equal(text.includes('@summon-internal/'), false, `${entry} imports an internal package`);
    assert.equal(/from ['"]@anarchitecture\/summon\/(host|engine\/src|browser\/src)/.test(text), false);
  }
});
