import assert from 'node:assert/strict';
import test from 'node:test';
import { createRunMetricsAccumulator } from './pages/generate/runMetrics.js';
import type { ProtocolLine, SurfaceEvent } from '@anarchitecture/summon/engine';

test('run metrics maps first byte to ttfb', () => {
  const metrics = createRunMetricsAccumulator('arrow-control');
  metrics.markFirstByte(12.6);
  metrics.markFirstByte(30);
  assert.equal(metrics.snapshot().ttfb, 13);
});

test('run metrics maps accepted preview content to ttfp', () => {
  const metrics = createRunMetricsAccumulator('arrow-control');
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

test('run metrics maps html stream preview delta to ttfp', () => {
  const metrics = createRunMetricsAccumulator('html-stream');
  metrics.observeProtocolLine({
    op: 'meta',
    path: '/html-stream-preview',
    value: { runtime: 'html', target: 'hero', action: 'replace', delta: '<p>' },
  }, 28);
  assert.equal(metrics.snapshot().ttfp, 28);
});

test('run metrics maps bundle artifact to tti', () => {
  const metrics = createRunMetricsAccumulator('html-static');
  metrics.observeProtocolLine(artifactLine(), 55);
  assert.equal(metrics.snapshot().tti, 55);
});

test('run metrics maps streamed html patch to tti with artifact fallback', () => {
  const metrics = createRunMetricsAccumulator('html-stream');
  metrics.observeProtocolLine(artifactLine(), 40);
  assert.equal(metrics.snapshot().tti, 40);
  metrics.observeProtocolLine({
    op: 'patch',
    path: '/artifact/html-patch',
    value: { runtime: 'html', target: 'hero', action: 'replace', html: '<section id="hero"></section>' },
  }, 77);
  assert.equal(metrics.snapshot().tti, 77);
});

test('run metrics merges server run-metrics meta', () => {
  const metrics = createRunMetricsAccumulator('arrow-control');
  metrics.setBytes(1234);
  metrics.markComplete(99);
  metrics.observeProtocolLine({
    op: 'meta',
    path: '/run-metrics',
    value: {
      schema: 'summon.run-metrics/v1',
      runtime: 'arrow-control',
      repairs: 1,
      blocked: true,
      validationCount: 3,
      safetyViolations: 2,
      safetyViolationCodes: ['external-url'],
    },
  }, 88);
  assert.deepEqual(metrics.snapshot(), {
    runtime: 'arrow-control',
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
      runtime: 'html',
      source: { 'body.html': '<main></main>' },
    },
  };
}
