import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inferSurfaceIntent,
  planAgentSurface,
  runAgentSurfaceGeneration,
  type AgentIntentTextClient,
  type SummonModelProvider,
} from '../src/index.ts';
import type {
  CapabilityPack,
  ProtocolLine,
} from '@summon-internal/engine';

const capabilities: CapabilityPack = {
  intents: [
    {
      name: 'search',
      description: 'Search host-owned recipe data.',
      argsSchema: '{}',
      stateShape: '{}',
      kind: 'resource',
      surface: { data: 'host-resource', authority: 'read' },
    },
    {
      name: 'choose',
      description: 'Save a user choice.',
      argsSchema: '{}',
      stateShape: '{}',
      kind: 'action',
      surface: { authority: 'host-action' },
    },
    {
      name: 'analysis',
      description: 'Run background risk analysis.',
      argsSchema: '{}',
      stateShape: '{}',
      kind: 'resource',
      surface: { data: 'worker', authority: 'read' },
    },
    {
      name: 'publish_summary',
      description: 'Publish a prepared summary after host approval.',
      argsSchema: '{}',
      stateShape: '{}',
      kind: 'action',
      surface: { authority: 'approval-gated' },
    },
  ],
};

test('inferSurfaceIntent maps search prompts to host-resource intent', () => {
  const intent = inferSurfaceIntent(
    'build a dinner finder where i can search recipes and browse results',
    { capabilities },
  );

  assert.equal(intent.purpose, 'explore');
  assert.equal(intent.interaction, 'search');
  assert.equal(intent.dataNeed, 'host-resource');
  assert.deepEqual(intent.requestedCapabilities, ['search']);
});

test('planAgentSurface proposes and compiles a declarative policy', async () => {
  const plan = await planAgentSurface({
    prompt: 'build a dinner finder where i can search recipes',
    capabilities,
  });

  assert.deepEqual(plan.surfacePolicy, {
    tier: 'declarative',
    purpose: 'explore',
    grants: ['search'],
    persistence: 'replayable',
  });
  assert.deepEqual(plan.compiledPolicy.issues, []);
  assert.deepEqual(plan.compiledPolicy.surfacePlan, {
    purpose: 'explore',
    runtime: 'declarative',
    data: 'host-resource',
    authority: 'read',
    persistence: 'replayable',
  });
});

test('planAgentSurface keeps passive summary prompts static despite powerful nouns', async () => {
  const updateSummary = await planAgentSurface({
    prompt: 'make a product update summary for this launch',
    capabilities,
  });
  assert.equal(updateSummary.surfacePolicy.tier, 'static');
  assert.equal(updateSummary.surfacePolicy.grants, undefined);

  const riskSummary = await planAgentSurface({
    prompt: 'summarize launch risk for next week',
    capabilities,
  });
  assert.equal(riskSummary.surfacePolicy.tier, 'static');
  assert.equal(riskSummary.surfacePolicy.grants, undefined);
});

test('planAgentSurface selects worker and approval tiers from catalog-backed intent', async () => {
  const worker = await planAgentSurface({
    prompt: 'analyze launch risk in the background and score readiness',
    capabilities,
  });
  assert.equal(worker.surfacePolicy.tier, 'worker');
  assert.deepEqual(worker.surfacePolicy.grants, ['analysis']);

  const approval = await planAgentSurface({
    prompt: 'publish the prepared product update summary',
    capabilities,
  });
  assert.equal(approval.surfacePolicy.tier, 'approval');
  assert.deepEqual(approval.surfacePolicy.grants, ['publish_summary']);
  assert.equal(approval.surfacePolicy.purpose, 'operate');
});

test('planAgentSurface selects host actions only from explicit action phrasing', async () => {
  const plan = await planAgentSurface({
    prompt: 'let me save a choice for the launch announcement',
    capabilities,
  });

  assert.equal(plan.surfacePolicy.tier, 'declarative');
  assert.equal(plan.surfacePolicy.purpose, 'operate');
  assert.deepEqual(plan.surfacePolicy.grants, ['choose']);
  assert.deepEqual(plan.compiledPolicy.surfacePlan, {
    purpose: 'operate',
    runtime: 'declarative',
    data: 'embedded',
    authority: 'host-action',
    persistence: 'replayable',
  });
});

test('model-assisted intent can narrow to known names but cannot add unknown grants', async () => {
  const intentModel: AgentIntentTextClient = {
    completeText: async () => JSON.stringify({
      purpose: 'operate',
      interaction: 'approval',
      dataNeed: 'embedded',
      sideEffect: 'approval-required',
      requestedCapabilities: ['missing', 'publish_summary'],
      requestedComponents: ['MysteryCard'],
      confidence: 0.91,
    }),
  };

  const plan = await planAgentSurface({
    prompt: 'publish the prepared product update summary',
    capabilities,
    intentModel,
  });

  assert.equal(plan.surfacePolicy.tier, 'approval');
  assert.deepEqual(plan.surfacePolicy.grants, ['publish_summary']);
  assert.equal(plan.surfacePolicy.components, undefined);
  assert.deepEqual(plan.policyResolution.rejectedCapabilities, []);
});

test('host policy resolver can force a static fallback', async () => {
  const plan = await planAgentSurface({
    prompt: 'build a dinner finder where i can search recipes',
    capabilities,
    hostPolicyResolver: () => null,
  });

  assert.equal(plan.policyResolution.source, 'host');
  assert.equal(plan.policyResolution.fallback, true);
  assert.deepEqual(plan.surfacePolicy, {
    tier: 'static',
    purpose: 'inform',
    persistence: 'replayable',
  });
});

test('runAgentSurfaceGeneration emits agent diagnostics before policy metadata', async () => {
  const lines: ProtocolLine[] = [];
  const provider: SummonModelProvider = async function* () {
    yield '{"op":"set","path":"/screen","value":{"sections":["hero"]}}\n';
    yield '{"op":"add","path":"/section/hero","html":"<section><h1>Dinner finder</h1><p>Ready.</p></section>"}\n';
  };

  const summary = await runAgentSurfaceGeneration({
    prompt: 'build a dinner finder where i can search recipes',
    capabilities,
    modelProvider: provider,
  }, (line) => {
    lines.push(line);
  });

  assert.deepEqual(lines.slice(0, 5).map((line) => `${line.op} ${line.path}`), [
    'meta /agent-intent',
    'meta /agent-policy-resolution',
    'meta /surface-policy',
    'meta /surface-plan',
    'meta /surface-contract',
  ]);
  assert.equal(summary.agent.surfacePolicy.tier, 'declarative');
  assert.equal(summary.blocked, false);
});
