import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compileSurfacePolicy,
  normalizeSurfacePolicy,
  type ToolPack,
  type ComponentPack,
} from '../src/index.ts';

const tools: ToolPack = {
  tools: [
    {
      name: 'search',
      description: 'Search host data',
      argsSchema: '{}',
      stateShape: '{}',
      kind: 'resource',
      surface: { data: 'host-resource', authority: 'read' },
    },
    {
      name: 'choose',
      description: 'Save a choice',
      argsSchema: '{}',
      stateShape: '{}',
      kind: 'action',
      surface: { authority: 'host-action' },
    },
    {
      name: 'publish',
      description: 'Publish with host approval',
      argsSchema: '{}',
      stateShape: '{}',
      kind: 'action',
      surface: { authority: 'approval-gated' },
    },
    {
      name: 'analysis',
      description: 'Run worker analysis',
      argsSchema: '{}',
      stateShape: '{}',
      kind: 'resource',
      surface: { data: 'worker', authority: 'read' },
    },
    {
      name: 'compute',
      description: 'Run worker compute',
      argsSchema: '{}',
      stateShape: '{}',
      kind: 'action',
      surface: { data: 'worker', authority: 'host-action' },
    },
  ],
  patterns: [
    { name: 'Search', code: 'import { callTool } from "host-bridge:summon";\nconst search = (query: string) => callTool("search", { query });', tool: 'search' },
    { name: 'Choose', code: 'import { callTool } from "host-bridge:summon";\nconst choose = () => callTool("choose", {});', tool: 'choose' },
  ],
};

const components: ComponentPack = {
  components: [
    {
      name: 'MetricCard',
      description: 'Embedded metric',
      propsSchema: '{}',
      surface: { data: 'embedded', authority: 'none' },
    },
    {
      name: 'WorkerChart',
      description: 'Worker chart',
      propsSchema: '{}',
      surface: { data: 'worker', authority: 'read' },
    },
  ],
};

test('normalizes defaults and dedupes policy names', () => {
  assert.deepEqual(normalizeSurfacePolicy({
    tier: 'declarative',
    grants: ['search', 'search', 'choose'],
    components: ['MetricCard', 'MetricCard'],
  }), {
    tier: 'declarative',
    purpose: 'inform',
    grants: ['search', 'choose'],
    components: ['MetricCard'],
    persistence: 'replayable',
  });
});

test('compiles static policy to static embedded plan with no packs', () => {
  const compiled = compileSurfacePolicy({ tier: 'static', purpose: 'compare' }, {
    tools,
    components,
  });
  assert.deepEqual(compiled.issues, []);
  assert.equal(compiled.mode, 'static');
  assert.equal(compiled.tools, null);
  assert.equal(compiled.components, null);
  assert.deepEqual(compiled.surfacePlan, {
    purpose: 'compare',
    runtime: 'arrow',
    data: 'embedded',
    authority: 'none',
    persistence: 'replayable',
    network: 'none',
  });
});

test('compiles declarative policy and narrows grants, components, and patterns', () => {
  const compiled = compileSurfacePolicy({
    tier: 'declarative',
    purpose: 'explore',
    grants: ['search', 'choose'],
    components: ['MetricCard'],
  }, { tools, components });
  assert.deepEqual(compiled.issues, []);
  assert.equal(compiled.mode, 'interactive');
  assert.deepEqual(compiled.tools?.tools.map((tool) => tool.name), ['search', 'choose']);
  assert.deepEqual(compiled.tools?.patterns?.map((pattern) => pattern.tool), ['search', 'choose']);
  assert.deepEqual(compiled.components?.components.map((component) => component.name), ['MetricCard']);
  assert.deepEqual(compiled.surfacePlan, {
    purpose: 'explore',
    runtime: 'arrow',
    data: 'host-resource',
    authority: 'host-action',
    persistence: 'replayable',
    network: 'none',
  });
});

test('rejects removed scripted policy tier', () => {
  const compiled = compileSurfacePolicy({
    tier: 'scripted',
    grants: ['choose'],
  } as never, { tools });
  assert.deepEqual(compiled.issues.map((issue) => issue.code), ['surface-policy-invalid']);
  assert.equal(compiled.mode, 'static');
  assert.equal(compiled.surfacePlan.runtime, 'arrow');
});

test('compiles worker policy and requires worker-backed surface area', () => {
  const compiled = compileSurfacePolicy({
    tier: 'worker',
    purpose: 'review',
    grants: ['analysis', 'compute'],
  }, { tools });
  assert.deepEqual(compiled.issues, []);
  assert.deepEqual(compiled.surfacePlan, {
    purpose: 'review',
    runtime: 'arrow',
    data: 'worker',
    authority: 'host-action',
    persistence: 'replayable',
    network: 'none',
  });

  const missing = compileSurfacePolicy({ tier: 'worker' }, { tools });
  assert.deepEqual(missing.issues.map((issue) => issue.code), ['surface-policy-tier-requirement']);
});

test('compiles approval policy and requires approval-gated grant', () => {
  const compiled = compileSurfacePolicy({
    tier: 'approval',
    purpose: 'operate',
    grants: ['publish'],
  }, { tools });
  assert.deepEqual(compiled.issues, []);
  assert.deepEqual(compiled.surfacePlan, {
    purpose: 'operate',
    runtime: 'arrow',
    data: 'embedded',
    authority: 'approval-gated',
    persistence: 'replayable',
    network: 'none',
  });

  const missing = compileSurfacePolicy({ tier: 'approval', grants: ['choose'] }, { tools });
  assert.deepEqual(missing.issues.map((issue) => issue.code), [
    'surface-policy-tier-exceeded',
    'surface-policy-tier-requirement',
  ]);
});

test('blocks unknown names and tier-exceeded grants/components', () => {
  const compiled = compileSurfacePolicy({
    tier: 'declarative',
    grants: ['missing', 'analysis', 'publish'],
    components: ['MissingComponent', 'WorkerChart'],
  }, { tools, components });
  assert.deepEqual(compiled.issues.map((issue) => issue.code), [
    'surface-policy-unknown-grant',
    'surface-policy-tier-exceeded',
    'surface-policy-tier-exceeded',
    'surface-policy-unknown-component',
    'surface-policy-tier-exceeded',
  ]);
  assert.equal(compiled.issues.every((issue) => issue.source === 'system' && issue.severity === 'block'), true);
});
