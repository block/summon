import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compileSurfacePolicy,
  normalizeSurfacePolicy,
} from '@anarchitecture/summon';
import { GALLERY_PRESETS } from '../../surface-gallery/src/presets.js';
import {
  createScopedDemoRegistry,
  narrowToolPack,
  SHOWCASE_SCENARIOS,
} from './showcase.js';
import { ALL_PROMPTS } from './prompts.js';
import { groupScenarios } from './pages/generate/surfaceHelpers.js';
import { defaultsForRunProfile } from './pages/generate/modelProviders.js';
import type { ModelProviderInfo } from './pages/generate/types.js';

const allDemoToolNames = [
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

const publicDirectionIds = new Set(['pulse', 'workbench']);

test('createScopedDemoRegistry aligns prompt pack, validation grants, and handlers', () => {
  const registry = createScopedDemoRegistry({ onSummon: () => {} }, ['search', 'summon']);
  const contract = registry.toContract();

  assert.deepEqual(contract.pack.tools.map((tool) => tool.name), ['search', 'summon']);
  assert.deepEqual(contract.validationTools.map((tool) => tool.name), ['search', 'summon']);
  assert.deepEqual(Object.keys(registry.toPolicyHandlers()), ['search', 'summon']);
  assert.deepEqual(registry.tools(), ['search', 'summon']);
});

test('narrowToolPack keeps only allowed tools and non-leaking patterns', () => {
  const full = createScopedDemoRegistry(
    { onSummon: () => {} },
    allDemoToolNames,
  ).toContract().pack;

  const narrowed = narrowToolPack(full, ['counter']);

  assert.deepEqual(narrowed.tools.map((tool) => tool.name), ['counter']);
  assert.ok(narrowed.patterns?.some((pattern) => pattern.code.includes('"counter"')));
  assert.equal(
    narrowed.patterns?.some((pattern) => pattern.code.includes('"summon"') || pattern.code.includes('"search"')),
    false,
  );
});

test('showcase scenarios declare contract-complete surfaces', () => {
  const tools = createScopedDemoRegistry(
    { onSummon: () => {} },
    allDemoToolNames,
  ).toContract().pack;

  for (const scenario of SHOWCASE_SCENARIOS) {
    assert.ok(scenario.id);
    assert.ok(scenario.label);
    assert.ok(scenario.prompt);
    assert.deepEqual(normalizeSurfacePolicy(scenario.surfacePolicy), {
      tier: scenario.surfacePolicy.tier,
      purpose: scenario.surfacePolicy.purpose ?? 'inform',
      grants: scenario.surfacePolicy.grants ?? [],
      persistence: scenario.surfacePolicy.persistence ?? 'replayable',
    });

    const compiled = compileSurfacePolicy(scenario.surfacePolicy, {
      tools,
    });
    assert.deepEqual(compiled.issues, [], `${scenario.id} has invalid SurfacePolicy`);
    assert.deepEqual(compiled.surfacePlan, scenario.surfacePlan, `${scenario.id} policy does not compile to its SurfacePlan`);
    assert.deepEqual(
      compiled.tools?.tools.map((tool) => tool.name) ?? [],
      scenario.toolNames,
      `${scenario.id} grants do not match tool names`,
    );

    assert.ok(scenario.surfacePlan.purpose);
    assert.ok(scenario.surfacePlan.runtime);
    assert.ok(scenario.surfacePlan.data);
    assert.ok(scenario.surfacePlan.authority);
    assert.ok(scenario.surfacePlan.persistence);
    assert.equal(scenario.mode, compiled.mode);
  }
});

test('generate showcase mirrors surface gallery presets for shared sandbox paths', () => {
  const galleryById = new Map(GALLERY_PRESETS.map((preset) => [preset.id, preset]));
  const sharedPresetIds = [
    'static-summary',
    'host-resource-search',
    'decision-picker',
    'arrow-fidelity',
    'worker-analysis',
  ];

  for (const id of sharedPresetIds) {
    const gallery = galleryById.get(id);
    const scenario = SHOWCASE_SCENARIOS.find((item) => item.id === id);
    assert.ok(gallery, `missing gallery preset ${id}`);
    assert.ok(scenario, `missing generate scenario ${id}`);
    assert.deepEqual(scenario.surfacePolicy, gallery.surfacePolicy, `${id} SurfacePolicy drift`);
    assert.deepEqual(scenario.toolNames, gallery.surfacePolicy.grants ?? [], `${id} grant drift`);
  }
});

test('showcase scenarios reference known demo tools', () => {
  const known = new Set(allDemoToolNames);
  for (const scenario of SHOWCASE_SCENARIOS) {
    for (const name of scenario.toolNames) {
      assert.ok(known.has(name), `${scenario.id} references unknown tool "${name}"`);
    }
  }
});

test('showcase scenarios cover every non-utility demo tool', () => {
  const utilityTools = new Set(['log']);
  const covered = new Set(SHOWCASE_SCENARIOS.flatMap((scenario) => scenario.toolNames));
  const missing = allDemoToolNames.filter(
    (name) => !utilityTools.has(name) && !covered.has(name),
  );

  assert.deepEqual(missing, []);
});

test('showcase menu groups use current Arrow-first labels', () => {
  const categories = groupScenarios(SHOWCASE_SCENARIOS).map((group) => group.category);

  assert.deepEqual(categories, [
    'Host resources',
    'Static',
    'Host actions',
    'Worker',
    'Approval',
    'Arrow behavior',
    'Design tokens',
    'Layout',
    'Composition',
  ]);
  assert.equal(categories.includes('Host data'), false);
  assert.equal(categories.includes('Read-only'), false);
  assert.equal(categories.includes('Runtime'), false);
});

test('batch prompt pool covers representative surface intents', () => {
  const requiredSignals: Array<[string, RegExp]> = [
    ['host data lookup', /\b(search|lookup|find)\b/i],
    ['host AI brainstorm', /\bbrainstorm\b/i],
    ['form submit', /\b(collect|intake|submit|order)\b/i],
    ['host action choice', /\b(save|choose|vote|pick)\b/i],
    ['worker analysis', /\b(analy[sz]e|compute|score)\b/i],
    ['approval-gated operation', /\b(approval|approve|publish)\b/i],
    ['GitHub resource', /\bgithub\b/i],
  ];

  for (const [label, pattern] of requiredSignals) {
    assert.ok(
      ALL_PROMPTS.some((prompt) => pattern.test(prompt)),
      `batch prompt pool is missing ${label}`,
    );
  }

  assert.equal(
    ALL_PROMPTS.some((prompt) => /\b(right now|latest|today's)\b/i.test(prompt)),
    false,
    'batch prompt pool should not require current external facts',
  );
});

test('showcase scenarios reference bundled public directions', () => {
  for (const scenario of SHOWCASE_SCENARIOS) {
    if (!scenario.directionId) continue;
    if (scenario.directionId.startsWith('ghost:')) continue;
    const directionId = scenario.directionId;
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

test('generate run profile fast picks fast catalog models and low-cost Anthropic options', () => {
  const provider = providerFixture();

  assert.deepEqual(defaultsForRunProfile(provider, 'fast'), {
    generationModel: 'claude-haiku-4-5',
    utilityModel: 'claude-haiku-4-5',
    maxOutputTokens: 12000,
    anthropicThinking: 'off',
    effort: 'low',
  });
});

test('generate run profile quality restores provider-reported defaults', () => {
  const provider = providerFixture();

  assert.deepEqual(defaultsForRunProfile(provider, 'quality'), {
    generationModel: 'claude-opus-4-8',
    utilityModel: 'claude-sonnet-4-6',
    maxOutputTokens: 64000,
    anthropicThinking: 'adaptive',
    effort: 'medium',
  });
});

test('generate run profile fast falls back to nearest lower output preset', () => {
  const provider = providerFixture({
    fastModelMaxOutputTokens: 10000,
    presets: [8000, 16000, 32000],
  });

  assert.equal(defaultsForRunProfile(provider, 'fast').maxOutputTokens, 8000);
});

function providerFixture({
  fastModelMaxOutputTokens = 64000,
  presets = [8000, 12000, 16000, 32000, 64000],
}: {
  fastModelMaxOutputTokens?: number;
  presets?: number[];
} = {}): ModelProviderInfo {
  return {
    id: 'anthropic',
    name: 'Anthropic',
    configured: true,
    model: 'claude-opus-4-8',
    utilityModel: 'claude-sonnet-4-6',
    models: [
      {
        id: 'claude-opus-4-8',
        label: 'Claude Opus 4.8',
        status: 'stable',
        tier: 'frontier',
        maxOutputTokens: 128000,
      },
      {
        id: 'claude-haiku-4-5',
        label: 'Claude Haiku 4.5',
        status: 'stable',
        tier: 'fast',
        maxOutputTokens: fastModelMaxOutputTokens,
      },
    ],
    utilityModels: [
      {
        id: 'claude-sonnet-4-6',
        label: 'Claude Sonnet 4.6',
        status: 'stable',
        tier: 'balanced',
        maxOutputTokens: 64000,
      },
      {
        id: 'claude-haiku-4-5',
        label: 'Claude Haiku 4.5',
        status: 'stable',
        tier: 'fast',
        maxOutputTokens: fastModelMaxOutputTokens,
      },
    ],
    defaults: {
      generationModel: 'claude-opus-4-8',
      utilityModel: 'claude-sonnet-4-6',
      modelOptions: {
        maxOutputTokens: 64000,
        anthropicThinking: 'adaptive',
        effort: 'medium',
      },
    },
    controls: {
      customModels: true,
      maxOutputTokens: { default: 64000, presets },
      anthropicThinking: { default: 'adaptive', options: ['adaptive', 'off'] },
      effort: { default: 'medium', options: ['low', 'medium', 'high'] },
    },
  };
}
