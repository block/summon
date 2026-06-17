import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveSurfaceGenerationPlan,
  runSurfaceGeneration,
  summarizeContractIssues,
  type ProtocolLine,
  type SummonModelProvider,
} from '../src/index.ts';

const surfacePlan = {
  purpose: 'inform',
  runtime: 'arrow',
  data: 'embedded',
  authority: 'none',
  persistence: 'replayable',
  network: 'none',
} as const;

function arrowProtocolLine(html: string): string {
  const source = html.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  return `${JSON.stringify({
    op: 'artifact',
    path: '/artifact',
    value: {
      runtime: 'arrow',
      source: {
        'main.ts': `import { html } from "@arrow-js/core";\nexport default html\`${source}\`;`,
      },
    },
  })}\n`;
}

test('summarizeContractIssues includes bounded examples per issue code', () => {
  const summary = summarizeContractIssues([
    {
      source: 'protocol',
      severity: 'block',
      code: 'arrow-only-protocol',
      message: 'old protocol',
    },
    {
      source: 'protocol',
      severity: 'block',
      code: 'arrow-only-protocol',
      message: 'same code second example',
    },
    {
      source: 'token',
      severity: 'warn',
      code: 'unknown-token',
      message: 'token drift',
    },
  ]);

  assert.equal(summary.blocked, 2);
  assert.equal(summary.warnings, 1);
  assert.deepEqual(summary.codes, { 'arrow-only-protocol': 2, 'unknown-token': 1 });
  assert.deepEqual(summary.examples.map((issue) => issue.code), ['arrow-only-protocol', 'unknown-token']);
});

test('runSurfaceGeneration emits prelude and surface plan before Arrow artifact output', async () => {
  const lines: ProtocolLine[] = [];
  const provider: SummonModelProvider = async function* () {
    yield arrowProtocolLine('<p>Hello</p>');
  };

  const summary = await runSurfaceGeneration({
    prompt: 'hello',
    modelProvider: provider,
    mode: 'static',
    surfacePlan,
    layout: { id: 'one-up', slots: [{ id: 'hero', purpose: 'main content' }] },
    preludeLines: [{ op: 'meta', path: '/status', value: 'queued' }],
  }, (line) => {
    lines.push(line);
  });

  assert.deepEqual(lines.slice(0, 3).map((line) => `${line.op} ${line.path}`), [
    'meta /status',
    'meta /surface-plan',
    'artifact /artifact',
  ]);
  assert.equal(summary.acceptedLines[0]?.path, '/artifact');
  assert.equal(summary.blocked, false);
});

test('runSurfaceGeneration skips unsupported legacy section protocol', async () => {
  const lines: ProtocolLine[] = [];

  const summary = await runSurfaceGeneration({
    prompt: 'legacy under arrow',
    modelProvider: async function* () {
      yield '{"op":"add","path":"/section/hero","html":"<p>Legacy</p>"}\n';
    },
    mode: 'static',
    surfacePlan,
  }, (line) => {
    lines.push(line);
  });

  assert.equal(summary.blocked, false);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'malformed-jsonl'));
  assert.ok(lines.some((line) => line.path === '/protocol-skip'));
  assert.equal(summary.acceptedLines.some((line) => line.path === '/artifact'), false);
});

test('runSurfaceGeneration forwards first-class Ghost context to the model contract', async () => {
  let ghostBlockText: string | undefined;
  const provider: SummonModelProvider = async function* (request) {
    ghostBlockText = request.promptBlocks.find((block) => block.id === 'ghost')?.text;
    yield arrowProtocolLine('<p>Hello</p>');
  };

  const summary = await runSurfaceGeneration({
    prompt: 'hello',
    modelProvider: provider,
    mode: 'static',
    surfacePlan,
    ghost: {
      source: 'root',
      prompt: 'Portable Ghost context.',
    },
  }, () => {});

  assert.equal(summary.blocked, false);
  assert.equal(ghostBlockText, 'Portable Ghost context.');
});

test('runSurfaceGeneration compiles surface policy, emits metadata, and narrows contracts', async () => {
  const lines: ProtocolLine[] = [];
  let systemText = '';

  const summary = await runSurfaceGeneration({
    prompt: 'choose one',
    surfacePolicy: {
      tier: 'declarative',
      purpose: 'compare',
      grants: ['choose'],
      components: ['MetricCard'],
    },
    capabilities: {
      intents: [
        {
          name: 'search',
          description: 'Search host data',
          argsSchema: '{}',
          stateShape: '{}',
          kind: 'resource',
          surface: { data: 'host-resource', authority: 'read' },
        },
        {
          name: 'choose',
          description: 'Save a choice',
          argsSchema: '{}',
          stateShape: '{}',
          kind: 'action',
          surface: { authority: 'host-action' },
        },
      ],
      patterns: [
        { name: 'Search', code: 'import { invoke } from "host-bridge:summon";\nconst search = (query: string) => invoke("search", { query });', intent: 'search' },
        { name: 'Choose', code: 'invoke("choose", {})', intent: 'choose' },
      ],
    },
    components: {
      components: [
        {
          name: 'MetricCard',
          description: 'Trusted metric',
          propsSchema: '{}',
          surface: { data: 'embedded', authority: 'none' },
        },
        {
          name: 'SecretWidget',
          description: 'Unselected widget',
          propsSchema: '{}',
          surface: { data: 'embedded', authority: 'none' },
        },
      ],
    },
    modelProvider: async function* ({ promptBlocks }) {
      systemText = promptBlocks.map((block) => block.text).join('\n');
      yield arrowProtocolLine('<button>Choose</button>');
    },
  }, (line) => {
    lines.push(line);
  });

  assert.deepEqual(lines.slice(0, 4).map((line) => `${line.op} ${line.path}`), [
    'meta /surface-policy',
    'meta /surface-plan',
    'meta /surface-contract',
    'artifact /artifact',
  ]);
  assert.equal(lines[0]?.op, 'meta');
  assert.deepEqual((lines[0] as Extract<ProtocolLine, { op: 'meta' }>).value, {
    tier: 'declarative',
    purpose: 'compare',
    grants: ['choose'],
    components: ['MetricCard'],
    persistence: 'replayable',
  });
  const surfaceContract = (lines[2] as Extract<ProtocolLine, { op: 'meta' }>).value as {
    tools?: Array<{ name: string }>;
    components?: Array<{ name: string }>;
  };
  assert.deepEqual(surfaceContract.tools?.map((tool) => tool.name), ['choose']);
  assert.deepEqual(surfaceContract.components?.map((component) => component.name), ['MetricCard']);
  assert.match(systemText, /Save a choice/);
  assert.match(systemText, /MetricCard/);
  assert.match(systemText, /Surface contract/);
  assert.doesNotMatch(systemText, /Search host data/);
  assert.doesNotMatch(systemText, /SecretWidget/);
  assert.equal(summary.blocked, false);
});

test('runSurfaceGeneration blocks invalid surface policy before provider invocation', async () => {
  let called = false;
  const lines: ProtocolLine[] = [];

  const summary = await runSurfaceGeneration({
    prompt: 'invalid worker grant',
    surfacePolicy: {
      tier: 'declarative',
      grants: ['analysis'],
    },
    capabilities: {
      intents: [{
        name: 'analysis',
        description: 'Worker analysis',
        argsSchema: '{}',
        stateShape: '{}',
        kind: 'resource',
        surface: { data: 'worker', authority: 'read' },
      }],
    },
    modelProvider: async function* () {
      called = true;
      yield arrowProtocolLine('<p>Should not run</p>');
    },
  }, (line) => {
    lines.push(line);
  });

  assert.equal(called, false);
  assert.equal(summary.blocked, true);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'surface-policy-tier-exceeded'));
  assert.deepEqual(lines.slice(0, 4).map((line) => `${line.op} ${line.path}`), [
    'meta /surface-policy',
    'meta /surface-plan',
    'meta /surface-contract',
    'meta /validation-blocked',
  ]);
});

test('runSurfaceGeneration rejects generated script policy before provider invocation', async () => {
  let called = false;
  const lines: ProtocolLine[] = [];

  const summary = await runSurfaceGeneration({
    prompt: 'script policy mismatch',
    mode: 'interactive',
    scriptPolicy: 'allow',
    modelProvider: async function* () {
      called = true;
      yield arrowProtocolLine('<button>Pick</button>');
    },
  }, (line) => {
    lines.push(line);
  });

  assert.equal(called, false);
  assert.equal(summary.blocked, true);
  assert.ok(summary.validationIssues.some((issue) =>
    issue.code === 'surface-script-policy-removed'
  ));
  assert.ok(lines.some((line) => line.path === '/validation-blocked'));
  assert.ok(lines.some((line) => line.path === '/error'));
});

test('runSurfaceGeneration passes provider meta chunks through in order', async () => {
  const lines: ProtocolLine[] = [];

  await runSurfaceGeneration({
    prompt: 'meta',
    mode: 'static',
    surfacePlan,
    modelProvider: async function* () {
      yield { type: 'meta', path: '/status', value: 'thinking' };
      yield { type: 'text', text: arrowProtocolLine('<p>Hello</p>') };
    },
  }, (line) => {
    lines.push(line);
  });

  assert.equal(lines[0]?.path, '/surface-plan');
  assert.equal(lines[1]?.path, '/status');
  assert.equal(lines[2]?.path, '/artifact');
});

test('runSurfaceGeneration processes final buffered artifact without trailing newline', async () => {
  const lines: ProtocolLine[] = [];

  const summary = await runSurfaceGeneration({
    prompt: 'tail',
    mode: 'static',
    surfacePlan,
    modelProvider: async function* () {
      yield arrowProtocolLine('<p>Tail</p>').trimEnd();
    },
  }, (line) => {
    lines.push(line);
  });

  assert.equal(summary.blocked, false);
  assert.ok(lines.some((line) => line.path === '/artifact'));
  assert.ok(summary.acceptedLines.some((line) => line.path === '/artifact'));
});

test('runSurfaceGeneration summary separates accepted artifact lines from emitted diagnostics', async () => {
  const lines: ProtocolLine[] = [];

  const summary = await runSurfaceGeneration({
    prompt: 'summary',
    mode: 'static',
    surfacePlan,
    preludeLines: [{ op: 'meta', path: '/status', value: 'queued' }],
    modelProvider: async function* () {
      yield { type: 'meta', path: '/status', value: 'writing' };
      yield arrowProtocolLine('<p>Hello</p>');
    },
  }, (line) => {
    lines.push(line);
  });

  assert.deepEqual(summary.acceptedLines.map((line) => line.path), [
    '/artifact',
  ]);
  assert.deepEqual(summary.emittedLines.map((line) => line.path), [
    '/status',
    '/surface-plan',
    '/status',
    '/artifact',
    '/stream-graph-summary',
  ]);
  assert.deepEqual(lines, summary.emittedLines);
});

test('resolveSurfaceGenerationPlan preserves server surface resolution behavior', () => {
  const resolved = resolveSurfaceGenerationPlan({
    prompt: 'search for recipes',
    mode: 'static',
    capabilities: {
      intents: [{
        name: 'search',
        description: 'Search host data.',
        argsSchema: '{query: string}',
        stateShape: '{}',
        kind: 'resource',
        surface: { data: 'host-resource', authority: 'read' },
      }],
    },
  });

  assert.equal(resolved.source, 'default');
  assert.deepEqual(resolved.surfacePlan, {
    purpose: 'inform',
    runtime: 'arrow',
    data: 'embedded',
    authority: 'none',
    persistence: 'replayable',
    network: 'none',
  });
});
