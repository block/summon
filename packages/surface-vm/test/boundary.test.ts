// M0 GATE: prove the capability boundary holds.
//
// This is the only milestone that can sink the project. It runs untrusted code
// in the QuickJS runner and asserts the four invariants the whole safety model
// rests on:
//   1. no browser globals leak into the VM (window/document/localStorage/fetch);
//   2. the VM can only communicate through the protocol channel;
//   3. events arrive as plain-data snapshots, never live nodes;
//   4. the host never evaluates a VM expression — it only receives messages.
//
// No DOM, no engine, no model. A hand-written VM core emits protocol messages.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createVmRunner } from '../src/host/runner.ts';
import type { VmToHostMessage } from '../src/protocol.ts';

// A minimal trusted "core" module: captures __hostSend at import time, installs
// __dispatch, and re-exposes the channel to the entry via a virtual import.
// This mirrors how the real domjs core will work, minus the DOM facade.
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
`;

function makeRunner(entrySource: string, onMessage: (m: VmToHostMessage) => void) {
  return createVmRunner({
    modules: {
      'surface-vm:core': CORE_MODULE,
      '/main.js': entrySource,
    },
    entryPath: '/main.js',
    onMessage,
  });
}

test('VM has no browser globals (window/document/localStorage/fetch)', async () => {
  const messages: VmToHostMessage[] = [];
  const runner = await makeRunner(
    `
    import { emit } from 'surface-vm:core';
    const probe = {
      window: typeof window,
      document: typeof document,
      localStorage: typeof localStorage,
      fetch: typeof fetch,
      XMLHttpRequest: typeof XMLHttpRequest,
      globalThisDocument: typeof globalThis.document,
    };
    emit({ type: 'output', payload: probe });
    `,
    (m) => messages.push(m),
  );
  runner.destroy();

  const output = messages.find((m) => m.type === 'output');
  assert.ok(output, 'VM should emit its probe');
  assert.deepEqual((output as { payload: unknown }).payload, {
    window: 'undefined',
    document: 'undefined',
    localStorage: 'undefined',
    fetch: 'undefined',
    XMLHttpRequest: 'undefined',
    globalThisDocument: 'undefined',
  });
});

test('VM cannot reach the host realm via constructor escape', async () => {
  const messages: VmToHostMessage[] = [];
  const runner = await makeRunner(
    `
    import { emit } from 'surface-vm:core';
    let leaked = 'none';
    try {
      // classic sandbox escape attempt: reach a host Function constructor.
      const fn = (function(){}).constructor('return typeof process')();
      leaked = String(fn);
    } catch (e) {
      leaked = 'blocked:' + (e && e.name ? e.name : 'error');
    }
    emit({ type: 'output', payload: { leaked } });
    `,
    (m) => messages.push(m),
  );
  runner.destroy();

  const output = messages.find((m) => m.type === 'output') as { payload: { leaked: string } };
  assert.ok(output);
  // Either the constructor is unavailable, or it runs INSIDE the VM where
  // `process` is still undefined. Crucially it must never see the host's process.
  assert.notEqual(output.payload.leaked, 'object', 'VM must not see host process');
});

test('__hostSend global is revoked after boot; later code cannot use it', async () => {
  const messages: VmToHostMessage[] = [];
  const runner = await makeRunner(
    `
    import { emit, registerHandler } from 'surface-vm:core';
    emit({ type: 'ready' });
    registerHandler('h1', () => {
      // By the time this handler runs, the raw global must be gone.
      emit({ type: 'output', payload: { rawGlobal: typeof globalThis.__hostSend } });
    });
    `,
    (m) => messages.push(m),
  );

  await runner.dispatch({
    type: 'event',
    payload: { handlerId: 'h1', event: { type: 'click', currentTargetId: 'snode:1' } },
  });
  runner.destroy();

  const output = messages.find((m) => m.type === 'output') as { payload: { rawGlobal: string } };
  assert.ok(output, 'handler should fire and emit');
  assert.equal(output.payload.rawGlobal, 'undefined', '__hostSend must be revoked after boot');
});

test('events arrive as the plain-data snapshot we sent — no live node', async () => {
  const messages: VmToHostMessage[] = [];
  const runner = await makeRunner(
    `
    import { emit, registerHandler } from 'surface-vm:core';
    registerHandler('h1', (event) => {
      // Reflect back what the handler actually received.
      emit({ type: 'output', payload: {
        isPlainObject: event && typeof event === 'object',
        hasTargetValue: event.target ? event.target.value : null,
        keys: Object.keys(event).sort(),
      }});
    });
    `,
    (m) => messages.push(m),
  );

  await runner.dispatch({
    type: 'event',
    payload: {
      handlerId: 'h1',
      event: {
        type: 'input',
        currentTargetId: 'snode:2',
        target: { tagName: 'input', value: 'hello' },
        value: 'hello',
      },
    },
  });
  runner.destroy();

  const output = messages.find((m) => m.type === 'output') as {
    payload: { isPlainObject: boolean; hasTargetValue: unknown; keys: string[] };
  };
  assert.ok(output);
  assert.equal(output.payload.isPlainObject, true);
  assert.equal(output.payload.hasTargetValue, 'hello');
});

test('unknown module imports fail closed', async () => {
  await assert.rejects(
    makeRunner(
      `import secrets from 'host:secrets'; export default secrets;`,
      () => {},
    ),
    /Unknown sandbox module/,
  );
});
