// M3.4 app-level: mount a domjs artifact through mountInlineSurface and verify
// render, a tool call round-trip through the host bridge, host->VM state sync,
// and clean runtime-error reporting. Complements M0's VM-level isolation gate.

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
import { mountInlineSurface } from '../src/inline-surface.ts';
import type { DomjsSurfaceArtifact, SurfaceDocumentArtifact } from '@summon-internal/engine';

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

test('mounts a domjs artifact and renders into the root', async () => {
  const root = makeRoot();
  const artifact: DomjsSurfaceArtifact = {
    runtime: 'domjs',
    source: {
      'main.js': `
        const card = document.createElement('div');
        card.className = 'card';
        const t = document.createTextNode('hello domjs');
        card.append(t);
        export default card;
      `,
    },
  };

  const handle = mountInlineSurface({ root, artifact, grantedTools: [] });
  await wait();

  assert.equal(root.querySelector('.card')?.textContent, 'hello domjs');
  handle.dispose();
});

test('a granted tool call round-trips through the host bridge', async () => {
  const root = makeRoot();
  const events = createEventStore();
  const calls: Array<{ tool: string; args: unknown }> = [];

  const artifact: DomjsSurfaceArtifact = {
    runtime: 'domjs',
    source: {
      'main.js': `
        const btn = document.createElement('button');
        btn.textContent = 'save';
        btn.addEventListener('click', () => { callTool('save', { value: 1 }); });
        export default btn;
      `,
    },
  };

  const handle = mountInlineSurface({
    root,
    artifact,
    grantedTools: ['save'],
    events,
    onToolCall: (tool, args) => {
      calls.push({ tool, args });
      return { saved: true };
    },
  });
  await wait();

  const btn = root.querySelector('button') as unknown as HTMLElement;
  btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }) as unknown as Event);
  await wait();

  assert.deepEqual(calls, [{ tool: 'save', args: { value: 1 } }]);
  handle.dispose();
});

test('an ungranted tool call is rejected (not executed)', async () => {
  const root = makeRoot();
  const events = createEventStore();
  let executed = false;

  const artifact: DomjsSurfaceArtifact = {
    runtime: 'domjs',
    source: {
      'main.js': `
        const btn = document.createElement('button');
        btn.addEventListener('click', () => { callTool('danger', {}); });
        export default btn;
      `,
    },
  };

  const handle = mountInlineSurface({
    root,
    artifact,
    grantedTools: [], // nothing granted
    events,
    onToolCall: () => { executed = true; return {}; },
  });
  await wait();

  const btn = root.querySelector('button') as unknown as HTMLElement;
  btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }) as unknown as Event);
  await wait();

  assert.equal(executed, false, 'ungranted tool must not execute');
  assert.ok(events.filter('tool-rejected').length >= 1);
  handle.dispose();
});

test('token style survives a domjs mount (tokens not wiped by replaceChildren)', async () => {
  const root = makeRoot();
  const artifact: DomjsSurfaceArtifact = {
    runtime: 'domjs',
    source: {
      'main.js': `
        const card = document.createElement('div');
        card.className = 'card';
        card.append(document.createTextNode('styled'));
        export default card;
      `,
    },
  };

  const handle = mountInlineSurface({
    root,
    artifact,
    grantedTools: [],
    tokensSource: ':root { --color-bg: #123456; }',
  });
  await wait();

  // The domjs HostRenderer replaces the mount point's children; the token
  // <style> must remain at the root level so tokens still apply.
  const tokenStyle = root.querySelector('style[data-summon-inline-tokens]');
  assert.ok(tokenStyle, 'token <style> must survive the domjs mount');
  assert.match(tokenStyle?.textContent ?? '', /--color-bg/);
  assert.equal(root.querySelector('.card')?.textContent, 'styled');
  handle.dispose();
});

test('domjs artifact main.css is injected and scoped to the surface', async () => {
  const root = makeRoot();
  const artifact: DomjsSurfaceArtifact = {
    runtime: 'domjs',
    source: {
      'main.js': `
        const card = document.createElement('div');
        card.className = 'card';
        card.append(document.createTextNode('styled'));
        export default card;
      `,
      'main.css': '.card { display: grid; gap: 8px; }',
    },
  };

  const handle = mountInlineSurface({ root, artifact, grantedTools: [] });
  await wait();

  const artifactStyle = root.querySelector('style[data-summon-inline-artifact-css]');
  assert.ok(artifactStyle, 'artifact <style> must be injected for main.css');
  // Rules must be scoped to the surface root, not leak globally.
  assert.match(artifactStyle?.textContent ?? '', /data-summon-inline-surface/);
  assert.match(artifactStyle?.textContent ?? '', /display: grid/);
  assert.equal(root.querySelector('.card')?.textContent, 'styled');
  handle.dispose();
});

test('a domjs runtime error is reported, not thrown', async () => {
  const root = makeRoot();
  const errors: string[] = [];

  const artifact: DomjsSurfaceArtifact = {
    runtime: 'domjs',
    // throws at build time (unsupported API used at top level)
    source: { 'main.js': `const d = document.createElement('div'); d.innerHTML = '<b>x</b>'; export default d;` },
  };

  const handle = mountInlineSurface({
    root,
    artifact,
    grantedTools: [],
    onRuntimeError: (reason) => errors.push(reason),
  });
  await wait();

  assert.ok(errors.some((e) => /domjs runtime error/.test(e) && /innerHTML/.test(e)), errors.join(' | '));
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

  const handle = mountInlineSurface({ root, artifact, grantedTools: [] });
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
  assert.doesNotMatch(artifactStyle.textContent ?? '', /data-summon-inline-surface/);
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

  const handle = mountInlineSurface({
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
