import assert from 'node:assert/strict';
import test from 'node:test';
import { Window } from 'happy-dom';
import { mountInlineSurface } from '@summon-internal/host';
import { runSurfaceGeneration, type SurfaceModelProvider } from '../src/index.ts';

const window = new Window({ url: 'http://localhost/' });
const g = globalThis as unknown as Record<string, unknown>;
g.window = window;
g.document = window.document;
g.Element = window.Element;
g.Node = window.Node;
g.Comment = window.Comment;
g.Event = window.Event;
g.MouseEvent = window.MouseEvent;
g.KeyboardEvent = window.KeyboardEvent;
g.HTMLElement = window.HTMLElement;
g.HTMLStyleElement = window.HTMLStyleElement;

function makeRoot(): HTMLElement {
  window.document.body.innerHTML = '';
  const root = window.document.createElement('div');
  window.document.body.append(root);
  return root as unknown as HTMLElement;
}

const wait = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

const GOOD_SURFACE_DOCUMENT = {
  schema: 'summon.surface-document-bundle/v1',
  source: {
    'main.html': '<main><p id="total">0</p><button id="inc">Increment</button></main>',
    'main.css': 'main { color: var(--color-text); }',
    'main.js': `
      const s = state({ count: 0 });
      document.getElementById('total').textContent = () => String(s.count);
      document.getElementById('inc').onclick = () => { s.count += 1; };
    `,
  },
};

// A provider that lies about its capabilities at runtime (e.g. a JS consumer
// without type checking) — generateSurfaceDocumentBundle is absent.
const incapableProvider = {} as unknown as SurfaceModelProvider;

const surfaceDocumentProvider: SurfaceModelProvider = {
  async generateSurfaceDocumentBundle() {
    return GOOD_SURFACE_DOCUMENT;
  },
};

test('surface-document strategy blocks when provider lacks generateSurfaceDocumentBundle', async () => {
  const lines: any[] = [];
  const summary = await runSurfaceGeneration({
    prompt: 'surface document without provider',
    playground: true,
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: incapableProvider,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, true);
  assert.ok(summary.validationIssues.some((i) => i.code === 'missing-surface-document-provider'));
  assert.equal(lines.some((l) => l.op === 'artifact'), false);
});

test('surface-document output mode reports the bundle schema', async () => {
  const lines: any[] = [];
  await runSurfaceGeneration({
    prompt: 'surface document output mode',
    playground: true,
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: surfaceDocumentProvider,
  }, (line) => lines.push(line));

  const outputMode = lines.find((l) => l.op === 'meta' && l.path === '/model-output-mode');
  assert.ok(outputMode);
  assert.equal(outputMode.value.format, 'surface-document-bundle');
  assert.equal(outputMode.value.schema, 'summon.surface-document-bundle/v1');
  assert.equal(outputMode.value.runtime, 'surface-document');
});

test('a valid surface-document bundle flows through to an accepted artifact', async () => {
  const lines: any[] = [];
  const summary = await runSurfaceGeneration({
    prompt: 'a counter',
    playground: true,
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: surfaceDocumentProvider,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, false);
  const artifact = lines.find((l) => l.op === 'artifact');
  assert.ok(artifact, 'should emit an artifact line');
  assert.equal(artifact.value.runtime, 'surface-document');
  assert.equal(artifact.value.source['main.html'], GOOD_SURFACE_DOCUMENT.source['main.html']);
  assert.equal(artifact.value.source['main.css'], GOOD_SURFACE_DOCUMENT.source['main.css']);
  assert.equal(artifact.value.source['main.js'], GOOD_SURFACE_DOCUMENT.source['main.js']);
});


test('a valid surface-document bundle can be generated and rendered by the host', async () => {
  const lines: any[] = [];
  const summary = await runSurfaceGeneration({
    prompt: 'a renderable counter',
    playground: true,
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: surfaceDocumentProvider,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, false);
  const artifact = lines.find((line) => line.op === 'artifact')?.value;
  assert.ok(artifact, 'server should emit an artifact');

  const root = makeRoot();
  const handle = mountInlineSurface({ root, artifact, grantedTools: [] });
  await wait();

  const shadow = root.querySelector('.summon-surface-document-host')?.shadowRoot;
  assert.ok(shadow, 'surface-document renders into a shadow root');
  assert.equal(shadow.querySelector('#total')?.textContent, '0');
  const btn = shadow.querySelector('#inc') as unknown as HTMLElement;
  btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }) as unknown as Event);
  await wait();
  assert.equal(shadow.querySelector('#total')?.textContent, '1');
  assert.ok(shadow.querySelector('style[data-summon-shadow-artifact-css]'), 'main.css should be injected into the shadow root');
  handle.dispose();
});

test('surface-document bundle-shape failures can repair', async () => {
  let repaired = false;
  const provider: SurfaceModelProvider = {
    async generateSurfaceDocumentBundle() {
      return {
        schema: 'summon.surface-document-bundle/v1',
        source: { 'main.html': '<main>Missing CSS first pass</main>' },
      };
    },
    async repairSurfaceDocumentBundle() {
      repaired = true;
      return GOOD_SURFACE_DOCUMENT;
    },
  };
  const lines: any[] = [];
  const summary = await runSurfaceGeneration({
    prompt: 'missing css then repaired',
    playground: true,
    maxRepairAttempts: 1,
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: provider,
  }, (line) => lines.push(line));

  assert.equal(repaired, true, 'repair path should run');
  assert.equal(summary.blocked, false);
  assert.ok(lines.some((l) => l.op === 'artifact' && l.value.runtime === 'surface-document'));
});

test('surface-document inertness and JS authority violations are blocked', async () => {
  const cases: Array<[unknown, string]> = [
    [{ schema: 'summon.surface-document-bundle/v1', source: { 'main.html': '<script>x()</script>', 'main.css': '.x{}' } }, 'surface-document-html-forbidden-tag'],
    [{ schema: 'summon.surface-document-bundle/v1', source: { 'main.html': '<button onclick="x()">x</button>', 'main.css': '.x{}' } }, 'surface-document-html-inline-handler'],
    [{ schema: 'summon.surface-document-bundle/v1', source: { 'main.html': '<main></main>', 'main.css': '.x{}', 'main.js': 'fetch("https://x")' } }, 'surface-document-network-not-granted'],
    [{ schema: 'summon.surface-document-bundle/v1', source: { 'main.html': '<main></main>', 'main.css': '.x{}', 'main.js': 'el.innerHTML = "<b>x</b>"' } }, 'surface-document-unsupported-api'],
  ];

  for (const [bundle, code] of cases) {
    const provider: SurfaceModelProvider = {
      async generateSurfaceDocumentBundle() { return bundle; },
    };
    const lines: any[] = [];
    const summary = await runSurfaceGeneration({
      prompt: `bad ${code}`,
        playground: true,
      surfacePolicy: { tier: 'static', purpose: 'inform' },
      modelProvider: provider,
    }, (line) => lines.push(line));

    assert.equal(summary.blocked, true, code);
    assert.ok(summary.validationIssues.some((i) => i.code === code), `${code}: got ${summary.validationIssues.map((i) => i.code).join(', ')}`);
    assert.ok(lines.some((l) => l.op === 'meta' && l.path === '/surface-document-blocked-source'), 'blocked source should stream');
    assert.equal(lines.some((l) => l.op === 'artifact'), false);
  }
});
