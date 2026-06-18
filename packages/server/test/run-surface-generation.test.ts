import assert from 'node:assert/strict';
import test from 'node:test';
import {
  runSurfaceGeneration,
  type ProtocolLine,
  type SurfaceModelProvider,
} from '../src/index.ts';

const validProvider: SurfaceModelProvider = {
  async generateArrowBundle() {
    return {
      schema: 'summon.arrow-bundle/v1',
      preview: {
        kind: 'inform',
        title: 'Hello',
        regions: [{ id: 'body', role: 'content', label: 'Body' }],
      },
      source: {
        'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<p>Hello</p>`;',
      },
    };
  },
};

function withoutTiming(lines: readonly ProtocolLine[]): ProtocolLine[] {
  return lines.filter((line) => !(line.op === 'meta' && line.path === '/timing'));
}

test('runSurfaceGeneration emits server-owned preview and artifact lines', async () => {
  const lines: ProtocolLine[] = [];
  const summary = await runSurfaceGeneration({
    prompt: 'hello',
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: validProvider,
  }, (line) => {
    lines.push(line);
  });

  assert.equal(summary.blocked, false);
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/model-output-mode'));
  assert.ok(lines.some((line) => line.op === 'event' && line.path === '/surface'));
  assert.ok(lines.some((line) => line.op === 'artifact' && line.path === '/artifact'));
  assert.deepEqual(summary.acceptedLines.map((line) => line.op), ['event', 'event', 'event', 'event', 'event', 'artifact']);
  assert.deepEqual(withoutTiming(lines).slice(0, 5).map((line) => `${line.op} ${line.path}`), [
    'meta /surface-policy',
    'meta /surface-plan',
    'meta /surface-contract',
    'meta /model-output-mode',
    'event /surface',
  ]);
});

test('runSurfaceGeneration repairs invalid structured bundle', async () => {
  const lines: ProtocolLine[] = [];
  let repaired = false;
  const provider: SurfaceModelProvider = {
    async generateArrowBundle() {
      return {
        schema: 'summon.arrow-bundle/v1',
        source: {
          'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<button ${() => "disabled"}>Save</button>`;',
        },
      };
    },
    async repairArrowBundle(request) {
      repaired = true;
      assert.equal(request.issues[0]?.code, 'unsupported-arrow-open-tag-expression');
      assert.ok(request.hints.length > 0);
      return {
        schema: 'summon.arrow-bundle/v1',
        source: {
          'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<button class="save">Save</button>`;',
        },
      };
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'repair',
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: provider,
  }, (line) => lines.push(line));

  assert.equal(repaired, true);
  assert.equal(summary.blocked, false);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'unsupported-arrow-open-tag-expression'));
  assert.ok(lines.some((line) => line.op === 'artifact'));
});

test('runSurfaceGeneration blocks invalid bundle when repair is unavailable', async () => {
  const lines: ProtocolLine[] = [];
  const provider: SurfaceModelProvider = {
    async generateArrowBundle() {
      return {
        schema: 'summon.arrow-bundle/v1',
        source: {
          'main.ts': 'export {}',
          'main.js': 'export {}',
        },
      };
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'bad',
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: provider,
    maxRepairAttempts: 0,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, true);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'invalid-arrow-bundle-entry'));
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/validation-blocked'));
  assert.equal(lines.some((line) => line.op === 'artifact'), false);
});

test('runSurfaceGeneration emits heartbeat while provider is slow', async () => {
  const lines: ProtocolLine[] = [];
  const provider: SurfaceModelProvider = {
    async generateArrowBundle() {
      await new Promise((resolve) => setTimeout(resolve, 35));
      return {
        schema: 'summon.arrow-bundle/v1',
        source: {
          'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<p>Slow</p>`;',
        },
      };
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'slow',
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: provider,
    heartbeatIntervalMs: 10,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, false);
  assert.ok(lines.some((line) => line.op === 'event' && line.path === '/surface' && (line.value as { text?: unknown }).text === 'Still composing Arrow bundle'));
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/timing' && (line.value as { phase?: unknown }).phase === 'bundle-received'));
});

test('runSurfaceGeneration emits fallback preview for artifact-only bundles', async () => {
  const lines: ProtocolLine[] = [];
  const summary = await runSurfaceGeneration({
    prompt: 'artifact only',
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: {
      async generateArrowBundle() {
        return {
          schema: 'summon.arrow-bundle/v1',
          source: {
            'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<p>Artifact only</p>`;',
          },
        };
      },
    },
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, false);
  assert.ok(lines.some((line) => line.op === 'event' && line.path === '/surface' && (line.value as { text?: unknown }).text === 'Rendering accepted Arrow artifact'));
});

test('runSurfaceGeneration observe mode accepts renderable artifacts with validation blockers', async () => {
  const lines: ProtocolLine[] = [];
  let repaired = false;
  const provider: SurfaceModelProvider = {
    async generateArrowBundle() {
      return {
        schema: 'summon.arrow-bundle/v1',
        source: {
          'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<button ${() => "disabled"}>Save</button>`;',
        },
      };
    },
    async repairArrowBundle() {
      repaired = true;
      return validProvider.generateArrowBundle({ prompt: '', promptBlocks: [], schema: {} });
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'observe blocker',
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    validationMode: 'observe',
    maxRepairAttempts: 0,
    modelProvider: provider,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, false);
  assert.equal(repaired, false);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'unsupported-arrow-open-tag-expression'));
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/validation-observed'));
  assert.ok(lines.some((line) => line.op === 'artifact' && line.path === '/artifact'));
});

test('runSurfaceGeneration observe mode does not preflight-block policy issues', async () => {
  const lines: ProtocolLine[] = [];
  const summary = await runSurfaceGeneration({
    prompt: 'unknown grant',
    surfacePolicy: { tier: 'declarative', purpose: 'explore', grants: ['missing'] },
    validationMode: 'observe',
    maxRepairAttempts: 0,
    modelProvider: validProvider,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, false);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'surface-policy-unknown-grant'));
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/validation-observed'));
  assert.ok(lines.some((line) => line.op === 'artifact' && line.path === '/artifact'));
});
