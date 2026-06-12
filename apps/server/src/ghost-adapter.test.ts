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
} from './ghost-adapter.js';

const fixtureRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    fixtureRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('Ghost adapter', () => {
  it('parses trusted roots and rejects unsafe request paths', async () => {
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

    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.ok ? parsed.request : null, {
      source: 'root',
      rootId: 'checkout',
      targetPath: '.',
      memoryDir: '.ghost',
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
    const explicitRoot = parseGhostRequest({ source: 'root', rootId: 'checkout' }, roots);
    assert.equal(explicitRoot.ok, true);
    assert.equal(explicitRoot.ok ? explicitRoot.request?.source : null, 'root');
    assert.deepEqual(parseGhostRequest({ rootId: 'checkout', baseDirectionId: '../ghost' }, roots), {
      ok: false,
      error: 'ghost.baseDirectionId must be a valid direction id',
    });
  });

  it('resolves a Ghost stack into prompt intent and valid token CSS', async () => {
    const root = await makeGhostFixture({ tokenCss: await readDefaultTokensCss() });
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');

    const ctx = await resolveGhostContext(parsed.request, roots);

    assert.equal(ctx.source, 'root');
    if (ctx.source !== 'root') assert.fail('expected root context');
    assert.equal(ctx.tokenSource.kind, 'ghost-config');
    assert.equal(ctx.tokenSource.source, 'tokens.css');
    assert.equal(ctx.tokenSource.css, await readDefaultTokensCss());
    assert.equal(ctx.product, 'Test Product');
    assert.match(ctx.prompt, /Test Product/);
    assert.match(ctx.prompt, /# Agent Handoff/);
    assert.match(ctx.prompt, /Preserve quiet density/);
    assert.match(ctx.prompt, /Status surfaces must foreground current state/);
    assert.match(ctx.prompt, /Surfaces are compact/);
    assert.match(ctx.prompt, /exacting workflows/);
    assert.match(ctx.prompt, /fingerprint\/memory\/intent\.md/);
  });

  it('bridges legacy fingerprint.yml roots', async () => {
    const root = await makeLegacyGhostFixture();
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');

    const ctx = await resolveGhostContext(parsed.request, roots);

    assert.equal(ctx.source, 'root');
    if (ctx.source !== 'root') assert.fail('expected root context');
    assert.equal(ctx.product, 'Test Product');
    assert.match(ctx.prompt, /Preserve quiet density/);
  });

  it('appends a Summon surface brief without recompiling the fingerprint', async () => {
    const root = await makeGhostFixture({ large: true });
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');

    const ctx = await resolveGhostContext(parsed.request, roots);

    assert.equal(ctx.source, 'root');
    if (ctx.source !== 'root') assert.fail('expected root context');
    const prepared = prepareGhostSurfacePrompt(ctx, {
      userPrompt: 'show checkout queue status',
      mode: 'static',
      surfacePlan: {
        purpose: 'inform',
        runtime: 'static',
        data: 'embedded',
        authority: 'none',
        persistence: 'replayable',
      },
      shape: 'card',
    });
    assert.equal(prepared.source, 'root');
    if (prepared.source !== 'root') assert.fail('expected root context');
    assert.match(prepared.prompt, /## Summon Surface Brief/);
    assert.match(prepared.prompt, /Surface plan: purpose=inform; runtime=static; data=embedded; authority=none; persistence=replayable/);
    assert.match(prepared.prompt, /The agent broker controls host authority and capabilities/);
    assert.match(prepared.prompt, /Compose from the fingerprint prose, inventory, and composition layers/);
    assert.match(prepared.prompt, /Preserve quiet density/);
  });

  it('falls back to Summon default tokens when Ghost token CSS is missing or invalid', async () => {
    const root = await makeGhostFixture({ tokenCss: ':root { --color-bg: red; }' });
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');

    const ctx = await resolveGhostContext(parsed.request, roots);

    assert.equal(ctx.source, 'root');
    if (ctx.source !== 'root') assert.fail('expected root context');
    assert.equal(ctx.tokenSource.kind, 'summon-default');
    assert.equal(ctx.tokenSource.source, '@anarchitecture/summon/tokens.css');
    assert.match(ctx.tokenSource.css, /--color-bg:/);
    assert.ok(ctx.tokenSource.warnings.some((warning) => warning.includes('failed token contract')));
  });

  it('falls back to base direction tokens before Summon defaults', async () => {
    const baseTokens = await readDefaultTokensCss();
    const root = await makeGhostFixture();
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout', baseDirectionId: 'ghost' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');

    const ctx = await resolveGhostSteer(parsed.request, roots, {
      id: 'ghost',
      tokensCss: baseTokens,
    });

    assert.equal(ctx.source, 'root');
    if (ctx.source !== 'root') assert.fail('expected root context');
    assert.equal(ctx.baseDirectionId, 'ghost');
    assert.equal(ctx.tokenSource.kind, 'base-direction');
    assert.equal(ctx.tokenSource.source, 'direction:ghost/tokens.css');
    assert.equal(ctx.tokenSource.css, baseTokens);
    assert.ok(ctx.tokenSource.warnings.some((warning) => warning.includes('using the fallback Summon direction tokens')));
  });

  it('builds review packet metadata from accepted protocol lines', async () => {
    const root = await makeGhostFixture();
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');
    const ctx = await resolveGhostContext(parsed.request, roots);
    assert.equal(ctx.source, 'root');
    if (ctx.source !== 'root') assert.fail('expected root context');

    const packet = buildGhostReviewPacket({
      context: ctx,
      mode: 'static',
      layoutId: 'card-structured',
      prompt: 'show the state of the queue',
      validation: { blocked: 0, warnings: 1, codes: { 'unknown-token': 1 } },
      acceptedLines: [
        { op: 'set', path: '/screen', value: { sections: ['header', 'content'] } },
        { op: 'add', path: '/section/header', html: '<h1>Queue</h1>' },
        { op: 'add', path: '/section/content', html: '<p>12 pending</p>' },
      ],
    });

    assert.equal(packet.schema, 'summon.ghost-fingerprint-generation/v1');
    assert.equal(packet.source, 'root');
    assert.equal(packet.rootId, 'checkout');
    assert.equal(packet.product, 'Test Product');
    assert.equal(packet.baseDirectionId, null);
    assert.equal(packet.styleSource, 'summon-default');
    assert.deepEqual(packet.fingerprintProvenance, {
      merge: 'child-wins-by-id',
      layers: [{ relativeRoot: '.', memoryDir: '.ghost' }],
    });
    assert.deepEqual(packet.declaredSections, ['header', 'content']);
    assert.deepEqual(packet.sections, [
      { id: 'header', html: '<h1>Queue</h1>' },
      { id: 'content', html: '<p>12 pending</p>' },
    ]);
    assert.equal(packet.tokenSource.kind, 'summon-default');
    assert.equal('css' in packet.tokenSource, false);
  });

  it('resolves caller-provided Ghost context without repo access', async () => {
    const roots = parseGhostRoots('');
    const parsed = parseGhostRequest({
      source: 'resolved-context',
      id: 'checkout',
      product: 'Checkout',
      prompt: 'You are working inside the Checkout product experience.',
      provenance: { layers: ['portable'] },
    }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid resolved context request');

    const ctx = await resolveGhostSteer(parsed.request, roots);

    assert.equal(ctx.source, 'resolved-context');
    assert.equal(ctx.prompt, 'You are working inside the Checkout product experience.');
    assert.equal(ctx.product, 'Checkout');
    assert.equal(ctx.root, null);
    assert.equal(ctx.stack, null);
    assert.equal(ctx.tokenSource.kind, 'summon-default');
    assert.deepEqual(ctx.provenance, { layers: ['portable'] });
  });

  it('uses valid resolved-context tokens', async () => {
    const tokens = await readDefaultTokensCss();
    const roots = parseGhostRoots('');
    const parsed = parseGhostRequest({
      source: 'resolved-context',
      prompt: 'Use portable Ghost fingerprint.',
      tokensCss: tokens,
      tokenSource: 'bundle/tokens.css',
    }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid resolved context request');

    const ctx = await resolveGhostSteer(parsed.request, roots);

    assert.equal(ctx.source, 'resolved-context');
    assert.equal(ctx.tokenSource.kind, 'resolved-context');
    assert.equal(ctx.tokenSource.source, 'bundle/tokens.css');
    assert.equal(ctx.tokenSource.css, tokens);
  });

  it('falls back from invalid resolved-context tokens to base direction tokens', async () => {
    const baseTokens = await readDefaultTokensCss();
    const roots = parseGhostRoots('');
    const parsed = parseGhostRequest({
      source: 'resolved-context',
      prompt: 'Use portable Ghost fingerprint.',
      tokensCss: ':root { --color-bg: red; }',
      tokenSource: 'bundle/tokens.css',
      baseDirectionId: 'ghost',
    }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid resolved context request');

    const ctx = await resolveGhostSteer(parsed.request, roots, {
      id: 'ghost',
      tokensCss: baseTokens,
    });

    assert.equal(ctx.source, 'resolved-context');
    assert.equal(ctx.tokenSource.kind, 'base-direction');
    assert.equal(ctx.tokenSource.source, 'direction:ghost/tokens.css');
    assert.ok(ctx.tokenSource.warnings.some((warning) => warning.includes('bundle/tokens.css failed token contract')));
  });

  it('rejects resolved-context requests without prompt', () => {
    const roots = parseGhostRoots('');

    assert.deepEqual(parseGhostRequest({ source: 'resolved-context' }, roots), {
      ok: false,
      error: 'ghost.prompt is required for resolved-context',
    });
    assert.deepEqual(parseGhostRequest({ source: 'resolved-context', prompt: '   ' }, roots), {
      ok: false,
      error: 'ghost.prompt is required for resolved-context',
    });
  });
});

async function makeGhostFixture(options: { tokenCss?: string; large?: boolean } = {}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'summon-ghost-adapter-'));
  fixtureRoots.push(root);
  await mkdir(join(root, '.ghost', 'fingerprint', 'enforcement'), { recursive: true });
  await mkdir(join(root, '.ghost', 'fingerprint', 'memory'), { recursive: true });
  const extraPrinciples = options.large
    ? Array.from({ length: 30 }, (_, index) => `  - id: extra-principle-${index}
    principle: Extra accepted principle ${index} ${'keeps operational hierarchy clear '.repeat(12)}
    guidance:
      - Extra guidance ${index} ${'keeps the surface compact and legible '.repeat(10)}
`)
    : [];
  const extraPatterns = options.large
    ? Array.from({ length: 30 }, (_, index) => `  - id: extra-pattern-${index}
    kind: structure
    pattern: Extra composition pattern ${index} ${'uses restrained blocks and clear state '.repeat(12)}
    guidance:
      - Extra pattern guidance ${index} ${'prevents ornamental layout from hiding work '.repeat(10)}
`)
    : [];
  await writeFile(
    join(root, '.ghost', 'fingerprint', 'manifest.yml'),
    `schema: ghost.fingerprint-package/v1
id: test-product
`,
  );
  await writeFile(
    join(root, '.ghost', 'fingerprint', 'prose.yml'),
    `summary:
  product: Test Product
  audience: [operators]
  goals: [keep work legible]
  tone: [quiet, exacting workflows]
situations:
  - id: queue-status
    title: Queue status
    user_intent: Show the current checkout queue state.
    product_obligation: Keep operator status legible before secondary detail.
    surface_type: dashboard
    principles: [prose.principle:calm-density]
    experience_contracts: [prose.experience_contract:queue-trust]
    patterns: [composition.pattern:measured-surfaces]
    refuses:
      - Decorative chrome that hides operational state.
principles:
  - id: calm-density
    principle: Preserve quiet density and clear hierarchy.
    applies_to:
      paths: [.]
      surface_types: [dashboard]
    guidance:
      - Favor compact hierarchy over decorative chrome.
    counterexamples:
      - Hero-style decoration before operational state.
    check_refs: [check:no-rainbow]
${extraPrinciples.join('')}experience_contracts:
  - id: queue-trust
    contract: Status surfaces must foreground current state.
    applies_to:
      paths: [.]
      surface_types: [dashboard]
    obligations:
      - Show current queue state before secondary context.
    check_refs: [check:no-rainbow]
`,
  );
  await writeFile(
    join(root, '.ghost', 'fingerprint', 'inventory.yml'),
    `topology:
  scopes:
    - id: app
      paths: [.]
      surface_types: [dashboard]
  surface_types: [dashboard]
building_blocks:
  tokens: [--color-bg, --color-text, --space-2]
  components: [QueueCard]
  libraries: [market]
`,
  );
  await writeFile(
    join(root, '.ghost', 'fingerprint', 'composition.yml'),
    `patterns:
  - id: measured-surfaces
    kind: structure
    pattern: Surfaces are compact, rectangular, and information-first.
    applies_to:
      paths: [.]
      surface_types: [dashboard]
    guidance:
      - Use one clear status block before supporting details.
    anti_patterns:
      - Avoid marketing-style hero copy.
    check_refs: [check:no-rainbow]
${extraPatterns.join('')}
`,
  );
  await writeFile(
    join(root, '.ghost', 'fingerprint', 'enforcement', 'checks.yml'),
    `schema: ghost.checks/v1
id: test-product
checks:
  - id: no-rainbow
    title: Avoid rainbow decorative color
    status: active
    severity: serious
    applies_to:
      paths: [.]
    detector:
      type: forbidden-regex
      pattern: rainbow
    evidence:
      support: 1
      observed_count: 1
      examples:
        - queue fixture avoids rainbow decorative color
`,
  );
  await writeFile(
    join(root, '.ghost', 'fingerprint', 'memory', 'intent.md'),
    `# Intent

Human-approved test intent keeps generated surfaces grounded.
`,
  );
  await writeFile(
    join(root, '.ghost', 'config.yml'),
    `schema: ghost.config/v1
targets:
  - id: web
    platform: web
    roots: [.]
    tokens: [tokens.css]
libraries: []
`,
  );
  if (options.tokenCss !== undefined) {
    await writeFile(join(root, 'tokens.css'), options.tokenCss);
  }
  return root;
}

async function makeLegacyGhostFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'summon-ghost-adapter-legacy-'));
  fixtureRoots.push(root);
  await mkdir(join(root, '.ghost'), { recursive: true });
  await writeFile(
    join(root, '.ghost', 'fingerprint.yml'),
    `schema: ghost.fingerprint/v1
summary:
  product: Test Product
  audience: [operators]
  goals: [keep work legible]
  tone: [quiet, exacting workflows]
topology:
  scopes:
    - id: app
      paths: [.]
      surface_types: [dashboard]
  surface_types: [dashboard]
situations: []
principles:
  - id: calm-density
    status: accepted
    principle: Preserve quiet density and clear hierarchy.
experience_contracts: []
patterns:
  - id: measured-surfaces
    kind: visual
    status: accepted
    pattern: Surfaces are compact, rectangular, and information-first.
implementation_vocabulary:
  tokens: [--color-bg, --color-text]
  components: []
review_policy:
  proposal_policy:
    - Agents propose memory changes; humans promote durable truth.
`,
  );
  return root;
}

async function readDefaultTokensCss(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFile(
    resolve(here, '..', '..', '..', 'packages', 'sandbox-runtime', 'src', 'tokens.css'),
    'utf-8',
  );
}
