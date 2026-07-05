import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProtocolLine } from '@decentralized-design/summon/engine';
import { initialGenerationTrace, traceReducer } from './generationTrace.js';

test('traceReducer folds ghost protocol lines into a generation trace', () => {
  const lines: ProtocolLine[] = [
    { op: 'meta', path: '/status', value: 'gathering' },
    {
      op: 'meta',
      path: '/ghost-gather',
      value: {
        selectedNodes: [
          { id: 'hero', pullReason: 'front-door', kind: 'section', reason: 'Primary entry' },
        ],
        warnings: ['low coverage'],
      },
    },
    {
      op: 'meta',
      path: '/ghost-conformance',
      value: {
        evaluated: true,
        summary: { pass: 1, fail: 1, inconclusive: 1 },
        checks: [
          { name: 'contrast', severity: 'high', verdict: 'pass', reason: 'ok' },
          { name: 'density', severity: 'medium', verdict: 'fail', reason: 'too dense', evidence: '12 controls' },
          { name: 'motion', severity: 'low', verdict: 'inconclusive', reason: 'not enough data' },
        ],
      },
    },
    {
      op: 'meta',
      path: '/ghost-receipt',
      value: {
        conformance: { summary: { pass: 1, fail: 1, inconclusive: 1 } },
        generation: { validation: { blocked: 0, warnings: 1 }, repairs: 0, safetyViolations: [] },
      },
    },
  ];

  const traced = lines.reduce(
    (state, line, index) => traceReducer(state, { type: 'line', line, at: 1_700_000_000_000 + index }),
    initialGenerationTrace,
  );

  assert.equal(traced.phase, 'gathering');
  assert.deepEqual(traced.gatherWarnings, ['low coverage']);
  assert.deepEqual(traced.gatheredNodes, [
    { id: 'hero', pullReason: 'front-door', kind: 'section', reason: 'Primary entry' },
  ]);
  assert.equal(traced.conformance?.evaluated, true);
  assert.deepEqual(traced.conformance?.summary, { pass: 1, fail: 1, inconclusive: 1 });
  assert.equal(traced.conformance?.checks.length, 3);
  assert.equal(traced.receipt, lines[3]!.value);
  assert.equal(traced.timeline.length, 4);
  assert.deepEqual(traced.timeline.map((item) => item.kind), ['status', 'gather', 'conformance', 'receipt']);

  const reset = traceReducer(traced, { type: 'reset' });
  assert.equal(reset.runId, traced.runId + 1);
  assert.equal(reset.gatheredNodes.length, 0);
  assert.equal(reset.conformance, null);
  assert.equal(reset.receipt, null);
  assert.equal(reset.timeline.length, 0);
});
