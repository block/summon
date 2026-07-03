import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  compileSurfaceContractView,
  compileSystemContracts,
  compileTokenContract,
  hintsForContractIssue,
  inferSurfacePlan,
  normalizeSurfacePlan,
  suggestSurfacePlan,
  SUMMON_FIXED_SURFACE_DOCUMENT_INSTRUCTIONS,
  SUMMON_STRUCTURED_SURFACE_DOCUMENT_BUNDLE_INSTRUCTIONS,
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

test('surface-document prompt describes intentional bundle output', () => {
  assert.match(SUMMON_FIXED_SURFACE_DOCUMENT_INSTRUCTIONS, /Surface Document bundles/);
  assert.match(SUMMON_FIXED_SURFACE_DOCUMENT_INSTRUCTIONS, /emit_surface_document/);
  assert.match(SUMMON_FIXED_SURFACE_DOCUMENT_INSTRUCTIONS, /summon\.surface-document-bundle\/v1/);
  assert.match(SUMMON_FIXED_SURFACE_DOCUMENT_INSTRUCTIONS, /main\.html is inert structure/);
  assert.match(SUMMON_FIXED_SURFACE_DOCUMENT_INSTRUCTIONS, /main\.css is fingerprint styling/);
  assert.match(SUMMON_FIXED_SURFACE_DOCUMENT_INSTRUCTIONS, /state\(initial\)/);
  assert.match(SUMMON_FIXED_SURFACE_DOCUMENT_INSTRUCTIONS, /region\(\(\) =>/);
  assert.match(SUMMON_FIXED_SURFACE_DOCUMENT_INSTRUCTIONS, /callTool\(toolName, args\)/);

  assert.match(SUMMON_STRUCTURED_SURFACE_DOCUMENT_BUNDLE_INSTRUCTIONS, /schema: "summon\.surface-document-bundle\/v1"/);
  assert.match(SUMMON_STRUCTURED_SURFACE_DOCUMENT_BUNDLE_INSTRUCTIONS, /source\["main\.html"\]/);
  assert.match(SUMMON_STRUCTURED_SURFACE_DOCUMENT_BUNDLE_INSTRUCTIONS, /source\["main\.css"\]/);
  assert.match(SUMMON_STRUCTURED_SURFACE_DOCUMENT_BUNDLE_INSTRUCTIONS, /optional `source\["main\.js"\]`/);
});

test('token compiler is agnostic to design-source token names', () => {
  const ok = compileTokenContract({ css: defaultTokens });
  assert.equal(ok.issues.length, 0);
  assert.equal(ok.definedTokens.has('color-bg'), true);
  assert.equal(ok.liveOpportunistic.length, 0);
  assert.match(ok.promptVocabulary, /do not assume Summon-specific token names/);

  const custom = compileTokenContract({ css: ':root { --paper: #faf7ed; --ink: #16130f; --breathing-room: 28px; }' });
  assert.equal(custom.issues.some((issue) => issue.severity === 'block'), false);
  assert.equal(custom.definedTokens.has('paper'), true);
  assert.equal(custom.definedTokens.has('breathing-room'), true);
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
    ['fixed', 'output-contract'],
  );
  assert.equal('components' in compiled.validationContext, false);
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
    activeTokensCss: defaultTokens,
    ghost: {
      source: 'root',
      prompt: 'Ghost context block.',
      product: 'Ghost Product',
    },
    layout,
    tools,
  });

  assert.deepEqual(
    compiled.promptBlocks.map((block) => block.id),
    [
      'fixed',
      'ghost',
      'layout:two-slot',
      'tools',
      'output-contract',
    ],
  );
  assert.equal(compiled.promptBlocks.at(-1)?.cache, 'none');
  assert.equal(compiled.validationContext.mode, 'interactive');
  assert.deepEqual([...(compiled.validationContext.allowedTools ?? [])], ['choose']);
  assert.equal(compiled.validationContext.definedTokens?.has('color-bg'), true);
  assert.deepEqual(compiled.startupLines, []);
});

test('system compiler uses surface-document prompt blocks intentionally', () => {
  const compiled = compileSystemContracts({
    mode: 'interactive',
    layout: {
      id: 'surface-slots',
      slots: [{ id: 'main', purpose: 'Primary surface' }],
    },
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
    },
  });

  assert.deepEqual(
    compiled.promptBlocks.map((block) => block.id),
    ['fixed', 'layout:surface-slots', 'tools', 'output-contract'],
  );
  const systemText = compiled.promptBlocks.map((block) => block.text).join('\n');
  assert.match(systemText, /emit_surface_document/);
  assert.match(systemText, /summon\.surface-document-bundle\/v1/);
  assert.match(systemText, /Build your Surface Document bundle/);
  assert.match(systemText, /main\.html is inert structure/);
  assert.match(systemText, /main\.css is fingerprint styling/);
  assert.match(systemText, /callTool\(toolName, args\)/);
  assert.doesNotMatch(systemText, /create_summon_old_surface/);
  assert.doesNotMatch(systemText, /create_summon_html_surface/);
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
    ['fixed', 'surface-contract', 'tools', 'output-contract'],
  );
  const surfaceBlock = compiled.promptBlocks.find((block) => block.id === 'surface-contract');
  assert.match(surfaceBlock?.text ?? '', /compact, read-only view/);
  assert.match(surfaceBlock?.text ?? '', /Surface Document bundle/);
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
    runtime: 'surface-document',
    data: 'worker',
    authority: 'approval-gated',
    persistence: 'replayable',
  }), {
    purpose: 'operate',
    runtime: 'surface-document',
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
    runtime: 'surface-document',
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

test('surface plan host diagnostics expose stable enum values', () => {
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

test('system compiler produces Surface Document interactive tool contracts', () => {
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
    },
  });

  const toolsBlock = compiled.promptBlocks.find((block) => block.id === 'tools');
  assert.match(toolsBlock?.text ?? '', /Surface Document may use host tools/);
  assert.match(toolsBlock?.text ?? '', /host-bridge:summon/);
  assert.match(toolsBlock?.text ?? '', /onState/);
  assert.match(toolsBlock?.text ?? '', /state\(\)/);
  assert.match(toolsBlock?.text ?? '', /region\(\(\) => \.\.\.\)/);
  assert.doesNotMatch(toolsBlock?.text ?? '', /old runtime/);
});

test('contract repair hints target Surface Document authoring', () => {
  const issue = {
    source: 'html' as const,
    severity: 'block' as const,
    code: 'surface-document-html-inline-handler',
    message: 'Inline event handler is not allowed',
  };

  assert.deepEqual(hintsForContractIssue(issue), [
    'Keep main.html inert: remove inline on* attributes and attach listeners in optional main.js with addEventListener/on<event> on scoped DOM nodes.',
  ]);
});

test('contract repair hints cover surface-document validation issue codes', () => {
  const issue = (code: string) => ({
    source: 'protocol' as const,
    severity: 'block' as const,
    code,
    message: code,
  });

  const cases: Array<[string, RegExp]> = [
    ['surface-document-html-inline-handler', /inline on\* attributes.*main\.js/],
    ['surface-document-html-forbidden-tag', /forbidden.*main\.css.*main\.js/],
    ['surface-document-html-javascript-url', /javascript: URLs.*callTool/],
    ['surface-document-css-import', /@import.*main\.css/],
    ['surface-document-css-external-url', /url\(\).*main\.css/],
    ['surface-document-network-not-granted', /fetch\/XHR\/WebSocket.*callTool/],
    ['surface-document-unsupported-api', /scoped Surface Document APIs.*state\(\).*region\(\).*callTool/],
    ['missing-surface-document-file', /main\.html.*main\.css/],
    ['missing-surface-document-bundle-html', /main\.html.*main\.css/],
    ['missing-surface-document-bundle-css', /main\.html.*main\.css/],
  ];

  for (const [code, expected] of cases) {
    assert.match(hintsForContractIssue(issue(code))[0], expected);
  }
});
