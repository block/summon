// Regression: model-authored getAttribute/hasAttribute/dataset must work in the
// domjs facade, and thrown VM errors must carry a stack frame, not a bare
// "not a function".
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSurfaceDocumentModules } from '../src/engine/domjs/index.ts';
import { createVmRunner } from '../src/host/runner.ts';

async function run(behaviorEntry: string) {
  const { modules, entryPath } = buildSurfaceDocumentModules({
    html: '<div id="app"><button id="b" data-item-id="42" disabled>Go</button></div>',
    behaviorEntry,
  });
  const errors: string[] = [];
  const outputs: unknown[] = [];
  const runner = await createVmRunner({
    modules, entryPath,
    onMessage(m) {
      if (m.type === 'error') errors.push(m.error);
      if (m.type === 'output') outputs.push(m.payload);
    },
  });
  await new Promise((r) => setTimeout(r, 25));
  runner.destroy();
  return { errors, outputs };
}

test('getAttribute / hasAttribute / dataset work on facade elements', async () => {
  const { errors, outputs } = await run(`
    const b = document.getElementById('b');
    b.dataset.state = 'ready';
    output({
      id: b.getAttribute('id'),
      missing: b.getAttribute('nope'),
      bool: b.getAttribute('disabled'),
      has: b.hasAttribute('disabled'),
      hasNot: b.hasAttribute('nope'),
      itemId: b.dataset.itemId,
      state: b.getAttribute('data-state'),
    });
  `);
  assert.deepEqual(errors, []);
  assert.deepEqual(outputs, [{
    id: 'b', missing: null, bool: '', has: true, hasNot: false, itemId: '42', state: 'ready',
  }]);
});

test('a thrown VM error carries a stack frame, not a bare message', async () => {
  const { errors } = await run(`
    const b = document.getElementById('b');
    b.definitelyNotAFunction();
  `);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /not a function/);
  assert.match(errors[0], /\(at /, 'expected a stack frame hint: ' + errors[0]);
});
