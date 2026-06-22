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

  it('resolves Ghost relay context into prompt context and valid token CSS', async () => {
    const root = await makeGhostFixture({ tokenCss: await readDefaultTokensCss() });
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');

    const ctx = await resolveGhostContext(parsed.request, roots);

    assert.equal(ctx.source, 'root');
    assert.equal(ctx.relay.schema, 'ghost.relay.gather/v1');
    assert.equal(ctx.relay.source.kind, 'stack');
    assert.equal(ctx.relay.source.repoRoot, resolve(root));
    assert.equal(ctx.relay.source.fingerprintDir, '.ghost');
    assert.deepEqual(
      ctx.relay.source.provenance.layers.map((layer: { relative_root: string }) => layer.relative_root),
      ['.'],
    );
    assert.equal(ctx.tokenSource.kind, 'ghost-config');
    assert.equal(ctx.tokenSource.source, 'tokens.css');
    assert.equal(ctx.tokenSource.css, await readDefaultTokensCss());
    assert.equal(ctx.product, 'Test Product');
    assert.match(ctx.prompt, /# Ghost Relay Brief/);
    assert.match(ctx.prompt, /## Identity Capsule/);
    assert.match(ctx.prompt, /## Task Contract/);
    assert.match(ctx.prompt, /### Preserve/);
    assert.match(ctx.prompt, /Product: Test Product/);
    assert.match(ctx.prompt, /Preserve quiet density/);
    assert.match(ctx.prompt, /Status surfaces must foreground current state/);
    assert.match(ctx.prompt, /Surfaces are compact/);
    assert.match(ctx.prompt, /exacting workflows/);
    assert.match(ctx.prompt, /Suggested Reads/);
    assert.match(ctx.prompt, /fingerprint\/prose\.yml/);
    assert.ok(ctx.relay.entrypoint.actionContract.preserve.some((entry) => entry.includes('Preserve quiet density')));
  });

  it('lets Ghost resolve its default memory dir when the request omits memoryDir', async () => {
    const root = await makeGhostFixture({ memoryDir: '.surface-memory' });
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');
    assert.equal(parsed.request.memoryDir, null);

    const previousMemoryDir = process.env.GHOST_MEMORY_DIR;
    process.env.GHOST_MEMORY_DIR = '.surface-memory';
    try {
      const ctx = await resolveGhostContext(parsed.request, roots);
      assert.equal(ctx.relay.source.fingerprintDir, '.surface-memory');
      assert.deepEqual(
        ctx.relay.source.provenance.layers.map((layer: { fingerprint_dir: string }) => layer.fingerprint_dir),
        ['.surface-memory'],
      );
    } finally {
      if (previousMemoryDir === undefined) {
        delete process.env.GHOST_MEMORY_DIR;
      } else {
        process.env.GHOST_MEMORY_DIR = previousMemoryDir;
      }
    }
  });

  it('appends a Summon surface brief without recompiling the fingerprint', async () => {
    const root = await makeGhostFixture({ large: true });
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
    assert.match(prepared.prompt, /# Ghost Relay Brief/);
    assert.match(prepared.prompt, /## Summon Surface Brief/);
    assert.match(prepared.prompt, /Surface plan: purpose=inform; runtime=arrow; data=embedded; authority=none; persistence=replayable/);
    assert.match(prepared.prompt, /Use the supplied Ghost Relay Brief as the complete fingerprint entrypoint/);
    assert.match(prepared.prompt, /structured Arrow sandbox bundle/);
    assert.match(prepared.prompt, /Do not emit Summon stream lines, transport records, Markdown, code fences, or host-owned metadata/);
    assert.match(prepared.prompt, /The agent broker controls host authority and tools/);
    assert.match(prepared.prompt, /Compose from the fingerprint prose, inventory, and composition layers/);
    assert.match(prepared.prompt, /Preserve quiet density/);
  });

  it('accepts arbitrary Ghost token CSS instead of requiring Summon token names', async () => {
    const tokenCss = ':root { --paper: #faf7ed; --ink: #16130f; --moss: #718c5a; --breathing-room: 28px; --soft-corner: 18px; }';
    const root = await makeGhostFixture({ tokenCss });
    const roots = parseGhostRoots(`checkout=${root}`);
    const parsed = parseGhostRequest({ rootId: 'checkout' }, roots);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.request) assert.fail('expected valid Ghost request');

    const ctx = await resolveGhostContext(parsed.request, roots);

    assert.equal(ctx.tokenSource.kind, 'ghost-config');
    assert.equal(ctx.tokenSource.css, tokenCss);
    assert.ok(ctx.ingestion?.style.definedTokens.includes('--paper'));
    assert.ok(ctx.ingestion?.style.definedTokens.includes('--soft-corner'));
    assert.ok(ctx.ingestion?.style.customTokens.includes('--moss'));
  });

  it('ignores base direction fallback when Ghost token CSS is present', async () => {
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

    assert.equal(ctx.baseDirectionId, 'ghost');
    assert.equal(ctx.tokenSource.kind, 'ghost-config');
    assert.equal(ctx.tokenSource.source, 'tokens.css');
    assert.equal(ctx.tokenSource.css, baseTokens);
  });

  it('builds review packet metadata from relay context and accepted Arrow artifacts', async () => {
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
    assert.equal(packet.product, 'Test Product');
    assert.equal(packet.baseDirectionId, null);
    assert.equal(packet.styleSource, 'ghost-config');
    assert.equal(packet.fingerprintProvenance.merge, 'child-wins-by-id');
    assert.ok(packet.taskContract.preserve.some((entry) => entry.includes('Preserve quiet density')));
    assert.ok(packet.suggestedReads.some((entry) => entry.path === 'fingerprint/prose.yml'));
    assert.deepEqual(
      packet.fingerprintProvenance.layers.map(({ relativeRoot, memoryDir, dir }) => ({ relativeRoot, memoryDir, dir })),
      [{ relativeRoot: '.', memoryDir: '.ghost', dir: '.ghost' }],
    );
    assert.equal(packet.artifactRuntime, 'arrow');
    assert.deepEqual(packet.artifactFiles, ['main.css', 'main.ts']);
    assert.equal(packet.tokenSource.kind, 'ghost-config');
    assert.equal('css' in packet.tokenSource, false);
  });
});

async function makeGhostFixture(options: { tokenCss?: string | null; large?: boolean; memoryDir?: string } = {}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'summon-ghost-adapter-'));
  const memoryDir = options.memoryDir ?? '.ghost';
  fixtureRoots.push(root);
  await mkdir(join(root, memoryDir, 'fingerprint', 'enforcement'), { recursive: true });
  await mkdir(join(root, memoryDir, 'fingerprint', 'memory'), { recursive: true });
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
    join(root, memoryDir, 'fingerprint', 'manifest.yml'),
    `schema: ghost.fingerprint-package/v1
id: test-product
`,
  );
  await writeFile(
    join(root, memoryDir, 'fingerprint', 'prose.yml'),
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
    join(root, memoryDir, 'fingerprint', 'inventory.yml'),
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
    join(root, memoryDir, 'fingerprint', 'composition.yml'),
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
    join(root, memoryDir, 'fingerprint', 'enforcement', 'checks.yml'),
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
    join(root, memoryDir, 'fingerprint', 'memory', 'tool.md'),
    `# Tool

Human-approved test tool keeps generated surfaces grounded.
`,
  );
  await writeFile(
    join(root, memoryDir, 'config.yml'),
    `schema: ghost.config/v1
targets:
  - id: web
    platform: web
    roots: [.]
    tokens: [tokens.css]
libraries: []
`,
  );
  if (options.tokenCss !== null) {
    await writeFile(join(root, 'tokens.css'), options.tokenCss ?? await readDefaultTokensCss());
  }
  return root;
}

async function readDefaultTokensCss(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFile(
    resolve(here, '..', '..', '..', 'packages', 'sandbox-runtime', 'src', 'tokens.css'),
    'utf-8',
  );
}
