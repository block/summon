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
  SUMMON_FIXED_INSTRUCTIONS,
  SUMMON_STRUCTURED_ARROW_BUNDLE_INSTRUCTIONS,
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

test('fixed prompt describes structured Arrow bundle output', () => {
  assert.match(SUMMON_FIXED_INSTRUCTIONS, /Structured Arrow sandbox bundle/);
  assert.match(SUMMON_FIXED_INSTRUCTIONS, /create_summon_arrow_surface/);
  assert.match(SUMMON_FIXED_INSTRUCTIONS, /summon\.arrow-bundle\/v1/);
  assert.match(SUMMON_FIXED_INSTRUCTIONS, /server owns streaming/);
  assert.match(SUMMON_FIXED_INSTRUCTIONS, /watch/);
  assert.match(SUMMON_FIXED_INSTRUCTIONS, /transport records, stream lines/);
});

test('structured output instructions restate the bundle contract', () => {
  assert.match(SUMMON_STRUCTURED_ARROW_BUNDLE_INSTRUCTIONS, /schema: "summon\.arrow-bundle\/v1"/);
  assert.match(SUMMON_STRUCTURED_ARROW_BUNDLE_INSTRUCTIONS, /exactly one `main.ts` or `main.js`/);
  assert.match(SUMMON_STRUCTURED_ARROW_BUNDLE_INSTRUCTIONS, /server owns streaming/);
  assert.match(SUMMON_STRUCTURED_ARROW_BUNDLE_INSTRUCTIONS, /objects with `op`\/`path` fields/);
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
    ['fixed', 'surface-plan', 'tools', 'output-contract'],
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

test('system compiler uses HTML-static prompt blocks without Arrow bridge leakage', () => {
  const compiled = compileSystemContracts({
    mode: 'interactive',
    outputRuntime: 'html-static',
    layout: {
      id: 'two-slot',
      slots: [
        { id: 'hero', purpose: 'Primary answer' },
        { id: 'details', purpose: 'Supporting context' },
      ],
    },
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
    ['fixed', 'layout:two-slot', 'surface-plan', 'tools', 'output-contract'],
  );
  assert.equal(compiled.validationContext.experimentalHtmlScript, false);
  const systemText = compiled.promptBlocks.map((block) => block.text).join('\n');
  assert.match(systemText, /create_summon_html_surface/);
  assert.match(systemText, /summon\.html-bundle\/v0/);
  assert.match(systemText, /Build your HTML bundle/);
  assert.match(systemText, /host-owned context for static HTML/);
  assert.match(systemText, /does not receive a host tool bridge/);
  // Composition is Ghost's job: Summon blocks must not carry a composition floor.
  assert.match(systemText, /sole authority for composition/);
  assert.doesNotMatch(systemText, /Visual composition floor/);
  assert.doesNotMatch(systemText, /at least three distinct visual zones/);
  assert.doesNotMatch(systemText, /create_summon_arrow_surface/);
  assert.doesNotMatch(systemText, /host-bridge:summon/);
  assert.doesNotMatch(systemText, /@arrow-js\/core/);
  assert.doesNotMatch(systemText, /Runtime is always `arrow`/);
  assert.doesNotMatch(systemText, /Arrow artifact/);
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

test('contract repair hints are runtime-aware for shared HTML issue codes', () => {
  const issue = {
    source: 'html' as const,
    severity: 'block' as const,
    code: 'inline-handler',
    message: 'Inline event handler is not allowed',
  };

  assert.deepEqual(hintsForContractIssue(issue), [
    'Use Arrow event handlers inside the template and call granted host tools with `callTool()` from `host-bridge:summon`.',
  ]);
  assert.deepEqual(hintsForContractIssue(issue, { outputRuntime: 'html-static' }), [
    'Remove inline event handlers; this HTML runtime must be static HTML/CSS without generated event code.',
  ]);
});
