import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compileSurfacePolicy,
  normalizeSurfacePolicy,
} from '@anarchitecture/summon';
import { deriveSurfacePlanControls } from '@anarchitecture/summon/engine';
import { GALLERY_PRESETS } from '../../../examples/surface-gallery/src/presets.js';
import { baseDemoComponentPack } from './components.js';
import {
  createScopedDemoRegistry,
  narrowCapabilityPack,
  SHOWCASE_SCENARIOS,
} from './showcase.js';

const allDemoCapabilityNames = [
  'log',
  'counter',
  'choose',
  'submit',
  'search',
  'ai',
  'github_lookup',
  'analysis',
  'compute_score',
  'publish_summary',
  'summon',
];

const publicDirectionIds = new Set(['ghost', 'pulse', 'workbench']);

test('createScopedDemoRegistry aligns prompt pack, validation grants, and handlers', () => {
  const registry = createScopedDemoRegistry({ onSummon: () => {} }, ['search', 'summon']);
  const contract = registry.toContract();

  assert.deepEqual(contract.pack.intents.map((intent) => intent.name), ['search', 'summon']);
  assert.deepEqual(contract.validationCapabilities.map((capability) => capability.name), ['search', 'summon']);
  assert.deepEqual(Object.keys(registry.toPolicyHandlers()), ['search', 'summon']);
  assert.deepEqual(registry.intents(), ['search', 'summon']);
});

test('narrowCapabilityPack keeps only allowed intents and non-leaking patterns', () => {
  const full = createScopedDemoRegistry(
    { onSummon: () => {} },
    allDemoCapabilityNames,
  ).toContract().pack;

  const narrowed = narrowCapabilityPack(full, ['counter']);

  assert.deepEqual(narrowed.intents.map((intent) => intent.name), ['counter']);
  assert.ok(narrowed.patterns?.some((pattern) => pattern.code.includes('"counter"')));
  assert.equal(
    narrowed.patterns?.some((pattern) => pattern.code.includes('"summon"') || pattern.code.includes('"search"')),
    false,
  );
});

test('showcase scenarios declare contract-complete surfaces', () => {
  const capabilities = createScopedDemoRegistry(
    { onSummon: () => {} },
    allDemoCapabilityNames,
  ).toContract().pack;
  const components = baseDemoComponentPack();

  for (const scenario of SHOWCASE_SCENARIOS) {
    assert.ok(scenario.id);
    assert.ok(scenario.label);
    assert.ok(scenario.prompt);
    assert.deepEqual(normalizeSurfacePolicy(scenario.surfacePolicy), {
      tier: scenario.surfacePolicy.tier,
      purpose: scenario.surfacePolicy.purpose ?? 'inform',
      grants: scenario.surfacePolicy.grants ?? [],
      components: scenario.surfacePolicy.components ?? [],
      persistence: scenario.surfacePolicy.persistence ?? 'replayable',
    });

    const compiled = compileSurfacePolicy(scenario.surfacePolicy, {
      capabilities,
      components,
    });
    assert.deepEqual(compiled.issues, [], `${scenario.id} has invalid SurfacePolicy`);
    assert.deepEqual(compiled.surfacePlan, scenario.surfacePlan, `${scenario.id} policy does not compile to its SurfacePlan`);
    assert.deepEqual(
      compiled.capabilities?.intents.map((intent) => intent.name) ?? [],
      scenario.capabilityNames,
      `${scenario.id} grants do not match capability names`,
    );
    assert.deepEqual(
      compiled.components?.components.map((component) => component.name) ?? [],
      scenario.componentNames ?? [],
      `${scenario.id} trusted components do not match component names`,
    );

    assert.ok(scenario.surfacePlan.purpose);
    assert.ok(scenario.surfacePlan.runtime);
    assert.ok(scenario.surfacePlan.data);
    assert.ok(scenario.surfacePlan.authority);
    assert.ok(scenario.surfacePlan.persistence);
    const controls = deriveSurfacePlanControls(scenario.surfacePlan);
    assert.equal(scenario.mode, controls.mode);
    assert.equal(scenario.scriptPolicy ?? controls.scriptPolicy, controls.scriptPolicy);
  }
});

test('generate showcase mirrors surface gallery presets for shared sandbox paths', () => {
  const galleryById = new Map(GALLERY_PRESETS.map((preset) => [preset.id, preset]));
  const sharedPresetIds = [
    'static-summary',
    'host-resource-search',
    'decision-picker',
    'approval-publish',
    'component-islands',
    'worker-analysis',
  ];

  for (const id of sharedPresetIds) {
    const gallery = galleryById.get(id);
    const scenario = SHOWCASE_SCENARIOS.find((item) => item.id === id);
    assert.ok(gallery, `missing gallery preset ${id}`);
    assert.ok(scenario, `missing generate scenario ${id}`);
    assert.equal(scenario.label, gallery.title, `${id} label drift`);
    assert.deepEqual(scenario.surfacePolicy, gallery.surfacePolicy, `${id} SurfacePolicy drift`);
    assert.deepEqual(scenario.capabilityNames, gallery.surfacePolicy.grants ?? [], `${id} grant drift`);
    assert.deepEqual(scenario.componentNames ?? [], gallery.surfacePolicy.components ?? [], `${id} component drift`);
  }
});

test('showcase scenarios reference known demo capabilities', () => {
  const known = new Set(allDemoCapabilityNames);
  for (const scenario of SHOWCASE_SCENARIOS) {
    for (const name of scenario.capabilityNames) {
      assert.ok(known.has(name), `${scenario.id} references unknown capability "${name}"`);
    }
  }
});

test('showcase scenarios cover every non-utility demo capability', () => {
  const utilityCapabilities = new Set(['log']);
  const covered = new Set(SHOWCASE_SCENARIOS.flatMap((scenario) => scenario.capabilityNames));
  const missing = allDemoCapabilityNames.filter(
    (name) => !utilityCapabilities.has(name) && !covered.has(name),
  );

  assert.deepEqual(missing, []);
});

test('showcase scenarios reference bundled public directions', () => {
  for (const scenario of SHOWCASE_SCENARIOS) {
    if (!scenario.directionId) continue;
    const directionId = scenario.directionId.startsWith('ghost:') ? 'ghost' : scenario.directionId;
    assert.ok(
      publicDirectionIds.has(directionId),
      `${scenario.id} references unknown public direction "${scenario.directionId}"`,
    );
  }
});

test('token override scenario uses the Pulse direction', () => {
  const scenario = SHOWCASE_SCENARIOS.find((item) => item.id === 'token-override');

  assert.equal(scenario?.directionId, 'pulse');
});
