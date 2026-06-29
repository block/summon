import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadFingerprintPackage,
  resolveFingerprintPackage,
} from '@anarchitecture/ghost/fingerprint';
import type { GhostGraph } from '@anarchitecture/ghost/core';
import { evaluateConformance } from './ghost-conformance.js';
import type { TextCompletionRequest } from './model-providers.js';

const here = dirname(fileURLToPath(import.meta.url));
const signalStreamGhostDir = resolve(
  here,
  '..',
  'fingerprints',
  'bundles',
  'signal-stream',
  '.ghost',
);
const consoleGhostDir = resolve(
  here,
  '..',
  'fingerprints',
  'bundles',
  'console-chrome-2001',
  '.ghost',
);

async function loadGraph(ghostDir: string): Promise<{ packageDir: string; graph: GhostGraph }> {
  const paths = resolveFingerprintPackage(ghostDir, process.cwd());
  const { graph } = await loadFingerprintPackage(paths);
  return { packageDir: paths.packageDir, graph };
}

const throwingCompleteText = (): Promise<string> => {
  throw new Error('completeText must not be called in the no-op fast path');
};

const sampleArtifact = { 'main.ts': 'export const x = 1;', 'main.css': 'body{}' };

describe('evaluateConformance', () => {
  it('empty-checks no-op: no checks dir → evaluated:false, no model call', async () => {
    const { packageDir, graph } = await loadGraph(consoleGhostDir);
    const verdict = await evaluateConformance({
      packageDir,
      graph,
      surface: 'core',
      artifactSource: sampleArtifact,
      completeText: throwingCompleteText,
    });
    assert.equal(verdict.schema, 'summon.ghost-conformance/v1');
    assert.equal(verdict.evaluated, false);
    assert.deepEqual(verdict.checks, []);
    assert.deepEqual(verdict.summary, {
      pass: 0,
      fail: 0,
      inconclusive: 0,
      failedHigh: 0,
      failedMedium: 0,
      failedLow: 0,
    });
  });

  it('null artifact → evaluated:false, no model call (even with checks)', async () => {
    const { packageDir, graph } = await loadGraph(signalStreamGhostDir);
    const verdict = await evaluateConformance({
      packageDir,
      graph,
      surface: 'core',
      artifactSource: null,
      completeText: throwingCompleteText,
    });
    assert.equal(verdict.evaluated, false);
    assert.deepEqual(verdict.checks, []);
  });

  it('routes signal-stream 2 checks and maps pass/fail verdicts', async () => {
    const { packageDir, graph } = await loadGraph(signalStreamGhostDir);
    let called = 0;
    const completeText = async (request: TextCompletionRequest): Promise<string> => {
      called++;
      assert.match(request.system, /design-conformance evaluator/i);
      assert.match(request.prompt, /main\.ts/);
      // One pass, one fail — keyed by the real check names.
      return JSON.stringify([
        { name: 'flat-depth-no-shadow-elevation', pass: true, reason: 'Flat, no shadows.' },
        {
          name: 'no-source-brand-leakage',
          pass: false,
          reason: 'Uses a real publisher logo.',
          evidence: '<img src="nyt-logo">',
        },
      ]);
    };
    const verdict = await evaluateConformance({
      packageDir,
      graph,
      surface: 'core',
      artifactSource: sampleArtifact,
      completeText,
    });
    assert.equal(called, 1);
    assert.equal(verdict.evaluated, true);
    assert.equal(verdict.checks.length, 2);

    const flat = verdict.checks.find((c) => c.name === 'flat-depth-no-shadow-elevation');
    const brand = verdict.checks.find((c) => c.name === 'no-source-brand-leakage');
    assert.ok(flat && brand);
    assert.equal(flat!.verdict, 'pass');
    assert.equal(flat!.severity, 'medium');
    assert.equal(flat!.relevance, 'own');
    assert.equal(brand!.verdict, 'fail');
    assert.equal(brand!.severity, 'high');
    assert.equal(brand!.evidence, '<img src="nyt-logo">');

    assert.deepEqual(verdict.summary, {
      pass: 1,
      fail: 1,
      inconclusive: 0,
      failedHigh: 1,
      failedMedium: 0,
      failedLow: 0,
    });
  });

  it('omitted check → inconclusive', async () => {
    const { packageDir, graph } = await loadGraph(signalStreamGhostDir);
    const completeText = async (): Promise<string> =>
      JSON.stringify([
        { name: 'flat-depth-no-shadow-elevation', pass: true, reason: 'ok' },
      ]);
    const verdict = await evaluateConformance({
      packageDir,
      graph,
      surface: 'core',
      artifactSource: sampleArtifact,
      completeText,
    });
    const brand = verdict.checks.find((c) => c.name === 'no-source-brand-leakage');
    assert.equal(brand!.verdict, 'inconclusive');
    assert.equal(verdict.summary.inconclusive, 1);
    assert.equal(verdict.summary.pass, 1);
  });

  it('malformed model output → all checks inconclusive, no throw', async () => {
    const { packageDir, graph } = await loadGraph(signalStreamGhostDir);
    const completeText = async (): Promise<string> => 'not json at all, sorry';
    const verdict = await evaluateConformance({
      packageDir,
      graph,
      surface: 'core',
      artifactSource: sampleArtifact,
      completeText,
    });
    assert.equal(verdict.evaluated, true);
    assert.equal(verdict.checks.length, 2);
    assert.ok(verdict.checks.every((c) => c.verdict === 'inconclusive'));
    assert.equal(verdict.summary.inconclusive, 2);
  });

  it('timeout → all checks inconclusive, no throw', async () => {
    const { packageDir, graph } = await loadGraph(signalStreamGhostDir);
    const completeText = (): Promise<string> =>
      new Promise((resolveFn) => setTimeout(() => resolveFn('[]'), 200));
    const verdict = await evaluateConformance({
      packageDir,
      graph,
      surface: 'core',
      artifactSource: sampleArtifact,
      completeText,
      timeoutMs: 10,
    });
    assert.equal(verdict.evaluated, true);
    assert.ok(verdict.checks.every((c) => c.verdict === 'inconclusive'));
    assert.equal(verdict.summary.inconclusive, 2);
  });

  it('completeText throwing → inconclusive, no crash', async () => {
    const { packageDir, graph } = await loadGraph(signalStreamGhostDir);
    const completeText = async (): Promise<string> => {
      throw new Error('provider exploded');
    };
    const verdict = await evaluateConformance({
      packageDir,
      graph,
      surface: 'core',
      artifactSource: sampleArtifact,
      completeText,
    });
    assert.equal(verdict.evaluated, true);
    assert.ok(verdict.checks.every((c) => c.verdict === 'inconclusive'));
  });
});
