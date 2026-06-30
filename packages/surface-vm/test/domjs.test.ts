// M2: the domjs engine. Run model-style imperative HTML/JS through the runner
// and assert the emitted protocol messages. No DOM needed for these — we test
// at the protocol boundary (fast, precise). One full-loop DOM test at the end.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createVmRunner } from '../src/host/runner.ts';
import { buildDomjsModules } from '../src/engine/domjs/index.ts';
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
  const runner = await createVmRunner({
    modules,
    entryPath,
    onMessage: (m) => messages.push(m),
  });
  // Live getters: patches/errors recompute on access so post-dispatch messages
  // are reflected.
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

function firstChildText(tree: SerializedNode): string {
  if (tree.kind === 'text') return tree.text;
  if (tree.kind === 'element' || tree.kind === 'region') {
    return tree.kind === 'element'
      ? tree.children.map(firstChildText).join('')
      : tree.children.map(firstChildText).join('');
  }
  return tree.children.map(firstChildText).join('');
}

test('createElement tree serializes into a render message', async () => {
  const r = await run(`
    const root = document.createElement('div');
    root.className = 'card';
    const span = document.createElement('span');
    span.textContent = 'hello';
    root.append(span);
    export default root;
  `);
  r.destroy();

  assert.ok(r.render, 'should emit a render');
  const tree = r.render!.tree as Extract<SerializedNode, { kind: 'element' }>;
  assert.equal(tree.kind, 'element');
  assert.equal(tree.tag, 'div');
  assert.equal(tree.attrs.class, 'card');
  assert.equal(firstChildText(tree), 'hello');
  assert.equal(r.patches.length, 0, 'build phase emits no patches');
});

test('build-phase mutations emit no patches; only the render', async () => {
  const r = await run(`
    const root = document.createElement('div');
    root.setAttribute('data-x', '1');
    root.setAttribute('data-x', '2');   // multiple build mutations
    const t = document.createTextNode('a');
    root.append(t);
    export default root;
  `);
  r.destroy();
  assert.equal(r.patches.length, 0);
  const tree = r.render!.tree as Extract<SerializedNode, { kind: 'element' }>;
  assert.equal(tree.attrs['data-x'], '2');
});

test('click handler mutating a held text node emits a set-text patch', async () => {
  const r = await run(`
    const root = document.createElement('button');
    const label = document.createTextNode('count: 0');
    root.append(label);
    let count = 0;
    root.addEventListener('click', () => {
      count += 1;
      label.textContent = 'count: ' + count;
    });
    export default root;
  `);

  // find the handlerId the engine assigned
  const tree = r.render!.tree as Extract<SerializedNode, { kind: 'element' }>;
  const handlerId = tree.events.click;
  assert.ok(handlerId, 'click should be bound');

  await r.dispatch({ type: 'event', payload: { handlerId, event: { type: 'click', currentTargetId: tree.id } } });
  r.destroy();

  assert.deepEqual(r.patches, [
    { type: 'set-text', nodeId: (tree.children[0] as { id: string }).id, text: 'count: 1' },
  ]);
});

test('multiple mutations in one handler batch into one patch message', async () => {
  const messages: VmToHostMessage[] = [];
  const { modules, entryPath } = buildDomjsModules({
    entry: `
      const root = document.createElement('div');
      const a = document.createTextNode('a');
      root.append(a);
      root.addEventListener('click', () => {
        root.setAttribute('data-y', '9');
        a.textContent = 'z';
      });
      export default root;
    `,
  });
  const runner = await createVmRunner({ modules, entryPath, onMessage: (m) => messages.push(m) });
  const tree = (messages.find((m) => m.type === 'render') as { tree: any }).tree;
  await runner.dispatch({ type: 'event', payload: { handlerId: tree.events.click, event: { type: 'click', currentTargetId: tree.id } } });
  runner.destroy();

  const patchMessages = messages.filter((m) => m.type === 'patch');
  assert.equal(patchMessages.length, 1, 'one flush per dispatch');
  assert.equal((patchMessages[0] as { patches: VmPatch[] }).patches.length, 2);
});

test('manual region.update() emits a replace-region patch with re-rendered children', async () => {
  const r = await run(`
    // Non-reactive data source + explicit update(): the manual escape hatch.
    let data = ['one'];
    const ul = document.createElement('ul');
    const list = region(() => data.map((label) => {
      const li = document.createElement('li');
      li.textContent = label;
      return li;
    }));
    ul.append(list);

    const btn = document.createElement('button');
    btn.addEventListener('click', () => {
      data = data.concat('two');
      list.update();
    });
    ul.append(btn);
    export default ul;
  `);

  const tree = r.render!.tree as Extract<SerializedNode, { kind: 'element' }>;
  const btn = tree.children.find((c) => c.kind === 'element' && c.tag === 'button') as Extract<SerializedNode, { kind: 'element' }>;
  await r.dispatch({ type: 'event', payload: { handlerId: btn.events.click, event: { type: 'click', currentTargetId: btn.id } } });
  r.destroy();

  assert.equal(r.patches.length, 1);
  const patch = r.patches[0] as Extract<VmPatch, { type: 'replace-region' }>;
  assert.equal(patch.type, 'replace-region');
  assert.equal(patch.children.length, 2);
  assert.deepEqual(patch.children.map((c) => firstChildText(c)), ['one', 'two']);
});

test('reactive region auto-updates on state change (no manual update call)', async () => {
  const r = await run(`
    const items = state({ list: ['one'] });
    const ul = document.createElement('ul');
    const list = region(() => items.list.map((label) => {
      const li = document.createElement('li');
      li.textContent = label;
      return li;
    }));
    ul.append(list);

    const btn = document.createElement('button');
    btn.addEventListener('click', () => {
      // Reassign (not push): a single reactive write -> single re-render.
      items.list = items.list.concat('two');
    });
    ul.append(btn);
    export default ul;
  `);

  const tree = r.render!.tree as Extract<SerializedNode, { kind: 'element' }>;
  const btn = tree.children.find((c) => c.kind === 'element' && c.tag === 'button') as Extract<SerializedNode, { kind: 'element' }>;
  await r.dispatch({ type: 'event', payload: { handlerId: btn.events.click, event: { type: 'click', currentTargetId: btn.id } } });
  r.destroy();

  // Exactly one replace-region from the auto-tracked effect — no .update() call.
  assert.equal(r.patches.length, 1);
  const patch = r.patches[0] as Extract<VmPatch, { type: 'replace-region' }>;
  assert.equal(patch.type, 'replace-region');
  assert.deepEqual(patch.children.map((c) => firstChildText(c)), ['one', 'two']);
});

test('reactive text binding updates only that text node on state change', async () => {
  const r = await run(`
    const s = state({ count: 0 });
    const label = document.createTextNode(() => 'count: ' + s.count);
    const wrap = document.createElement('div');
    wrap.append(label);
    const btn = document.createElement('button');
    btn.addEventListener('click', () => { s.count = s.count + 1; });
    wrap.append(btn);
    export default wrap;
  `);

  const tree = r.render!.tree as Extract<SerializedNode, { kind: 'element' }>;
  const btn = tree.children.find((c) => c.kind === 'element' && c.tag === 'button') as Extract<SerializedNode, { kind: 'element' }>;
  await r.dispatch({ type: 'event', payload: { handlerId: btn.events.click, event: { type: 'click', currentTargetId: btn.id } } });
  await r.dispatch({ type: 'event', payload: { handlerId: btn.events.click, event: { type: 'click', currentTargetId: btn.id } } });
  r.destroy();

  // Two clicks -> two set-text patches, fine-grained (no region teardown).
  const setText = r.patches.filter((p) => p.type === 'set-text') as Extract<VmPatch, { type: 'set-text' }>[];
  assert.equal(setText.length, 2);
  assert.equal(setText[setText.length - 1].text, 'count: 2');
});

test('unsupported APIs throw repair-phrased errors', async () => {
  const cases: Array<[string, RegExp]> = [
    [`const d = document.createElement('div'); d.innerHTML = '<b>x</b>'; export default d;`, /innerHTML is not supported/],
    [`const d = document.createElement('div'); d.querySelector('x'); export default d;`, /querySelector is not supported/],
    [`const d = document.createElement('div'); const s = d.style; export default d;`, /style is not supported/],
    [`document.getElementById('x'); export default document.createElement('div');`, /getElementById is not supported/],
  ];
  for (const [entry, re] of cases) {
    const r = await run(entry);
    r.destroy();
    assert.ok(r.errors.some((e) => re.test(e)), `expected error matching ${re}, got: ${r.errors.join(' | ')}`);
  }
});

test('appending to a rendered element throws (use region instead)', async () => {
  const r = await run(`
    const root = document.createElement('div');
    root.addEventListener('click', () => {
      root.append(document.createElement('span'));  // illegal after mount
    });
    export default root;
  `);
  const tree = r.render!.tree as Extract<SerializedNode, { kind: 'element' }>;
  await r.dispatch({ type: 'event', payload: { handlerId: tree.events.click, event: { type: 'click', currentTargetId: tree.id } } });
  r.destroy();
  assert.ok(r.errors.some((e) => /cannot append to a rendered element/.test(e)), r.errors.join(' | '));
});
