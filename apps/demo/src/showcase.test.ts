import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveSurfacePlanControls } from '@anarchitecture/summon';
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
  for (const scenario of SHOWCASE_SCENARIOS) {
    assert.ok(scenario.id);
    assert.ok(scenario.label);
    assert.ok(scenario.prompt);
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
