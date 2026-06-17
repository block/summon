import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compileSurfaceContractView,
  compileSurfacePolicy,
  surfaceContractViewFromCompiledPolicy,
  type ToolPack,
} from '../src/index.ts';

const tools: ToolPack = {
  tools: [
    {
      name: 'search',
      description: 'Search host records.',
      argsSchema: '{query: string}',
      stateShape: '{loading: boolean, results: SearchResult[], error: string | null, empty: boolean}',
      kind: 'resource',
      triggers: ['submit', 'mount'],
      stateKeys: {
        loading: 'searchLoading',
        data: 'searchResults',
        error: 'searchError',
        empty: 'searchEmpty',
      },
      resultSchema: 'SearchResult[]',
      defaultDataShape: '[]',
      surface: { data: 'host-resource', authority: 'read' },
    },
    {
      name: 'choose',
      description: 'Save a choice.',
      argsSchema: '{id: string}',
      stateShape: '{choiceId: string}',
      kind: 'action',
      actionStateKeys: {
        pending: 'choosePending',
        done: 'chooseDone',
        error: 'chooseError',
      },
      surface: { authority: 'host-action' },
    },
    {
      name: 'analysis',
      description: 'Run worker analysis.',
      argsSchema: '{}',
      stateShape: '{}',
      kind: 'resource',
      surface: { data: 'worker', authority: 'read' },
    },
  ],
};

test('static policy contract view has no tools and Arrow runtime', () => {
  const view = compileSurfaceContractView({ tier: 'static', purpose: 'inform' }, {
    tools,
  });

  assert.deepEqual(view.tools, []);
  assert.equal(view.surface.policy.tier, 'static');
  assert.equal(view.surface.plan.runtime, 'arrow');
  assert.equal(view.surface.mode, 'static');
  assert.deepEqual(view.issues, []);
});

test('declarative search policy includes only selected resource state keys', () => {
  const view = compileSurfaceContractView({
    tier: 'declarative',
    purpose: 'explore',
    grants: ['search'],
  }, { tools });

  assert.deepEqual(view.tools.map((tool) => tool.name), ['search']);
  assert.deepEqual(view.tools[0], {
    name: 'search',
    kind: 'resource',
    description: 'Search host records.',
    triggers: ['submit', 'mount'],
    argsSchema: '{query: string}',
    stateShape: '{loading: boolean, results: SearchResult[], error: string | null, empty: boolean}',
    stateKeys: {
      loading: 'searchLoading',
      data: 'searchResults',
      error: 'searchError',
      empty: 'searchEmpty',
    },
    resultSchema: 'SearchResult[]',
    defaultDataShape: '[]',
    surface: { data: 'host-resource', authority: 'read' },
  });
  assert.equal(view.surface.plan.runtime, 'arrow');
  assert.equal(view.surface.plan.data, 'host-resource');
  assert.equal(view.surface.plan.authority, 'read');
});

test('invalid grants preserve compile issues in derived view', () => {
  const compiled = compileSurfacePolicy({
    tier: 'declarative',
    grants: ['missing', 'analysis'],
  }, { tools });
  const view = surfaceContractViewFromCompiledPolicy(compiled, {
    id: 'host-layout',
    slots: [{ id: 'hero', purpose: 'Main result' }],
  });

  assert.deepEqual(view.issues.map((issue) => issue.code), [
    'surface-policy-unknown-grant',
    'surface-policy-tier-exceeded',
  ]);
  assert.deepEqual(view.layout, {
    id: 'host-layout',
    slots: [{ id: 'hero', purpose: 'Main result' }],
  });
});
