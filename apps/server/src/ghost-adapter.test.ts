import { strict as assert } from 'node:assert';
import { afterEach, describe, it } from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildGhostReviewPacket,
  parseGhostRequest,
  parseGhostRoots,
  prepareGhostSurfacePrompt,
  resolveGhostContext,
  resolveGhostSteer,
  selectGhostSurface,
} from './ghost-adapter.js';
import { assembleGraph } from '@anarchitecture/ghost/core';

const fixtureRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    fixtureRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('Ghost adapter', () => {
  it('parses trusted roots and rejects unsafe or unsupported request paths', async () => {
    const root = await makeGhostFixture();
    const roots = parseGhostRoots(`checkout=${root}`);

    assert.equal(roots.get('checkout'), resolve(root));
    assert.deepEqual(parseGhostRequest({ rootId: 'missing' }, roots), {
      ok: false,
      error: 'unknown Ghost root "missing"',
    });
    assert.deepEqual(parseGhostRequest({ rootId: 'checkout', targetPath: '/tmp' }, roots), {
      ok: false,
      error: 'ghost.targetPath must be relative',
    });
    assert.deepEqual(parseGhostRequest({ rootId: 'checkout', targetPath: '../outside' }, roots), {
      ok: false,
      error: 'ghost.targetPath must not contain path traversal segments',
    });
    assert.deepEqual(parseGhostRequest({ rootId: 'checkout', targetPath: 'a/../b' }, roots), {
      ok: false,
      error: 'ghost.targetPath must not contain path traversal segments',
    });
    assert.deepEqual(parseGhostRequest({ source: 'resolved-context', prompt: 'legacy' }, roots), {
      ok: false,
      error: 'ghost.source must be "root"; resolved-context is no longer supported',
    });

    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.ok ? parsed.request : null, {
      source: 'root',
      rootId: 'checkout',
      targetPath: '.',
      memoryDir: null,
      baseDirectionId: null,
    });

    const withBase = parseGhostRequest({
      rootId: 'checkout',
      targetPath: 'app',
      memoryDir: '.ghost',
      baseDirectionId: 'ghost',
    }, roots);
    assert.equal(withBase.ok, true);
    assert.deepEqual(withBase.ok ? withBase.request : null, {
      source: 'root',
      rootId: 'checkout',
      targetPath: 'app',
      memoryDir: '.ghost',
      baseDirectionId: 'ghost',
    });
    assert.deepEqual(parseGhostRequest({ rootId: 'checkout', baseDirectionId: '../ghost' }, roots), {
      ok: false,
      error: 'ghost.baseDirectionId must be a valid direction id',
    });
  });

  it('loads the fingerprint graph and resolves the core slice into prompt context and token CSS', async () => {
    const root = await makeGhostFixture();
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');

    const ctx = await resolveGhostContext(parsed.request, roots);

    assert.equal(ctx.source, 'root');
    assert.equal(ctx.surface, 'core');
    assert.equal(ctx.root, resolve(root));
    // graph loaded
    assert.ok(ctx.graph.nodes.size >= 1);
    // slice resolves the core node
    assert.equal(ctx.slice.surface, 'core');
    assert.ok(ctx.slice.nodes.some((node) => node.id === 'core'));
    assert.equal(ctx.product, 'checkout');
    assert.match(ctx.prompt, /# Ghost Fingerprint/);
    // cascade line + provenance-labeled core node
    assert.match(ctx.prompt, /Cascade: core/);
    assert.match(ctx.prompt, /## core — own/);
    assert.match(ctx.prompt, /Preserve quiet density/);
    // token CSS comes from the fenced css block in the core node body
    assert.equal(ctx.tokenSource.kind, 'ghost-config');
    assert.equal(ctx.tokenSource.source, 'fingerprint:core');
    assert.match(ctx.tokenSource.css, /--color-bg/);
    // The fingerprint prose is the ONLY place the model sees the token CSS:
    // activeTokensCss is consumed for validation + sandbox injection, never
    // rendered into the system prompt. So the fenced css block stays in the
    // rendered fingerprint prose, and the values also flow via tokenSource.css.
    assert.match(ctx.prompt, /```css/);
    assert.match(ctx.prompt, /--color-bg/);
  });

  it('appends a Summon surface brief to the slice prompt', async () => {
    const root = await makeGhostFixture();
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');

    const ctx = await resolveGhostContext(parsed.request, roots);
    const prepared = prepareGhostSurfacePrompt(ctx, {
      userPrompt: 'show checkout queue status',
      mode: 'static',
      surfacePlan: {
        purpose: 'inform',
        runtime: 'arrow',
        data: 'embedded',
        authority: 'none',
        persistence: 'replayable',
      },
    });

    assert.equal(prepared.source, 'root');
    assert.match(prepared.prompt, /# Ghost Fingerprint/);
    assert.match(prepared.prompt, /## Summon Surface Brief/);
    assert.match(prepared.prompt, /Surface plan: purpose=inform; runtime=arrow; data=embedded; authority=none; persistence=replayable/);
    assert.match(prepared.prompt, /Output runtime: arrow-control/);
    assert.match(prepared.prompt, /structured Arrow sandbox bundle/);
    assert.match(prepared.prompt, /Do not emit Summon stream lines, transport records, Markdown, code fences, or host-owned metadata/);
    assert.match(prepared.prompt, /The agent broker controls host authority and tools/);
    assert.match(prepared.prompt, /The user request is the semantic and task authority/);
    assert.match(prepared.prompt, /The Ghost fingerprint is the visual and composition authority/);
    assert.match(prepared.prompt, /Fingerprint surface: core \(cascade: core\)/);
    assert.match(prepared.prompt, /Gathered nodes: core \(own\)/);
  });

  it('selects core for single-surface graphs and matches by menu for multi-surface', () => {
    const single = assembleGraph({
      placedNodes: [
        { id: 'core', folder: '', doc: { frontmatter: {}, body: 'root prose' } },
      ],
    });
    assert.equal(selectGhostSurface(single, 'anything goes here'), 'core');

    const multi = assembleGraph({
      placedNodes: [
        { id: 'core', folder: '', doc: { frontmatter: {}, body: 'root prose' } },
        {
          id: 'dashboard',
          parent: 'core',
          folder: 'dashboard',
          doc: {
            frontmatter: { description: 'Operational dashboard for queue metrics' },
            body: 'dashboard prose',
          },
        },
        {
          id: 'editor',
          parent: 'core',
          folder: 'editor',
          doc: {
            frontmatter: { description: 'Document editor with rich text composition' },
            body: 'editor prose',
          },
        },
      ],
    });
    // prompt overlaps "dashboard" / "queue" → dashboard wins
    assert.equal(selectGhostSurface(multi, 'build a queue dashboard'), 'dashboard');
    // prompt overlaps "editor" / "document" → editor wins
    assert.equal(selectGhostSurface(multi, 'a document editor surface'), 'editor');
    // no overlap → fall back to core
    assert.equal(selectGhostSurface(multi, 'completely unrelated zzz'), 'core');
  });

  it('uses HTML output wording in the Summon surface brief when requested', async () => {
    const root = await makeGhostFixture();
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');

    const ctx = await resolveGhostContext(parsed.request, roots);
    const prepared = prepareGhostSurfacePrompt(ctx, {
      userPrompt: 'show checkout queue status',
      mode: 'static',
      outputRuntime: 'html-static',
      surfacePlan: {
        purpose: 'inform',
        runtime: 'arrow',
        data: 'embedded',
        authority: 'none',
        persistence: 'replayable',
      },
    });

    assert.match(prepared.prompt, /Output runtime: html-static/);
    assert.match(prepared.prompt, /structured HTML\/CSS sandbox bundle/);
    assert.match(prepared.prompt, /create_summon_html_surface/);
    assert.match(prepared.prompt, /final HTML artifact/);
    assert.doesNotMatch(prepared.prompt, /structured Arrow sandbox bundle/);
    assert.doesNotMatch(prepared.prompt, /create_summon_arrow_surface/);
    assert.doesNotMatch(prepared.prompt, /final Arrow artifact/);
  });

  it('extracts arbitrary fingerprint token CSS from the core node body', async () => {
    const tokenCss = ':root { --paper: #faf7ed; --ink: #16130f; --moss: #718c5a; --breathing-room: 28px; --soft-corner: 18px; }';
    const root = await makeGhostFixture({ tokenCss });
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');

    const ctx = await resolveGhostContext(parsed.request, roots);

    assert.equal(ctx.tokenSource.kind, 'ghost-config');
    assert.match(ctx.tokenSource.css, /--paper: #faf7ed/);
    assert.match(ctx.tokenSource.css, /--soft-corner: 18px/);
    assert.match(ctx.tokenSource.css, /--moss: #718c5a/);
  });

  it('carries base direction id through the resolved context', async () => {
    const root = await makeGhostFixture();
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout', baseDirectionId: 'ghost' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');

    const ctx = await resolveGhostSteer(parsed.request, roots, {
      id: 'ghost',
      tokensCss: ':root { --color-bg: #000; }',
    });

    assert.equal(ctx.baseDirectionId, 'ghost');
    assert.equal(ctx.tokenSource.kind, 'ghost-config');
    assert.equal(ctx.tokenSource.source, 'fingerprint:core');
  });

  it('builds review packet metadata from the slice and accepted Arrow artifacts', async () => {
    const root = await makeGhostFixture();
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');
    const ctx = await resolveGhostContext(parsed.request, roots);

    const packet = buildGhostReviewPacket({
      context: ctx,
      mode: 'static',
      layoutId: 'card-structured',
      prompt: 'show the state of the queue',
      validation: { blocked: 0, warnings: 1, codes: { 'unknown-token': 1 } },
      acceptedLines: [
        {
          op: 'artifact',
          path: '/artifact',
          value: {
            runtime: 'arrow',
            source: {
              'main.ts': 'export default html`<h1>Queue</h1>`',
              'main.css': 'h1 { color: var(--color-text); }',
            },
          },
        },
      ],
    });

    assert.equal(packet.schema, 'summon.ghost-fingerprint-generation/v1');
    assert.equal(packet.source, 'root');
    assert.equal(packet.rootId, 'checkout');
    assert.equal(packet.product, 'checkout');
    assert.equal(packet.surface, 'core');
    assert.ok(packet.gatheredNodes.includes('core'));
    assert.equal(packet.baseDirectionId, null);
    assert.equal(packet.styleSource, 'ghost-config');
    assert.equal(packet.artifactRuntime, 'arrow');
    assert.deepEqual(packet.artifactFiles, ['main.css', 'main.ts']);
    // reduced packet drops every relay-derived field
    assert.equal('fingerprintProvenance' in packet, false);
    assert.equal('taskContract' in packet, false);
    assert.equal('suggestedReads' in packet, false);
    assert.equal('layers' in packet, false);
    assert.equal('tokenSource' in packet, false);
  });
});

async function makeGhostFixture(options: { tokenCss?: string } = {}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'summon-ghost-adapter-'));
  fixtureRoots.push(root);
  const ghostDir = join(root, '.ghost');
  await mkdir(ghostDir, { recursive: true });
  await writeFile(
    join(ghostDir, 'manifest.yml'),
    `schema: ghost.fingerprint-package/v1
id: test-product
`,
  );
  const css = options.tokenCss ?? await readDefaultTokensCss();
  await writeFile(join(ghostDir, 'index.md'), ghostIndexMarkdown(css));
  return root;
}

function ghostIndexMarkdown(css: string): string {
  return `---
description: Test fingerprint — quiet operational density for checkout surfaces.
---

## Intent

Preserve quiet density and clear hierarchy. Status surfaces foreground current
state. Surfaces are compact, rectangular, and information-first, built for
exacting workflows over decorative chrome.

## Inventory

The material is a calm token system for dashboards and queues.

\`\`\`css
${css.trim()}
\`\`\`
`;
}

async function readDefaultTokensCss(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFile(
    resolve(here, '..', '..', '..', 'packages', 'sandbox-runtime', 'src', 'tokens.css'),
    'utf-8',
  );
}
