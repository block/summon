import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  compileSurfacePolicy,
  normalizeSurfacePolicy,
} from '@anarchitecture/summon';
import { allGalleryToolNames, createGalleryToolRegistry } from './tools.js';
import { allGalleryComponentNames, createGalleryComponentRegistry } from './components.js';
import { GALLERY_PRESETS } from './presets.js';

test('gallery presets are explicit, valid, and policy-complete', () => {
  const toolNames = new Set(allGalleryToolNames());
  const componentNames = new Set(allGalleryComponentNames());
  const seen = new Set<string>();
  const requiredIds = [
    'static-summary',
    'host-resource-search',
    'decision-picker',
    'approval-refund',
    'component-islands',
    'worker-analysis',
    'boundary-stress',
  ];

  for (const id of requiredIds) {
    assert.equal(GALLERY_PRESETS.some((preset) => preset.id === id), true, `missing preset ${id}`);
  }

  for (const preset of GALLERY_PRESETS) {
    assert.equal(seen.has(preset.id), false, `duplicate preset ${preset.id}`);
    seen.add(preset.id);
    assert.equal(Boolean(preset.claim), true, `${preset.id} needs a claim`);
    assert.deepEqual(normalizeSurfacePolicy(preset.surfacePolicy), {
      tier: preset.surfacePolicy.tier,
      purpose: preset.surfacePolicy.purpose ?? 'inform',
      grants: preset.surfacePolicy.grants ?? [],
      components: preset.surfacePolicy.components ?? [],
      persistence: preset.surfacePolicy.persistence ?? 'replayable',
    });

    for (const tool of preset.surfacePolicy.grants ?? []) {
      assert.equal(toolNames.has(tool), true, `${preset.id} references unknown tool ${tool}`);
    }
    for (const component of preset.surfacePolicy.components ?? []) {
      assert.equal(componentNames.has(component), true, `${preset.id} references unknown component ${component}`);
    }

    const compiled = compileSurfacePolicy(preset.surfacePolicy, {
      tools: createGalleryToolRegistry().toContract().pack,
      components: createGalleryComponentRegistry().toContract().pack,
    });
    assert.deepEqual(compiled.issues, []);
    assert.deepEqual(
      compiled.tools?.tools.map((tool) => tool.name) ?? [],
      preset.surfacePolicy.grants ?? [],
    );
    assert.deepEqual(
      compiled.components?.components.map((component) => component.name) ?? [],
      preset.surfacePolicy.components ?? [],
    );
  }
});

test('featured gallery presets cover the main surface policy story', () => {
  const featured = GALLERY_PRESETS.filter((preset) => preset.featured);
  assert.equal(featured.length >= 6, true);
  assert.equal(featured.some((preset) => preset.surfacePolicy.tier === 'static'), true);
  assert.equal(featured.some((preset) => preset.surfacePolicy.tier === 'declarative'), true);
  assert.equal(featured.some((preset) => preset.surfacePolicy.tier === 'approval'), true);
  assert.equal(featured.some((preset) => preset.surfacePolicy.tier === 'worker'), true);
  assert.equal(featured.some((preset) => Boolean(preset.adversarialPrompt)), true);
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
