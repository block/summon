import assert from 'node:assert/strict';
import test from 'node:test';
import { parseToolPack } from './tool-pack.js';

test('parseToolPack preserves valid surface metadata', () => {
  const pack = parseToolPack({
    tools: [
      {
        name: 'analysis',
        description: 'Run worker analysis.',
        argsSchema: '{topic: string}',
        stateShape: '{}',
        kind: 'resource',
        triggers: ['submit', 'mount'],
        stateKeys: { loading: 'loading', data: 'data', error: 'error' },
        surface: { data: 'worker', authority: 'read' },
      },
      {
        name: 'publish_summary',
        description: 'Publish after approval.',
        argsSchema: '{title: string}',
        stateShape: '{}',
        kind: 'action',
        surface: { authority: 'approval-gated' },
      },
    ],
  });

  assert.deepEqual(pack?.tools.map((tool) => tool.surface), [
    { data: 'worker', authority: 'read' },
    { authority: 'approval-gated' },
  ]);
});

test('parseToolPack drops invalid surface fields without dropping tool', () => {
  const pack = parseToolPack({
    tools: [
      {
        name: 'lookup',
        description: 'Lookup something.',
        argsSchema: '{query: string}',
        stateShape: '{}',
        kind: 'resource',
        surface: { data: 'browser', authority: 'admin' },
      },
      {
        name: 'mixed',
        description: 'Partially valid surface.',
        argsSchema: '{}',
        stateShape: '{}',
        surface: { data: 'worker', authority: 'admin' },
      },
    ],
  });

  assert.equal(pack?.tools.length, 2);
  assert.equal(pack?.tools[0]?.surface, undefined);
  assert.deepEqual(pack?.tools[1]?.surface, { data: 'worker' });
});
