import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generateSurfaceStream,
  resolveSurfaceGenerationPlan,
  runSurfaceGeneration,
  summarizeContractIssues,
  type GenerationSummary,
  type ProtocolLine,
  type SummonModelProvider,
} from '../src/index.ts';

const surfacePlan = {
  purpose: 'inform',
  runtime: 'static',
  data: 'embedded',
  authority: 'none',
  persistence: 'replayable',
} as const;

async function collectGenerator(stream: AsyncGenerator<ProtocolLine, GenerationSummary, void>) {
  const lines: ProtocolLine[] = [];
  let next = await stream.next();
  while (!next.done) {
    lines.push(next.value);
    next = await stream.next();
  }
  return { lines, summary: next.value as GenerationSummary };
}

test('generateSurfaceStream hardens provider JSONL and returns replay summary', async () => {
  const provider: SummonModelProvider = async function* () {
    yield '{"op":"set","path":"/screen","value":{"sections":["hero"]}}\n';
    yield '{"op":"add","path":"/section/hero","html":"<p>Hello</p>"}\n';
  };

  const { lines, summary } = await collectGenerator(generateSurfaceStream({
    prompt: 'hello',
    modelProvider: provider,
    mode: 'static',
  }));

  assert.deepEqual(lines.slice(0, 2).map((line) => line.op), ['set', 'add']);
  assert.equal(lines.at(-1)?.path, '/stream-graph-summary');
  assert.equal(summary.blocked, false);
  assert.equal(summary.acceptedLines.length, 2);
  assert.equal(summary.streamGraph.sections.length, 1);
});

test('generateSurfaceStream blocks unsafe sections', async () => {
  const provider: SummonModelProvider = async function* () {
    yield '{"op":"add","path":"/section/hero","html":"<script>alert(1)</script>"}\n';
  };

  const { lines, summary } = await collectGenerator(generateSurfaceStream({
    prompt: 'hello',
    modelProvider: provider,
    mode: 'static',
  }));

  assert.equal(summary.blocked, true);
  assert.ok(lines.some((line) => line.path === '/validation-blocked'));
  assert.ok(lines.some((line) => line.path === '/error'));
  assert.equal(lines.at(-1)?.path, '/stream-graph-summary');
});

test('summarizeContractIssues includes bounded examples per issue code', () => {
  const summary = summarizeContractIssues([
    {
      source: 'html',
      severity: 'block',
      code: 'unsafe-tag',
      message: 'bad tag',
    },
    {
      source: 'html',
      severity: 'block',
      code: 'unsafe-tag',
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
  assert.deepEqual(summary.codes, { 'unsafe-tag': 2, 'unknown-token': 1 });
  assert.deepEqual(summary.examples.map((issue) => issue.code), ['unsafe-tag', 'unknown-token']);
});

test('runSurfaceGeneration emits prelude, surface plan, and layout startup before model output', async () => {
  const lines: ProtocolLine[] = [];
  const provider: SummonModelProvider = async function* () {
    yield '{"op":"add","path":"/section/hero","html":"<p>Hello</p>"}\n';
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

  assert.deepEqual(lines.slice(0, 4).map((line) => `${line.op} ${line.path}`), [
    'meta /status',
    'meta /surface-plan',
    'set /screen',
    'add /section/hero',
  ]);
  assert.equal(summary.acceptedLines[0]?.path, '/screen');
  assert.equal(summary.blocked, false);
});

test('runSurfaceGeneration forwards first-class Ghost context to the model contract', async () => {
  let ghostBlockText: string | undefined;
  const provider: SummonModelProvider = async function* (request) {
    ghostBlockText = request.promptBlocks.find((block) => block.id === 'ghost')?.text;
    yield '{"op":"set","path":"/screen","value":{"sections":["hero"]}}\n';
    yield '{"op":"add","path":"/section/hero","html":"<p>Hello</p>"}\n';
  };

  const summary = await runSurfaceGeneration({
    prompt: 'hello',
    modelProvider: provider,
    mode: 'static',
    ghost: {
      source: 'resolved-context',
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
        { name: 'Search', code: '<form data-summon-resource="search"></form>', intent: 'search' },
        { name: 'Choose', code: '<button data-summon-on-click="choose"></button>', intent: 'choose' },
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
      yield '{"op":"set","path":"/screen","value":{"sections":["hero"]}}\n';
      yield '{"op":"add","path":"/section/hero","html":"<button data-summon-on-click=\\"choose\\" data-summon-args=\\"{}\\">Choose</button><div data-summon-component=\\"MetricCard\\" data-summon-component-id=\\"metric\\" data-summon-props=\\"{}\\"></div>"}\n';
    },
  }, (line) => {
    lines.push(line);
  });

  assert.deepEqual(lines.slice(0, 4).map((line) => `${line.op} ${line.path}`), [
    'meta /surface-policy',
    'meta /surface-plan',
    'set /screen',
    'add /section/hero',
  ]);
  assert.equal(lines[0]?.op, 'meta');
  assert.deepEqual((lines[0] as Extract<ProtocolLine, { op: 'meta' }>).value, {
    tier: 'declarative',
    purpose: 'compare',
    grants: ['choose'],
    components: ['MetricCard'],
    persistence: 'replayable',
  });
  assert.equal(lines[1]?.op, 'meta');
  assert.deepEqual((lines[1] as Extract<ProtocolLine, { op: 'meta' }>).value, {
    purpose: 'compare',
    runtime: 'declarative',
    data: 'embedded',
    authority: 'host-action',
    persistence: 'replayable',
  });
  assert.match(systemText, /Save a choice/);
  assert.match(systemText, /MetricCard/);
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
      yield '{"op":"set","path":"/screen","value":{"sections":["hero"]}}\n';
    },
  }, (line) => {
    lines.push(line);
  });

  assert.equal(called, false);
  assert.equal(summary.blocked, true);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'surface-policy-tier-exceeded'));
  assert.deepEqual(lines.slice(0, 3).map((line) => `${line.op} ${line.path}`), [
    'meta /surface-policy',
    'meta /surface-plan',
    'meta /validation-blocked',
  ]);
});

test('runSurfaceGeneration fails blocking compile issues before provider invocation', async () => {
  let called = false;
  const lines: ProtocolLine[] = [];

  const summary = await runSurfaceGeneration({
    prompt: 'scripted mismatch',
    mode: 'interactive',
    scriptPolicy: 'forbid',
    surfacePlan: {
      purpose: 'explore',
      runtime: 'scripted',
      data: 'embedded',
      authority: 'host-action',
      persistence: 'replayable',
    },
    modelProvider: async function* () {
      called = true;
      yield '{"op":"set","path":"/screen","value":{"sections":["hero"]}}\n';
    },
  }, (line) => {
    lines.push(line);
  });

  assert.equal(called, false);
  assert.equal(summary.blocked, true);
  assert.ok(lines.some((line) => line.path === '/validation-blocked'));
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'surface-script-policy-mismatch'));
});

test('runSurfaceGeneration rejects script policy allow without scripted surface plan before provider invocation', async () => {
  let called = false;
  const lines: ProtocolLine[] = [];

  const summary = await runSurfaceGeneration({
    prompt: 'script policy mismatch',
    mode: 'interactive',
    scriptPolicy: 'allow',
    modelProvider: async function* () {
      called = true;
      yield '{"op":"set","path":"/screen","value":{"sections":["hero"]}}\n';
    },
  }, (line) => {
    lines.push(line);
  });

  assert.equal(called, false);
  assert.equal(summary.blocked, true);
  assert.ok(summary.validationIssues.some((issue) =>
    issue.code === 'surface-script-policy-mismatch' &&
    issue.message === 'scriptPolicy: "allow" requires a scripted SurfacePlan'
  ));
  assert.ok(lines.some((line) => line.path === '/validation-blocked'));
  assert.ok(lines.some((line) => line.path === '/error'));
});

test('runSurfaceGeneration blocks interactive script output by default', async () => {
  const lines: ProtocolLine[] = [];

  const summary = await runSurfaceGeneration({
    prompt: 'interactive script',
    mode: 'interactive',
    modelProvider: async function* () {
      yield '{"op":"add","path":"/section/hero","html":"<button>Pick</button><script>console.log(1)</script>"}\n';
    },
  }, (line) => {
    lines.push(line);
  });

  assert.equal(summary.blocked, true);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'script-not-granted'));
  assert.ok(lines.some((line) => line.path === '/validation-blocked'));
});

test('runSurfaceGeneration emits structural skips without blocking', async () => {
  const lines: ProtocolLine[] = [];

  const summary = await runSurfaceGeneration({
    prompt: 'bad structure',
    mode: 'static',
    modelProvider: async function* () {
      yield '{"op":"set","path":"/bad","value":{"sections":["hero"]}}\n';
      yield '{"op":"add","path":"/section/hero","html":"<p>Hello</p>"}\n';
    },
  }, (line) => {
    lines.push(line);
  });

  assert.equal(summary.blocked, false);
  assert.ok(lines.some((line) => line.path === '/protocol-skip'));
  assert.ok(lines.some((line) => line.path === '/section/hero'));
});

test('runSurfaceGeneration repairs a blocked retryable section', async () => {
  const lines: ProtocolLine[] = [];

  const summary = await runSurfaceGeneration({
    prompt: 'repair me',
    mode: 'static',
    modelProvider: async function* () {
      yield '{"op":"add","path":"/section/hero","html":"<script>alert(1)</script>"}\n';
    },
    repair: {
      enabled: true,
      maxAttempts: 1,
      maxTargets: 2,
      provider: async () => '{"op":"add","path":"/section/hero","html":"<p>safe</p>"}',
    },
  }, (line) => {
    lines.push(line);
  });

  assert.equal(summary.blocked, false);
  assert.deepEqual(summary.repairStats, { queued: 1, cancelled: 0, repaired: 1, failed: 0 });
  assert.ok(lines.some((line) => line.path === '/repair-feedback' && (line.value as { status?: string }).status === 'repaired'));
  assert.ok(lines.some((line) => line.path === '/section/hero'));
  assert.equal(lines.find((line) => line.path === '/repair-summary')?.value && true, true);
});

test('runSurfaceGeneration blocks when repair fails', async () => {
  const lines: ProtocolLine[] = [];

  const summary = await runSurfaceGeneration({
    prompt: 'repair me badly',
    mode: 'static',
    modelProvider: async function* () {
      yield '{"op":"add","path":"/section/hero","html":"<script>alert(1)</script>"}\n';
    },
    repair: {
      enabled: true,
      maxAttempts: 1,
      maxTargets: 2,
      provider: async () => '{"op":"add","path":"/section/other","html":"<p>wrong</p>"}',
    },
  }, (line) => {
    lines.push(line);
  });

  assert.equal(summary.blocked, true);
  assert.deepEqual(summary.repairStats, { queued: 1, cancelled: 0, repaired: 0, failed: 1 });
  assert.ok(lines.some((line) => line.path === '/repair-feedback' && (line.value as { status?: string }).status === 'failed'));
  assert.ok(lines.some((line) => line.path === '/validation-blocked'));
  assert.ok(lines.some((line) => line.path === '/error'));
});

test('runSurfaceGeneration passes provider meta chunks through in order', async () => {
  const lines: ProtocolLine[] = [];

  await runSurfaceGeneration({
    prompt: 'meta',
    mode: 'static',
    modelProvider: async function* () {
      yield { type: 'meta', path: '/status', value: 'thinking' };
      yield { type: 'text', text: '{"op":"set","path":"/screen","value":{"sections":["hero"]}}\n' };
      yield '{"op":"add","path":"/section/hero","html":"<p>Hello</p>"}\n';
    },
  }, (line) => {
    lines.push(line);
  });

  assert.equal(lines[0]?.path, '/status');
  assert.equal(lines[1]?.path, '/screen');
  assert.equal(lines[2]?.path, '/section/hero');
});

test('runSurfaceGeneration processes final buffered text without trailing newline', async () => {
  const lines: ProtocolLine[] = [];

  const summary = await runSurfaceGeneration({
    prompt: 'tail',
    mode: 'static',
    modelProvider: async function* () {
      yield '{"op":"set","path":"/screen","value":{"sections":["hero"]}}\n';
      yield '{"op":"add","path":"/section/hero","html":"<p>Tail</p>"}';
    },
  }, (line) => {
    lines.push(line);
  });

  assert.equal(summary.blocked, false);
  assert.ok(lines.some((line) => line.path === '/section/hero'));
  assert.ok(summary.acceptedLines.some((line) => line.path === '/section/hero'));
});

test('runSurfaceGeneration summary separates accepted structural lines from emitted diagnostics', async () => {
  const lines: ProtocolLine[] = [];

  const summary = await runSurfaceGeneration({
    prompt: 'summary',
    mode: 'static',
    surfacePlan,
    layout: { id: 'one-up', slots: [{ id: 'hero', purpose: 'main content' }] },
    preludeLines: [{ op: 'meta', path: '/status', value: 'queued' }],
    modelProvider: async function* () {
      yield { type: 'meta', path: '/status', value: 'writing' };
      yield '{"op":"add","path":"/section/hero","html":"<p>Hello</p>"}\n';
    },
  }, (line) => {
    lines.push(line);
  });

  assert.deepEqual(summary.acceptedLines.map((line) => line.path), [
    '/screen',
    '/section/hero',
  ]);
  assert.deepEqual(summary.emittedLines.map((line) => line.path), [
    '/status',
    '/surface-plan',
    '/screen',
    '/status',
    '/section/hero',
    '/stream-graph-summary',
  ]);
  assert.deepEqual(lines, summary.emittedLines);
});

test('runSurfaceGeneration cancels queued repair when model later emits the target safely', async () => {
  const lines: ProtocolLine[] = [];
  let repairCalls = 0;

  const summary = await runSurfaceGeneration({
    prompt: 'self repair',
    mode: 'static',
    modelProvider: async function* () {
      yield '{"op":"add","path":"/section/hero","html":"<script>alert(1)</script>"}\n';
      yield '{"op":"add","path":"/section/hero","html":"<p>safe later</p>"}\n';
    },
    repair: {
      enabled: true,
      maxAttempts: 1,
      maxTargets: 2,
      provider: async () => {
        repairCalls += 1;
        return '{"op":"add","path":"/section/hero","html":"<p>repair</p>"}';
      },
    },
  }, (line) => {
    lines.push(line);
  });

  assert.equal(repairCalls, 0);
  assert.equal(summary.blocked, false);
  assert.deepEqual(summary.repairStats, { queued: 1, cancelled: 1, repaired: 0, failed: 0 });
  assert.ok(lines.some((line) => line.path === '/repair-feedback' && (line.value as { status?: string }).status === 'blocked'));
  assert.ok(lines.some((line) => line.path === '/section/hero' && (line as { html?: string }).html?.includes('safe later')));
  assert.ok(lines.some((line) => line.path === '/repair-summary'));
});

test('runSurfaceGeneration edit input seeds existing screen and enforces targets', async () => {
  const lines: ProtocolLine[] = [];
  let sawEditBlock = false;

  const summary = await runSurfaceGeneration({
    prompt: 'edit',
    mode: 'static',
    edit: {
      baseRevision: 3,
      sections: [{ id: 'hero', html: '<p>old</p>' }],
      targetSections: ['hero'],
    },
    modelProvider: async function* ({ promptBlocks }) {
      sawEditBlock = promptBlocks.some((block) => block.id === 'edit');
      yield '{"op":"add","path":"/section/other","html":"<p>wrong</p>"}\n';
    },
  }, (line) => {
    lines.push(line);
  });

  assert.equal(sawEditBlock, true);
  assert.equal(summary.blocked, false);
  assert.ok(lines.some((line) => line.path === '/protocol-skip'));
  assert.equal(summary.acceptedLines.some((line) => line.path === '/section/other'), false);
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
    runtime: 'static',
    data: 'embedded',
    authority: 'none',
    persistence: 'replayable',
  });
});
