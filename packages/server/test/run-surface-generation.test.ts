import assert from 'node:assert/strict';
import test from 'node:test';
import {
  policyFromGoal,
  runSurfaceGeneration,
  summarizeContractIssues,
  type ProtocolLine,
  type SummonModelProvider,
} from '../src/index.ts';

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

function arrowSourceProtocolLine(source: string): string {
  return `${JSON.stringify({
    op: 'artifact',
    path: '/artifact',
    value: {
      runtime: 'arrow',
      source: {
        'main.ts': source,
      },
    },
  })}\n`;
}

function withoutTiming(lines: readonly ProtocolLine[]): ProtocolLine[] {
  return lines.filter((line) => !(line.op === 'meta' && line.path === '/timing'));
}

function timingValues(lines: readonly ProtocolLine[]): Array<Record<string, unknown>> {
  return lines.flatMap((line) => (
    line.op === 'meta' && line.path === '/timing' && line.value && typeof line.value === 'object'
      ? [line.value as Record<string, unknown>]
      : []
  ));
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

test('runSurfaceGeneration emits prelude and derived surface metadata before Arrow artifact output', async () => {
  const lines: ProtocolLine[] = [];
  const provider: SummonModelProvider = async function* () {
    yield arrowProtocolLine('<p>Hello</p>');
  };

  const summary = await runSurfaceGeneration({
    prompt: 'hello',
    modelProvider: provider,
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    layout: { id: 'one-up', slots: [{ id: 'hero', purpose: 'main content' }] },
    preludeLines: [{ op: 'meta', path: '/status', value: 'queued' }],
  }, (line) => {
    lines.push(line);
  });

  assert.deepEqual(lines.slice(0, 6).map((line) => `${line.op} ${line.path}`), [
    'meta /status',
    'meta /surface-policy',
    'meta /surface-plan',
    'meta /surface-contract',
    'event /surface',
    'meta /status',
  ]);
  assert.ok(lines.some((line) => line.path === '/artifact'));
  assert.equal(summary.acceptedLines[0]?.path, '/artifact');
  assert.equal(summary.blocked, false);
});

test('runSurfaceGeneration forwards semantic preview events before final artifact output', async () => {
  const lines: ProtocolLine[] = [];
  const summary = await runSurfaceGeneration({
    prompt: 'preview then artifact',
    modelProvider: async function* () {
      yield `${JSON.stringify({
        op: 'event',
        path: '/surface',
        value: { type: 'surface.status', status: 'drafting', text: 'Drafting surface' },
      })}\n`;
      yield arrowProtocolLine('<p>Done</p>');
    },
    surfacePolicy: { tier: 'static', purpose: 'inform' },
  }, (line) => {
    lines.push(line);
  });

  assert.deepEqual(withoutTiming(lines).map((line) => `${line.op} ${line.path}`).slice(-3), [
    'meta /status',
    'artifact /artifact',
    'meta /stream-graph-summary',
  ]);
  assert.deepEqual(lines.filter((line) => line.op === 'event').map((line) => `${line.op} ${line.path}`), [
    'event /surface',
    'event /surface',
    'event /surface',
    'event /surface',
  ]);
  assert.deepEqual(summary.acceptedLines.map((line) => line.op), ['event', 'artifact']);
  assert.equal(summary.streamGraph.preview.events.count, 4);
  assert.equal(summary.streamGraph.preview.lastStatus, 'rendering');
});

test('runSurfaceGeneration skips unsupported legacy section protocol', async () => {
  const lines: ProtocolLine[] = [];

  const summary = await runSurfaceGeneration({
    prompt: 'legacy under arrow',
    modelProvider: async function* () {
      yield '{"op":"add","path":"/section/hero","html":"<p>Legacy</p>"}\n';
    },
    surfacePolicy: { tier: 'static', purpose: 'inform' },
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
    surfacePolicy: { tier: 'static', purpose: 'inform' },
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
    },
    tools: {
      tools: [
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
        { name: 'Search', code: 'import { callTool } from "host-bridge:summon";\nconst search = (query: string) => callTool("search", { query });', tool: 'search' },
        { name: 'Choose', code: 'callTool("choose", {})', tool: 'choose' },
      ],
    },
    modelProvider: async function* ({ promptBlocks }) {
      systemText = promptBlocks.map((block) => block.text).join('\n');
      yield arrowProtocolLine('<button>Choose</button>');
    },
  }, (line) => {
    lines.push(line);
  });

  assert.deepEqual(withoutTiming(lines).slice(0, 6).map((line) => `${line.op} ${line.path}`), [
    'meta /surface-policy',
    'meta /surface-plan',
    'meta /surface-contract',
    'event /surface',
    'meta /status',
    'event /surface',
  ]);
  assert.ok(lines.some((line) => line.op === 'artifact' && line.path === '/artifact'));
  assert.equal(lines[0]?.op, 'meta');
  assert.deepEqual((lines[0] as Extract<ProtocolLine, { op: 'meta' }>).value, {
    tier: 'declarative',
    purpose: 'compare',
    grants: ['choose'],
    persistence: 'replayable',
  });
  const surfaceContract = (lines[2] as Extract<ProtocolLine, { op: 'meta' }>).value as {
    tools?: Array<{ name: string }>;
  };
  assert.deepEqual(surfaceContract.tools?.map((tool) => tool.name), ['choose']);
  assert.match(systemText, /Save a choice/);
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
    tools: {
      tools: [{
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

test('runSurfaceGeneration passes provider meta chunks through in order', async () => {
  const lines: ProtocolLine[] = [];

  await runSurfaceGeneration({
    prompt: 'meta',
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: async function* () {
      yield { type: 'meta', path: '/status', value: 'thinking' };
      yield { type: 'text', text: arrowProtocolLine('<p>Hello</p>') };
    },
  }, (line) => {
    lines.push(line);
  });

  assert.equal(lines[0]?.path, '/surface-policy');
  assert.equal(lines[1]?.path, '/surface-plan');
  assert.equal(lines[2]?.path, '/surface-contract');
  assert.equal(lines[3]?.path, '/surface');
  assert.equal(lines[4]?.path, '/status');
  assert.equal(withoutTiming(lines)[5]?.path, '/status');
  assert.ok(lines.some((line) => line.path === '/artifact'));
});

test('runSurfaceGeneration processes final buffered artifact without trailing newline', async () => {
  const lines: ProtocolLine[] = [];

  const summary = await runSurfaceGeneration({
    prompt: 'tail',
    surfacePolicy: { tier: 'static', purpose: 'inform' },
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

test('runSurfaceGeneration blocks invalid Arrow artifacts by default', async () => {
  const lines: ProtocolLine[] = [];

  const summary = await runSurfaceGeneration({
    prompt: 'strict invalid artifact',
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: async function* () {
      yield arrowSourceProtocolLine('import { html } from "@arrow-js/core";\nexport default html`<button ${() => "disabled"}>Save</button>`');
    },
  }, (line) => {
    lines.push(line);
  });

  assert.equal(summary.blocked, true);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'unsupported-arrow-open-tag-expression'));
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/validation-blocked'));
  assert.equal(lines.some((line) => line.op === 'artifact'), false);
});

test('runSurfaceGeneration observe mode emits would-block diagnostics and artifact', async () => {
  const lines: ProtocolLine[] = [];

  const summary = await runSurfaceGeneration({
    prompt: 'observed invalid artifact',
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    validationMode: 'observe',
    modelProvider: async function* () {
      yield arrowSourceProtocolLine('import { html } from "@arrow-js/core";\nexport default html`<button ${() => "disabled"}>Save</button>`');
    },
  }, (line) => {
    lines.push(line);
  });

  assert.equal(summary.blocked, false);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'unsupported-arrow-open-tag-expression'));
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/validation-observed'));
  assert.ok(lines.some((line) => line.op === 'artifact' && line.path === '/artifact'));
  assert.ok(lines.some((line) => (
    line.op === 'meta' &&
    line.path === '/validation-summary' &&
    typeof (line.value as { blocked?: unknown } | undefined)?.blocked === 'number' &&
    (line.value as { blocked: number }).blocked > 0
  )));
});

test('runSurfaceGeneration summary separates accepted artifact lines from emitted diagnostics', async () => {
  const lines: ProtocolLine[] = [];

  const summary = await runSurfaceGeneration({
    prompt: 'summary',
    surfacePolicy: { tier: 'static', purpose: 'inform' },
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
  assert.deepEqual(withoutTiming(summary.emittedLines).map((line) => line.path), [
    '/status',
    '/surface-policy',
    '/surface-plan',
    '/surface-contract',
    '/surface',
    '/status',
    '/status',
    '/surface',
    '/status',
    '/surface',
    '/status',
    '/artifact',
    '/stream-graph-summary',
  ]);
  assert.deepEqual(lines, summary.emittedLines);
});

test('runSurfaceGeneration emits diagnostic timing without changing accepted artifacts', async () => {
  const lines: ProtocolLine[] = [];

  const summary = await runSurfaceGeneration({
    prompt: 'timing',
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: async function* () {
      yield { type: 'text', text: arrowProtocolLine('<p>Timed</p>') };
    },
  }, (line) => {
    lines.push(line);
  });

  assert.deepEqual(summary.acceptedLines.map((line) => line.path), ['/artifact']);
  const timings = timingValues(lines);
  for (const phase of ['drafting', 'first-provider-chunk', 'validating', 'rendering', 'complete']) {
    const timing = timings.find((entry) => entry.phase === phase);
    assert.ok(timing, `missing timing phase ${phase}`);
    assert.equal(timing.source, 'server');
    assert.equal(typeof timing.label, 'string');
    assert.equal(typeof timing.elapsedMs, 'number');
    assert.ok(Number(timing.elapsedMs) >= 0);
    if (timing.durationMs !== undefined) assert.ok(Number(timing.durationMs) >= 0);
  }
  assert.ok(lines.some((line) => line.op === 'artifact' && line.path === '/artifact'));
});

test('policyFromGoal converts agent goal to a host SurfacePolicy', () => {
  const policy = policyFromGoal({
    purpose: 'explore',
    interaction: 'search',
    dataNeed: 'host-resource',
    sideEffect: 'none',
    requestedTools: ['search'],
    confidence: 0.72,
  });

  assert.deepEqual(policy, {
    tier: 'declarative',
    purpose: 'explore',
    grants: ['search'],
    persistence: 'replayable',
  });
});
