// Phase 0 safety floor: the VM cannot hang the host, reactive cycles fail
// loudly instead of livelocking, and malformed VM messages surface as errors.
//
// These are hostile-input tests: they run model-shaped *misbehaving* code and
// assert the runner's containment, not the code's output.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createVmRunner } from '../src/host/runner.ts';
import { buildDomjsModules } from '../src/engine/domjs/index.ts';
import type { VmToHostMessage } from '../src/protocol.ts';

const CORE_MODULE = `
  const send = globalThis.__hostSend;
  let handlers = new Map();
  globalThis.__dispatch = async (message) => {
    if (message.type === 'event') {
      const fn = handlers.get(message.payload.handlerId);
      if (fn) await fn(message.payload.event);
    }
  };
  export function emit(message) { send(JSON.stringify(message)); }
  export function registerHandler(id, fn) { handlers.set(id, fn); }
  export function sendRaw(text) { send(text); }
`;

function makeRunner(
  entrySource: string,
  onMessage: (m: VmToHostMessage) => void,
  dispatchBudgetMs?: number,
) {
  return createVmRunner({
    modules: {
      'surface-vm:core': CORE_MODULE,
      '/main.js': entrySource,
    },
    entryPath: '/main.js',
    onMessage,
    ...(dispatchBudgetMs !== undefined ? { dispatchBudgetMs } : {}),
  });
}

test('an infinite loop in an event handler trips the budget; runner survives', async () => {
  const messages: VmToHostMessage[] = [];
  const runner = await makeRunner(
    `
    import { emit, registerHandler } from 'surface-vm:core';
    registerHandler('loop', () => { while (true) {} });
    registerHandler('ok', () => { emit({ type: 'output', payload: 'still alive' }); });
    emit({ type: 'ready' });
    `,
    (m) => messages.push(m),
    100,
  );

  const started = Date.now();
  await runner.dispatch({
    type: 'event',
    payload: { handlerId: 'loop', event: { type: 'click', currentTargetId: 'snode:1' } },
  });
  const elapsed = Date.now() - started;

  assert.ok(elapsed < 5000, `dispatch must return promptly (took ${elapsed}ms)`);
  const budgetError = messages.find(
    (m) => m.type === 'error' && /dispatch budget/.test((m as { error: string }).error),
  );
  assert.ok(budgetError, 'a budget-exceeded error must surface as a protocol message');

  // The runner must still service subsequent dispatches.
  await runner.dispatch({
    type: 'event',
    payload: { handlerId: 'ok', event: { type: 'click', currentTargetId: 'snode:1' } },
  });
  runner.destroy();

  const output = messages.find((m) => m.type === 'output') as { payload: string } | undefined;
  assert.equal(output?.payload, 'still alive', 'runner must survive a budget trip');
});

test('an infinite loop at module top level trips the budget at boot', async () => {
  await assert.rejects(
    makeRunner('while (true) {}', () => {}, 100),
    /interrupted/i,
  );
});

test('a reactive write-what-you-read cycle errors instead of livelocking', async () => {
  const messages: VmToHostMessage[] = [];
  const { modules, entryPath } = buildDomjsModules({
    entry: `
    const s = state({ go: 0, a: 0, b: 0 });
    const root = document.createElement('div');
    // Dormant mutual cycle: harmless at build (go=0); once go=1, binding A
    // writes b and binding B writes a, re-triggering each other forever.
    const label = document.createElement('p');
    label.textContent = () => { if (s.go) { s.b = s.a + 1; } return String(s.a); };
    const other = document.createElement('p');
    other.textContent = () => { if (s.go) { s.a = s.b + 1; } return String(s.b); };
    const btn = document.createElement('button');
    btn.addEventListener('click', () => { s.go = 1; });
    root.append(label, other, btn);
    export default root;
    `,
  });
  const runner = await createVmRunner({
    modules,
    entryPath,
    onMessage: (m) => messages.push(m),
    dispatchBudgetMs: 5000,
  });

  // Find the click handler id from the render tree.
  const render = messages.find((m) => m.type === 'render') as
    | { tree: { children?: unknown[] } }
    | undefined;
  assert.ok(render, 'surface should render');
  const handlerId = findFirstHandler(render.tree);
  assert.ok(handlerId, 'button handler should be registered');

  await runner.dispatch({
    type: 'event',
    payload: { handlerId, event: { type: 'click', currentTargetId: 'snode:1' } },
  });
  runner.destroy();

  const cycleError = messages.find(
    (m) => m.type === 'error' && /reactive update cycle/.test((m as { error: string }).error),
  );
  assert.ok(cycleError, 'the cycle must surface as a domjs cycle error, not a hang');
});

test('a malformed VM message surfaces as a protocol error, not silence', async () => {
  const messages: VmToHostMessage[] = [];
  const runner = await makeRunner(
    `
    import { sendRaw } from 'surface-vm:core';
    sendRaw('this is not json {');
    `,
    (m) => messages.push(m),
  );
  runner.destroy();

  const malformed = messages.find(
    (m) => m.type === 'error' && /malformed VM message/.test((m as { error: string }).error),
  );
  assert.ok(malformed, 'malformed messages must be surfaced');
});

function findFirstHandler(node: any): string | null {
  if (!node || typeof node !== 'object') return null;
  if (node.events) {
    for (const id of Object.values(node.events)) return id as string;
  }
  for (const child of node.children ?? []) {
    const found = findFirstHandler(child);
    if (found) return found;
  }
  return null;
}
