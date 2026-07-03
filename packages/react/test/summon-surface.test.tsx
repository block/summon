import assert from 'node:assert/strict';
import test from 'node:test';
import { Window } from 'happy-dom';

const window = new Window({ url: 'http://localhost/' });
const g = globalThis as unknown as Record<string, unknown>;
g.window = window;
g.document = window.document;
g.Element = window.Element;
g.Node = window.Node;
g.Comment = window.Comment;
g.Event = window.Event;
g.MouseEvent = window.MouseEvent;
g.KeyboardEvent = window.KeyboardEvent;
g.HTMLElement = window.HTMLElement;
g.HTMLStyleElement = window.HTMLStyleElement;
g.ShadowRoot = window.ShadowRoot;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });

const { createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
import type { SummonSurfaceHandle, SummonRenderableArtifact } from '../src/index.ts';

const { SummonSurface } = await import('../src/index.ts');

const wait = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(assertion: () => void, timeoutMs = 1000): Promise<void> {
  const started = Date.now();
  let lastError: unknown;
  while (Date.now() - started < timeoutMs) {
    try {
      assertion();
      return;
    } catch (err) {
      lastError = err;
      await wait(20);
    }
  }
  if (lastError) throw lastError;
  assertion();
}

function makeRoot(): HTMLElement {
  window.document.body.innerHTML = '';
  const root = window.document.createElement('div');
  window.document.body.append(root);
  return root as unknown as HTMLElement;
}

function surfaceDocumentShadowRoot(root: HTMLElement): ShadowRoot {
  const surfaceHost = root.querySelector('.summon-surface-document-host') as HTMLElement | null;
  assert.ok(surfaceHost, 'Surface Document shadow host should be mounted');
  assert.ok(surfaceHost.shadowRoot, 'Surface Document should render into an open shadow root');
  return surfaceHost.shadowRoot;
}

test('SummonSurface mounts a Surface Document artifact and exposes the imperative handle', async () => {
  const root = makeRoot();
  let handle: SummonSurfaceHandle | null = null;
  const renderedEvents: string[] = [];
  const toolCalls: Array<{ tool: string; args: Record<string, unknown> }> = [];

  const artifact: SummonRenderableArtifact = {
    runtime: 'surface-document',
    source: {
      'main.html': '<main><p id="status">idle</p><button id="save">Save</button></main>',
      'main.css': 'main { color: var(--color-text); }',
      'main.js': `
        const s = state({ status: 'idle' });
        document.getElementById('status').textContent = () => s.status;
        document.getElementById('save').onclick = async () => {
          const result = await callTool('save', { value: 2 });
          s.status = String(result.state.status ?? 'missing');
        };
      `,
    },
  };

  const reactRoot = createRoot(root);
  reactRoot.render(createElement(SummonSurface, {
    artifact,
    grantedTools: ['save'],
    tokensSource: ':root { --color-text: #111; }',
    onEvent: (event) => renderedEvents.push(event.kind),
    onToolCall: (tool, args) => {
      toolCalls.push({ tool, args });
      return { status: 'saved' };
    },
    ref: (value: SummonSurfaceHandle | null) => {
      handle = value;
    },
  }));

  await waitFor(() => {
    assert.ok(handle, 'imperative handle should be assigned');
    assert.ok(renderedEvents.includes('rendered'), 'surface should report rendered');
    assert.equal(surfaceDocumentShadowRoot(root).querySelector('#status')?.textContent, 'idle');
  });

  handle?.pushState({ status: 'external' });

  const button = surfaceDocumentShadowRoot(root).querySelector('#save') as unknown as HTMLElement;
  button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }) as unknown as Event);

  await waitFor(() => {
    assert.deepEqual(toolCalls, [{ tool: 'save', args: { value: 2 } }]);
    assert.equal(surfaceDocumentShadowRoot(root).querySelector('#status')?.textContent, 'saved');
  });

  reactRoot.unmount();
});
