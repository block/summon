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
import type { DomjsSurfaceArtifact } from '@summon-internal/engine';

function makeRoot(): HTMLElement {
  window.document.body.innerHTML = '';
  const root = window.document.createElement('div');
  window.document.body.append(root);
  return root as unknown as HTMLElement;
}

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));

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
