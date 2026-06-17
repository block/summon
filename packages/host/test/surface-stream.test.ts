import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProtocolLine } from '@summon-internal/engine';
import { StreamGraph } from '@summon-internal/engine';
import {
  consumeSurfaceStream,
  type SurfaceStreamContext,
} from '../src/index.ts';

const encoder = new TextEncoder();

function artifactLine(source = 'import { html } from "@arrow-js/core";\nexport default html`<p>Arrow</p>`'): string {
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

test('consumeSurfaceStream parses split chunks and delivers Arrow artifacts', async () => {
  const artifacts: string[] = [];
  const graphSnapshots: number[] = [];
  const lines: ProtocolLine[] = [];
  const line = artifactLine();
  const result = await consumeSurfaceStream([
    line.slice(0, 35),
    line.slice(35),
  ], {
    mode: 'interactive',
    onLine: (accepted) => lines.push(accepted),
    onGraph: (snapshot) => graphSnapshots.push(snapshot.health.blockedCount),
    onArtifact: (artifact) => artifacts.push(artifact.source['main.ts'] ?? ''),
  });

  assert.equal(result.protocolLines.length, 1);
  assert.deepEqual(lines.map((accepted) => accepted.op), ['artifact']);
  assert.equal(artifacts.length, 1);
  assert.match(artifacts[0]!, /Arrow/);
  assert.equal(result.streamGraph.health.complete, true);
  assert.ok(graphSnapshots.length >= 1);
});

test('consumeSurfaceStream accepts Uint8Array and ReadableStream sources', async () => {
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(artifactLine()));
      controller.close();
    },
  });

  const bytesResult = await consumeSurfaceStream([
    encoder.encode(artifactLine()),
  ], {
    mode: 'static',
  });
  const streamResult = await consumeSurfaceStream(readable, {
    mode: 'static',
  });

  assert.equal(bytesResult.protocolLines.length, 1);
  assert.equal(streamResult.protocolLines.length, 1);
});

test('consumeSurfaceStream blocks invalid Arrow artifacts before callback delivery', async () => {
  const artifacts: string[] = [];
  const result = await consumeSurfaceStream([
    artifactLine('import { html } from "@arrow-js/core";\nexport default html`<input .value=${state.title}>`'),
  ], {
    mode: 'interactive',
    onArtifact: (artifact) => artifacts.push(artifact.source['main.ts'] ?? ''),
  });

  assert.deepEqual(artifacts, []);
  assert.equal(result.protocolLines.length, 0);
  assert.deepEqual(result.validationIssues.map((issue) => issue.code), [
    'unsupported-arrow-idl-binding',
  ]);
  assert.equal(result.streamGraph.health.blockedCount, 1);
});

test('consumeSurfaceStream rejects legacy section protocol at parse boundary', async () => {
  const result = await consumeSurfaceStream([
    '{"op":"set","path":"/screen","value":{"sections":["hero"]}}\n',
    '{"op":"add","path":"/section/hero","html":"<p>Legacy</p>"}\n',
  ], {
    mode: 'interactive',
    validationContext: {
      mode: 'interactive',
      scriptPolicy: 'forbid',
      surfacePlan: {
        purpose: 'inform',
        runtime: 'arrow',
        data: 'embedded',
        authority: 'none',
        persistence: 'replayable',
        network: 'none',
      },
    },
  });

  assert.equal(result.protocolLines.length, 0);
  assert.deepEqual(result.validationIssues.map((issue) => issue.code), []);
  assert.equal(result.parseErrors.length, 2);
  assert.equal(result.streamGraph.health.blockedCount, 0);
});

test('consumeSurfaceStream records malformed lines and calls parse-error callback', async () => {
  const parseErrors: string[] = [];
  const result = await consumeSurfaceStream([
    'not jsonl\n',
    artifactLine(),
  ], {
    mode: 'static',
    onParseError: (raw) => parseErrors.push(raw),
  });

  assert.deepEqual(parseErrors, ['not jsonl']);
  assert.equal(result.parseErrors.length, 1);
  assert.equal(result.protocolLines.length, 1);
});

test('consumeSurfaceStream delivers meta lines and collects validation-blocked issues', async () => {
  const metas: string[] = [];
  const result = await consumeSurfaceStream([
    `${JSON.stringify({
      op: 'meta',
      path: '/validation-blocked',
      value: {
        source: 'protocol',
        severity: 'block',
        code: 'arrow-only-protocol',
        message: 'old protocol',
      },
    })}\n`,
  ], {
    mode: 'interactive',
    onMeta: (line) => metas.push(line.path),
  });

  assert.deepEqual(metas, ['/validation-blocked']);
  assert.equal(result.validationIssues.length, 1);
  assert.equal(result.validationIssues[0]?.code, 'arrow-only-protocol');
  assert.equal(result.streamGraph.health.blockedCount, 1);
});

test('consumeSurfaceStream collects validation-summary examples without duplicating blocked issues', async () => {
  const blocked = {
    source: 'protocol',
    severity: 'block',
    code: 'arrow-only-protocol',
    message: 'old protocol',
  } as const;
  const warning = {
    source: 'token',
    severity: 'warn',
    code: 'unknown-token',
    message: 'token drift',
  } as const;

  const result = await consumeSurfaceStream([
    `${JSON.stringify({ op: 'meta', path: '/validation-blocked', value: blocked })}\n`,
    `${JSON.stringify({
      op: 'meta',
      path: '/validation-summary',
      value: {
        blocked: 1,
        warnings: 1,
        codes: { 'arrow-only-protocol': 1, 'unknown-token': 1 },
        examples: [blocked, warning],
      },
    })}\n`,
  ], {
    mode: 'interactive',
  });

  assert.deepEqual(result.validationIssues.map((issue) => issue.code), [
    'arrow-only-protocol',
    'unknown-token',
  ]);
});

test('consumeSurfaceStream can discard or stop before applying a line', async () => {
  const contexts: SurfaceStreamContext[] = [];
  let decisions = 0;
  const discardResult = await consumeSurfaceStream([
    artifactLine(),
    artifactLine('import { html } from "@arrow-js/core";\nexport default html`<p>Keep</p>`'),
  ], {
    mode: 'static',
    shouldApplyLine: () => decisions++ === 0 ? 'discard' : 'apply',
    onLine: (_line, context) => contexts.push(context),
  });

  assert.equal(discardResult.discarded, true);
  assert.equal(discardResult.stopped, false);
  assert.equal(discardResult.protocolLines.length, 1);

  const stopResult = await consumeSurfaceStream([
    artifactLine(),
  ], {
    mode: 'static',
    shouldApplyLine: () => 'stop',
  });

  assert.equal(stopResult.stopped, true);
  assert.equal(stopResult.discarded, true);
  assert.equal(stopResult.protocolLines.length, 0);
});

test('consumeSurfaceStream can use a supplied graph instance', async () => {
  const streamGraph = new StreamGraph();
  const result = await consumeSurfaceStream([
    artifactLine(),
  ], {
    mode: () => 'interactive',
    streamGraph,
  });

  assert.deepEqual(result.streamGraph, streamGraph.snapshot());
});
