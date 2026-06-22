import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import type {
  ProtocolLine,
  SummonArrowBundle,
  SurfacePlan,
} from '@anarchitecture/summon/engine';
import {
  runSurfaceGeneration,
  type SurfaceGenerationSummary,
  type SurfaceModelProvider,
} from '@anarchitecture/summon-server';
import {
  prepareGhostSurfacePrompt,
  resolveCatalogGhostGenerationContext,
  type ResolvedCatalogGhostSteer,
} from './ghost-adapter.js';
import { loadFingerprintCatalog } from './fingerprint-catalog.js';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');
const fingerprintCatalog = loadFingerprintCatalog(resolve(packageRoot, 'fingerprints'));

const boundaryPrompt = 'compare launching mobile preorder in 12 stores first versus all 48 stores at once';
const boundarySurfacePlan: SurfacePlan = {
  purpose: 'compare',
  runtime: 'arrow',
  data: 'embedded',
  authority: 'none',
  persistence: 'replayable',
  network: 'none',
};

test('editorial-mono accepts an editorial comparison-spread artifact', async () => {
  const { summary, lines } = await runGhostBoundaryCase({
    fingerprintId: 'editorial-mono',
    bundle: editorialBundle,
  });

  expectAcceptedForGhost(summary, lines);
  assert.equal(hasIssue(summary, 'ghost-fidelity-no-composition-evidence'), false);
});

test('editorial-mono rejects a garden-note artifact', async () => {
  const { summary, lines } = await runGhostBoundaryCase({
    fingerprintId: 'editorial-mono',
    bundle: gardenBundle,
  });

  expectBlockedForGhost(summary, lines);
  expectChosenFingerprintBoundaryIssue(summary);
});

test('garden-notes accepts a staged note-plan artifact', async () => {
  const { summary, lines } = await runGhostBoundaryCase({
    fingerprintId: 'garden-notes',
    bundle: gardenBundle,
  });

  expectAcceptedForGhost(summary, lines);
  assert.equal(hasIssue(summary, 'ghost-fidelity-no-composition-evidence'), false);
});

test('garden-notes rejects an editorial broadsheet artifact', async () => {
  const { summary, lines } = await runGhostBoundaryCase({
    fingerprintId: 'garden-notes',
    bundle: editorialBundle,
  });

  expectBlockedForGhost(summary, lines);
  expectChosenFingerprintBoundaryIssue(summary);
});

async function runGhostBoundaryCase(input: {
  fingerprintId: 'editorial-mono' | 'garden-notes';
  bundle: SummonArrowBundle;
}): Promise<{
  ghost: ResolvedCatalogGhostSteer;
  summary: SurfaceGenerationSummary;
  lines: ProtocolLine[];
}> {
  const ghost = await resolveBundledGhost(input.fingerprintId);
  const lines: ProtocolLine[] = [];
  const summary = await runSurfaceGeneration({
    prompt: boundaryPrompt,
    ghost,
    activeTokensCss: ghost.tokenSource.css,
    surfacePolicy: { tier: 'static', purpose: 'compare' },
    modelProvider: providerReturning(input.bundle),
    maxRepairAttempts: 0,
  }, (line) => {
    lines.push(line);
  });
  return { ghost, summary, lines };
}

async function resolveBundledGhost(id: 'editorial-mono' | 'garden-notes'): Promise<ResolvedCatalogGhostSteer> {
  const context = await resolveCatalogGhostGenerationContext({
    id,
    targetPath: '.',
    baseDirectionId: null,
  }, fingerprintCatalog, null);

  return prepareGhostSurfacePrompt(context, {
    userPrompt: boundaryPrompt,
    mode: 'static',
    surfacePlan: boundarySurfacePlan,
    tools: null,
  }) as ResolvedCatalogGhostSteer;
}

function providerReturning(bundle: SummonArrowBundle): SurfaceModelProvider {
  return {
    async generateArrowBundle() {
      return bundle;
    },
  };
}

function expectAcceptedForGhost(summary: SurfaceGenerationSummary, lines: ProtocolLine[]): void {
  assert.equal(summary.blocked, false, summarizeIssues(summary));
  assert.equal(hasArtifact(lines), true, 'accepted Ghost run should emit artifact');
  const fidelity = fidelitySummary(lines);
  assert.ok(fidelity, 'missing /ghost-fidelity-summary');
  assert.notEqual((fidelity.value as { status?: unknown }).status, 'block');
}

function expectBlockedForGhost(summary: SurfaceGenerationSummary, lines: ProtocolLine[]): void {
  assert.equal(summary.blocked, true, 'wrong-style Ghost run should be blocked');
  assert.equal(hasArtifact(lines), false, 'blocked Ghost run should not emit artifact');
  const fidelity = fidelitySummary(lines);
  assert.ok(fidelity, 'missing /ghost-fidelity-summary');
  assert.equal((fidelity.value as { status?: unknown }).status, 'block');
}

function expectChosenFingerprintBoundaryIssue(summary: SurfaceGenerationSummary): void {
  const codes = new Set(summary.validationIssues.map((issue) => issue.code));
  assert.equal(
    codes.has('ghost-fidelity-forbidden-anti-pattern') || codes.has('ghost-fidelity-no-composition-evidence'),
    true,
    `expected chosen-fingerprint boundary issue, got: ${[...codes].join(', ')}`,
  );
}

function fidelitySummary(lines: ProtocolLine[]): Extract<ProtocolLine, { op: 'meta' }> | undefined {
  return lines.find((line) => line.op === 'meta' && line.path === '/ghost-fidelity-summary') as Extract<ProtocolLine, { op: 'meta' }> | undefined;
}

function hasArtifact(lines: ProtocolLine[]): boolean {
  return lines.some((line) => line.op === 'artifact' && line.path === '/artifact');
}

function hasIssue(summary: SurfaceGenerationSummary, code: string): boolean {
  return summary.validationIssues.some((issue) => issue.code === code);
}

function summarizeIssues(summary: SurfaceGenerationSummary): string {
  return summary.validationIssues.map((issue) => `${issue.severity}:${issue.code}:${issue.message}`).join('\n');
}

const editorialBundle: SummonArrowBundle = {
  schema: 'summon.arrow-bundle/v1',
  preview: {
    kind: 'compare',
    title: 'Rollout verdict',
    regions: [{
      id: 'verdict',
      role: 'content',
      label: 'Editorial verdict',
      summary: 'Dominant claim with ruled evidence rows.',
    }],
  },
  source: {
    'main.ts': `import { html } from "@arrow-js/core";

export default html\`
  <main class="editorial-shell comparison-spread claim-first-brief broadsheet host-frame-safe-area stark-editorial-broadsheets black-ink-blocks square-newspaper-panels">
    <section class="verdict-ink-block compact-metadata">
      <p class="folio">Decision brief / compact metadata</p>
      <h1>Launch 12 stores first.</h1>
      <p class="deck">The pilot wins on learning speed, operational control, and measurable risk.</p>
      <p class="evidence-note">A compact editorial brief starts with a dominant newspaper-like claim.</p>
      <p class="evidence-note">Comparison layouts make tradeoffs visible across shared criteria.</p>
      <p class="evidence-note">Full-screen generated surfaces leave safe space for host chrome.</p>
    </section>

    <section class="ruled-evidence matrix comparison-row aligned-criteria">
      <article class="criteria-row">
        <span class="criterion">Learning quality</span>
        <strong>12-store pilot</strong>
        <p>Clean signal before scaling.</p>
      </article>
      <article class="criteria-row">
        <span class="criterion">Operational risk</span>
        <strong>Lower exposure</strong>
        <p>Contains training and support load.</p>
      </article>
      <article class="criteria-row recommended-option">
        <span class="criterion">Board action</span>
        <strong>Approve pilot gate</strong>
        <p>Review conversion and pickup defects after 21 days.</p>
      </article>
    </section>
  </main>
\`;`,
    'main.css': `
.editorial-shell {
  min-height: 100%;
  padding: var(--space-8);
  padding-top: calc(var(--space-8) + var(--space-5));
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-serif);
  display: grid;
  gap: var(--space-5);
  grid-template-columns: minmax(0, 1fr);
}
.verdict-ink-block {
  background: var(--color-accent);
  color: var(--color-accent-fg);
  border: 2px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}
.folio,
.criterion {
  font-family: var(--font-mono);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
  color: var(--color-text-muted);
}
.verdict-ink-block h1 {
  margin: 0;
  font-size: var(--text-display);
  line-height: var(--leading-display);
}
.deck {
  max-width: 56ch;
  font-size: var(--text-lg);
}
.ruled-evidence {
  background: var(--color-surface);
  border-top: 2px solid var(--color-border-strong);
  border-bottom: 2px solid var(--color-border-strong);
  display: grid;
}
.criteria-row {
  display: grid;
  grid-template-columns: 180px 1fr 1.2fr;
  gap: var(--space-4);
  border-bottom: 1px solid var(--color-border);
  padding: var(--space-4) 0;
}
.recommended-option {
  border-left: 6px solid var(--color-text);
  padding-left: var(--space-4);
}
`,
  },
};

const gardenBundle: SummonArrowBundle = {
  schema: 'summon.arrow-bundle/v1',
  preview: {
    kind: 'planner',
    title: 'A kind rollout plan',
    regions: [{
      id: 'staged-plan',
      role: 'content',
      label: 'Now next later',
      summary: 'Soft note panels with a gentle next step.',
    }],
  },
  source: {
    'main.ts': `import { html } from "@arrow-js/core";

export default html\`
  <main class="garden-shell staged-plan soft-rounded-shell comparison-for-life-admin host-frame-safe-area soft-personal-planning-boards green-badges rounded-note-panels">
    <section class="note-panel recommendation-note soft-green-accents">
      <span class="gentle-badge">Good-enough first step</span>
      <h1>Start with the 12-store pilot.</h1>
      <p>The next small step is easy: choose stores with steady pickup volume and one experienced lead.</p>
      <p>A planning surface shows a staged path through soft note panels.</p>
      <p>Personal comparisons prioritize fit and timing with a clearly kind good-enough choice.</p>
      <p>Full-screen generated surfaces leave safe space for host chrome.</p>
    </section>

    <section class="staged-checklist now-next-later">
      <article class="note-panel now">
        <span class="gentle-badge">Now</span>
        <h2>Pick the calmest pilot group</h2>
        <p>Use stores with predictable rush windows and willing managers.</p>
      </article>
      <article class="note-panel next">
        <span class="gentle-badge">Next</span>
        <h2>Prepare support notes</h2>
        <p>Give teams a short checklist for pickup timing, refunds, and customer handoff.</p>
      </article>
      <article class="note-panel later">
        <span class="gentle-badge">Later</span>
        <h2>Scale when it feels lighter</h2>
        <p>Move to 48 stores after the first week’s friction is visible and fixable.</p>
      </article>
    </section>
  </main>
\`;`,
    'main.css': `
.garden-shell {
  min-height: 100%;
  padding: var(--space-6);
  padding-top: calc(var(--space-6) + var(--space-4));
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
  display: grid;
  gap: var(--space-6);
}
.soft-rounded-shell {
  border-radius: var(--radius-lg);
}
.note-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  padding: var(--space-4);
}
.recommendation-note {
  background: var(--color-surface-muted);
}
.gentle-badge {
  display: inline-flex;
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  color: var(--color-accent-fg);
  padding: var(--space-2) var(--space-3);
}
.staged-checklist {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}
.now-next-later h2 {
  margin: var(--space-3) 0 var(--space-2);
  font-size: var(--text-lg);
}
`,
  },
};
