import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadFingerprintPackage,
  resolveFingerprintPackage,
} from '@decentralized-design/ghost/fingerprint';
import { evaluateConformance, formatArtifactSourceForConformance } from '../src/ghost/conformance.js';
import type { GhostLoadedCheck } from '../src/ghost/adapter.js';
import type { TextCompletionRequest } from '../src/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const signalStreamGhostDir = resolve(
  here,
  '..',
  '..',
  '..',
  'apps',
  'server',
  'fingerprints',
  'bundles',
  'signal-stream',
  '.ghost',
);
const consoleGhostDir = resolve(
  here,
  '..',
  '..',
  '..',
  'apps',
  'server',
  'fingerprints',
  'bundles',
  'console-chrome-2001',
  '.ghost',
);

async function loadChecks(ghostDir: string): Promise<Map<string, GhostLoadedCheck>> {
  const paths = resolveFingerprintPackage(ghostDir, process.cwd());
  const { checks } = await loadFingerprintPackage(paths);
  return checks;
}

const throwingCompleteText = (): Promise<string> => {
  throw new Error('completeText must not be called in the no-op fast path');
};

const sampleArtifact = { 'main.ts': 'export const x = 1;', 'main.css': 'body{}' };

describe('formatArtifactSourceForConformance', () => {
  it('preserves design-bearing CSS even when main.js is huge', () => {
    const formatted = formatArtifactSourceForConformance({
      'main.js': 'x'.repeat(60_000),
      'main.html': '<main id="x"><h1>Title</h1></main>',
      'main.css': 'main { color: var(--color-text); }',
    });

    assert.ok(formatted.indexOf('=== main.css ===') < formatted.indexOf('=== main.html ==='));
    assert.ok(formatted.indexOf('=== main.html ===') < formatted.indexOf('=== main.js ==='));
  });
});

describe('evaluateConformance', () => {
  it('empty-checks no-op: empty check map → evaluated:false, no model call', async () => {
    const verdict = await evaluateConformance({
      checks: new Map(),
      surface: 'index',
      artifactSource: sampleArtifact,
      completeText: throwingCompleteText,
    });
    assert.equal(verdict.schema, 'summon.ghost-conformance/v2');
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
    const checks = await loadChecks(signalStreamGhostDir);
    assert.ok(checks.size > 0, 'signal-stream must carry checks');
    const verdict = await evaluateConformance({
      checks,
      surface: 'index',
      artifactSource: null,
      completeText: throwingCompleteText,
    });
    assert.equal(verdict.evaluated, false);
    assert.deepEqual(verdict.checks, []);
  });

  it('offers all signal-stream checks and maps pass/fail verdicts', async () => {
    const checks = await loadChecks(signalStreamGhostDir);
    let called = 0;
    const completeText = async (request: TextCompletionRequest): Promise<string> => {
      called++;
      assert.match(request.system, /design-conformance evaluator/i);
      assert.match(request.prompt, /main\.ts/);
      // One pass, one fail — keyed by the real check names.
      // One fail, the rest pass — keyed by the real check names.
      return JSON.stringify(
        [...checks.values()].map((entry) => entry.doc.frontmatter.name).map((name) =>
          name === 'no-source-brand-leakage'
            ? {
                name,
                pass: false,
                reason: 'Uses a real publisher logo.',
                evidence: '<img src="nyt-logo">',
              }
            : { name, pass: true, reason: 'Conforms.' },
        ),
      );
    };
    const verdict = await evaluateConformance({
      checks,
      surface: 'index',
      artifactSource: sampleArtifact,
      completeText,
    });
    assert.equal(called, 1);
    assert.equal(verdict.evaluated, true);
    assert.equal(verdict.checks.length, checks.size);

    const flat = verdict.checks.find((c) => c.name === 'flat-depth-no-shadow-elevation');
    const brand = verdict.checks.find((c) => c.name === 'no-source-brand-leakage');
    assert.ok(flat && brand);
    assert.equal(flat!.verdict, 'pass');
    assert.equal(flat!.severity, 'medium');
    assert.equal(flat!.offered, 'always');
    assert.equal(brand!.verdict, 'fail');
    assert.equal(brand!.severity, 'high');
    assert.equal(brand!.evidence, '<img src="nyt-logo">');

    assert.deepEqual(verdict.summary, {
      pass: checks.size - 1,
      fail: 1,
      inconclusive: 0,
      failedHigh: 1,
      failedMedium: 0,
      failedLow: 0,
    });
  });

  it('omitted check → inconclusive', async () => {
    const checks = await loadChecks(signalStreamGhostDir);
    const completeText = async (): Promise<string> =>
      JSON.stringify([
        { name: 'flat-depth-no-shadow-elevation', pass: true, reason: 'ok' },
      ]);
    const verdict = await evaluateConformance({
      checks,
      surface: 'index',
      artifactSource: sampleArtifact,
      completeText,
    });
    const brand = verdict.checks.find((c) => c.name === 'no-source-brand-leakage');
    assert.equal(brand!.verdict, 'inconclusive');
    assert.equal(verdict.summary.inconclusive, checks.size - 1);
    assert.equal(verdict.summary.pass, 1);
  });

  it('malformed model output → all checks inconclusive, no throw', async () => {
    const checks = await loadChecks(signalStreamGhostDir);
    const completeText = async (): Promise<string> => 'not json at all, sorry';
    const verdict = await evaluateConformance({
      checks,
      surface: 'index',
      artifactSource: sampleArtifact,
      completeText,
    });
    assert.equal(verdict.evaluated, true);
    assert.equal(verdict.checks.length, checks.size);
    assert.ok(verdict.checks.every((c) => c.verdict === 'inconclusive'));
    assert.equal(verdict.summary.inconclusive, checks.size);
  });

  it('timeout → all checks inconclusive, no throw', async () => {
    const checks = await loadChecks(signalStreamGhostDir);
    const completeText = (): Promise<string> =>
      new Promise((resolveFn) => setTimeout(() => resolveFn('[]'), 200));
    const verdict = await evaluateConformance({
      checks,
      surface: 'index',
      artifactSource: sampleArtifact,
      completeText,
      timeoutMs: 10,
    });
    assert.equal(verdict.evaluated, true);
    assert.ok(verdict.checks.every((c) => c.verdict === 'inconclusive'));
    assert.equal(verdict.summary.inconclusive, checks.size);
  });

  it('completeText throwing → inconclusive, no crash', async () => {
    const checks = await loadChecks(signalStreamGhostDir);
    const completeText = async (): Promise<string> => {
      throw new Error('provider exploded');
    };
    const verdict = await evaluateConformance({
      checks,
      surface: 'index',
      artifactSource: sampleArtifact,
      completeText,
    });
    assert.equal(verdict.evaluated, true);
    assert.ok(verdict.checks.every((c) => c.verdict === 'inconclusive'));
  });
});
