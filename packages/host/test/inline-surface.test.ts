import assert from 'node:assert/strict';
import test from 'node:test';
import { createEventStore } from '@summon-internal/devtools';
import {
  HTML_IFRAME_SANDBOX,
  buildHtmlPreviewCsp,
  buildHtmlPreviewSrcdoc,
  buildHtmlSandboxCsp,
  buildHtmlSandboxSrcdoc,
  parseHtmlSandboxMessage,
  resolveInlineToolCall,
  scopeTokenCss,
} from '../src/inline-surface.ts';

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

test('HTML iframe srcdoc uses strict sandbox and nonce-bound CSP', () => {
  assert.equal(HTML_IFRAME_SANDBOX, 'allow-scripts');
  const csp = buildHtmlSandboxCsp('nonce-1');
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /connect-src 'none'/);
  assert.match(csp, /script-src 'nonce-nonce-1'/);
  assert.doesNotMatch(csp, /allow-same-origin/);

  const srcdoc = buildHtmlSandboxSrcdoc({
    sandboxId: 'surface-1-1',
    bootstrapNonce: 'nonce-1',
    tokensSource: ':root { --color-text: #111; }',
    artifact: {
      runtime: 'html',
      source: {
        'body.html': '<section id="hero"><h1>Ready</h1></section>',
        'main.css': '#hero { color: var(--color-text); }',
      },
    },
  });
  assert.match(srcdoc, /Content-Security-Policy/);
  assert.match(srcdoc, /<main id="summon-html-root"><section id="hero">/);
  assert.match(srcdoc, /SUMMON_HTML_READY/);
  assert.doesNotMatch(srcdoc, /allow-same-origin/);
});

test('HTML stream preview srcdoc is inert and scriptless', () => {
  const csp = buildHtmlPreviewCsp();
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /connect-src 'none'/);
  assert.match(csp, /script-src 'none'/);

  const srcdoc = buildHtmlPreviewSrcdoc({
    tokensSource: ':root { --color-text: #111; }',
    bodyHtml: '<section id="hero"><script>window.evil = true</script><h1>Preview</h1></section>',
  });
  assert.match(srcdoc, /Content-Security-Policy/);
  assert.match(srcdoc, /script-src 'none'/);
  assert.match(srcdoc, /summon-html-stream-preview-root/);
  assert.match(srcdoc, /<h1>Preview<\/h1>/);
});

test('inline token CSS scopes fingerprint element selectors to the surface root', () => {
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

  assert.match(scoped, /\/\* token source header \*\/\s*\[data-summon-inline-surface="surface-1"\]\s*\{\s*--color-text: #111;/);
  assert.match(scoped, /\[data-summon-inline-surface="surface-1"\], \[data-summon-inline-surface="surface-1"\]\s*\{\s*margin: 0;/);
  assert.match(scoped, /\[data-summon-inline-surface="surface-1"\] button, \[data-summon-inline-surface="surface-1"\] input, \[data-summon-inline-surface="surface-1"\] textarea::placeholder, \[data-summon-inline-surface="surface-1"\] a:hover, \[data-summon-inline-surface="surface-1"\] strong, \[data-summon-inline-surface="surface-1"\] b\s*\{/);
  assert.match(scoped, /@media \(min-width: 40rem\)\s*\{\s*\[data-summon-inline-surface="surface-1"\]\s*\{\s*background: black;/);
  assert.match(scoped, /\[data-summon-inline-surface="surface-1"\] button, \[data-summon-inline-surface="surface-1"\] a:focus-visible\s*\{\s*outline:/);
  assert.match(scoped, /@keyframes pulse\s*\{\s*from \{ opacity: 0; \}\s*to \{ opacity: 1; \}\s*\}/);
  assert.doesNotMatch(scoped, /(^|})\s*button\s*,/);
  assert.doesNotMatch(scoped, /(^|})\s*a:hover\s*\{/);
});

test('HTML iframe message parser rejects forged messages', () => {
  assert.equal(parseHtmlSandboxMessage({ type: 'SUMMON_HTML_READY', sandboxId: 'wrong' }, 'surface-1'), null);
  assert.deepEqual(
    parseHtmlSandboxMessage({ type: 'SUMMON_HTML_READY', sandboxId: 'surface-1' }, 'surface-1'),
    { type: 'SUMMON_HTML_READY', sandboxId: 'surface-1' },
  );
  assert.deepEqual(
    parseHtmlSandboxMessage({
      type: 'SUMMON_HTML_TOOL',
      sandboxId: 'surface-1',
      requestId: 'r1',
      tool: 'choose',
      args: { id: 'a' },
    }, 'surface-1'),
    {
      type: 'SUMMON_HTML_TOOL',
      sandboxId: 'surface-1',
      requestId: 'r1',
      tool: 'choose',
      args: { id: 'a' },
    },
  );
  assert.equal(parseHtmlSandboxMessage({ type: 'SUMMON_HTML_TOOL', sandboxId: 'surface-1', tool: 'choose' }, 'surface-1'), null);
});
