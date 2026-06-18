import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  compileDirectionContract,
  compileSurfaceContractView,
  compileSystemContracts,
  compileTokenContract,
  inferSurfacePlan,
  normalizeSurfacePlan,
  suggestSurfacePlan,
  SUMMON_FIXED_INSTRUCTIONS,
  SURFACE_AUTHORITY_VALUES,
  SURFACE_DATA_VALUES,
  SURFACE_NETWORK_VALUES,
  SURFACE_PERSISTENCE_VALUES,
  SURFACE_PURPOSE_VALUES,
  type ToolPack,
  type SummonLayout,
} from '../src/index.ts';

const defaultTokens = readFileSync(
  new URL('../../sandbox-runtime/src/tokens.css', import.meta.url),
  'utf-8',
);

test('fixed prompt describes Arrow-only artifact output', () => {
  assert.match(SUMMON_FIXED_INSTRUCTIONS, /Output protocol — semantic preview events, then Arrow artifact/);
  assert.match(SUMMON_FIXED_INSTRUCTIONS, /"op":"event"/);
  assert.match(SUMMON_FIXED_INSTRUCTIONS, /"op":"artifact"/);
  assert.match(SUMMON_FIXED_INSTRUCTIONS, /"runtime":"arrow"/);
  assert.match(SUMMON_FIXED_INSTRUCTIONS, /`watch`/);
  assert.match(SUMMON_FIXED_INSTRUCTIONS, /Do not emit `set \/screen`, `add \/section\/\*`/);
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

test('system compiler ignores component island metadata in V2', () => {
  const compiled = compileSystemContracts({
    mode: 'static',
    components: {
      components: [
        {
          name: 'MetricCard',
          description: 'Displays a KPI card.',
          propsSchema: '{label: string, value: string}',
          surface: { data: 'embedded', authority: 'none' },
        },
      ],
    },
  });

  assert.deepEqual(
    compiled.promptBlocks.map((block) => block.id),
    ['fixed'],
  );
  assert.equal('components' in compiled.validationContext, false);
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
  const tools: ToolPack = {
    tools: [
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
    tools,
    tokenOverrides: [{ token: 'color-accent', baseValue: 'blue', newValue: 'red' }],
  });

  assert.deepEqual(
    compiled.promptBlocks.map((block) => block.id),
    [
      'fixed',
      'direction:demo',
      'ghost',
      'layout:two-slot',
      'tools',
      'token-overrides',
    ],
  );
  assert.equal(compiled.validationContext.mode, 'interactive');
  assert.deepEqual([...(compiled.validationContext.allowedTools ?? [])], ['choose']);
  assert.equal(compiled.validationContext.definedTokens?.has('color-bg'), true);
  assert.deepEqual(compiled.startupLines, []);
});

test('system compiler includes a host-owned surface plan block', () => {
  const compiled = compileSystemContracts({
    mode: 'interactive',
    surfacePlan: {
      purpose: 'explore',
      runtime: 'arrow',
      data: 'host-resource',
      authority: 'read',
      persistence: 'replayable',
      network: 'none',
    },
    tools: {
      tools: [
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
    ['fixed', 'surface-plan', 'tools'],
  );
  assert.deepEqual(compiled.validationContext.surfacePlan, {
    purpose: 'explore',
    runtime: 'arrow',
    data: 'host-resource',
    authority: 'read',
    persistence: 'replayable',
    network: 'none',
  });
  const surfaceBlock = compiled.promptBlocks.find((block) => block.id === 'surface-plan');
  assert.match(surfaceBlock?.text ?? '', /host-owned runtime contract/);
  assert.match(surfaceBlock?.text ?? '', /Do not emit a `\/surface-plan` meta line/);
});

test('system compiler includes compact surface contract view without dropping detail blocks', () => {
  const tools: ToolPack = {
    tools: [
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
  const surfaceContract = compileSurfaceContractView({
    tier: 'declarative',
    purpose: 'explore',
    grants: ['search'],
  }, { tools });
  const compiled = compileSystemContracts({
    mode: surfaceContract.surface.mode,
    surfaceContract,
    tools: surfaceContract.tools.length ? tools : null,
  });

  assert.deepEqual(
    compiled.promptBlocks.map((block) => block.id),
    ['fixed', 'surface-contract', 'tools'],
  );
  const surfaceBlock = compiled.promptBlocks.find((block) => block.id === 'surface-contract');
  assert.match(surfaceBlock?.text ?? '', /compact, read-only view/);
  assert.match(surfaceBlock?.text ?? '', /Arrow/);
  assert.match(surfaceBlock?.text ?? '', /Do not emit `\/surface-contract`, `\/surface-policy`, or `\/surface-plan`/);
  assert.match(surfaceBlock?.text ?? '', /`search` \(resource\)/);
  assert.doesNotMatch(surfaceBlock?.text ?? '', /Trusted components/);
  assert.equal(compiled.promptBlocks.some((block) => block.id === 'surface-plan'), false);
  assert.match(compiled.promptBlocks.find((block) => block.id === 'tools')?.text ?? '', /Available data resources/);
  assert.deepEqual(compiled.validationContext.surfacePlan, surfaceContract.surface.plan);
});

test('surface plan normalization and suggestions are stable', () => {
  assert.deepEqual(normalizeSurfacePlan({
    purpose: 'operate',
    runtime: 'arrow',
    data: 'worker',
    authority: 'approval-gated',
    persistence: 'replayable',
  }), {
    purpose: 'operate',
    runtime: 'arrow',
    data: 'worker',
    authority: 'approval-gated',
    persistence: 'replayable',
    network: 'none',
  });

  const suggestion = suggestSurfacePlan({
    prompt: 'compare payment plans and help me pick one',
    mode: 'interactive',
    tools: {
      tools: [
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
    runtime: 'arrow',
    data: 'embedded',
    authority: 'host-action',
    persistence: 'replayable',
    network: 'none',
  });
  assert.deepEqual(inferSurfacePlan({
    prompt: 'compare payment plans and help me pick one',
    mode: 'interactive',
    tools: {
      tools: [
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

test('surface plan host diagnostics expose Arrow-only values', () => {
  assert.deepEqual([...SURFACE_PURPOSE_VALUES], [
    'inform',
    'compare',
    'collect',
    'explore',
    'operate',
    'review',
    'export',
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
  assert.deepEqual([...SURFACE_NETWORK_VALUES], [
    'none',
    'restricted-fetch',
  ]);
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

test('system compiler can produce Arrow-native interactive contracts', () => {
  const compiled = compileSystemContracts({
    mode: 'interactive',
    tools: {
      tools: [
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
          name: 'legacy declarative pattern',
          code: '<button data-summon-on-click="choose" data-summon-args=\'{"option":"A"}\'>Pick</button>',
        },
        {
          name: 'arrow pattern',
          code: 'import { callTool } from "host-bridge:summon";\nconst choose = () => callTool("choose", { option: "A" });',
        },
      ],
    },
  });

  const toolsBlock = compiled.promptBlocks.find((block) => block.id === 'tools');
  assert.match(toolsBlock?.text ?? '', /Arrow-native interactivity/);
  assert.match(toolsBlock?.text ?? '', /host-bridge:summon/);
  assert.match(toolsBlock?.text ?? '', /onState/);
  assert.match(toolsBlock?.text ?? '', /Do not emit `<script>` tags/);
  assert.doesNotMatch(toolsBlock?.text ?? '', /document\.getElementById/);
  assert.doesNotMatch(toolsBlock?.text ?? '', /data-summon-on-click="choose"/);
  assert.match(toolsBlock?.text ?? '', /arrow pattern/);
});
