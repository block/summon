import assert from 'node:assert/strict';
import test from 'node:test';
import { createRunMetricsAccumulator } from './pages/generate/runMetrics.js';
import type { ProtocolLine, SurfaceEvent } from '@decentralized-design/summon/engine';

test('run metrics maps first byte to ttfb', () => {
  const metrics = createRunMetricsAccumulator();
  metrics.markFirstByte(12.6);
  metrics.markFirstByte(30);
  assert.equal(metrics.snapshot().ttfb, 13);
});

test('run metrics maps accepted preview content to ttfp', () => {
  const metrics = createRunMetricsAccumulator();
  metrics.observeSurfaceEvent({
    type: 'region.add',
    id: 'hero',
    parent: 'main',
    role: 'summary',
  } satisfies SurfaceEvent, 42);
  metrics.observeSurfaceEvent({
    type: 'surface.status',
    status: 'rendering',
  } satisfies SurfaceEvent, 90);
  assert.equal(metrics.snapshot().ttfp, 42);
});

test('run metrics maps bundle artifact to tti', () => {
  const metrics = createRunMetricsAccumulator();
  metrics.observeProtocolLine(artifactLine(), 55);
  metrics.observeProtocolLine(artifactLine(), 90);
  assert.equal(metrics.snapshot().tti, 55);
});

test('run metrics merges server run-metrics meta', () => {
  const metrics = createRunMetricsAccumulator();
  metrics.setBytes(1234);
  metrics.markComplete(99);
  metrics.observeProtocolLine({
    op: 'meta',
    path: '/run-metrics',
    value: {
      schema: 'summon.run-metrics/v1',
      runtime: 'surface-document',
      repairs: 1,
      blocked: true,
      validationCount: 3,
      safetyViolations: 2,
      safetyViolationCodes: ['surface-document-network-not-granted'],
    },
  }, 88);
  assert.deepEqual(metrics.snapshot(), {
    runtime: 'surface-document',
    ttfb: null,
    ttfp: null,
    tti: null,
    complete: 99,
    repairs: 1,
    blocked: true,
    validationCount: 3,
    safetyViolations: 2,
    bytes: 1234,
  });
});

function artifactLine(): ProtocolLine {
  return {
    op: 'artifact',
    path: '/artifact',
    value: {
      runtime: 'surface-document',
      source: {
        'main.html': '<main></main>',
        'main.css': 'main { color: var(--color-text); }',
      },
    },
  };
}
