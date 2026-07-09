import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compileSurfacePolicy,
  normalizeSurfacePolicy,
  surfacePlanCoversGrants,
  type SurfacePlan,
  type ToolPack,
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

test('normalizes defaults and dedupes policy names', () => {
  assert.deepEqual(normalizeSurfacePolicy({
    ceiling: { data: 'host-resource', authority: 'host-action' },
    grants: ['search', 'search', 'choose'],
  }), {
    ceiling: { data: 'host-resource', authority: 'host-action' },
    purpose: 'inform',
    grants: ['search', 'choose'],
    persistence: 'replayable',
  });
  // Omitted ceiling fails closed to static; omitted axes fail closed too.
  assert.deepEqual(normalizeSurfacePolicy({})?.ceiling, { data: 'embedded', authority: 'none' });
  assert.deepEqual(
    normalizeSurfacePolicy({ ceiling: { authority: 'host-action' } })?.ceiling,
    { data: 'embedded', authority: 'host-action' },
  );
  // Legacy tier input is rejected, not silently ignored.
  assert.equal(normalizeSurfacePolicy({ tier: 'declarative' }), null);
});

test('compiles static policy to static embedded plan with no packs', () => {
  const compiled = compileSurfacePolicy({ purpose: 'compare' }, {
    tools,
  });
  assert.deepEqual(compiled.issues, []);
  assert.equal(compiled.mode, 'static');
  assert.equal(compiled.tools, null);
  assert.equal(compiled.displayTier, 'static');
  assert.deepEqual(compiled.surfacePlan, {
    purpose: 'compare',
    runtime: 'surface-document',
    data: 'embedded',
    authority: 'none',
    persistence: 'replayable',
    network: 'none',
  });
});

test('compiles declarative-ceiling policy and narrows grants and patterns', () => {
  const compiled = compileSurfacePolicy({
    ceiling: { data: 'host-resource', authority: 'host-action' },
    purpose: 'explore',
    grants: ['search', 'choose'],
  }, { tools });
  assert.deepEqual(compiled.issues, []);
  assert.equal(compiled.mode, 'interactive');
  assert.deepEqual(compiled.tools?.tools.map((tool) => tool.name), ['search', 'choose']);
  assert.deepEqual(compiled.tools?.patterns?.map((pattern) => pattern.tool), ['search', 'choose']);
  assert.deepEqual(compiled.surfacePlan, {
    purpose: 'explore',
    runtime: 'surface-document',
    data: 'host-resource',
    authority: 'host-action',
    persistence: 'replayable',
    network: 'none',
  });
});

test('rejects legacy tier-authored policies', () => {
  const compiled = compileSurfacePolicy({
    tier: 'declarative',
    grants: ['choose'],
  } as never, { tools });
  assert.deepEqual(compiled.issues.map((issue) => issue.code), ['surface-policy-invalid']);
  assert.match(compiled.issues[0]!.message, /tier was removed/);
  assert.equal(compiled.mode, 'static');
  assert.equal(compiled.surfacePlan.runtime, 'surface-document');
});

test('compiles worker-ceiling policy and requires worker-backed surface area', () => {
  const compiled = compileSurfacePolicy({
    ceiling: { data: 'worker', authority: 'host-action' },
    purpose: 'review',
    grants: ['analysis', 'compute'],
  }, { tools });
  assert.deepEqual(compiled.issues, []);
  assert.equal(compiled.displayTier, 'worker');
  assert.deepEqual(compiled.surfacePlan, {
    purpose: 'review',
    runtime: 'surface-document',
    data: 'worker',
    authority: 'host-action',
    persistence: 'replayable',
    network: 'none',
  });

  const missing = compileSurfacePolicy({
    ceiling: { data: 'worker', authority: 'host-action' },
  }, { tools });
  assert.deepEqual(missing.issues.map((issue) => issue.code), ['surface-policy-ceiling-requirement']);
});

test('compiles approval-ceiling policy and requires approval-gated grant', () => {
  const compiled = compileSurfacePolicy({
    ceiling: { data: 'worker', authority: 'approval-gated' },
    purpose: 'operate',
    grants: ['publish'],
  }, { tools });
  assert.deepEqual(compiled.issues, []);
  assert.equal(compiled.displayTier, 'approval');
  // The plan reports reality (the join of granted tools), not the ceiling.
  assert.deepEqual(compiled.surfacePlan, {
    purpose: 'operate',
    runtime: 'surface-document',
    data: 'embedded',
    authority: 'approval-gated',
    persistence: 'replayable',
    network: 'none',
  });

  const missing = compileSurfacePolicy({
    ceiling: { authority: 'approval-gated' },
    grants: ['choose'],
  }, { tools });
  assert.deepEqual(missing.issues.map((issue) => issue.code), [
    'surface-policy-ceiling-requirement',
  ]);
});

test('compiles mixed compute-then-commit policy under the approval ceiling', () => {
  // The flow the tier vocabulary made inexpressible: worker compute +
  // approval-gated commit on one surface.
  const compiled = compileSurfacePolicy({
    ceiling: { data: 'worker', authority: 'approval-gated' },
    purpose: 'operate',
    grants: ['analysis', 'publish'],
  }, { tools });
  assert.deepEqual(compiled.issues, []);
  assert.equal(compiled.displayTier, 'approval');
  assert.deepEqual(compiled.tools?.tools.map((tool) => tool.name), ['analysis', 'publish']);
  assert.deepEqual(compiled.surfacePlan, {
    purpose: 'operate',
    runtime: 'surface-document',
    data: 'worker',
    authority: 'approval-gated',
    persistence: 'replayable',
    network: 'none',
  });
});

test('blocks unknown names and ceiling-exceeded grants', () => {
  const compiled = compileSurfacePolicy({
    ceiling: { data: 'host-resource', authority: 'host-action' },
    grants: ['missing', 'analysis', 'publish'],
  }, { tools });
  assert.deepEqual(compiled.issues.map((issue) => issue.code), [
    'surface-policy-unknown-grant',
    'surface-policy-ceiling-exceeded',
    'surface-policy-ceiling-exceeded',
  ]);
  assert.equal(compiled.issues.every((issue) => issue.source === 'system' && issue.severity === 'block'), true);
  // Exceeding grants are excluded from the narrowed pack (fail closed).
  assert.equal(compiled.tools, null);
});

test('surfacePlanCoversGrants accepts plans that meet the grant capability floor', () => {
  const plan: SurfacePlan = {
    purpose: 'operate',
    runtime: 'surface-document',
    data: 'host-resource',
    authority: 'host-action',
    persistence: 'replayable',
    network: 'none',
  };
  assert.equal(surfacePlanCoversGrants(plan, [], []), true);
  assert.equal(
    surfacePlanCoversGrants(plan, ['search', 'choose'], [
      { name: 'search', kind: 'resource', surface: { data: 'host-resource', authority: 'read' } },
      { name: 'choose', kind: 'action', surface: { authority: 'host-action' } },
    ]),
    true,
  );
  // Overstatement is tolerated — errs toward scarier chrome.
  assert.equal(
    surfacePlanCoversGrants(
      { ...plan, data: 'worker', authority: 'approval-gated' },
      ['search'],
      [{ name: 'search', kind: 'resource', surface: { data: 'host-resource', authority: 'read' } }],
    ),
    true,
  );
});

test('surfacePlanCoversGrants rejects plans that understate grant capability', () => {
  const understated: SurfacePlan = {
    purpose: 'inform',
    runtime: 'surface-document',
    data: 'embedded',
    authority: 'none',
    persistence: 'replayable',
    network: 'none',
  };
  // Approval-gated grant behind an authority:none label — the spoof case.
  assert.equal(
    surfacePlanCoversGrants(understated, ['publish'], [
      { name: 'publish', kind: 'action', surface: { authority: 'approval-gated' } },
    ]),
    false,
  );
  // Worker-backed grant behind an embedded data label.
  assert.equal(
    surfacePlanCoversGrants(understated, ['analysis'], [
      { name: 'analysis', kind: 'resource', surface: { data: 'worker', authority: 'read' } },
    ]),
    false,
  );
});

test('surfacePlanCoversGrants fails closed for grants without tool entries', () => {
  const plan: SurfacePlan = {
    purpose: 'inform',
    runtime: 'surface-document',
    data: 'embedded',
    authority: 'none',
    persistence: 'replayable',
    network: 'none',
  };
  // Unknown grant defaults to action semantics (authority: host-action):
  // a none-authority plan cannot cover it.
  assert.equal(surfacePlanCoversGrants(plan, ['mystery'], []), false);
  assert.equal(surfacePlanCoversGrants(plan, ['mystery'], undefined), false);
  assert.equal(
    surfacePlanCoversGrants({ ...plan, authority: 'host-action' }, ['mystery'], []),
    true,
  );
});
