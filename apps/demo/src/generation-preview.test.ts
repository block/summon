import assert from 'node:assert/strict';
import test from 'node:test';
import type { SurfacePreviewSnapshot } from '@anarchitecture/summon/browser';
import type {
  SummonLayout,
  SurfaceContractView,
  SurfaceEvent,
  SurfacePlan,
} from '@anarchitecture/summon/engine';
import {
  buildGenerationPreview,
  reduceSurfacePreviewSnapshot,
} from './pages/generate/generationPreview.js';

const hostResourcePlan: SurfacePlan = {
  purpose: 'explore',
  runtime: 'arrow',
  data: 'host-resource',
  authority: 'read',
  persistence: 'replayable',
  network: 'none',
};

test('generation preview uses host layout slots before stream regions arrive', () => {
  const preview = buildGenerationPreview({
    prompt: 'build a launch plan',
    status: 'drafting',
    statusText: 'Composing surface',
    bytes: 0,
    artifactRevision: 0,
    rendered: false,
    surfacePlan: hostResourcePlan,
    contractView: null,
    layout: cardLayout,
    previewSnapshot: null,
    toolNames: [],
  });

  assert.deepEqual(preview.sections.map((section) => section.label), [
    'Header',
    'Content',
    'Actions',
  ]);
  assert.deepEqual(preview.sections.map((section) => section.source), [
    'layout',
    'layout',
    'layout',
  ]);
});

test('generation preview enriches layout slots with streamed region labels and summaries', () => {
  const preview = buildGenerationPreview({
    prompt: 'build a launch plan',
    status: 'drafting',
    statusText: 'Composing surface',
    bytes: 1200,
    artifactRevision: 0,
    rendered: false,
    surfacePlan: hostResourcePlan,
    contractView: null,
    layout: cardLayout,
    previewSnapshot: previewSnapshot,
    toolNames: [],
  });

  assert.deepEqual(preview.sections.map((section) => section.label), [
    'Decision frame',
    'Signal comparison',
    'Next action',
  ]);
  assert.equal(preview.sections[1]?.summary, 'Weights the candidate options.');
  assert.deepEqual(preview.sections.map((section) => section.source), [
    'stream',
    'stream',
    'stream',
  ]);
});

test('generation preview reducer folds streamed events into a host snapshot', () => {
  const events: SurfaceEvent[] = [
    {
      type: 'surface.start',
      id: 'main',
      kind: 'decision',
      title: 'Launch readiness',
    },
    {
      type: 'surface.status',
      status: 'drafting',
      text: 'Sketching the surface',
    },
    {
      type: 'region.add',
      id: 'summary',
      parent: 'main',
      role: 'summary',
      label: 'Decision frame',
    },
    {
      type: 'node.add',
      id: 'summary-copy',
      parent: 'summary',
      kind: 'text',
      props: { text: 'Clarifies the launch question.' },
    },
  ];
  let snapshot: SurfacePreviewSnapshot | null = null;
  for (const event of events) {
    snapshot = reduceSurfacePreviewSnapshot(snapshot, event);
  }

  const preview = buildGenerationPreview({
    prompt: 'build a launch plan',
    status: 'drafting',
    statusText: 'Composing surface',
    bytes: 512,
    artifactRevision: 0,
    rendered: false,
    surfacePlan: hostResourcePlan,
    contractView: null,
    layout: null,
    previewSnapshot: snapshot,
    toolNames: [],
  });

  assert.equal(preview.title, 'Launch readiness');
  assert.equal(preview.phase, 'Sketching the surface');
  assert.equal(preview.sections[0]?.label, 'Decision frame');
  assert.equal(preview.sections[0]?.summary, 'Clarifies the launch question.');
});

test('generation preview falls back to a generic skeleton without layout or stream events', () => {
  const preview = buildGenerationPreview({
    prompt: 'explain Roth vs traditional IRA',
    status: 'planning',
    statusText: 'Reading intent',
    bytes: 0,
    artifactRevision: 0,
    rendered: false,
    surfacePlan: {
      ...hostResourcePlan,
      data: 'embedded',
      authority: 'none',
    },
    contractView: null,
    layout: null,
    previewSnapshot: null,
    toolNames: [],
  });

  assert.deepEqual(preview.sections.map((section) => section.label), [
    'Frame',
    'Content',
    'Takeaway',
  ]);
  assert.deepEqual(preview.sections.map((section) => section.source), [
    'fallback',
    'fallback',
    'fallback',
  ]);
});

test('generation preview creates a small set of user-facing chips from contract data', () => {
  const preview = buildGenerationPreview({
    prompt: 'search dinner ideas',
    status: 'rendering',
    statusText: 'Mounting',
    bytes: 2048,
    artifactRevision: 1,
    rendered: false,
    surfacePlan: hostResourcePlan,
    contractView,
    layout: null,
    previewSnapshot: null,
    toolNames: ['fallback_tool'],
  });

  assert.deepEqual(preview.chips, ['interactive', 'host data', 'search', 'ai']);
  assert.equal(preview.artifactSeen, true);
  assert.equal(preview.rendered, false);
});

const cardLayout: SummonLayout = {
  id: 'card-structured',
  slots: [
    { id: 'header', purpose: 'short title and context' },
    { id: 'content', purpose: 'useful details and comparison' },
    { id: 'actions', purpose: 'next controls' },
  ],
};

const previewSnapshot: SurfacePreviewSnapshot = {
  surface: { id: 'main', kind: 'review', title: 'Launch readiness' },
  status: { status: 'drafting', text: 'Sketching the decision surface' },
  finalized: false,
  nodes: [
    {
      id: 'progress',
      kind: 'region',
      role: 'status',
      label: 'Preparing surface',
      props: {},
    },
    {
      id: 'decision',
      parent: 'main',
      kind: 'region',
      role: 'summary',
      label: 'Decision frame',
      props: {},
    },
    {
      id: 'decision-text',
      parent: 'decision',
      kind: 'text',
      props: { text: 'Clarifies the launch question.' },
    },
    {
      id: 'signals',
      parent: 'main',
      kind: 'region',
      role: 'comparison',
      label: 'Signal comparison',
      props: {},
    },
    {
      id: 'signals-text',
      parent: 'signals',
      kind: 'text',
      props: { text: 'Weights the candidate options.' },
    },
    {
      id: 'action',
      parent: 'main',
      kind: 'region',
      role: 'action',
      label: 'Next action',
      props: {},
    },
  ],
};

const contractView: SurfaceContractView = {
  surface: {
    policy: {
      tier: 'declarative',
      purpose: 'explore',
      grants: ['search', 'ai'],
      persistence: 'replayable',
    },
    plan: hostResourcePlan,
    mode: 'interactive',
  },
  tools: [
    {
      name: 'search',
      kind: 'resource',
      description: 'Search recipes',
      triggers: ['submit'],
      argsSchema: '{}',
      stateShape: '{}',
      surface: { data: 'host-resource', authority: 'read' },
    },
    {
      name: 'ai',
      kind: 'resource',
      description: 'Brainstorm',
      triggers: ['submit'],
      argsSchema: '{}',
      stateShape: '{}',
      surface: { data: 'host-resource', authority: 'read' },
    },
  ],
  layout: null,
  issues: [],
};
