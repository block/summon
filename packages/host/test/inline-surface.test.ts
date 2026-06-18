import assert from 'node:assert/strict';
import test from 'node:test';
import { createEventStore } from '@summon-internal/devtools';
import { resolveInlineToolCall } from '../src/inline-surface.ts';

test('inline bridge rejects a granted tool without a host handler', async () => {
  const events = createEventStore();
  const rejections: Array<{ reason: string; raw: unknown }> = [];

  const result = await resolveInlineToolCall({
    surfaceId: 'surface-1',
    toolAllowlist: new Set(['search']),
    currentState: { searchResults: [] },
    tool: 'search',
    rawArgs: { query: 'pasta' },
    events,
    onToolRejected: (reason, raw) => rejections.push({ reason, raw }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'tool "search" has no host handler');
  assert.deepEqual(result.state, { searchResults: [] });
  assert.equal(result.stateChanged, false);
  assert.equal(events.filter('tool-called').length, 0);
  assert.deepEqual(events.filter('tool-rejected').map((event) => event.reason), [
    'tool "search" has no host handler',
  ]);
  assert.deepEqual(rejections, [{
    reason: 'tool "search" has no host handler',
    raw: { tool: 'search', args: { query: 'pasta' } },
  }]);
});

test('inline bridge resolves a granted tool through the supplied host handler', async () => {
  const events = createEventStore();

  const result = await resolveInlineToolCall({
    surfaceId: 'surface-2',
    toolAllowlist: new Set(['search']),
    currentState: { searchResults: [] },
    tool: 'search',
    rawArgs: { query: 'pasta' },
    events,
    onToolCall: (_tool, args) => ({
      searchResults: [{ id: '1', title: String(args.query) }],
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.state, {
    searchResults: [{ id: '1', title: 'pasta' }],
  });
  assert.equal(result.stateChanged, true);
  assert.deepEqual(events.filter('tool-called').map((event) => event.tool), ['search']);
  assert.equal(events.filter('tool-rejected').length, 0);
});
