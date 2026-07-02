// Phase 2/3 ergonomics: standard DOM semantics post-mount (implicit element
// regions), widened facade surface (style/classList/on-props/reflected props),
// and deep reactivity (array mutation tracks). Tested at the protocol boundary
// like domjs.test.ts, plus one full-loop DOM test for implicit regions.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createVmRunner } from '../src/host/runner.ts';
import { buildDomjsModules } from '../src/engine/domjs/index.ts';
import { mountSurface } from '../src/host/mount.ts';
import { makeMount } from './dom-env.ts';
import type { VmToHostMessage, SerializedNode, VmPatch, HostToVmMessage } from '../src/protocol.ts';

interface RunResult {
  readonly messages: VmToHostMessage[];
  readonly render?: Extract<VmToHostMessage, { type: 'render' }>;
  readonly patches: VmPatch[];
  readonly errors: string[];
  dispatch: (m: HostToVmMessage) => Promise<void>;
  destroy: () => void;
}

async function run(entry: string): Promise<RunResult> {
  const messages: VmToHostMessage[] = [];
  const { modules, entryPath } = buildDomjsModules({ entry });
  const runner = await createVmRunner({ modules, entryPath, onMessage: (m) => messages.push(m) });
  return {
    messages,
    get render() {
      return messages.find((m) => m.type === 'render') as RunResult['render'];
    },
    get patches() {
      return messages
        .filter((m) => m.type === 'patch')
        .flatMap((m) => (m as { patches: VmPatch[] }).patches);
    },
    get errors() {
      return messages.filter((m) => m.type === 'error').map((m) => (m as { error: string }).error);
    },
    dispatch: (m) => runner.dispatch(m),
    destroy: () => runner.destroy(),
  };
}

type ElementTree = Extract<SerializedNode, { kind: 'element' }>;

function clickOn(r: RunResult, el: ElementTree): Promise<void> {
  return r.dispatch({
    type: 'event',
    payload: { handlerId: el.events.click!, event: { type: 'click', currentTargetId: el.id } },
  });
}

// --- implicit element regions -----------------------------------------------

test('removeChild after mount works and emits one replace-region', async () => {
  const r = await run(`
    const root = document.createElement('ul');
    const a = document.createElement('li'); a.textContent = 'a';
    const b = document.createElement('li'); b.textContent = 'b';
    root.append(a, b);
    root.addEventListener('click', () => { root.removeChild(a); });
    export default root;
  `);
  const tree = r.render!.tree as ElementTree;
  await clickOn(r, tree);
  r.destroy();

  assert.equal(r.errors.length, 0, r.errors.join(' | '));
  const replaces = r.patches.filter((p) => p.type === 'replace-region') as Extract<VmPatch, { type: 'replace-region' }>[];
  assert.equal(replaces.length, 1);
  assert.equal(replaces[0]!.regionId, tree.id);
  assert.equal(replaces[0]!.children.length, 1);
});

test('textContent reset after mount works (no throw)', async () => {
  const r = await run(`
    const root = document.createElement('div');
    root.textContent = 'before';
    root.addEventListener('click', () => { root.textContent = 'after'; });
    export default root;
  `);
  const tree = r.render!.tree as ElementTree;
  await clickOn(r, tree);
  r.destroy();

  assert.equal(r.errors.length, 0, r.errors.join(' | '));
  const replace = r.patches.find((p) => p.type === 'replace-region') as Extract<VmPatch, { type: 'replace-region' }>;
  assert.ok(replace);
  assert.equal((replace.children[0] as { text: string }).text, 'after');
});

test('multiple structural mutations coalesce to one patch per element per dispatch', async () => {
  const r = await run(`
    const root = document.createElement('div');
    root.addEventListener('click', () => {
      for (let i = 0; i < 5; i++) {
        const s = document.createElement('span');
        s.textContent = String(i);
        root.append(s);
      }
    });
    export default root;
  `);
  const tree = r.render!.tree as ElementTree;
  await clickOn(r, tree);
  r.destroy();

  const replaces = r.patches.filter((p) => p.type === 'replace-region') as Extract<VmPatch, { type: 'replace-region' }>[];
  assert.equal(replaces.length, 1, 'five appends must coalesce into one replace-region');
  assert.equal(replaces[0]!.children.length, 5);
});

test('insertBefore and string append coerce like the real DOM', async () => {
  const r = await run(`
    const root = document.createElement('div');
    const last = document.createElement('em'); last.textContent = 'last';
    root.append('plain text', last);
    const mid = document.createElement('b'); mid.textContent = 'mid';
    root.insertBefore(mid, last);
    export default root;
  `);
  r.destroy();

  assert.equal(r.errors.length, 0, r.errors.join(' | '));
  const tree = r.render!.tree as ElementTree;
  assert.deepEqual(
    tree.children.map((c) => (c.kind === 'text' ? 'text' : (c as ElementTree).tag)),
    ['text', 'b', 'em'],
  );
});

// --- widened facade surface ---------------------------------------------

test('el.style.* serializes to the style attribute and patches when live', async () => {
  const r = await run(`
    const root = document.createElement('div');
    root.style.color = 'red';
    root.style.backgroundColor = 'black';
    root.addEventListener('click', () => { root.style.color = 'green'; });
    export default root;
  `);
  const tree = r.render!.tree as ElementTree;
  assert.equal(tree.attrs.style, 'color: red; background-color: black');

  await clickOn(r, tree);
  r.destroy();
  assert.equal(r.errors.length, 0, r.errors.join(' | '));
  const attr = r.patches.find((p) => p.type === 'set-attribute') as Extract<VmPatch, { type: 'set-attribute' }>;
  assert.equal(attr.name, 'style');
  assert.match(String(attr.value), /color: green/);
});

test('classList add/remove/toggle round-trips through the class attribute', async () => {
  const r = await run(`
    const root = document.createElement('div');
    root.classList.add('a', 'b');
    root.classList.remove('a');
    root.classList.toggle('c');
    output({ contains: root.classList.contains('b') });
    export default root;
  `);
  r.destroy();
  const tree = r.render!.tree as ElementTree;
  assert.equal(tree.attrs.class, 'b c');
  const out = r.messages.find((m) => m.type === 'output') as { payload: { contains: boolean } };
  assert.equal(out.payload.contains, true);
});

test('onclick property assignment and reflected props (disabled, value) work', async () => {
  const r = await run(`
    const s = state({ n: 0 });
    const root = document.createElement('div');
    const btn = document.createElement('button');
    btn.disabled = false;
    btn.onclick = () => { s.n += 1; };
    const input = document.createElement('input');
    input.value = 'seed';
    const label = document.createElement('p');
    label.textContent = () => 'n=' + s.n;
    root.append(btn, input, label);
    export default root;
  `);
  const tree = r.render!.tree as ElementTree;
  const btn = tree.children[0] as ElementTree;
  const input = tree.children[1] as ElementTree;
  assert.ok(btn.events.click, 'onclick must register a click handler');
  assert.equal(input.attrs.value, 'seed');
  assert.equal('disabled' in btn.attrs, false, 'disabled=false must not set the attribute');

  await clickOn(r, btn);
  r.destroy();
  assert.equal(r.errors.length, 0, r.errors.join(' | '));
  const setText = r.patches.find((p) => p.type === 'set-text') as Extract<VmPatch, { type: 'set-text' }>;
  assert.equal(setText.text, 'n=1');
});

// --- deep reactivity ---------------------------------------------------

test('s.items.push(x) re-renders a region (no array reassignment needed)', async () => {
  const r = await run(`
    const s = state({ items: ['first'] });
    const root = document.createElement('div');
    const btn = document.createElement('button');
    btn.addEventListener('click', () => { s.items.push('second'); });
    const list = region(() => s.items.map((label) => {
      const li = document.createElement('li');
      li.textContent = label;
      return li;
    }));
    root.append(btn, list);
    export default root;
  `);
  const tree = r.render!.tree as ElementTree;
  const btn = tree.children[0] as ElementTree;
  await clickOn(r, btn);
  r.destroy();

  assert.equal(r.errors.length, 0, r.errors.join(' | '));
  const replace = r.patches.find((p) => p.type === 'replace-region') as Extract<VmPatch, { type: 'replace-region' }>;
  assert.ok(replace, 'push must trigger a region re-render');
  assert.equal(replace.children.length, 2);
});

test('nested object writes track (s.user.name = ...)', async () => {
  const r = await run(`
    const s = state({ user: { name: 'ada' } });
    const root = document.createElement('div');
    const label = document.createElement('p');
    label.textContent = () => 'hi ' + s.user.name;
    const btn = document.createElement('button');
    btn.addEventListener('click', () => { s.user.name = 'grace'; });
    root.append(label, btn);
    export default root;
  `);
  const tree = r.render!.tree as ElementTree;
  const btn = tree.children[1] as ElementTree;
  await clickOn(r, btn);
  r.destroy();

  assert.equal(r.errors.length, 0, r.errors.join(' | '));
  const setText = r.patches.find((p) => p.type === 'set-text') as Extract<VmPatch, { type: 'set-text' }>;
  assert.equal(setText.text, 'hi grace');
});

test('splice and index writes track too', async () => {
  const r = await run(`
    const s = state({ items: ['a', 'b', 'c'] });
    const root = document.createElement('div');
    const count = document.createElement('p');
    count.textContent = () => s.items.length + ' items';
    const btn = document.createElement('button');
    btn.addEventListener('click', () => { s.items.splice(1, 1); });
    root.append(count, btn);
    export default root;
  `);
  const tree = r.render!.tree as ElementTree;
  const btn = tree.children[1] as ElementTree;
  await clickOn(r, btn);
  r.destroy();

  assert.equal(r.errors.length, 0, r.errors.join(' | '));
  const setText = r.patches.find((p) => p.type === 'set-text') as Extract<VmPatch, { type: 'set-text' }>;
  assert.equal(setText.text, '2 items');
});

// --- full loop: implicit region reaches real DOM -------------------------

test('full loop: post-mount append updates the rendered DOM', async () => {
  const root = makeMount();
  const errors: string[] = [];
  const { modules, entryPath } = buildDomjsModules({
    entry: `
    const root = document.createElement('div');
    const first = document.createElement('p');
    first.textContent = 'one';
    root.append(first);
    root.addEventListener('click', () => {
      const next = document.createElement('p');
      next.textContent = 'two';
      root.append(next);
    });
    export default root;
    `,
  });
  const surface = await mountSurface({
    modules,
    entryPath,
    root,
    onError: (e) => errors.push(e),
  });

  assert.equal(root.querySelectorAll('p').length, 1);
  const div = root.querySelector('div')!;
  div.dispatchEvent(new (globalThis as any).MouseEvent('click', { bubbles: true }));
  // Event dispatch into the VM is async; wait for the patch round-trip.
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.deepEqual(errors, []);
  assert.equal(root.querySelectorAll('p').length, 2, 'append must reach the DOM');
  assert.equal(root.textContent, 'onetwo');
  surface.destroy();
});
