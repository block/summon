import assert from 'node:assert/strict';
import test from 'node:test';
import { createEventStore } from '@summon-internal/devtools';
import {
  resolveSummonSurfaceToolCall,
  scopeTokenCss,
  shadowSurfaceCss,
} from '../src/summon-surface.ts';

test('surface bridge rejects a granted tool without a host handler', async () => {
  const events = createEventStore();
  const rejections: Array<{ reason: string; raw: unknown }> = [];

  const result = await resolveSummonSurfaceToolCall({
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

test('surface bridge resolves a granted tool through the supplied host handler', async () => {
  const events = createEventStore();

  const result = await resolveSummonSurfaceToolCall({
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

test('surface token CSS scopes fingerprint element selectors to the surface root', () => {
  const scoped = scopeTokenCss(`
/* token source header */
:root {
  --color-text: #111;
}

html, body {
  margin: 0;
}

button, input, textarea::placeholder, a:hover, strong, b {
  color: var(--color-text);
}

/* nested rules keep the same surface boundary */
@media (min-width: 40rem) {
  body {
    background: black;
  }

  button, a:focus-visible {
    outline: 1px solid currentColor;
  }
}

@keyframes pulse {
  from { opacity: 0; }
  to { opacity: 1; }
}
`, 'surface-1');

  assert.match(scoped, /\/\* token source header \*\/\s*\[data-summon-surface="surface-1"\]\s*\{\s*--color-text: #111;/);
  assert.match(scoped, /\[data-summon-surface="surface-1"\], \[data-summon-surface="surface-1"\]\s*\{\s*margin: 0;/);
  assert.match(scoped, /\[data-summon-surface="surface-1"\] button, \[data-summon-surface="surface-1"\] input, \[data-summon-surface="surface-1"\] textarea::placeholder, \[data-summon-surface="surface-1"\] a:hover, \[data-summon-surface="surface-1"\] strong, \[data-summon-surface="surface-1"\] b\s*\{/);
  assert.match(scoped, /@media \(min-width: 40rem\)\s*\{\s*\[data-summon-surface="surface-1"\]\s*\{\s*background: black;/);
  assert.match(scoped, /\[data-summon-surface="surface-1"\] button, \[data-summon-surface="surface-1"\] a:focus-visible\s*\{\s*outline:/);
  assert.match(scoped, /@keyframes pulse\s*\{\s*from \{ opacity: 0; \}\s*to \{ opacity: 1; \}\s*\}/);
  assert.doesNotMatch(scoped, /(^|})\s*button\s*,/);
  assert.doesNotMatch(scoped, /(^|})\s*a:hover\s*\{/);
});

test('shadow surface CSS maps document-level selectors without prefixing ordinary selectors', () => {
  const css = shadowSurfaceCss(`
:root {
  --color-text: #111;
}

html, body {
  margin: 0;
}

.card, button:hover {
  color: var(--color-text);
}

@media (min-width: 40rem) {
  body {
    background: black;
  }
}

@keyframes pulse {
  from { opacity: 0; }
  to { opacity: 1; }
}
`);

  assert.match(css, /:host\s*\{\s*--color-text: #111;/);
  assert.match(css, /\.summon-surface-document-mount, \.summon-surface-document-mount\s*\{\s*margin: 0;/);
  assert.match(css, /\.card, button:hover\s*\{\s*color: var\(--color-text\);/);
  assert.match(css, /@media \(min-width: 40rem\)\s*\{\s*\.summon-surface-document-mount\s*\{\s*background: black;/);
  assert.match(css, /@keyframes pulse\s*\{\s*from \{ opacity: 0; \}\s*to \{ opacity: 1; \}\s*\}/);
  assert.doesNotMatch(css, /data-summon-surface/);
});

