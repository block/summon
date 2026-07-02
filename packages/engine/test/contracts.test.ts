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
  SUMMON_FIXED_SURFACE_DOCUMENT_INSTRUCTIONS,
  SUMMON_STRUCTURED_ARROW_BUNDLE_INSTRUCTIONS,
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

test('fixed prompt describes structured Arrow bundle output', () => {
  assert.match(SUMMON_FIXED_INSTRUCTIONS, /Structured Arrow sandbox bundle/);
  assert.match(SUMMON_FIXED_INSTRUCTIONS, /create_summon_arrow_surface/);
  assert.match(SUMMON_FIXED_INSTRUCTIONS, /summon\.arrow-bundle\/v1/);
  assert.match(SUMMON_FIXED_INSTRUCTIONS, /server owns streaming/);
  assert.match(SUMMON_FIXED_INSTRUCTIONS, /watch/);
  assert.match(SUMMON_FIXED_INSTRUCTIONS, /transport records, stream lines/);
});

test('structured output instructions are a tight recency anchor', () => {
  // The output-contract block restates only the shape + highest-value rules;
  // it must NOT re-teach the full rule list (that lives in the fixed block).
  assert.match(SUMMON_STRUCTURED_ARROW_BUNDLE_INSTRUCTIONS, /schema: "summon\.arrow-bundle\/v1"/);
  assert.match(SUMMON_STRUCTURED_ARROW_BUNDLE_INSTRUCTIONS, /exactly one `main.ts` or `main.js`/);
  assert.match(SUMMON_STRUCTURED_ARROW_BUNDLE_INSTRUCTIONS, /create_summon_arrow_surface/);
  assert.match(SUMMON_STRUCTURED_ARROW_BUNDLE_INSTRUCTIONS, /IDL property bindings/);
  // It is an anchor, not a restatement: the full subset block is not duplicated.
  assert.doesNotMatch(SUMMON_STRUCTURED_ARROW_BUNDLE_INSTRUCTIONS, /namespace-style/);
});

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

test('system compiler uses HTML-static prompt blocks without Arrow bridge leakage', () => {
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
    mode: 'interactive',
    outputRuntime: 'html-static',
    layout: {
      id: 'two-slot',
      slots: [
        { id: 'hero', purpose: 'Primary answer' },
        { id: 'details', purpose: 'Supporting context' },
      ],
    },
    surfaceContract,
    tools,
  });

  assert.deepEqual(
    compiled.promptBlocks.map((block) => block.id),
    ['fixed', 'layout:two-slot', 'surface-contract', 'tools', 'output-contract'],
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

test('system compiler uses surface-document prompt blocks intentionally', () => {
  const compiled = compileSystemContracts({
    mode: 'interactive',
    outputRuntime: 'surface-document',
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
  assert.doesNotMatch(systemText, /create_summon_arrow_surface/);
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
  assert.deepEqual(hintsForContractIssue(issue, { outputRuntime: 'surface-document' }), [
    'Remove inline event handlers from main.html; wire behavior in optional main.js with scoped DOM APIs and granted host tools via callTool().',
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
    assert.match(hintsForContractIssue(issue(code), { outputRuntime: 'surface-document' })[0], expected);
  }
});
