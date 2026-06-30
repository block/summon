import assert from 'node:assert/strict';
import test from 'node:test';
import { runSurfaceGeneration, type SurfaceModelProvider } from '../src/index.ts';
import { DomjsControlStrategy } from '../src/runtime/domjs-control.ts';
import { createRuntimeStrategy } from '../src/runtime/strategy.ts';

const GOOD_DOMJS = `
  const root = document.createElement('div');
  const label = document.createTextNode('hi');
  root.append(label);
  const btn = document.createElement('button');
  btn.addEventListener('click', () => { label.textContent = 'clicked'; });
  root.append(btn);
  export default root;
`;

const arrowOnlyProvider: SurfaceModelProvider = {
  async generateArrowBundle() {
    return { schema: 'summon.arrow-bundle/v1', source: { 'main.ts': 'export default null;' } };
  },
};

const domjsProvider: SurfaceModelProvider = {
  ...arrowOnlyProvider,
  async generateDomjsBundle() {
    return { schema: 'summon.domjs-bundle/v1', source: { 'main.js': GOOD_DOMJS } };
  },
};

test('runtime strategy factory maps domjs-control', () => {
  assert.ok(createRuntimeStrategy('domjs-control') instanceof DomjsControlStrategy);
});

test('domjs strategy blocks when provider lacks generateDomjsBundle', async () => {
  const lines: any[] = [];
  const summary = await runSurfaceGeneration({
    prompt: 'domjs without provider',
    experimentalRuntime: 'domjs-control',
    playground: true,
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: arrowOnlyProvider,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, true);
  assert.ok(summary.validationIssues.some((i) => i.code === 'missing-domjs-provider'));
  assert.equal(lines.some((l) => l.op === 'artifact'), false);
});

test('domjs output mode reports the domjs bundle schema', async () => {
  const lines: any[] = [];
  await runSurfaceGeneration({
    prompt: 'domjs output mode',
    experimentalRuntime: 'domjs-control',
    playground: true,
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: domjsProvider,
  }, (line) => lines.push(line));

  const outputMode = lines.find((l) => l.op === 'meta' && l.path === '/model-output-mode');
  assert.ok(outputMode);
  assert.equal(outputMode.value.format, 'domjs-bundle');
  assert.equal(outputMode.value.schema, 'summon.domjs-bundle/v1');
  assert.equal(outputMode.value.runtime, 'domjs-control');
});

test('a valid domjs bundle flows through to an accepted artifact', async () => {
  const lines: any[] = [];
  const summary = await runSurfaceGeneration({
    prompt: 'a counter',
    experimentalRuntime: 'domjs-control',
    playground: true,
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: domjsProvider,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, false);
  const artifact = lines.find((l) => l.op === 'artifact');
  assert.ok(artifact, 'should emit an artifact line');
  assert.equal(artifact.value.runtime, 'domjs');
  assert.equal(artifact.value.source['main.js'], GOOD_DOMJS);
});

test('a domjs bundle using an unsupported API is blocked (or repaired away)', async () => {
  const badProvider: SurfaceModelProvider = {
    ...arrowOnlyProvider,
    async generateDomjsBundle() {
      return {
        schema: 'summon.domjs-bundle/v1',
        source: { 'main.js': 'const d = document.createElement("div"); d.innerHTML = "<b>x</b>"; export default d;' },
      };
    },
  };
  const lines: any[] = [];
  const summary = await runSurfaceGeneration({
    prompt: 'bad domjs',
    experimentalRuntime: 'domjs-control',
    playground: true,
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: badProvider,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, true);
  assert.ok(summary.validationIssues.some((i) => i.code === 'domjs-unsupported-api'));
  assert.equal(lines.some((l) => l.op === 'artifact'), false);
});

test('a domjs unsupported-api bundle is REPAIRED (not blocked) when the code is in repairIssueCodes', async () => {
  let repaired = false;
  const provider: SurfaceModelProvider = {
    ...arrowOnlyProvider,
    async generateDomjsBundle() {
      // First attempt uses window — runtime-fatal, valid syntax.
      return {
        schema: 'summon.domjs-bundle/v1',
        source: { 'main.js': 'const w = window.innerWidth; const d = document.createElement("div"); d.textContent = String(w); export default d;' },
      };
    },
    async repairDomjsBundle() {
      repaired = true;
      return { schema: 'summon.domjs-bundle/v1', source: { 'main.js': GOOD_DOMJS } };
    },
  };
  const lines: any[] = [];
  const summary = await runSurfaceGeneration({
    prompt: 'window then clean',
    experimentalRuntime: 'domjs-control',
    playground: true,
    maxRepairAttempts: 1,
    // This is the playground allowlist gap the fix closed: without
    // 'domjs-unsupported-api' here, the run blocks with 0 repairs.
    repairIssueCodes: ['domjs-unsupported-api'],
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: provider,
  }, (line) => lines.push(line));

  assert.equal(repaired, true, 'repair path should run');
  assert.equal(summary.blocked, false, 'should recover, not block');
  assert.ok(lines.some((l) => l.op === 'artifact'), 'should emit the repaired artifact');
});
