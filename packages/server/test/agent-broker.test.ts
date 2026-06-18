import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inferSurfaceGoal,
  planAgentSurface,
  runAgentSurfaceGeneration,
  type AgentGoalTextClient,
  type SurfaceModelProvider,
} from '../src/index.ts';
import type {
  ToolPack,
  ProtocolLine,
} from '@summon-internal/engine';

const tools: ToolPack = {
  tools: [
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

function arrowBundle(html: string) {
  const source = html.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  return {
    schema: 'summon.arrow-bundle/v1' as const,
    source: {
      'main.ts': `import { html } from "@arrow-js/core";\nexport default html\`${source}\`;`,
    },
  };
}

const multiToolPack: ToolPack = {
  tools: [
    ...tools.tools,
    {
      name: 'delete_record',
      description: 'Delete a selected record after host approval.',
      argsSchema: '{}',
      stateShape: '{}',
      kind: 'action',
      surface: { authority: 'approval-gated' },
    },
    {
      name: 'github_lookup',
      description: 'Look up GitHub profile data.',
      argsSchema: '{}',
      stateShape: '{}',
      kind: 'resource',
      surface: { data: 'host-resource', authority: 'read' },
    },
    {
      name: 'compute_score',
      description: 'Run background score computation.',
      argsSchema: '{}',
      stateShape: '{}',
      kind: 'action',
      surface: { data: 'worker', authority: 'host-action' },
    },
    {
      name: 'counter',
      description: 'Increment a local counter.',
      argsSchema: '{}',
      stateShape: '{}',
      kind: 'action',
      surface: { authority: 'host-action' },
    },
  ],
};

test('inferSurfaceGoal maps search prompts to host-resource tool', () => {
  const tool = inferSurfaceGoal(
    'build a dinner finder where i can search recipes and browse results',
    { tools },
  );

  assert.equal(tool.purpose, 'explore');
  assert.equal(tool.interaction, 'search');
  assert.equal(tool.dataNeed, 'host-resource');
  assert.deepEqual(tool.requestedTools, ['search']);
});

test('planAgentSurface proposes and compiles a declarative policy', async () => {
  const plan = await planAgentSurface({
    prompt: 'build a dinner finder where i can search recipes',
    tools,
  });

  assert.deepEqual(plan.surfacePolicy, {
    tier: 'declarative',
    purpose: 'explore',
    grants: ['search'],
    persistence: 'replayable',
  });
  assert.equal(plan.goalSource, 'deterministic');
  assert.deepEqual(plan.compiledPolicy.issues, []);
    assert.deepEqual(plan.compiledPolicy.surfacePlan, {
      purpose: 'explore',
      runtime: 'arrow',
      data: 'host-resource',
      authority: 'read',
      persistence: 'replayable',
      network: 'none',
    });
});

test('planAgentSurface keeps passive summary prompts static despite powerful nouns', async () => {
  const updateSummary = await planAgentSurface({
    prompt: 'make a product update summary for this launch',
    tools,
  });
  assert.equal(updateSummary.surfacePolicy.tier, 'static');
  assert.equal(updateSummary.surfacePolicy.grants, undefined);

  const riskSummary = await planAgentSurface({
    prompt: 'summarize launch risk for next week',
    tools,
  });
  assert.equal(riskSummary.surfacePolicy.tier, 'static');
  assert.equal(riskSummary.surfacePolicy.grants, undefined);
});

test('planAgentSurface selects worker and approval tiers from catalog-backed tool', async () => {
  const worker = await planAgentSurface({
    prompt: 'analyze launch risk in the background and score readiness',
    tools,
  });
  assert.equal(worker.surfacePolicy.tier, 'worker');
  assert.deepEqual(worker.surfacePolicy.grants, ['analysis']);

  const approval = await planAgentSurface({
    prompt: 'publish the prepared product update summary',
    tools,
  });
  assert.equal(approval.surfacePolicy.tier, 'approval');
  assert.deepEqual(approval.surfacePolicy.grants, ['publish_summary']);
  assert.equal(approval.surfacePolicy.purpose, 'operate');
});

test('planAgentSurface keeps multi-tool class inference narrow', async () => {
  const approval = await planAgentSurface({
    prompt: 'publish the prepared summary',
    tools: multiToolPack,
  });
  assert.equal(approval.surfacePolicy.tier, 'approval');
  assert.deepEqual(approval.surfacePolicy.grants, ['publish_summary']);

  const search = await planAgentSurface({
    prompt: 'search recipes for dinner',
    tools: multiToolPack,
  });
  assert.equal(search.surfacePolicy.tier, 'declarative');
  assert.deepEqual(search.surfacePolicy.grants, ['search']);

  const ambiguousSearch = await planAgentSurface({
    prompt: 'search the host data',
    tools: {
      tools: [
        {
          name: 'recipe_lookup',
          description: 'Look up recipe data.',
          argsSchema: '{}',
          stateShape: '{}',
          kind: 'resource',
          surface: { data: 'host-resource', authority: 'read' },
        },
        {
          name: 'github_lookup',
          description: 'Look up GitHub profile data.',
          argsSchema: '{}',
          stateShape: '{}',
          kind: 'resource',
          surface: { data: 'host-resource', authority: 'read' },
        },
      ],
    },
  });
  assert.equal(ambiguousSearch.surfacePolicy.tier, 'static');
  assert.equal(ambiguousSearch.surfacePolicy.grants, undefined);
});

test('planAgentSurface selects host actions only from explicit action phrasing', async () => {
  const plan = await planAgentSurface({
    prompt: 'let me save a choice for the launch announcement',
    tools,
  });

  assert.equal(plan.surfacePolicy.tier, 'declarative');
  assert.equal(plan.surfacePolicy.purpose, 'operate');
  assert.deepEqual(plan.surfacePolicy.grants, ['choose']);
    assert.deepEqual(plan.compiledPolicy.surfacePlan, {
      purpose: 'operate',
      runtime: 'arrow',
      data: 'embedded',
      authority: 'host-action',
      persistence: 'replayable',
      network: 'none',
    });
});

test('model-assisted tool can narrow to known names but cannot add unknown grants', async () => {
  const goalModel: AgentGoalTextClient = {
    completeText: async () => JSON.stringify({
      purpose: 'operate',
      interaction: 'approval',
      dataNeed: 'embedded',
      sideEffect: 'approval-required',
      requestedTools: ['missing', 'publish_summary'],
      confidence: 0.91,
    }),
  };

  const plan = await planAgentSurface({
    prompt: 'publish the prepared product update summary',
    tools,
    goalModel,
  });

  assert.equal(plan.surfacePolicy.tier, 'approval');
  assert.equal(plan.goalSource, 'model');
  assert.deepEqual(plan.surfacePolicy.grants, ['publish_summary']);
  assert.deepEqual(plan.policyResolution.rejectedTools, []);
});

test('provided tool is reported separately from model and deterministic sources', async () => {
  const plan = await planAgentSurface({
    prompt: 'show the matching recipes',
    tools,
    goal: {
      purpose: 'explore',
      interaction: 'search',
      dataNeed: 'host-resource',
      sideEffect: 'none',
      requestedTools: ['search'],
      confidence: 1,
    },
  });

  assert.equal(plan.goalSource, 'provided');
  assert.equal(plan.surfacePolicy.tier, 'declarative');
  assert.deepEqual(plan.surfacePolicy.grants, ['search']);
});

test('host policy resolver can force a static fallback', async () => {
  const plan = await planAgentSurface({
    prompt: 'build a dinner finder where i can search recipes',
    tools,
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
  const provider: SurfaceModelProvider = {
    async generateArrowBundle() {
      return arrowBundle('<section><h1>Dinner finder</h1><p>Ready.</p></section>');
    },
  };

  const summary = await runAgentSurfaceGeneration({
    prompt: 'build a dinner finder where i can search recipes',
    tools,
    modelProvider: provider,
  }, (line) => {
    lines.push(line);
  });

  assert.deepEqual(lines.slice(0, 5).map((line) => `${line.op} ${line.path}`), [
    'meta /agent-goal',
    'meta /agent-policy-resolution',
    'meta /surface-policy',
    'meta /surface-plan',
    'meta /surface-contract',
  ]);
  assert.equal(summary.agent.surfacePolicy.tier, 'declarative');
  assert.equal(summary.agent.goalSource, 'deterministic');
  const policyResolution = lines[1] as Extract<ProtocolLine, { op: 'meta' }>;
  assert.equal((policyResolution.value as { goalSource?: unknown }).goalSource, 'deterministic');
  assert.equal(summary.blocked, false);
});
