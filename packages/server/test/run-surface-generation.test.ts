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

test('runSurfaceGeneration repairs Arrow source syntax errors before runtime', async () => {
  const lines: ProtocolLine[] = [];
  let repaired = false;
  const provider: SurfaceModelProvider = {
    async generateArrowBundle() {
      return {
        schema: 'summon.arrow-bundle/v1',
        source: {
          'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<p>${() => "broken}</p>`;',
        },
      };
    },
    async repairArrowBundle(request) {
      repaired = true;
      assert.equal(request.issues[0]?.code, 'invalid-arrow-source-syntax');
      assert.ok(request.hints.some((hint) => hint.includes('syntax error')));
      return {
        schema: 'summon.arrow-bundle/v1',
        source: {
          'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<p>${() => "Fixed"}</p>`;',
        },
      };
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'repair syntax',
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: provider,
  }, (line) => lines.push(line));

  assert.equal(repaired, true);
  assert.equal(summary.blocked, false);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'invalid-arrow-source-syntax'));
  assert.ok(lines.some((line) => line.op === 'artifact'));
});

test('runSurfaceGeneration blocks Arrow source syntax errors in observe mode without repair', async () => {
  const lines: ProtocolLine[] = [];
  const provider: SurfaceModelProvider = {
    async generateArrowBundle() {
      return {
        schema: 'summon.arrow-bundle/v1',
        source: {
          'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<p>${() => "broken}</p>`;',
        },
      };
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'observe syntax',
    playground: true,
    validationMode: 'observe',
    maxRepairAttempts: 0,
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: provider,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, true);
  const syntaxIssue = summary.validationIssues.find((issue) => issue.code === 'invalid-arrow-source-syntax');
  assert.ok(syntaxIssue);
  assert.match(syntaxIssue.message, /main\.ts:2:/);
  assert.match(syntaxIssue.message, /Source excerpt:/);
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/validation-blocked'));
  assert.equal(lines.some((line) => line.op === 'artifact'), false);
});

test('runSurfaceGeneration can restrict repair attempts to selected issue codes', async () => {
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
    prompt: 'observe subset blocker',
    playground: true,
    validationMode: 'observe',
    maxRepairAttempts: 1,
    repairIssueCodes: ['invalid-arrow-source-syntax'],
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: provider,
  }, (line) => lines.push(line));

  assert.equal(repaired, false);
  assert.equal(summary.blocked, false);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'unsupported-arrow-open-tag-expression'));
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/validation-observed'));
  assert.ok(lines.some((line) => line.op === 'artifact'));
});

test('runSurfaceGeneration repairs invalid entry-file bundles', async () => {
  const lines: ProtocolLine[] = [];
  let repaired = false;
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
    async repairArrowBundle(request) {
      repaired = true;
      assert.equal(request.issues[0]?.code, 'invalid-arrow-bundle-entry');
      assert.ok(request.hints.some((hint) => hint.includes('exactly one Arrow entry file')));
      return {
        schema: 'summon.arrow-bundle/v1',
        source: {
          'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<p>Repaired</p>`;',
        },
      };
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'repair entry files',
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: provider,
  }, (line) => lines.push(line));

  assert.equal(repaired, true);
  assert.equal(summary.blocked, false);
  assert.ok(lines.some((line) => line.op === 'artifact'));
  const diagnostics = lines.filter((line) => line.op === 'meta' && line.path === '/arrow-bundle-diagnostic');
  assert.equal(diagnostics.length, 2);
  assert.deepEqual((diagnostics[0]?.value as { entryKeys?: unknown }).entryKeys, ['main.js', 'main.ts']);
  assert.deepEqual((diagnostics[1]?.value as { entryKeys?: unknown }).entryKeys, ['main.ts']);
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

test('runSurfaceGeneration playground mode skips preview scaffold and preview bundle events', async () => {
  const lines: ProtocolLine[] = [];
  const summary = await runSurfaceGeneration({
    prompt: 'playground artifact only',
    playground: true,
    surfacePolicy: { tier: 'static', purpose: 'inform' },
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

test('runSurfaceGeneration blocks Ghost artifacts with no selected composition evidence', async () => {
  const lines: ProtocolLine[] = [];
  const provider: SurfaceModelProvider = {
    async generateArrowBundle() {
      return {
        schema: 'summon.arrow-bundle/v1',
        source: {
          'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<main class="generic-shell"><section><h1>Hello</h1><p>Safe but generic.</p></section></main>`;',
          'main.css': '.generic-shell { min-height: 100%; padding: var(--space-6); color: var(--color-text); background: var(--color-bg); display: grid; gap: var(--space-4); border: 1px solid var(--color-border); } .generic-shell section { display: grid; gap: var(--space-3); } .generic-shell h1 { font-size: var(--text-xl); }',
        },
      };
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'ghost generic',
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: provider,
    maxRepairAttempts: 0,
    ghost: ghostFixtureContext(),
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, true);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'ghost-fidelity-no-composition-evidence'));
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/validation-blocked'));
  assert.equal(lines.some((line) => line.op === 'artifact'), false);
});

test('runSurfaceGeneration accepts Ghost artifacts with selected composition evidence', async () => {
  const lines: ProtocolLine[] = [];
  const provider: SurfaceModelProvider = {
    async generateArrowBundle() {
      return {
        schema: 'summon.arrow-bundle/v1',
        source: {
          'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<main class="ledger-shell"><section class="ledger-rows"><h1>Ledger rows</h1><p>Evidence rail with compact metadata.</p></section></main>`;',
          'main.css': '.ledger-shell { min-height: 100%; padding: var(--space-6); color: var(--color-text); background: var(--color-bg); display: grid; gap: var(--space-4); border: 1px solid var(--color-border); } .ledger-rows { display: grid; gap: var(--space-3); border-top: 1px solid var(--color-border-strong); } .ledger-rows h1 { font-size: var(--text-xl); }',
        },
      };
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'ghost ledger',
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: provider,
    maxRepairAttempts: 0,
    ghost: ghostFixtureContext(),
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, false);
  assert.equal(summary.validationIssues.some((issue) => issue.code === 'ghost-fidelity-no-composition-evidence'), false);
  assert.ok(lines.some((line) => line.op === 'artifact'));
});

function ghostFixtureContext() {
  return {
    source: 'catalog' as const,
    prompt: 'Ghost relay brief.',
    product: 'Ledger Ghost',
    ingestion: {
      schema: 'summon.ghost-ingestion/v1' as const,
      product: 'Ledger Ghost',
      source: { kind: 'catalog' as const, id: 'ledger-ghost', targetPath: '.' },
      relay: {
        taskContract: { preserve: [], inspect: [], avoid: [], validate: [] },
        selectedRefs: { prose: [], composition: ['composition.pattern:ledger-shell'], inventory: [], checks: [] },
        suggestedReads: [],
        omissions: [],
      },
      fingerprint: {
        identity: { audience: [], goals: [], tone: [], antiGoals: [], tradeoffs: [] },
        prose: [],
        composition: [{ ref: 'composition.pattern:ledger-shell', summary: 'Ledger rows use an evidence rail.', details: [] }],
        inventory: { refs: [], buildingBlocks: [], tokens: [], components: [], libraries: [] },
        checks: [],
        antiPatterns: [],
      },
      style: { tokenSource: 'fingerprint-catalog' as const, source: 'tokens.css', definedTokens: [], customTokens: [], warnings: [] },
      promptBlocks: [],
      validation: {
        requiredSignals: [{
          id: 'composition:ledger-shell',
          kind: 'composition' as const,
          label: 'Ledger rows use an evidence rail.',
          terms: ['ledger rows', 'evidence rail'],
          severity: 'block' as const,
          sourceRef: 'composition.pattern:ledger-shell',
        }],
        forbiddenSignals: [],
        activeChecks: [],
      },
    },
  };
}
