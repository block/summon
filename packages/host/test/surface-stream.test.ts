import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProtocolLine } from '@summon-internal/engine';
import {
  SectionAccumulator,
  StreamGraph,
} from '@summon-internal/engine';
import {
  consumeSurfaceStream,
  type SurfaceStreamContext,
} from '../src/index.ts';

const encoder = new TextEncoder();

test('consumeSurfaceStream parses split string chunks and renders static updates live', async () => {
  const renders: string[] = [];
  const graphSnapshots: number[] = [];
  const lines: ProtocolLine[] = [];

  const result = await consumeSurfaceStream([
    '{"op":"set","path":"/screen","value":{"sections":["hero"]}}\n{"op":"add","path":"/section',
    '/hero","html":"<p>Hello</p>"}\n',
  ], {
    mode: 'static',
    onLine: (line) => lines.push(line),
    onGraph: (snapshot) => graphSnapshots.push(snapshot.sections.length),
    onRenderHtml: (html) => renders.push(html),
  });

  assert.equal(result.protocolLines.length, 2);
  assert.deepEqual(lines.map((line) => line.op), ['set', 'add']);
  assert.equal(renders.length, 1);
  assert.equal(renders[0], '<section data-summon-section="hero">\n<p>Hello</p>\n</section>');
  assert.equal(result.html, renders[0]);
  assert.equal(result.streamGraph.health.complete, true);
  assert.ok(graphSnapshots.length >= 2);
});

test('consumeSurfaceStream accepts Uint8Array chunks', async () => {
  const result = await consumeSurfaceStream([
    encoder.encode('{"op":"set","path":"/screen","value":{"sections":["hero"]}}\n'),
    encoder.encode('{"op":"add","path":"/section/hero","html":"<p>Bytes</p>"}\n'),
  ], {
    mode: 'static',
  });

  assert.equal(result.protocolLines.length, 2);
  assert.match(result.html, /Bytes/);
});

test('consumeSurfaceStream accepts ReadableStream sources', async () => {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('{"op":"set","path":"/screen","value":{"sections":["hero"]}}\n'));
      controller.enqueue(encoder.encode('{"op":"add","path":"/section/hero","html":"<p>Readable</p>"}\n'));
      controller.close();
    },
  });

  const result = await consumeSurfaceStream(source, {
    mode: 'static',
  });

  assert.equal(result.protocolLines.length, 2);
  assert.match(result.html, /Readable/);
});

test('consumeSurfaceStream records malformed lines and calls parse-error callback', async () => {
  const parseErrors: string[] = [];
  const result = await consumeSurfaceStream([
    'not jsonl\n',
    '{"op":"set","path":"/screen","value":{"sections":["hero"]}}\n',
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
    JSON.stringify({
      op: 'meta',
      path: '/validation-blocked',
      value: {
        source: 'html',
        severity: 'block',
        code: 'unsafe-tag',
        message: 'bad tag',
      },
    }),
    '\n',
  ], {
    mode: 'interactive',
    onMeta: (line) => metas.push(line.path),
  });

  assert.deepEqual(metas, ['/validation-blocked']);
  assert.equal(result.validationIssues.length, 1);
  assert.equal(result.validationIssues[0]?.code, 'unsafe-tag');
  assert.equal(result.streamGraph.health.blockedCount, 1);
});

test('consumeSurfaceStream collects validation-summary examples without duplicating blocked issues', async () => {
  const blocked = {
    source: 'html',
    severity: 'block',
    code: 'unsafe-tag',
    message: 'bad tag',
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
        codes: { 'unsafe-tag': 1, 'unknown-token': 1 },
        examples: [blocked, warning],
      },
    })}\n`,
  ], {
    mode: 'interactive',
  });

  assert.deepEqual(result.validationIssues.map((issue) => issue.code), [
    'unsafe-tag',
    'unknown-token',
  ]);
});

test('consumeSurfaceStream renders interactive streams only at completion', async () => {
  const renders: string[] = [];
  const result = await consumeSurfaceStream([
    '{"op":"set","path":"/screen","value":{"sections":["hero","body"]}}\n',
    '{"op":"add","path":"/section/hero","html":"<h1>Title</h1>"}\n',
    '{"op":"add","path":"/section/body","html":"<p>Done</p>"}\n',
  ], {
    mode: 'interactive',
    onRenderHtml: (html) => renders.push(html),
  });

  assert.equal(renders.length, 1);
  assert.equal(renders[0], result.html);
  assert.match(result.html, /Title/);
  assert.match(result.html, /Done/);
});

test('consumeSurfaceStream manual render mode does not call render callback', async () => {
  let renderCount = 0;
  const result = await consumeSurfaceStream([
    '{"op":"set","path":"/screen","value":{"sections":["hero"]}}\n',
    '{"op":"add","path":"/section/hero","html":"<p>Manual</p>"}\n',
  ], {
    mode: 'static',
    renderMode: 'manual',
    onRenderHtml: () => {
      renderCount += 1;
    },
  });

  assert.equal(renderCount, 0);
  assert.match(result.html, /Manual/);
});

test('consumeSurfaceStream can discard a line and keep consuming', async () => {
  const result = await consumeSurfaceStream([
    '{"op":"set","path":"/screen","value":{"sections":["hero","body"]}}\n',
    '{"op":"add","path":"/section/hero","html":"<p>Discard</p>"}\n',
    '{"op":"add","path":"/section/body","html":"<p>Keep</p>"}\n',
  ], {
    mode: 'static',
    shouldApplyLine: (line) => line.path === '/section/hero' ? 'discard' : 'apply',
  });

  assert.equal(result.discarded, true);
  assert.equal(result.stopped, false);
  assert.equal(result.protocolLines.length, 2);
  assert.doesNotMatch(result.html, /Discard/);
  assert.match(result.html, /Keep/);
});

test('consumeSurfaceStream can stop before applying a line', async () => {
  const contexts: SurfaceStreamContext[] = [];
  const result = await consumeSurfaceStream([
    '{"op":"set","path":"/screen","value":{"sections":["hero"]}}\n',
    '{"op":"add","path":"/section/hero","html":"<p>Stop</p>"}\n',
    '{"op":"add","path":"/section/hero","html":"<p>Ignored</p>"}\n',
  ], {
    mode: 'static',
    shouldApplyLine: (line, context) => {
      contexts.push(context);
      return line.op === 'add' ? 'stop' : 'apply';
    },
  });

  assert.equal(result.stopped, true);
  assert.equal(result.discarded, true);
  assert.equal(result.protocolLines.length, 1);
  assert.equal(contexts.at(-1)?.acceptedStructuralLines, 1);
  assert.equal(result.html, '');
});

test('consumeSurfaceStream cancels a ReadableStream when stop is returned', async () => {
  let canceled = false;
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(
        '{"op":"set","path":"/screen","value":{"sections":["hero"]}}\n' +
        '{"op":"add","path":"/section/hero","html":"<p>Stop</p>"}\n' +
        '{"op":"add","path":"/section/hero","html":"<p>Ignored</p>"}\n',
      ));
    },
    cancel() {
      canceled = true;
    },
  });

  const result = await consumeSurfaceStream(source, {
    mode: 'static',
    shouldApplyLine: (line) => line.op === 'add' ? 'stop' : 'apply',
  });

  assert.equal(result.stopped, true);
  assert.equal(canceled, true);
});

test('consumeSurfaceStream can preserve source when cancelOnStop is false', async () => {
  let canceled = false;
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(
        '{"op":"set","path":"/screen","value":{"sections":["hero"]}}\n' +
        '{"op":"add","path":"/section/hero","html":"<p>Stop</p>"}\n',
      ));
    },
    cancel() {
      canceled = true;
    },
  });

  const result = await consumeSurfaceStream(source, {
    mode: 'static',
    cancelOnStop: false,
    shouldApplyLine: (line) => line.op === 'add' ? 'stop' : 'apply',
  });

  assert.equal(result.stopped, true);
  assert.equal(canceled, false);
});

test('consumeSurfaceStream calls async iterator return when stop is returned', async () => {
  let returned = false;
  const chunks = [
    '{"op":"set","path":"/screen","value":{"sections":["hero"]}}\n' +
    '{"op":"add","path":"/section/hero","html":"<p>Stop</p>"}\n',
    '{"op":"add","path":"/section/hero","html":"<p>Ignored</p>"}\n',
  ];
  const source: AsyncIterable<string> = {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        async next() {
          if (index >= chunks.length) return { done: true, value: undefined };
          return { done: false, value: chunks[index++]! };
        },
        async return() {
          returned = true;
          return { done: true, value: undefined };
        },
      };
    },
  };

  const result = await consumeSurfaceStream(source, {
    mode: 'static',
    shouldApplyLine: (line) => line.op === 'add' ? 'stop' : 'apply',
  });

  assert.equal(result.stopped, true);
  assert.equal(returned, true);
});

test('consumeSurfaceStream can use supplied accumulator and graph instances', async () => {
  const accumulator = new SectionAccumulator();
  const streamGraph = new StreamGraph();

  const result = await consumeSurfaceStream([
    '{"op":"set","path":"/screen","value":{"sections":["hero"]}}\n',
    '{"op":"add","path":"/section/hero","html":"<p>Shared</p>"}\n',
  ], {
    mode: () => 'interactive',
    accumulator,
    streamGraph,
  });

  assert.equal(result.html, accumulator.compose());
  assert.deepEqual(result.streamGraph, streamGraph.snapshot());
});
