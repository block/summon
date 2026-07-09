import assert from 'node:assert/strict';
import test from 'node:test';
import {
  runSurfaceGeneration,
  type ProtocolLine,
  type SurfaceModelProvider,
} from '../src/index.ts';

const GOOD_BUNDLE = {
  schema: 'summon.surface-document-bundle/v1',
  source: {
    'main.html': '<main><p>Hello</p></main>',
    'main.css': 'main { color: var(--color-text); }',
  },
};

const validProvider: SurfaceModelProvider = {
  async generateSurfaceDocumentBundle() {
    return GOOD_BUNDLE;
  },
};

function withoutTiming(lines: readonly ProtocolLine[]): ProtocolLine[] {
  return lines.filter((line) => !(line.op === 'meta' && line.path === '/timing'));
}

function runMetrics(lines: readonly ProtocolLine[]): Record<string, unknown> {
  const line = lines.find((item) => item.op === 'meta' && item.path === '/run-metrics');
  assert.ok(line, 'expected /run-metrics line');
  assert.ok(line.value && typeof line.value === 'object');
  return line.value as Record<string, unknown>;
}

test('runSurfaceGeneration emits server-owned preview and artifact lines', async () => {
  const lines: ProtocolLine[] = [];
  const summary = await runSurfaceGeneration({
    prompt: 'hello',
    surfacePolicy: { purpose: 'inform' },
    modelProvider: validProvider,
  }, (line) => {
    lines.push(line);
  });

  assert.equal(summary.blocked, false);
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/model-output-mode'));
  assert.ok(lines.some((line) => line.op === 'event' && line.path === '/surface'));
  assert.ok(lines.some((line) => line.op === 'artifact' && line.path === '/artifact'));
  assert.deepEqual(runMetrics(lines), {
    schema: 'summon.run-metrics/v1',
    runtime: 'surface-document',
    repairs: 0,
    blocked: false,
    validationCount: 0,
    safetyViolations: 0,
    safetyViolationCodes: [],
  });
  assert.equal(summary.acceptedLines.at(-1)?.op, 'artifact');
  assert.ok(summary.acceptedLines.filter((line) => line.op === 'event').length > 0);
  assert.deepEqual(withoutTiming(lines).slice(0, 4).map((line) => `${line.op} ${line.path}`), [
    'meta /surface-policy',
    'meta /surface-plan',
    'meta /surface-contract',
    'meta /model-output-mode',
  ]);
});

test('runSurfaceGeneration runs a fidelity repair pass when the reviewer blocks', async () => {
  const lines: ProtocolLine[] = [];
  let generateCalls = 0;
  let repairCalls = 0;
  const provider: SurfaceModelProvider = {
    async generateSurfaceDocumentBundle() {
      generateCalls++;
      return GOOD_BUNDLE;
    },
    async repairSurfaceDocumentBundle() {
      repairCalls++;
      return {
        schema: 'summon.surface-document-bundle/v1',
        source: {
          'main.html': '<main><p>Faithful</p></main>',
          'main.css': 'main { color: var(--color-text); }',
        },
      };
    },
  };

  let reviewCalls = 0;
  const summary = await runSurfaceGeneration({
    prompt: 'hello',
    surfacePolicy: { purpose: 'inform' },
    modelProvider: provider,
    maxRepairAttempts: 0,
    maxFidelityRepairs: 1,
    // First (and only) review fails with a block-severity design issue,
    // triggering the single budgeted fidelity repair. Once the budget is spent
    // the loop accepts without re-reviewing (a re-review could not act anyway).
    fidelityReviewer: async () => {
      reviewCalls++;
      return [{
        source: 'direction',
        severity: 'block',
        code: 'fingerprint-fidelity',
        message: 'Surface does not carry the fingerprint signature moves.',
      }];
    },
  }, (line) => {
    lines.push(line);
  });

  assert.equal(summary.blocked, false);
  assert.equal(generateCalls, 1);
  assert.equal(repairCalls, 1, 'expected exactly one fidelity repair pass');
  assert.equal(reviewCalls, 1, 'reviewer runs once; budget spent, no re-review');
  assert.ok(
    lines.some((line) => line.op === 'meta' && line.path === '/fidelity-review'),
    'expected a /fidelity-review diagnostic line',
  );
  const outputModes = lines.filter((line) => line.op === 'meta' && line.path === '/model-output-mode');
  assert.ok(
    outputModes.some((line) => (line.value as Record<string, unknown>).fidelityRepair === 1),
    'expected a model-output-mode line tagged as a fidelity repair',
  );
});

test('runSurfaceGeneration ships a valid surface when no fidelity reviewer is set', async () => {
  const lines: ProtocolLine[] = [];
  const summary = await runSurfaceGeneration({
    prompt: 'hello',
    surfacePolicy: { purpose: 'inform' },
    modelProvider: validProvider,
  }, (line) => {
    lines.push(line);
  });
  assert.equal(summary.blocked, false);
  assert.ok(!lines.some((line) => line.op === 'meta' && line.path === '/fidelity-review'));
});

test('runSurfaceGeneration repairs unsafe bundles with validation hints', async () => {
  const lines: ProtocolLine[] = [];
  let repaired = false;
  const provider: SurfaceModelProvider = {
    async generateSurfaceDocumentBundle() {
      return {
        schema: 'summon.surface-document-bundle/v1',
        source: {
          'main.html': '<main><button id="save">Save</button></main>',
          'main.css': 'main {}',
          'main.js': 'void fetch("https://example.test/track");',
        },
      };
    },
    async repairSurfaceDocumentBundle(request) {
      repaired = true;
      assert.equal(request.issues[0]?.code, 'surface-document-network-not-granted');
      assert.ok(request.hints.length > 0);
      return GOOD_BUNDLE;
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'repair',
    surfacePolicy: { purpose: 'inform' },
    modelProvider: provider,
  }, (line) => lines.push(line));

  assert.equal(repaired, true);
  assert.equal(summary.blocked, false);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'surface-document-network-not-granted'));
  assert.ok(lines.some((line) => line.op === 'artifact'));
  const metrics = runMetrics(lines);
  assert.equal(metrics.repairs, 1);
  assert.equal(metrics.blocked, false);
  assert.equal(metrics.validationCount, summary.validationIssues.length);
});

test('runSurfaceGeneration repairs main.js syntax errors before runtime', async () => {
  const lines: ProtocolLine[] = [];
  let repaired = false;
  const provider: SurfaceModelProvider = {
    async generateSurfaceDocumentBundle() {
      return {
        schema: 'summon.surface-document-bundle/v1',
        source: {
          'main.html': '<main><p id="msg"></p></main>',
          'main.css': 'main {}',
          'main.js': 'const s = state({ msg: "broken });',
        },
      };
    },
    async repairSurfaceDocumentBundle(request) {
      repaired = true;
      assert.equal(request.issues[0]?.code, 'invalid-surface-document-source-syntax');
      return GOOD_BUNDLE;
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'repair syntax',
    surfacePolicy: { purpose: 'inform' },
    modelProvider: provider,
  }, (line) => lines.push(line));

  assert.equal(repaired, true);
  assert.equal(summary.blocked, false);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'invalid-surface-document-source-syntax'));
  assert.ok(lines.some((line) => line.op === 'artifact'));
});

test('runSurfaceGeneration blocks syntax errors in observe mode without repair', async () => {
  const lines: ProtocolLine[] = [];
  const provider: SurfaceModelProvider = {
    async generateSurfaceDocumentBundle() {
      return {
        schema: 'summon.surface-document-bundle/v1',
        source: {
          'main.html': '<main><p id="msg"></p></main>',
          'main.css': 'main {}',
          'main.js': 'const s = state({ msg: "broken });',
        },
      };
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'observe syntax',
    playground: true,
    validationMode: 'observe',
    maxRepairAttempts: 0,
    surfacePolicy: { purpose: 'inform' },
    modelProvider: provider,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, true);
  const syntaxIssue = summary.validationIssues.find((issue) => issue.code === 'invalid-surface-document-source-syntax');
  assert.ok(syntaxIssue);
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/validation-blocked'));
  assert.equal(lines.some((line) => line.op === 'artifact'), false);
});

test('runSurfaceGeneration can restrict repair attempts to selected issue codes', async () => {
  const lines: ProtocolLine[] = [];
  let repaired = false;
  const provider: SurfaceModelProvider = {
    async generateSurfaceDocumentBundle() {
      return {
        schema: 'summon.surface-document-bundle/v1',
        source: {
          'main.html': '<main><button id="save">Save</button></main>',
          'main.css': 'main {}',
          'main.js': 'void fetch("https://example.test/track");',
        },
      };
    },
    async repairSurfaceDocumentBundle() {
      repaired = true;
      return GOOD_BUNDLE;
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'observe subset blocker',
    playground: true,
    validationMode: 'observe',
    maxRepairAttempts: 1,
    repairIssueCodes: ['invalid-surface-document-source-syntax'],
    surfacePolicy: { purpose: 'inform' },
    modelProvider: provider,
  }, (line) => lines.push(line));

  assert.equal(repaired, false);
  assert.equal(summary.blocked, false);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'surface-document-network-not-granted'));
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/validation-observed'));
  assert.ok(lines.some((line) => line.op === 'artifact'));
});

test('runSurfaceGeneration repairs bundles missing required files', async () => {
  const lines: ProtocolLine[] = [];
  let repaired = false;
  const provider: SurfaceModelProvider = {
    async generateSurfaceDocumentBundle() {
      return {
        schema: 'summon.surface-document-bundle/v1',
        source: {
          'main.html': '<main>No stylesheet</main>',
        },
      };
    },
    async repairSurfaceDocumentBundle(request) {
      repaired = true;
      assert.ok(request.issues.some((issue) => issue.code === 'missing-surface-document-bundle-css'));
      return GOOD_BUNDLE;
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'repair missing css',
    surfacePolicy: { purpose: 'inform' },
    modelProvider: provider,
  }, (line) => lines.push(line));

  assert.equal(repaired, true);
  assert.equal(summary.blocked, false);
  assert.ok(lines.some((line) => line.op === 'artifact'));
  const diagnostics = lines.filter((line) => line.op === 'meta' && line.path === '/surface-document-bundle-diagnostic');
  assert.equal(diagnostics.length, 2);
});

test('runSurfaceGeneration blocks invalid bundle when repair is unavailable', async () => {
  const lines: ProtocolLine[] = [];
  const provider: SurfaceModelProvider = {
    async generateSurfaceDocumentBundle() {
      return {
        schema: 'summon.surface-document-bundle/v1',
        source: {
          'main.html': '<main>No stylesheet</main>',
        },
      };
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'bad',
    surfacePolicy: { purpose: 'inform' },
    modelProvider: provider,
    maxRepairAttempts: 0,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, true);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'missing-surface-document-bundle-css'));
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/validation-blocked'));
  assert.equal(lines.some((line) => line.op === 'artifact'), false);
});

test('runSurfaceGeneration emits heartbeat while provider is slow', async () => {
  const lines: ProtocolLine[] = [];
  const provider: SurfaceModelProvider = {
    async generateSurfaceDocumentBundle() {
      await new Promise((resolve) => setTimeout(resolve, 35));
      return GOOD_BUNDLE;
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'slow',
    surfacePolicy: { purpose: 'inform' },
    modelProvider: provider,
    heartbeatIntervalMs: 10,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, false);
  assert.ok(lines.some((line) => line.op === 'event' && line.path === '/surface' && (line.value as { text?: unknown }).text === 'Still composing Surface Document bundle'));
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/timing' && (line.value as { phase?: unknown }).phase === 'bundle-received'));
});

test('runSurfaceGeneration playground mode skips preview scaffold and preview bundle events', async () => {
  const lines: ProtocolLine[] = [];
  const summary = await runSurfaceGeneration({
    prompt: 'playground artifact only',
    playground: true,
    surfacePolicy: { purpose: 'inform' },
    modelProvider: validProvider,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, false);
  assert.deepEqual(summary.acceptedLines.map((line) => line.op), ['artifact']);
  assert.equal(lines.some((line) => line.op === 'event' && line.path === '/surface' && (line.value as { type?: unknown }).type === 'surface.start'), false);
  assert.equal(lines.some((line) => line.op === 'event' && line.path === '/surface' && (line.value as { type?: unknown }).type === 'region.add'), false);
  assert.ok(lines.some((line) => line.op === 'artifact' && line.path === '/artifact'));
});

test('runSurfaceGeneration observe mode accepts renderable artifacts with validation blockers', async () => {
  const lines: ProtocolLine[] = [];
  let repaired = false;
  const provider: SurfaceModelProvider = {
    async generateSurfaceDocumentBundle() {
      return {
        schema: 'summon.surface-document-bundle/v1',
        source: {
          'main.html': '<main><button id="save">Save</button></main>',
          'main.css': 'main {}',
          'main.js': 'void fetch("https://example.test/track");',
        },
      };
    },
    async repairSurfaceDocumentBundle() {
      repaired = true;
      return GOOD_BUNDLE;
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'observe blocker',
    surfacePolicy: { purpose: 'inform' },
    validationMode: 'observe',
    maxRepairAttempts: 0,
    modelProvider: provider,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, false);
  assert.equal(repaired, false);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'surface-document-network-not-granted'));
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/validation-observed'));
  assert.ok(lines.some((line) => line.op === 'artifact' && line.path === '/artifact'));
});

test('runSurfaceGeneration observe mode does not preflight-block policy issues', async () => {
  const lines: ProtocolLine[] = [];
  const summary = await runSurfaceGeneration({
    prompt: 'unknown grant',
    surfacePolicy: {
      ceiling: { data: 'host-resource', authority: 'host-action' },
      purpose: 'explore',
      grants: ['missing'],
    },
    validationMode: 'observe',
    maxRepairAttempts: 0,
    modelProvider: validProvider,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, false);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'surface-policy-unknown-grant'));
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/validation-observed'));
  assert.ok(lines.some((line) => line.op === 'artifact' && line.path === '/artifact'));
});
