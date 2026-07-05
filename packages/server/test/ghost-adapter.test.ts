import { strict as assert } from 'node:assert';
import { afterEach, describe, it } from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildGhostReceipt,
  parseGhostRequest,
  parseGhostRoots,
  prepareGhostSurfacePrompt,
  resolveGhostGenerationContext,
} from '../src/ghost/adapter.js';
import { selectGhostSurface } from '../src/ghost/conjuror.js';
import { assembleCatalog } from '@decentralized-design/ghost/core';

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
    assert.deepEqual(parseGhostRequest({ source: 'resolved-context', prompt: 'resolved context' }, roots), {
      ok: false,
      error: 'ghost.source must be "root"; resolved-context is no longer supported',
    });

    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.ok ? parsed.request : null, {
      source: 'root',
      rootId: 'checkout',
      targetPath: '.',
      packageDir: null,
      memoryDir: null,
    });

    const withTarget = parseGhostRequest({
      rootId: 'checkout',
      targetPath: 'app',
      packageDir: '.ghost',
    }, roots);
    assert.equal(withTarget.ok, true);
    assert.deepEqual(withTarget.ok ? withTarget.request : null, {
      source: 'root',
      rootId: 'checkout',
      targetPath: 'app',
      packageDir: '.ghost',
      memoryDir: '.ghost',
    });
  });

  it('loads the fingerprint catalog and pulls the corpus into prompt context and token CSS', async () => {
    const root = await makeGhostFixture();
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');

    const ctx = await resolveGhostGenerationContext(parsed.request, roots);

    assert.equal(ctx.source, 'root');
    assert.equal(ctx.surface, 'index');
    assert.equal(ctx.root, resolve(root));
    // catalog loaded
    assert.ok(ctx.catalog.nodes.size >= 1);
    // the front door is pulled first
    assert.ok(ctx.pulled.some((node) => node.id === 'index'));
    assert.equal(ctx.pulled[0]?.id, 'index');
    assert.equal(ctx.pulled[0]?.reason, 'front-door');
    assert.equal(ctx.product, 'checkout');
    assert.match(ctx.prompt, /# Ghost Fingerprint/);
    // anchor line + front-door-labeled index node
    assert.match(ctx.prompt, /Anchor: index/);
    assert.match(ctx.prompt, /## index — front door/);
    assert.match(ctx.prompt, /Preserve quiet density/);
    // token CSS comes from the fenced css block in the index node body
    assert.equal(ctx.tokenSource.kind, 'ghost-config');
    assert.equal(ctx.tokenSource.source, 'fingerprint:index');
    assert.match(ctx.tokenSource.css, /--color-bg/);
    // The fingerprint prose is the ONLY place the model sees the token CSS:
    // activeTokensCss is consumed for validation + sandbox injection, never
    // rendered into the system prompt. So the fenced css block stays in the
    // rendered fingerprint prose, and the values also flow via tokenSource.css.
    assert.match(ctx.prompt, /```css/);
    assert.match(ctx.prompt, /--color-bg/);
  });

  it('injects signature moves and the fingerprint\'s own composition grammar at the index anchor', async () => {
    const root = await makeRichGhostFixture();
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');

    const ctx = await resolveGhostGenerationContext(parsed.request, roots);
    // The common path: anchor stays at `index`. Composition authority lives in
    // the fingerprint's own front-door prose + building-block nodes, so an
    // `index` anchor is fully composed — not a generic base.
    const prepared = await prepareGhostSurfacePrompt(ctx, {
      userPrompt: 'make me something',
      mode: 'static',
      surfacePlan: {
        purpose: 'inform',
        runtime: 'surface-document',
        data: 'embedded',
        authority: 'none',
        persistence: 'ephemeral',
      },
      preselectedSurface: 'index',
    });

    assert.equal(prepared.surface, 'index');
    // Signature moves are surfaced verbatim as mandatory requirements.
    assert.match(prepared.prompt, /Signature moves — non-negotiable for this fingerprint/);
    assert.match(prepared.prompt, /the ticked rail runs down the left edge/i);
    // The fingerprint's own composition grammar (from the front door) carries
    // the surface — its building-block node body is rendered verbatim in the
    // pulled corpus.
    assert.match(prepared.prompt, /Compose every surface from the same parts/);
    assert.match(prepared.prompt, /Stack ordered updates on the visible rail/);
    // Summon injects NO composition voice of its own: no repertoire, no
    // archetype menu, no lead-archetype template.
    assert.doesNotMatch(prepared.prompt, /Composition repertoire/);
    assert.doesNotMatch(prepared.prompt, /Lead archetype composition/);
    assert.doesNotMatch(prepared.prompt, /Fingerprint composition rules/);
  });

  it('appends a Summon surface brief to the corpus prompt', async () => {
    const root = await makeGhostFixture();
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');

    const ctx = await resolveGhostGenerationContext(parsed.request, roots);
    const prepared = await prepareGhostSurfacePrompt(ctx, {
      userPrompt: 'show checkout queue status',
      mode: 'static',
      surfacePlan: {
        purpose: 'inform',
        runtime: 'surface-document',
        data: 'embedded',
        authority: 'none',
        persistence: 'replayable',
      },
    });

    assert.equal(prepared.source, 'root');
    assert.match(prepared.prompt, /# Ghost Fingerprint/);
    assert.match(prepared.prompt, /## Summon Surface Brief/);
    assert.match(prepared.prompt, /Surface plan: purpose=inform; runtime=surface-document; data=embedded; authority=none; persistence=replayable/);
    assert.match(prepared.prompt, /Output runtime: surface-document/);
    assert.match(prepared.prompt, /structured Surface Document bundle/);
    assert.match(prepared.prompt, /Do not emit Summon stream lines, transport records, Markdown, code fences, or host-owned metadata/);
    assert.match(prepared.prompt, /The agent ward controls host authority and tools/);
    assert.match(prepared.prompt, /The user request is the semantic and task authority/);
    assert.match(prepared.prompt, /The Ghost fingerprint is the sole composition authority/);
    assert.match(prepared.prompt, /Fingerprint anchor: index \(front door\)/);
    assert.match(prepared.prompt, /Gathered nodes: index \(front-door\)/);
  });

  it('selects an anchor semantically via the model, falling back to index safely', async () => {
    const single = assembleCatalog({
      placedNodes: [
        { id: 'index', doc: { frontmatter: {}, body: 'front-door prose' } },
      ],
    });
    // Single-node corpus: no candidates, no model call, always index.
    let calls = 0;
    const neverCalled = async () => {
      calls += 1;
      return 'dashboard';
    };
    assert.equal(
      await selectGhostSurface(single, 'anything goes here', { completeText: neverCalled }),
      'index',
    );
    assert.equal(calls, 0, 'single-node corpora must not call the model');

    const multi = assembleCatalog({
      placedNodes: [
        { id: 'index', doc: { frontmatter: {}, body: 'front-door prose' } },
        {
          id: 'dashboard',
          doc: {
            frontmatter: { description: 'Operational dashboard for queue metrics' },
            body: 'dashboard prose',
          },
        },
        {
          id: 'editor',
          doc: {
            frontmatter: { description: 'Document editor with rich text composition' },
            body: 'editor prose',
          },
        },
      ],
    });

    // No completeText → selection is skipped entirely, anchor stays at index.
    assert.equal(await selectGhostSurface(multi, 'build a queue dashboard'), 'index');

    // The model's chosen id (when it is a real candidate) is honored verbatim.
    assert.equal(
      await selectGhostSurface(multi, 'build a queue dashboard', {
        completeText: async () => 'dashboard',
      }),
      'dashboard',
    );
    // Tolerates surrounding whitespace / casing.
    assert.equal(
      await selectGhostSurface(multi, 'a document editor', {
        completeText: async () => '  Editor\n',
      }),
      'editor',
    );
    // Model explicitly declines → index.
    assert.equal(
      await selectGhostSurface(multi, 'something ambiguous', {
        completeText: async () => 'index',
      }),
      'index',
    );
    // Out-of-menu hallucination → index (never trust an id not on the menu).
    assert.equal(
      await selectGhostSurface(multi, 'x', {
        completeText: async () => 'nonexistent',
      }),
      'index',
    );
    // Model throws → index (selection never gates generation).
    assert.equal(
      await selectGhostSurface(multi, 'x', {
        completeText: async () => {
          throw new Error('model down');
        },
      }),
      'index',
    );
    // Timeout → index.
    assert.equal(
      await selectGhostSurface(multi, 'x', {
        timeoutMs: 5,
        completeText: (req) =>
          new Promise((resolve, reject) => {
            req.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      }),
      'index',
    );
  });

  it('hoists a selected anchor as the lead composition while still pulling the whole corpus', async () => {
    const root = await makeRichGhostFixture();
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');

    const ctx = await resolveGhostGenerationContext(parsed.request, roots);
    const prepared = await prepareGhostSurfacePrompt(ctx, {
      userPrompt: 'show the update rail',
      mode: 'static',
      surfacePlan: {
        purpose: 'inform',
        runtime: 'surface-document',
        data: 'embedded',
        authority: 'none',
        persistence: 'ephemeral',
      },
      preselectedSurface: 'rail',
    });

    assert.equal(prepared.surface, 'rail');
    // Pull order: front door first, anchor hoisted second.
    assert.equal(prepared.pulled[0]?.id, 'index');
    assert.equal(prepared.pulled[1]?.id, 'rail');
    assert.equal(prepared.pulled[1]?.reason, 'anchor');
    assert.match(prepared.prompt, /Anchor: rail/);
    assert.match(prepared.prompt, /## rail — lead composition/);
    assert.match(prepared.prompt, /Fingerprint anchor: rail \(lead composition\)/);
    // The whole corpus is still pulled — the front door body is present.
    assert.match(prepared.prompt, /Compose every surface from the same parts/);
    // Token CSS is anchor-independent (front door → id order, never hoisted).
    assert.equal(prepared.tokenSource.css, ctx.tokenSource.css);
  });

  it('honors a preselected anchor and makes no selection model call', async () => {
    const root = await makeGhostFixture();
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');

    const ctx = await resolveGhostGenerationContext(parsed.request, roots);
    let calls = 0;
    const throwIfCalled = async () => {
      calls += 1;
      throw new Error('selection model must not be called when preselected');
    };

    // `index` is always a valid anchor; preselected → no model call.
    const prepared = await prepareGhostSurfacePrompt(ctx, {
      userPrompt: 'show checkout queue status',
      mode: 'static',
      surfacePlan: {
        purpose: 'inform',
        runtime: 'surface-document',
        data: 'embedded',
        authority: 'none',
        persistence: 'replayable',
      },
      preselectedSurface: 'index',
      completeText: throwIfCalled,
    });
    assert.equal(prepared.surface, 'index');
    assert.equal(calls, 0, 'preselected anchor must skip the selection model call');

    // An unknown preselected id falls back to index (never trust an off-menu
    // id), still without a model call.
    const fallback = await prepareGhostSurfacePrompt(ctx, {
      userPrompt: 'show checkout queue status',
      mode: 'static',
      surfacePlan: {
        purpose: 'inform',
        runtime: 'surface-document',
        data: 'embedded',
        authority: 'none',
        persistence: 'replayable',
      },
      preselectedSurface: 'nonexistent-surface',
      completeText: throwIfCalled,
    });
    assert.equal(fallback.surface, 'index');
    assert.equal(calls, 0, 'unknown preselected id must not trigger a model call');
  });

  it('uses Surface Document output wording in the Summon surface brief', async () => {
    const root = await makeGhostFixture();
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');

    const ctx = await resolveGhostGenerationContext(parsed.request, roots);
    const prepared = await prepareGhostSurfacePrompt(ctx, {
      userPrompt: 'show checkout queue status',
      mode: 'static',
      surfacePlan: {
        purpose: 'inform',
        runtime: 'surface-document',
        data: 'embedded',
        authority: 'none',
        persistence: 'replayable',
      },
    });

    assert.match(prepared.prompt, /Output runtime: surface-document/);
    assert.match(prepared.prompt, /structured Surface Document bundle/);
    assert.match(prepared.prompt, /emit_surface_document/);
    assert.match(prepared.prompt, /final Surface Document artifact/);
    assert.doesNotMatch(prepared.prompt, /structured Surface Document sandbox bundle/);
    assert.doesNotMatch(prepared.prompt, /create_summon_old_surface/);
  });

  it('extracts arbitrary fingerprint token CSS from the index node body', async () => {
    const tokenCss = ':root { --paper: #faf7ed; --ink: #16130f; --moss: #718c5a; --breathing-room: 28px; --soft-corner: 18px; }';
    const root = await makeGhostFixture({ tokenCss });
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');

    const ctx = await resolveGhostGenerationContext(parsed.request, roots);

    assert.equal(ctx.tokenSource.kind, 'ghost-config');
    assert.match(ctx.tokenSource.css, /--paper: #faf7ed/);
    assert.match(ctx.tokenSource.css, /--soft-corner: 18px/);
    assert.match(ctx.tokenSource.css, /--moss: #718c5a/);
  });

  it('builds the receipt from the pulled corpus, accepted Surface Document artifacts, and the conformance verdict', async () => {
    const root = await makeGhostFixture();
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');
    const ctx = await resolveGhostGenerationContext(parsed.request, roots);

    const receipt = buildGhostReceipt({
      context: ctx,
      mode: 'static',
      layoutId: 'card-structured',
      grantedTools: ['host_action'],
      validation: { blocked: 0, warnings: 1, codes: { 'unknown-token': 1 } },
      runtime: 'surface-document',
      repairs: 2,
      blocked: false,
      safetyViolations: [],
      conformance: {
        schema: 'summon.ghost-conformance/v2',
        surface: 'index',
        evaluated: true,
        checks: [
          {
            name: 'density',
            severity: 'high',
            offered: 'always',
            verdict: 'pass',
            reason: 'compact rhythm preserved',
            evidence: 'gap: var(--space-2)',
          },
          {
            name: 'hierarchy',
            severity: 'medium',
            offered: 'always',
            verdict: 'fail',
            reason: 'heading lost emphasis',
            evidence: 'h1 { font-weight: 400 }',
          },
        ],
        summary: { pass: 1, fail: 1, inconclusive: 0, failedHigh: 0, failedMedium: 1, failedLow: 0 },
      },
      acceptedLines: [
        {
          op: 'artifact',
          path: '/artifact',
          value: {
            runtime: 'surface-document',
            source: {
              'main.html': '<h1>Queue</h1>',
              'main.css': 'h1 { color: var(--color-text); }',
            },
          },
        },
      ],
    });

    assert.equal(receipt.schema, 'summon.ghost-receipt/v2');

    // --- fingerprint (spec-in) ---
    assert.equal(receipt.fingerprint.source, 'root');
    assert.equal(receipt.fingerprint.id, 'checkout');
    assert.equal(receipt.fingerprint.product, 'checkout');
    assert.equal(receipt.fingerprint.surface, 'index');
    // gatheredNodes carry the pull reason (front-door/anchor/corpus)
    assert.ok(receipt.fingerprint.gatheredNodes.some((node) => node.id === 'index'));
    for (const node of receipt.fingerprint.gatheredNodes) {
      assert.ok(['front-door', 'anchor', 'corpus'].includes(node.reason));
    }
    assert.equal(receipt.fingerprint.tokenSource.kind, 'ghost-config');
    assert.equal(receipt.fingerprint.tokenSource.source, 'fingerprint:index');
    assert.equal(typeof receipt.fingerprint.tokenSource.definedTokenCount, 'number');
    assert.ok(receipt.fingerprint.tokenSource.definedTokenCount >= 0);
    // offeredChecks == the evaluated check set
    assert.deepEqual(receipt.fingerprint.offeredChecks, [
      { name: 'density', severity: 'high' },
      { name: 'hierarchy', severity: 'medium' },
    ]);

    // --- capability ---
    assert.equal(receipt.capability.mode, 'static');
    assert.deepEqual(receipt.capability.grantedTools, ['host_action']);
    assert.equal(receipt.capability.layoutId, 'card-structured');

    // --- generation (what-happened) ---
    assert.equal(receipt.generation.runtime, 'surface-document');
    assert.equal(receipt.generation.artifactRuntime, 'surface-document');
    assert.deepEqual(receipt.generation.artifactFiles, ['main.css', 'main.html']);
    assert.equal(receipt.generation.repairs, 2);
    assert.equal(receipt.generation.blocked, false);
    assert.deepEqual(receipt.generation.validation, {
      blocked: 0,
      warnings: 1,
      codes: { 'unknown-token': 1 },
    });
    assert.deepEqual(receipt.generation.safetyViolations, []);

    // --- conformance folded in (verdict + reason, NO evidence) ---
    assert.equal(receipt.conformance.evaluated, true);
    assert.deepEqual(receipt.conformance.summary, {
      pass: 1,
      fail: 1,
      inconclusive: 0,
      failedHigh: 0,
      failedMedium: 1,
      failedLow: 0,
    });
    assert.equal(receipt.conformance.checks.length, 2);
    assert.deepEqual(receipt.conformance.checks[0], {
      name: 'density',
      severity: 'high',
      verdict: 'pass',
      reason: 'compact rhythm preserved',
    });
    // evidence is dropped from the receipt (decision 4)
    assert.equal('evidence' in receipt.conformance.checks[0]!, false);
    assert.equal('offered' in receipt.conformance.checks[0]!, false);
  });

  it('builds a receipt with an unevaluated conformance verdict (empty offeredChecks)', async () => {
    const root = await makeGhostFixture();
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');
    const ctx = await resolveGhostGenerationContext(parsed.request, roots);

    const receipt = buildGhostReceipt({
      context: ctx,
      mode: 'static',
      layoutId: null,
      grantedTools: [],
      validation: { blocked: 0, warnings: 0, codes: {} },
      runtime: 'surface-document',
      repairs: 0,
      blocked: true,
      safetyViolations: [],
      conformance: {
        schema: 'summon.ghost-conformance/v2',
        surface: 'index',
        evaluated: false,
        checks: [],
        summary: { pass: 0, fail: 0, inconclusive: 0, failedHigh: 0, failedMedium: 0, failedLow: 0 },
      },
      acceptedLines: [],
    });

    assert.equal(receipt.conformance.evaluated, false);
    assert.deepEqual(receipt.conformance.checks, []);
    assert.deepEqual(receipt.fingerprint.offeredChecks, []);
    assert.equal(receipt.generation.artifactRuntime, null);
    assert.deepEqual(receipt.generation.artifactFiles, []);
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

/** A fixture with a `## Signature look & feel` section and a `## Composition`
 * grammar on the front door, plus a building-block node (`rail`), so the
 * signature-moves block and the fingerprint's own composition voice have real
 * content to surface. Composition is authored as grammar-in-index + composable
 * parts — a flat corpus with no folders. */
async function makeRichGhostFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'summon-ghost-adapter-rich-'));
  fixtureRoots.push(root);
  const ghostDir = join(root, '.ghost');
  await mkdir(ghostDir, { recursive: true });
  await writeFile(
    join(ghostDir, 'manifest.yml'),
    `schema: ghost.fingerprint-package/v1
id: rich-product
`,
  );
  const css = await readDefaultTokensCss();
  await writeFile(
    join(ghostDir, 'index.md'),
    `---
description: Rich test fingerprint with signature moves and a composition grammar.
---

## Intent

A paced signal language.

## Signature look & feel

- The ticked rail runs down the left edge and no other fingerprint has it.
- Flat saturated tiles carry hierarchy through color, never elevation.

## Inventory

\`\`\`css
${css.trim()}
\`\`\`

## Composition

Compose every surface from the same parts: run the [ticked rail](rail) down the
left edge, then stack flat saturated tiles beside it. Let the task set the shape —
a live feed orders the tiles by time; a digest leads with one large tile — but
never collapse to an unframed generic layout.
`,
  );
  await writeFile(
    join(ghostDir, 'rail.md'),
    `---
description: The ticked rail — the left-edge sequence spine that orders the surface.
---

## Composition

Stack ordered updates on the visible rail with mono timestamps beside rounded tile bodies.
`,
  );
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
    resolve(here, '..', '..', 'sandbox-runtime', 'src', 'tokens.css'),
    'utf-8',
  );
}
