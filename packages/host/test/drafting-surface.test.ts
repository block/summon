// Drafting surface: the host-owned, fingerprint-derived generation-time
// presentation. Contract: docs/spec/surface-document.md "Generation-time
// presentation". Covers token derivation, lifecycle edges including repair
// re-entry, the no-redraw-after-render guard, and the drafting -> rendered
// handoff.

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

import assert from 'node:assert/strict';
import test from 'node:test';
import { mountSummonSurface } from '../src/summon-surface.ts';
import type { SurfaceDocumentArtifact } from '@summon-internal/engine';

function makeRoot(): HTMLElement {
  window.document.body.innerHTML = '';
  const root = window.document.createElement('div');
  window.document.body.append(root);
  return root as unknown as HTMLElement;
}

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));

const artifact: SurfaceDocumentArtifact = {
  runtime: 'surface-document',
  source: {
    'main.html': '<main><h1>Done</h1></main>',
    'main.css': 'main { color: var(--color-text); }',
  },
};

function draftingRoot(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>('[data-summon-preview-root]');
}

test('mounting without an artifact renders the drafting surface immediately', () => {
  const root = makeRoot();
  const handle = mountSummonSurface({ root, grantedTools: [] });

  const drafting = draftingRoot(root);
  assert.ok(drafting, 'drafting surface should paint at t=0');
  assert.equal(drafting.getAttribute('role'), 'status');
  assert.equal(drafting.getAttribute('aria-live'), 'polite');
  assert.ok(drafting.querySelector('.summon-drafting__mark'), 'fingerprint mark should exist');
  assert.equal(handle.lifecycle(), 'preview');
  handle.dispose();
});

test('drafting styles derive from the fingerprint token source', () => {
  const root = makeRoot();
  const handle = mountSummonSurface({
    root,
    grantedTools: [],
    tokensSource: ':root { --color-accent: #ff2244; --radius-sm: 9px; }',
  });

  const style = root.querySelector<HTMLStyleElement>('style[data-summon-surface-tokens]');
  assert.ok(style);
  // The scoped token css and the drafting css live in the same style element:
  // the drafting treatment consumes accent/radius/shadow/type tokens.
  assert.match(style.textContent ?? '', /--color-accent: #ff2244/);
  assert.match(style.textContent ?? '', /var\(--color-accent/);
  assert.match(style.textContent ?? '', /var\(--radius-sm/);
  assert.match(style.textContent ?? '', /var\(--tracking-display/);
  assert.match(style.textContent ?? '', /prefers-reduced-motion/);
  handle.dispose();
});

test('status events drive the drafting copy', () => {
  const root = makeRoot();
  const handle = mountSummonSurface({ root, grantedTools: [] });

  handle.applyPreviewEvent({ type: 'surface.status', status: 'drafting', text: 'Composing Surface Document bundle' });
  const drafting = draftingRoot(root);
  assert.ok(drafting);
  assert.equal(drafting.dataset.summonDraftingPhase, 'drafting');
  assert.equal(
    drafting.querySelector('.summon-drafting__detail')?.textContent,
    'Composing Surface Document bundle',
  );
  handle.dispose();
});

test('a backwards phase transition marks the drafting surface as repairing', () => {
  const root = makeRoot();
  const handle = mountSummonSurface({ root, grantedTools: [] });

  handle.applyPreviewEvent({ type: 'surface.status', status: 'drafting' });
  handle.applyPreviewEvent({ type: 'surface.status', status: 'validating' });
  assert.equal(draftingRoot(root)?.dataset.summonDraftingRepair, undefined, 'forward progress is not repair');

  handle.applyPreviewEvent({ type: 'surface.status', status: 'rendering' });
  handle.applyPreviewEvent({ type: 'surface.status', status: 'validating', text: 'Repairing Surface Document bundle' });
  const drafting = draftingRoot(root);
  assert.equal(drafting?.dataset.summonDraftingRepair, 'true', 'rendering -> validating is repair re-entry');
  assert.equal(drafting?.dataset.summonDraftingPhase, 'validating');
  handle.dispose();
});

test('rendering an artifact completes the handoff and removes the drafting surface', async () => {
  const root = makeRoot();
  const handle = mountSummonSurface({ root, grantedTools: [] });
  handle.applyPreviewEvent({ type: 'surface.status', status: 'drafting' });
  assert.ok(draftingRoot(root));

  handle.renderArtifact(artifact);
  // During the async mount the drafting surface must still be present — no blank frame.
  assert.ok(draftingRoot(root), 'drafting stays in place while the VM mounts');
  assert.equal(handle.lifecycle(), 'rendering');

  await wait(500); // covers the transition-fallback removal timer
  assert.equal(handle.lifecycle(), 'rendered');
  assert.equal(draftingRoot(root), null, 'drafting surface departs after render');
  const host = root.querySelector<HTMLElement>('.summon-surface-document-host');
  assert.ok(host);
  assert.equal(host.dataset.summonEntering, undefined, 'entering flag cleared on handoff');
  handle.dispose();
});

test('late status events do not redraw drafting over a rendered surface', async () => {
  const root = makeRoot();
  const handle = mountSummonSurface({ root, artifact, grantedTools: [] });
  await wait(500);
  assert.equal(handle.lifecycle(), 'rendered');

  handle.applyPreviewEvent({ type: 'surface.status', status: 'finalizing', text: 'late' });
  assert.equal(draftingRoot(root), null, 'rendered surface is immune to late status events');
  assert.ok(root.querySelector('.summon-surface-document-host'));
  handle.dispose();
});

test('a failed render re-enters drafting on the next status event', async () => {
  const root = makeRoot();
  const failing: SurfaceDocumentArtifact = {
    runtime: 'surface-document',
    source: {
      'main.html': '<div id="x">x</div>',
      'main.css': 'div { color: var(--color-text); }',
      'main.js': `document.getElementById('x').innerHTML = 'nope';`,
    },
  };
  const handle = mountSummonSurface({ root, artifact: failing, grantedTools: [], onRuntimeError: () => {} });
  await wait();
  assert.equal(handle.lifecycle(), 'failed');
  assert.ok(root.querySelector('.summon-runtime-error'));

  handle.applyPreviewEvent({ type: 'surface.status', status: 'validating', text: 'Repairing Surface Document bundle' });
  assert.ok(draftingRoot(root), 'drafting re-enters during repair');
  assert.equal(root.querySelector('.summon-runtime-error'), null, 'error card is superseded by drafting');
  handle.dispose();
});
