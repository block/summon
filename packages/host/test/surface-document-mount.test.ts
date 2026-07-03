// App-level: mount Surface Document artifacts through mountSummonSurface and
// verify render, tool call round-trips through the host bridge, grant
// enforcement, style containment, and clean runtime-error reporting.

import { Window } from 'happy-dom';

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

import assert from 'node:assert/strict';
import test from 'node:test';
import { createEventStore } from '@summon-internal/devtools';
import { mountSummonSurface } from '../src/summon-surface.ts';
import type { SurfaceDocumentArtifact } from '@summon-internal/engine';

function makeRoot(): HTMLElement {
  window.document.body.innerHTML = '';
  const root = window.document.createElement('div');
  window.document.body.append(root);
  return root as unknown as HTMLElement;
}

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));

function surfaceDocumentShadowRoot(root: HTMLElement): ShadowRoot {
  const host = root.querySelector('.summon-surface-document-host') as HTMLElement | null;
  assert.ok(host, 'Surface Document shadow host should be mounted');
  assert.ok(host.shadowRoot, 'Surface Document should render into an open shadow root');
  return host.shadowRoot;
}

test('an ungranted tool call is rejected (not executed)', async () => {
  const root = makeRoot();
  const events = createEventStore();
  let executed = false;

  const artifact: SurfaceDocumentArtifact = {
    runtime: 'surface-document',
    source: {
      'main.html': '<button id="go">Go</button>',
      'main.css': 'button { color: var(--color-text); }',
      'main.js': `document.getElementById('go').onclick = () => { callTool('danger', {}); };`,
    },
  };

  const handle = mountSummonSurface({
    root,
    artifact,
    grantedTools: [], // nothing granted
    events,
    onToolCall: () => { executed = true; return {}; },
  });
  await wait();

  const shadow = surfaceDocumentShadowRoot(root);
  const btn = shadow.querySelector('#go') as unknown as HTMLElement;
  btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }) as unknown as Event);
  await wait();

  assert.equal(executed, false, 'ungranted tool must not execute');
  assert.ok(events.filter('tool-rejected').length >= 1);
  handle.dispose();
});

test('token style is installed inside the shadow root', async () => {
  const root = makeRoot();
  const artifact: SurfaceDocumentArtifact = {
    runtime: 'surface-document',
    source: {
      'main.html': '<div class="card">styled</div>',
      'main.css': '.card { color: var(--color-bg); }',
    },
  };

  const handle = mountSummonSurface({
    root,
    artifact,
    grantedTools: [],
    tokensSource: ':root { --color-bg: #123456; }',
  });
  await wait();

  const shadow = surfaceDocumentShadowRoot(root);
  const tokenStyle = shadow.querySelector('style[data-summon-shadow-tokens]');
  assert.ok(tokenStyle, 'token <style> must be installed in the shadow root');
  assert.match(tokenStyle?.textContent ?? '', /--color-bg/);
  assert.equal(shadow.querySelector('.card')?.textContent, 'styled');
  handle.dispose();
});

test('artifact main.css is injected into the shadow root without host scoping selectors', async () => {
  const root = makeRoot();
  const artifact: SurfaceDocumentArtifact = {
    runtime: 'surface-document',
    source: {
      'main.html': '<div class="card">styled</div>',
      'main.css': '.card { display: grid; gap: 8px; }',
    },
  };

  const handle = mountSummonSurface({ root, artifact, grantedTools: [] });
  await wait();

  const shadow = surfaceDocumentShadowRoot(root);
  const artifactStyle = shadow.querySelector('style[data-summon-shadow-artifact-css]');
  assert.ok(artifactStyle, 'artifact <style> must be injected for main.css');
  assert.match(artifactStyle?.textContent ?? '', /display: grid/);
  // Shadow containment replaces attribute-scoping; host selectors must not leak in.
  assert.doesNotMatch(artifactStyle?.textContent ?? '', /data-summon-surface/);
  handle.dispose();
});

test('a Surface Document runtime error is reported, not thrown', async () => {
  const root = makeRoot();
  const errors: string[] = [];

  const artifact: SurfaceDocumentArtifact = {
    runtime: 'surface-document',
    source: {
      'main.html': '<div id="x">x</div>',
      'main.css': 'div { color: var(--color-text); }',
      // throws at hydrate time (unsupported API used at top level)
      'main.js': `document.getElementById('x').innerHTML = '<b>x</b>';`,
    },
  };

  const handle = mountSummonSurface({
    root,
    artifact,
    grantedTools: [],
    onRuntimeError: (reason) => errors.push(reason),
  });
  await wait();

  assert.ok(errors.some((e) => /Surface Document runtime error/.test(e) && /innerHTML/.test(e)), errors.join(' | '));
  handle.dispose();
});

test('mounts a Surface Document artifact and hydrates behavior', async () => {
  const root = makeRoot();
  const artifact: SurfaceDocumentArtifact = {
    runtime: 'surface-document',
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

  const handle = mountSummonSurface({ root, artifact, grantedTools: [] });
  await wait();

  const shadow = surfaceDocumentShadowRoot(root);
  assert.equal(root.querySelector('#total'), null, 'Surface Document internals should not render in light DOM');
  assert.equal(shadow.querySelector('#total')?.textContent, '0');
  const btn = shadow.querySelector('#inc') as unknown as HTMLElement;
  btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }) as unknown as Event);
  await wait();
  assert.equal(shadow.querySelector('#total')?.textContent, '1');
  const artifactStyle = shadow.querySelector('style[data-summon-shadow-artifact-css]');
  assert.ok(artifactStyle, 'main.css should be injected in the shadow root');
  assert.doesNotMatch(artifactStyle.textContent ?? '', /data-summon-surface/);
  handle.dispose();
});

test('Surface Document host bridge calls granted tools', async () => {
  const root = makeRoot();
  const calls: Array<{ tool: string; args: unknown }> = [];
  const artifact: SurfaceDocumentArtifact = {
    runtime: 'surface-document',
    source: {
      'main.html': '<button id="save">Save</button>',
      'main.css': 'button { color: var(--color-text); }',
      'main.js': `document.getElementById('save').onclick = () => callTool('save', { value: 2 });`,
    },
  };

  const handle = mountSummonSurface({
    root,
    artifact,
    grantedTools: ['save'],
    onToolCall: (tool, args) => {
      calls.push({ tool, args });
      return { ok: true };
    },
  });
  await wait();

  const shadow = surfaceDocumentShadowRoot(root);
  const btn = shadow.querySelector('#save') as unknown as HTMLElement;
  btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }) as unknown as Event);
  await wait();
  assert.deepEqual(calls, [{ tool: 'save', args: { value: 2 } }]);
  handle.dispose();
});
