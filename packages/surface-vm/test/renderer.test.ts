// M1.3: renderer unit tests. Drives the renderer with hand-written protocol
// messages (no VM, no engine) and asserts DOM output + event sanitization.

import './dom-env.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeMount } from './dom-env.ts';
import { HostRenderer } from '../src/host/renderer.ts';
import type { SandboxedEventPayload, SerializedNode } from '../src/protocol.ts';

function el(
  id: string,
  tag: string,
  extra: Partial<{ attrs: Record<string, string | boolean>; events: Record<string, string>; children: SerializedNode[] }> = {},
): SerializedNode {
  return {
    kind: 'element',
    id,
    tag,
    attrs: extra.attrs ?? {},
    events: extra.events ?? {},
    children: extra.children ?? [],
  };
}

function text(id: string, value: string): SerializedNode {
  return { kind: 'text', id, text: value };
}

function noop() {}

test('instantiates a static element tree into the mount point', () => {
  const root = makeMount();
  const renderer = new HostRenderer({ mountPoint: root, onEvent: noop, onError: noop });

  renderer.render(
    el('snode:1', 'div', {
      attrs: { class: 'card' },
      children: [el('snode:2', 'span', { children: [text('snode:3', 'hello')] })],
    }),
  );

  assert.equal(root.innerHTML, '<div class="card"><span>hello</span></div>');
});

test('set-text and set/remove-attribute patches mutate the DOM', () => {
  const root = makeMount();
  const renderer = new HostRenderer({ mountPoint: root, onEvent: noop, onError: noop });
  renderer.render(el('snode:1', 'div', { attrs: { 'data-x': '1' }, children: [text('snode:2', 'a')] }));

  renderer.applyPatches([{ type: 'set-text', nodeId: 'snode:2', text: 'b' }]);
  assert.equal(root.textContent, 'b');

  renderer.applyPatches([{ type: 'set-attribute', nodeId: 'snode:1', name: 'data-x', value: '2' }]);
  assert.equal((root.firstChild as Element).getAttribute('data-x'), '2');

  renderer.applyPatches([{ type: 'set-attribute', nodeId: 'snode:1', name: 'hidden', value: true }]);
  assert.equal((root.firstChild as Element).getAttribute('hidden'), '');

  renderer.applyPatches([{ type: 'remove-attribute', nodeId: 'snode:1', name: 'data-x' }]);
  assert.equal((root.firstChild as Element).hasAttribute('data-x'), false);
});

test('boolean false attribute removes the attribute', () => {
  const root = makeMount();
  const renderer = new HostRenderer({ mountPoint: root, onEvent: noop, onError: noop });
  renderer.render(el('snode:1', 'button', { attrs: { disabled: true } }));
  assert.equal((root.firstChild as Element).getAttribute('disabled'), '');

  renderer.applyPatches([{ type: 'set-attribute', nodeId: 'snode:1', name: 'disabled', value: false }]);
  assert.equal((root.firstChild as Element).hasAttribute('disabled'), false);
});

test('replace-region tears down old children and inserts new', () => {
  const root = makeMount();
  const renderer = new HostRenderer({ mountPoint: root, onEvent: noop, onError: noop });
  renderer.render(
    el('snode:1', 'ul', {
      children: [
        { kind: 'region', id: 'region:1', children: [el('snode:2', 'li', { children: [text('snode:3', 'one')] })] },
      ],
    }),
  );
  assert.equal(root.querySelectorAll('li').length, 1);

  renderer.applyPatches([
    {
      type: 'replace-region',
      regionId: 'region:1',
      children: [
        el('snode:4', 'li', { children: [text('snode:5', 'a')] }),
        el('snode:6', 'li', { children: [text('snode:7', 'b')] }),
      ],
    },
  ]);
  const items = Array.from(root.querySelectorAll('li')).map((n) => n.textContent);
  assert.deepEqual(items, ['a', 'b']);
});

test('a click produces a plain-data snapshot with no live node reference', async () => {
  const root = makeMount();
  let received: SandboxedEventPayload | null = null;
  const renderer = new HostRenderer({
    mountPoint: root,
    onEvent: (_handlerId, payload) => {
      received = payload;
    },
    onError: noop,
  });

  renderer.render(el('snode:1', 'button', { events: { click: 'shandler:1' }, children: [text('snode:2', 'Go')] }));

  const button = root.firstChild as HTMLElement;
  button.dispatchEvent(new (globalThis as any).MouseEvent('click', { bubbles: true }));

  // event delegation dispatch is async (Promise.resolve chain)
  await new Promise((r) => setTimeout(r, 0));

  assert.ok(received, 'handler should fire');
  const payload = received as SandboxedEventPayload;
  assert.equal(payload.type, 'click');
  assert.equal(payload.currentTargetId, 'snode:1');
  assert.equal(payload.currentTarget?.tagName, 'button');

  // CRITICAL: the payload must be plain data — no DOM node anywhere in it.
  for (const value of Object.values(payload)) {
    assert.equal(value instanceof (globalThis as any).Node, false, 'no live Node in payload');
  }
  assert.equal(JSON.stringify(payload).includes('[object'), false, 'payload is JSON-serializable plain data');
});

test('input event carries value from the snapshot', async () => {
  const root = makeMount();
  let received: SandboxedEventPayload | null = null;
  const renderer = new HostRenderer({
    mountPoint: root,
    onEvent: (_h, p) => { received = p; },
    onError: noop,
  });
  renderer.render(el('snode:1', 'input', { events: { input: 'shandler:1' } }));

  const input = root.firstChild as HTMLInputElement;
  input.value = 'typed';
  input.dispatchEvent(new (globalThis as any).Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 0));

  assert.ok(received);
  assert.equal((received as SandboxedEventPayload).value, 'typed');
});
