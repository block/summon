// M1.4: end-to-end runner <-> renderer loop, in a DOM, with no engine.
//
// A hand-written VM "surface" emits an initial render, registers a click
// handler, and on click emits a set-text patch. We assert the DOM updates —
// proving render -> event -> dispatch -> patch -> DOM works through mountSurface.

import './dom-env.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeMount } from './dom-env.ts';
import { mountSurface } from '../src/host/mount.ts';
import { buildDomjsModules } from '../src/engine/domjs/index.ts';

// A trusted VM core: captures __hostSend at import, installs __dispatch, exposes
// helpers. Stands in for the future domjs engine.
const CORE = `
  const send = globalThis.__hostSend;
  const handlers = new Map();
  globalThis.__dispatch = async (m) => {
    if (m.type === 'event') {
      const fn = handlers.get(m.payload.handlerId);
      if (fn) await fn(m.payload.event);
    }
  };
  export const emit = (msg) => send(JSON.stringify(msg));
  export const onHandler = (id, fn) => handlers.set(id, fn);
`;

const SURFACE = `
  import { emit, onHandler } from 'surface-vm:core';

  let count = 0;
  emit({ type: 'ready' });
  emit({ type: 'render', tree: {
    kind: 'element', id: 'snode:1', tag: 'button',
    attrs: {}, events: { click: 'shandler:1' },
    children: [{ kind: 'text', id: 'snode:2', text: 'count: 0' }],
  }});

  onHandler('shandler:1', () => {
    count += 1;
    emit({ type: 'patch', patches: [
      { type: 'set-text', nodeId: 'snode:2', text: 'count: ' + count },
    ]});
  });
`;

test('render -> click -> patch -> DOM update flows through mountSurface', async () => {
  const root = makeMount();
  const surface = await mountSurface({
    modules: { 'surface-vm:core': CORE, '/main.js': SURFACE },
    entryPath: '/main.js',
    root,
  });

  assert.equal(root.textContent, 'count: 0');

  const button = root.firstChild as HTMLElement;
  button.dispatchEvent(new (globalThis as any).MouseEvent('click', { bubbles: true }));

  // allow the async event -> dispatch -> VM -> patch round trip to settle
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(root.textContent, 'count: 1');

  button.dispatchEvent(new (globalThis as any).MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(root.textContent, 'count: 2');

  surface.destroy();
});

test('VM output messages reach onOutput', async () => {
  const root = makeMount();
  const outputs: unknown[] = [];
  const surface = await mountSurface({
    modules: {
      'surface-vm:core': CORE,
      '/main.js': `
        import { emit } from 'surface-vm:core';
        emit({ type: 'render', tree: { kind: 'text', id: 'snode:1', text: 'hi' } });
        emit({ type: 'output', payload: { hello: 'world' } });
      `,
    },
    entryPath: '/main.js',
    root,
    onOutput: (p) => outputs.push(p),
  });

  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(outputs, [{ hello: 'world' }]);
  surface.destroy();
});

test('M2 exit gate: real domjs engine drives render + click + region through the DOM', async () => {
  const root = makeMount();
  const { modules, entryPath } = buildDomjsModules({
    entry: `
      const data = state({ items: ['one'] });

      const wrap = document.createElement('div');
      const label = document.createTextNode('items: 1');
      wrap.append(label);

      const ul = document.createElement('ul');
      const list = region(() => data.items.map((text) => {
        const li = document.createElement('li');
        li.textContent = text;
        return li;
      }));
      ul.append(list);
      wrap.append(ul);

      const add = document.createElement('button');
      add.textContent = 'add';
      add.addEventListener('click', () => {
        data.items.push('next');
        list.update();
        label.textContent = 'items: ' + data.items.length;
      });
      wrap.append(add);

      export default wrap;
    `,
  });

  const surface = await mountSurface({ modules, entryPath, root });

  assert.equal(root.querySelectorAll('li').length, 1);
  assert.equal(root.textContent?.includes('items: 1'), true);

  const button = root.querySelector('button') as HTMLElement;
  button.dispatchEvent(new (globalThis as any).MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 25));

  assert.equal(root.querySelectorAll('li').length, 2);
  assert.deepEqual(
    Array.from(root.querySelectorAll('li')).map((n) => n.textContent),
    ['one', 'next'],
  );
  assert.equal(root.textContent?.includes('items: 2'), true);

  surface.destroy();
});
