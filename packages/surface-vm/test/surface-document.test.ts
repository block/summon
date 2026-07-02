import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createVmRunner } from '../src/host/runner.ts';
import { buildSurfaceDocumentModules } from '../src/engine/domjs/index.ts';
import type { HostToVmMessage, SerializedNode, VmPatch, VmToHostMessage } from '../src/protocol.ts';

interface RunResult {
  readonly messages: VmToHostMessage[];
  readonly render?: Extract<VmToHostMessage, { type: 'render' }>;
  readonly patches: VmPatch[];
  readonly errors: string[];
  dispatch: (m: HostToVmMessage) => Promise<void>;
  destroy: () => void;
}

async function run(html: string, behaviorEntry?: string): Promise<RunResult> {
  const messages: VmToHostMessage[] = [];
  const { modules, entryPath } = buildSurfaceDocumentModules({ html, behaviorEntry });
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
type FragmentTree = Extract<SerializedNode, { kind: 'fragment' }>;

function textOf(node: SerializedNode): string {
  if (node.kind === 'text') return node.text;
  if (node.kind === 'element' || node.kind === 'region' || node.kind === 'fragment') return node.children.map(textOf).join('');
  return '';
}

function findElement(node: SerializedNode, predicate: (node: ElementTree) => boolean): ElementTree | null {
  if (node.kind === 'element' && predicate(node)) return node;
  if (node.kind === 'element' || node.kind === 'region' || node.kind === 'fragment') {
    for (const child of node.children) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
  }
  return null;
}

test('static Surface Document HTML renders through the existing render message', async () => {
  const r = await run(`
    <main id="app" class="card" data-mode="static">
      <h1>Hello</h1>
      <button disabled>Save</button>
    </main>
  `);
  r.destroy();

  assert.equal(r.errors.length, 0, r.errors.join(' | '));
  assert.ok(r.render, 'should emit a render');
  const tree = r.render!.tree as FragmentTree;
  assert.equal(tree.kind, 'fragment');
  const main = tree.children.find((c) => c.kind === 'element') as ElementTree;
  assert.equal(main.tag, 'main');
  assert.equal(main.attrs.id, 'app');
  assert.equal(main.attrs.class, 'card');
  assert.equal(main.attrs['data-mode'], 'static');
  const button = findElement(tree, (n) => n.tag === 'button')!;
  assert.equal(button.attrs.disabled, true);
  assert.match(textOf(tree), /Hello/);
});

test('Surface Document behavior hydrates template nodes and reactive text patches through existing ops', async () => {
  const r = await run(
    `<p id="total">0</p><button id="inc">Increment</button>`,
    `
      const s = state({ count: 0 });
      const total = document.getElementById('total');
      const inc = document.getElementById('inc');
      total.textContent = () => String(s.count);
      inc.onclick = () => { s.count += 1; };
    `,
  );

  assert.equal(r.errors.length, 0, r.errors.join(' | '));
  const tree = r.render!.tree;
  const total = findElement(tree, (n) => n.attrs.id === 'total')!;
  const button = findElement(tree, (n) => n.attrs.id === 'inc')!;
  assert.equal(textOf(total), '0');
  assert.ok(button.events.click, 'onclick should bind a click handler');

  await r.dispatch({ type: 'event', payload: { handlerId: button.events.click, event: { type: 'click', currentTargetId: button.id } } });
  r.destroy();

  const setText = r.patches.find((p) => p.type === 'set-text') as Extract<VmPatch, { type: 'set-text' }>;
  assert.ok(setText, 'click should emit a set-text patch');
  assert.equal(setText.nodeId, (total.children[0] as { id: string }).id);
  assert.equal(setText.text, '1');
});

test('Surface Document supports scoped simple query selectors', async () => {
  const r = await run(
    `
      <main id="app">
        <section class="card primary" data-ref="target"><span data-role="label">Ready</span></section>
        <section class="card"></section>
      </main>
    `,
    `
      const byId = document.querySelector('#app');
      const byClass = document.querySelector('.primary');
      const byAttr = document.querySelector('[data-ref="target"]');
      const byRole = byAttr.querySelector('[data-role="label"]');
      const allCards = document.querySelectorAll('.card');
      byId.setAttribute('data-count', String(allCards.length));
      byRole.textContent = byClass === byAttr ? 'Matched' : 'Wrong';
    `,
  );
  r.destroy();

  assert.equal(r.errors.length, 0, r.errors.join(' | '));
  const tree = r.render!.tree;
  const app = findElement(tree, (n) => n.attrs.id === 'app')!;
  const label = findElement(tree, (n) => n.attrs['data-role'] === 'label')!;
  assert.equal(app.attrs['data-count'], '2');
  assert.equal(textOf(label), 'Matched');
});

test('Surface Document rejects unsupported complex selectors clearly', async () => {
  const r = await run(
    `<main><section><span id="x">x</span></section></main>`,
    `document.querySelector('main span');`,
  );
  r.destroy();
  assert.match(r.errors.join(' | '), /supports only simple selectors/);
});

test('Surface Document parser caps source size, nodes, and depth', () => {
  assert.throws(
    () => buildSurfaceDocumentModules({ html: '<p>x</p>', parseOptions: { maxSourceChars: 4 } }),
    /exceeds 4 characters/,
  );
  assert.throws(
    () => buildSurfaceDocumentModules({ html: '<p>a</p><p>b</p>', parseOptions: { maxNodes: 2 } }),
    /maximum node count 2/,
  );
  assert.throws(
    () => buildSurfaceDocumentModules({ html: '<div><span><b>x</b></span></div>', parseOptions: { maxDepth: 2 } }),
    /maximum depth 2/,
  );
});

test('malicious Surface Document HTML is rejected before VM boot', () => {
  const cases: Array<[string, RegExp]> = [
    ['<script>alert(1)</script>', /Forbidden HTML tag <script>/],
    ['<button onclick="steal()">x</button>', /Forbidden inline event attribute "onclick"/],
    ['<a href="javascript:alert(1)">x</a>', /Forbidden javascript: URL in attribute "href"/],
  ];

  for (const [html, expected] of cases) {
    assert.throws(() => buildSurfaceDocumentModules({ html }), expected);
  }
});
