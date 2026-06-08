import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSurfaceGenerationPlan } from '@anarchitecture/summon-server';
import type { CapabilityPack } from '@anarchitecture/summon';
import { parseCapabilityPack } from './capability-pack.js';

const capabilities: CapabilityPack = {
  intents: [
    {
      name: 'search',
      description: 'Search host data.',
      argsSchema: '{query: string}',
      stateShape: '{}',
      kind: 'resource',
      surface: { data: 'host-resource', authority: 'read' },
    },
    {
      name: 'analyze',
      description: 'Run worker analysis.',
      argsSchema: '{id: string}',
      stateShape: '{}',
      surface: { data: 'worker', authority: 'host-action' },
    },
    {
      name: 'publish',
      description: 'Publish after approval.',
      argsSchema: '{title: string}',
      stateShape: '{}',
      surface: { authority: 'approval-gated' },
    },
  ],
};

test('explicit surface plan is honored when within ceiling', () => {
  const resolved = resolveSurfaceGenerationPlan({
    prompt: 'publish this',
    mode: 'interactive',
    capabilities,
    rawSurfacePlan: {
      purpose: 'operate',
      runtime: 'worker',
      data: 'worker',
      authority: 'approval-gated',
      persistence: 'replayable',
    },
    rawSurfaceCeiling: {
      runtimes: ['static', 'declarative', 'worker'],
      data: ['embedded', 'host-resource', 'worker'],
      authorities: ['none', 'read', 'host-action', 'approval-gated'],
      persistences: ['replayable'],
    },
  });

  assert.equal(resolved.explicitAccepted, true);
  assert.equal(resolved.mode, 'interactive');
  assert.equal(resolved.scriptPolicy, 'forbid');
  assert.deepEqual(resolved.surfacePlan, {
    purpose: 'operate',
    runtime: 'worker',
    data: 'worker',
    authority: 'approval-gated',
    persistence: 'replayable',
  });
});

test('inferred surface plan never widens beyond default ceiling', () => {
  const resolved = resolveSurfaceGenerationPlan({
    prompt: 'analyze this batch and publish the result after approval',
    mode: 'interactive',
    capabilities,
  });

  assert.deepEqual(resolved.surfacePlan, {
    purpose: 'review',
    runtime: 'declarative',
    data: 'host-resource',
    authority: 'host-action',
    persistence: 'replayable',
  });
});

test('static mode stays static while preserving compatible surface metadata', () => {
  const resolved = resolveSurfaceGenerationPlan({
    prompt: 'search for recipes',
    mode: 'static',
    capabilities,
  });

  assert.equal(resolved.mode, 'static');
  assert.equal(resolved.scriptPolicy, 'forbid');
  assert.deepEqual(resolved.surfacePlan, {
    purpose: 'explore',
    runtime: 'static',
    data: 'embedded',
    authority: 'none',
    persistence: 'replayable',
  });
});

test('parsed worker capability resolves to worker surface when explicitly requested', () => {
  const parsed = parseCapabilityPack({
    intents: [
      {
        name: 'analysis',
        description: 'Run worker analysis.',
        argsSchema: '{topic: string}',
        stateShape: '{}',
        kind: 'resource',
        surface: { data: 'worker', authority: 'read' },
      },
      {
        name: 'compute_score',
        description: 'Run worker calculation.',
        argsSchema: '{topic: string}',
        stateShape: '{}',
        kind: 'action',
        surface: { data: 'worker', authority: 'host-action' },
      },
    ],
  });
  assert.ok(parsed);

  const resolved = resolveSurfaceGenerationPlan({
    prompt: 'analyze and score this rollout plan',
    mode: 'interactive',
    capabilities: parsed,
    rawSurfaceCeiling: {
      runtimes: ['static', 'declarative', 'worker'],
      data: ['embedded', 'host-resource', 'worker'],
      authorities: ['none', 'read', 'host-action'],
      persistences: ['replayable'],
    },
  });

  assert.deepEqual(resolved.surfacePlan, {
    purpose: 'inform',
    runtime: 'worker',
    data: 'worker',
    authority: 'host-action',
    persistence: 'replayable',
  });
});

test('scripted surface resolves to allow only when explicitly requested within ceiling', () => {
  const resolved = resolveSurfaceGenerationPlan({
    prompt: 'build keyboard shortcuts with local highlighted selection',
    mode: 'interactive',
    scriptPolicy: 'allow',
    rawSurfacePlan: {
      purpose: 'explore',
      runtime: 'scripted',
      data: 'embedded',
      authority: 'host-action',
      persistence: 'replayable',
    },
    rawSurfaceCeiling: {
      runtimes: ['static', 'declarative', 'scripted'],
      data: ['embedded'],
      authorities: ['none', 'host-action'],
      persistences: ['replayable'],
    },
  });

  assert.equal(resolved.explicitAccepted, true);
  assert.equal(resolved.scriptPolicy, 'allow');
  assert.deepEqual(resolved.surfacePlan, {
    purpose: 'explore',
    runtime: 'scripted',
    data: 'embedded',
    authority: 'host-action',
    persistence: 'replayable',
  });
});

test('scripted request falls back to forbid when ceiling excludes scripted runtime', () => {
  const resolved = resolveSurfaceGenerationPlan({
    prompt: 'build keyboard shortcuts with local highlighted selection',
    mode: 'interactive',
    scriptPolicy: 'allow',
    rawSurfacePlan: {
      purpose: 'explore',
      runtime: 'scripted',
      data: 'embedded',
      authority: 'host-action',
      persistence: 'replayable',
    },
    rawSurfaceCeiling: {
      runtimes: ['static', 'declarative'],
      data: ['embedded'],
      authorities: ['none', 'host-action'],
      persistences: ['replayable'],
    },
  });

  assert.equal(resolved.explicitAccepted, false);
  assert.equal(resolved.scriptPolicy, 'forbid');
  assert.equal(resolved.surfacePlan.runtime, 'declarative');
});

test('parsed approval capability resolves to approval-gated authority', () => {
  const parsed = parseCapabilityPack({
    intents: [
      {
        name: 'publish_summary',
        description: 'Publish after approval.',
        argsSchema: '{title: string}',
        stateShape: '{}',
        kind: 'action',
        surface: { authority: 'approval-gated' },
      },
    ],
  });
  assert.ok(parsed);

  const resolved = resolveSurfaceGenerationPlan({
    prompt: 'publish this summary after approval',
    mode: 'interactive',
    capabilities: parsed,
    rawSurfaceCeiling: {
      runtimes: ['static', 'declarative'],
      data: ['embedded'],
      authorities: ['none', 'read', 'host-action', 'approval-gated'],
      persistences: ['replayable'],
    },
  });

  assert.deepEqual(resolved.surfacePlan, {
    purpose: 'review',
    runtime: 'declarative',
    data: 'embedded',
    authority: 'approval-gated',
    persistence: 'replayable',
  });
});
