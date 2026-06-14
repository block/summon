import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  compileDirectionContract,
  compileSurfaceContractView,
  compileSystemContracts,
  compileTokenContract,
  deriveSurfacePlanControls,
  inferSurfacePlan,
  normalizeSurfacePlan,
  suggestSurfacePlan,
  SUMMON_FIXED_INSTRUCTIONS,
  SURFACE_AUTHORITY_VALUES,
  SURFACE_DATA_VALUES,
  SURFACE_PERSISTENCE_VALUES,
  SURFACE_PURPOSE_VALUES,
  SURFACE_RUNTIME_VALUES,
  type CapabilityPack,
  type ComponentPack,
  type SurfacePlan,
  type SummonLayout,
} from '../src/index.ts';

const defaultTokens = readFileSync(
  new URL('../../sandbox-runtime/src/tokens.css', import.meta.url),
  'utf-8',
);

test('fixed prompt describes skeleton-first progressive rendering', () => {
  assert.match(SUMMON_FIXED_INSTRUCTIONS, /Progressive rendering contract/);
  assert.match(SUMMON_FIXED_INSTRUCTIONS, /placeholder `add \/section\/<id>`/);
  assert.match(SUMMON_FIXED_INSTRUCTIONS, /later accepted `add` lines for the same section as replacements/);
  assert.match(SUMMON_FIXED_INSTRUCTIONS, /complete, validated JSONL protocol lines/);
});

test('token compiler emits prompt vocabulary and validates from the token contract', () => {
  const ok = compileTokenContract({ css: defaultTokens });
  assert.equal(ok.issues.length, 0);
  assert.equal(ok.definedTokens.has('color-bg'), true);
  assert.equal(ok.liveOpportunistic.includes('space-12'), true);
  assert.match(ok.promptVocabulary, /host ships a stylesheet/);

  const bad = compileTokenContract({ css: ':root { --color-bg: red; }' });
  assert.equal(bad.issues.some((issue) => issue.severity === 'block'), true);
  assert.equal(bad.issues[0]?.source, 'token');
});

test('system compiler includes component island prompt and validation metadata', () => {
  const components: ComponentPack = {
    components: [
      {
        name: 'MetricCard',
        description: 'Displays a KPI card.',
        propsSchema: '{label: string, value: string}',
        surface: { data: 'embedded', authority: 'none' },
        sizing: { height: '112px' },
        examples: [
          {
          name: 'Metric',
          code: '<div data-summon-component="MetricCard" data-summon-component-id="metric" data-summon-props=\'{"label":"Revenue","value":"$284k"}\' style="min-height:var(--space-10);"></div>',
        },
      ],
      },
    ],
  };

  const compiled = compileSystemContracts({
    mode: 'static',
    components,
  });

  assert.deepEqual(
    compiled.promptBlocks.map((block) => block.id),
    ['fixed', 'components'],
  );
  const block = compiled.promptBlocks.find((promptBlock) => promptBlock.id === 'components');
  assert.match(block?.text ?? '', /Component islands/);
  assert.match(block?.text ?? '', /MetricCard\(\{label: string, value: string\}\)/);
  assert.match(block?.text ?? '', /data-summon-component-id/);
  assert.deepEqual(compiled.validationContext.components, [
    { name: 'MetricCard', surface: { data: 'embedded', authority: 'none' } },
  ]);
});

test('direction compiler validates tokens and selects matching shape exemplars', () => {
  const contract = compileDirectionContract({
    id: 'test',
    prompt: 'Use sharp editorial cards.',
    tokensCss: defaultTokens,
    opts: {},
    shape: 'card',
    exemplars: [
      {
        name: 'button',
        kind: 'atom',
        content: '<button>Continue</button>',
      },
      {
        name: 'card-shape',
        kind: 'shape',
        shape: 'card',
        content: '<article>Card exemplar</article>',
      },
      {
        name: 'comparison-shape',
        kind: 'shape',
        shape: 'comparison',
        content: '<section>Comparison exemplar</section>',
      },
    ],
  });

  assert.equal(contract.issues.length, 0);
  assert.equal(contract.promptBlock.id, 'direction:test');
  assert.match(contract.promptBlock.text, /Card exemplar/);
  assert.doesNotMatch(contract.promptBlock.text, /Comparison exemplar/);
  assert.match(contract.promptBlock.text, /Continue/);
});

test('system compiler returns deterministic prompt block order and validation context', () => {
  const layout: SummonLayout = {
    id: 'two-slot',
    slots: [
      { id: 'summary', purpose: 'Main answer' },
      { id: 'details', purpose: 'Supporting facts' },
    ],
  };
  const capabilities: CapabilityPack = {
    intents: [
      {
        name: 'choose',
        description: 'Pick an option.',
        argsSchema: '{option: string}',
        stateShape: '{lastChoice: string}',
        triggers: ['click'],
      },
    ],
  };
  const compiled = compileSystemContracts({
    mode: 'interactive',
    direction: {
      id: 'demo',
      prompt: 'Use the demo direction.',
      tokensCss: defaultTokens,
      exemplars: [],
      opts: {},
      layout,
    },
    ghost: {
      source: 'root',
      prompt: 'Ghost context block.',
      product: 'Ghost Product',
    },
    layout,
    editBlock: 'Edit block.',
    capabilities,
    tokenOverrides: [{ token: 'color-accent', baseValue: 'blue', newValue: 'red' }],
    postures: { postures: [{ name: 'brief', description: 'Short response.' }] },
  });

  assert.deepEqual(
    compiled.promptBlocks.map((block) => block.id),
    [
      'fixed',
      'direction:demo',
      'ghost',
      'layout:two-slot',
      'edit',
      'capabilities',
      'token-overrides',
      'postures',
    ],
  );
  assert.equal(compiled.validationContext.mode, 'interactive');
  assert.equal(compiled.validationContext.scriptPolicy, 'forbid');
  assert.deepEqual([...(compiled.validationContext.allowedIntents ?? [])], ['choose']);
  assert.equal(compiled.validationContext.definedTokens?.has('color-bg'), true);
  assert.deepEqual(compiled.startupLines, [
    {
      op: 'set',
      path: '/screen',
      value: { sections: ['summary', 'details'] },
    },
  ]);
});

test('system compiler includes a host-owned surface plan block', () => {
  const compiled = compileSystemContracts({
    mode: 'interactive',
    surfacePlan: {
      purpose: 'explore',
      runtime: 'declarative',
      data: 'host-resource',
      authority: 'read',
      persistence: 'replayable',
    },
    capabilities: {
      intents: [
        {
          name: 'search',
          description: 'Search host data.',
          argsSchema: '{query: string}',
          stateShape: '{loading: boolean, results: unknown[]}',
          kind: 'resource',
          triggers: ['submit'],
          stateKeys: { loading: 'loading', data: 'results', error: 'error' },
        },
      ],
    },
  });

  assert.deepEqual(
    compiled.promptBlocks.map((block) => block.id),
    ['fixed', 'surface-plan', 'capabilities'],
  );
  assert.equal(compiled.validationContext.scriptPolicy, 'forbid');
  assert.deepEqual(compiled.validationContext.surfacePlan, {
    purpose: 'explore',
    runtime: 'declarative',
    data: 'host-resource',
    authority: 'read',
    persistence: 'replayable',
  });
  const surfaceBlock = compiled.promptBlocks.find((block) => block.id === 'surface-plan');
  assert.match(surfaceBlock?.text ?? '', /host-owned runtime contract/);
  assert.match(surfaceBlock?.text ?? '', /Do not emit a `\/surface-plan` meta line/);
});

test('system compiler includes compact surface contract view without dropping detail blocks', () => {
  const capabilities: CapabilityPack = {
    intents: [
      {
        name: 'search',
        description: 'Search host data.',
        argsSchema: '{query: string}',
        stateShape: '{loading: boolean, results: unknown[]}',
        kind: 'resource',
        triggers: ['submit'],
        stateKeys: { loading: 'loading', data: 'results', error: 'error' },
        resultSchema: 'unknown[]',
        surface: { data: 'host-resource', authority: 'read' },
      },
    ],
  };
  const components: ComponentPack = {
    components: [
      {
        name: 'MetricCard',
        description: 'Displays a KPI card.',
        propsSchema: '{label: string, value: string}',
        surface: { data: 'embedded', authority: 'none' },
      },
    ],
  };
  const surfaceContract = compileSurfaceContractView({
    tier: 'declarative',
    purpose: 'explore',
    grants: ['search'],
    components: ['MetricCard'],
  }, { capabilities, components });
  const compiled = compileSystemContracts({
    mode: surfaceContract.surface.mode,
    surfaceContract,
    capabilities: surfaceContract.tools.length ? capabilities : null,
    components,
    scriptPolicy: surfaceContract.surface.scriptPolicy,
  });

  assert.deepEqual(
    compiled.promptBlocks.map((block) => block.id),
    ['fixed', 'surface-contract', 'capabilities', 'components'],
  );
  const surfaceBlock = compiled.promptBlocks.find((block) => block.id === 'surface-contract');
  assert.match(surfaceBlock?.text ?? '', /compact, read-only view/);
  assert.match(surfaceBlock?.text ?? '', /freeform HTML\/CSS/);
  assert.match(surfaceBlock?.text ?? '', /Do not emit `\/surface-contract`, `\/surface-policy`, or `\/surface-plan`/);
  assert.match(surfaceBlock?.text ?? '', /`search` \(resource\)/);
  assert.match(surfaceBlock?.text ?? '', /`MetricCard`/);
  assert.equal(compiled.promptBlocks.some((block) => block.id === 'surface-plan'), false);
  assert.match(compiled.promptBlocks.find((block) => block.id === 'capabilities')?.text ?? '', /Available data resources/);
  assert.match(compiled.promptBlocks.find((block) => block.id === 'components')?.text ?? '', /Component islands/);
  assert.deepEqual(compiled.validationContext.surfacePlan, surfaceContract.surface.plan);
});

test('surface plan normalization and suggestions are stable', () => {
  assert.deepEqual(normalizeSurfacePlan({
    purpose: 'operate',
    runtime: 'worker',
    data: 'worker',
    authority: 'approval-gated',
    persistence: 'replayable',
  }), {
    purpose: 'operate',
    runtime: 'worker',
    data: 'worker',
    authority: 'approval-gated',
    persistence: 'replayable',
  });

  const suggestion = suggestSurfacePlan({
    prompt: 'compare payment plans and help me pick one',
    mode: 'interactive',
    scriptPolicy: 'forbid',
    capabilities: {
      intents: [
        {
          name: 'choose',
          description: 'Choose.',
          argsSchema: '{}',
          stateShape: '{}',
          surface: { authority: 'host-action' },
        },
      ],
    },
  });

  assert.deepEqual(suggestion, {
    purpose: 'compare',
    runtime: 'declarative',
    data: 'embedded',
    authority: 'host-action',
    persistence: 'replayable',
  });
  assert.deepEqual(inferSurfacePlan({
    prompt: 'compare payment plans and help me pick one',
    mode: 'interactive',
    scriptPolicy: 'forbid',
    capabilities: {
      intents: [
        {
          name: 'choose',
          description: 'Choose.',
          argsSchema: '{}',
          stateShape: '{}',
          surface: { authority: 'host-action' },
        },
      ],
    },
  }), suggestion);
});

test('surface plan host control helpers expose values and derive defaults', () => {
  assert.deepEqual([...SURFACE_PURPOSE_VALUES], [
    'inform',
    'compare',
    'collect',
    'explore',
    'operate',
    'review',
    'export',
  ]);
  assert.deepEqual([...SURFACE_RUNTIME_VALUES], [
    'static',
    'declarative',
    'scripted',
    'worker',
  ]);
  assert.deepEqual([...SURFACE_DATA_VALUES], [
    'embedded',
    'host-resource',
    'worker',
  ]);
  assert.deepEqual([...SURFACE_AUTHORITY_VALUES], [
    'none',
    'read',
    'host-action',
    'approval-gated',
  ]);
  assert.deepEqual([...SURFACE_PERSISTENCE_VALUES], [
    'ephemeral',
    'replayable',
  ]);

  const base: Omit<SurfacePlan, 'runtime'> = {
    purpose: 'explore',
    data: 'embedded',
    authority: 'none',
    persistence: 'replayable',
  };

  assert.deepEqual(deriveSurfacePlanControls({ ...base, runtime: 'static' }), {
    mode: 'static',
    scriptPolicy: 'forbid',
  });
  assert.deepEqual(deriveSurfacePlanControls({ ...base, runtime: 'declarative' }), {
    mode: 'interactive',
    scriptPolicy: 'forbid',
  });
  assert.deepEqual(deriveSurfacePlanControls({ ...base, runtime: 'worker' }), {
    mode: 'interactive',
    scriptPolicy: 'forbid',
  });
  assert.deepEqual(deriveSurfacePlanControls({ ...base, runtime: 'scripted' }), {
    mode: 'interactive',
    scriptPolicy: 'allow',
  });
});

test('system compiler validates against explicit active tokens when direction is layered', () => {
  const activeTokens = defaultTokens.replace(
    ':root {',
    ':root {\n  --ghost-config-only: 1px;',
  );
  const compiled = compileSystemContracts({
    mode: 'static',
    direction: {
      id: 'demo',
      prompt: 'Use the demo direction.',
      tokensCss: defaultTokens,
      exemplars: [],
      opts: {},
    },
    ghost: {
      source: 'root',
      prompt: 'Ghost context block.',
    },
    activeTokensCss: activeTokens,
  });

  assert.equal(compiled.validationContext.definedTokens?.has('ghost-config-only'), true);
});

test('system compiler can produce declarative-only interactive contracts', () => {
  const compiled = compileSystemContracts({
    mode: 'interactive',
    scriptPolicy: 'forbid',
    capabilities: {
      intents: [
        {
          name: 'choose',
          description: 'Pick an option.',
          argsSchema: '{option: string}',
          stateShape: '{lastChoice: string}',
          triggers: ['click'],
        },
      ],
      patterns: [
        {
          name: 'script pattern',
          code: '<button id="x">Pick</button><script>document.getElementById("x")?.addEventListener("click", () => sandbox.emit("choose", {option:"A"}))</script>',
        },
        {
          name: 'declarative pattern',
          code: '<button data-summon-on-click="choose" data-summon-args=\'{"option":"A"}\'>Pick</button>',
        },
      ],
    },
  });

  assert.equal(compiled.validationContext.scriptPolicy, 'forbid');
  const capabilitiesBlock = compiled.promptBlocks.find((block) => block.id === 'capabilities');
  assert.match(capabilitiesBlock?.text ?? '', /Declarative-only interactivity/);
  assert.match(capabilitiesBlock?.text ?? '', /Do not emit `<script>` tags/);
  assert.doesNotMatch(capabilitiesBlock?.text ?? '', /document\.getElementById/);
  assert.match(capabilitiesBlock?.text ?? '', /data-summon-on-click="choose"/);
});

test('system compiler requires a scripted surface plan for script policy allow', () => {
  const missingPlan = compileSystemContracts({
    mode: 'interactive',
    scriptPolicy: 'allow',
    capabilities: {
      intents: [
        {
          name: 'choose',
          description: 'Pick an option.',
          argsSchema: '{option: string}',
          stateShape: '{lastChoice: string}',
          triggers: ['click'],
        },
      ],
    },
  });

  assert.equal(missingPlan.validationContext.scriptPolicy, 'forbid');
  assert.ok(missingPlan.issues.some((issue) =>
    issue.code === 'surface-script-policy-mismatch' &&
    issue.message === 'scriptPolicy: "allow" requires a scripted SurfacePlan'
  ));

  const declarativePlan = compileSystemContracts({
    mode: 'interactive',
    scriptPolicy: 'allow',
    surfacePlan: {
      purpose: 'explore',
      runtime: 'declarative',
      data: 'embedded',
      authority: 'host-action',
      persistence: 'replayable',
    },
  });

  assert.ok(declarativePlan.issues.some((issue) =>
    issue.code === 'surface-script-policy-mismatch' &&
    issue.message === 'scriptPolicy: "allow" requires a scripted SurfacePlan'
  ));
});

test('system compiler accepts explicit scripted surface plan with script policy allow', () => {
  const compiled = compileSystemContracts({
    mode: 'interactive',
    scriptPolicy: 'allow',
    surfacePlan: {
      purpose: 'explore',
      runtime: 'scripted',
      data: 'embedded',
      authority: 'host-action',
      persistence: 'replayable',
    },
    capabilities: {
      intents: [
        {
          name: 'choose',
          description: 'Pick an option.',
          argsSchema: '{option: string}',
          stateShape: '{lastChoice: string}',
          triggers: ['click'],
        },
      ],
    },
  });

  assert.equal(compiled.validationContext.scriptPolicy, 'allow');
  assert.equal(compiled.issues.some((issue) => issue.code === 'surface-script-policy-mismatch'), false);
  const capabilitiesBlock = compiled.promptBlocks.find((block) => block.id === 'capabilities');
  assert.match(capabilitiesBlock?.text ?? '', /Rules for scripts/);
});
