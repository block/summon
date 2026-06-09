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
    assert.equal(ctx.stack.merged.fingerprint.summary.product, 'Test Product');
    assert.match(ctx.prompt, /Test Product/);
    assert.match(ctx.prompt, /quiet/);
    assert.match(ctx.prompt, /exacting workflows/);
    assert.match(ctx.prompt, /Human-approved test intent/);
  });

  it('rejects legacy single-file fingerprints', async () => {
    const root = await makeLegacyGhostFixture();
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');
    const request = parsed.request;

    await assert.rejects(
      () => resolveGhostContext(request, roots),
      /No \.ghost\/fingerprint\.yml found/,
    );
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
    assert.ok(ctx.tokenSource.warnings.some((warning) => warning.includes('using the base Summon direction tokens')));
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

    assert.equal(packet.schema, 'summon.ghost-generation/v1');
    assert.equal(packet.source, 'root');
    assert.equal(packet.rootId, 'checkout');
    assert.equal(packet.product, 'Test Product');
    assert.equal(packet.baseDirectionId, null);
    assert.equal(packet.styleSource, 'summon-default');
    assert.deepEqual(packet.memoryProvenance, {
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
      prompt: 'Use portable Ghost memory.',
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
      prompt: 'Use portable Ghost memory.',
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

async function makeGhostFixture(options: { tokenCss?: string } = {}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'summon-ghost-adapter-'));
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
    status: accepted
    kind: visual
    pattern: Surfaces are compact, rectangular, and information-first.
implementation_vocabulary:
  tokens: [--color-bg, --color-text]
  components: []
review_policy: {}
`,
  );
  await writeFile(
    join(root, '.ghost', 'checks.yml'),
    `schema: ghost.checks/v1
id: test-product
checks: []
`,
  );
  await writeFile(
    join(root, '.ghost', 'intent.md'),
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
    join(root, '.ghost', 'fingerprint.md'),
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
