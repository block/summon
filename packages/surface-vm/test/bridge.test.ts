// M3.1: the host capability bridge. Round-trip callTool, ungranted rejection,
// plain-data-only enforcement, and state push -> onState. Protocol-boundary
// tests (no DOM).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createVmRunner } from '../src/host/runner.ts';
import { buildDomjsModules } from '../src/engine/domjs/index.ts';
import type { HostBridge, VmToHostMessage, HostToVmMessage } from '../src/protocol.ts';

async function runWithBridge(
  entry: string,
  hostBridge: HostBridge,
): Promise<{ messages: VmToHostMessage[]; dispatch: (m: HostToVmMessage) => Promise<void>; destroy: () => void }> {
  const messages: VmToHostMessage[] = [];
  const { modules, entryPath } = buildDomjsModules({ entry });
  const runner = await createVmRunner({ modules, entryPath, onMessage: (m) => messages.push(m), hostBridge });
  return { messages, dispatch: (m) => runner.dispatch(m), destroy: () => runner.destroy() };
}

function outputs(messages: VmToHostMessage[]): unknown[] {
  return messages.filter((m) => m.type === 'output').map((m) => (m as { payload: unknown }).payload);
}

test('callTool round-trips: VM calls, host runs, VM gets the result', async () => {
  const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
  const bridge: HostBridge = (tool, args) => {
    calls.push({ tool, args });
    return { ok: true, echo: args.value };
  };

  const r = await runWithBridge(
    `
    const btn = document.createElement('button');
    btn.addEventListener('click', async () => {
      const result = await callTool('save', { value: 42 });
      output({ result });
    });
    export default btn;
    `,
    bridge,
  );

  const tree = (r.messages.find((m) => m.type === 'render') as { tree: any }).tree;
  await r.dispatch({ type: 'event', payload: { handlerId: tree.events.click, event: { type: 'click', currentTargetId: tree.id } } });
  // allow the async bridge round trip to settle
  await new Promise((res) => setTimeout(res, 20));
  r.destroy();

  assert.deepEqual(calls, [{ tool: 'save', args: { value: 42 } }]);
  assert.deepEqual(outputs(r.messages), [{ result: { ok: true, echo: 42 } }]);
});

test('ungranted/unknown tool rejection surfaces to the surface code', async () => {
  const bridge: HostBridge = (tool) => {
    throw new Error(`tool "${tool}" is not granted`);
  };

  const r = await runWithBridge(
    `
    const btn = document.createElement('button');
    btn.addEventListener('click', async () => {
      try {
        await callTool('danger', {});
        output({ reached: true });
      } catch (e) {
        output({ rejected: String(e && e.message ? e.message : e) });
      }
    });
    export default btn;
    `,
    bridge,
  );

  const tree = (r.messages.find((m) => m.type === 'render') as { tree: any }).tree;
  await r.dispatch({ type: 'event', payload: { handlerId: tree.events.click, event: { type: 'click', currentTargetId: tree.id } } });
  await new Promise((res) => setTimeout(res, 20));
  r.destroy();

  const out = outputs(r.messages)[0] as { rejected?: string; reached?: boolean };
  assert.equal(out.reached, undefined);
  assert.match(out.rejected ?? '', /not granted/);
});

test('bridge args are plain data only — functions are dropped at the boundary', async () => {
  let receivedArgs: Record<string, unknown> | null = null;
  const bridge: HostBridge = (_tool, args) => {
    receivedArgs = args;
    return null;
  };

  const r = await runWithBridge(
    `
    const btn = document.createElement('button');
    btn.addEventListener('click', async () => {
      await callTool('x', { n: 1, fn: () => 'nope', nested: { ok: true } });
    });
    export default btn;
    `,
    bridge,
  );
  const tree = (r.messages.find((m) => m.type === 'render') as { tree: any }).tree;
  await r.dispatch({ type: 'event', payload: { handlerId: tree.events.click, event: { type: 'click', currentTargetId: tree.id } } });
  await new Promise((res) => setTimeout(res, 20));
  r.destroy();

  assert.deepEqual(receivedArgs, { n: 1, nested: { ok: true } }, 'function arg dropped by JSON boundary');
});

test('state push fires onState and updates getState', async () => {
  const r = await runWithBridge(
    `
    const div = document.createElement('div');
    onState((s) => { output({ onState: s }); });
    const btn = document.createElement('button');
    btn.addEventListener('click', () => { output({ getState: getState() }); });
    div.append(btn);
    export default div;
    `,
    () => null,
  );

  // onState fires once on registration with the initial (empty) state
  await r.dispatch({ type: 'state', state: { count: 5 } });
  await new Promise((res) => setTimeout(res, 10));

  const tree = (r.messages.find((m) => m.type === 'render') as { tree: any }).tree;
  const btn = tree.children.find((c: any) => c.tag === 'button');
  await r.dispatch({ type: 'event', payload: { handlerId: btn.events.click, event: { type: 'click', currentTargetId: btn.id } } });
  await new Promise((res) => setTimeout(res, 10));
  r.destroy();

  const out = outputs(r.messages);
  assert.deepEqual(out[0], { onState: {} });            // initial registration
  assert.deepEqual(out[1], { onState: { count: 5 } });  // after push
  assert.deepEqual(out[out.length - 1], { getState: { count: 5 } });
});

test('host-bridge:summon virtual module resolves for explicit imports', async () => {
  // Generated surfaces author `import { callTool, onState } from "host-bridge:summon"`
  // rather than relying on the ambient globals. The domjs module map must resolve
  // that specifier (matching the Arrow path) instead of throwing
  // "Unknown sandbox module".
  const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
  const bridge: HostBridge = (tool, args) => {
    calls.push({ tool, args });
    return { ok: true };
  };

  const r = await runWithBridge(
    `
    import { callTool, onState } from 'host-bridge:summon';
    onState((s) => { output({ onState: s }); });
    const btn = document.createElement('button');
    btn.addEventListener('click', async () => {
      const result = await callTool('save', { value: 7 });
      output({ result });
    });
    export default btn;
    `,
    bridge,
  );

  // No build-phase error should have been emitted for the import.
  const errors = r.messages.filter((m) => m.type === 'error');
  assert.deepEqual(errors, [], 'import from host-bridge:summon must not error');

  const tree = (r.messages.find((m) => m.type === 'render') as { tree: any }).tree;
  await r.dispatch({ type: 'event', payload: { handlerId: tree.events.click, event: { type: 'click', currentTargetId: tree.id } } });
  await new Promise((res) => setTimeout(res, 20));
  r.destroy();

  assert.deepEqual(calls, [{ tool: 'save', args: { value: 7 } }]);
  assert.deepEqual(outputs(r.messages).at(-1), { result: { ok: true } });
});
