import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compileSurfaceContractView,
  compileSurfacePolicy,
  surfaceContractViewFromCompiledPolicy,
  type CapabilityPack,
  type ComponentPack,
} from '../src/index.ts';

const capabilities: CapabilityPack = {
  intents: [
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

const components: ComponentPack = {
  components: [
    {
      name: 'MetricCard',
      description: 'Trusted metric card.',
      propsSchema: '{label: string, value: string}',
      surface: { data: 'embedded', authority: 'none' },
      sizing: { width: '320px', height: '112px' },
      examples: [{ name: 'Example', code: '<div>large example omitted from view</div>' }],
    },
    {
      name: 'WorkerChart',
      description: 'Worker-backed chart.',
      propsSchema: '{}',
      surface: { data: 'worker', authority: 'read' },
    },
  ],
};

test('static policy contract view has no tools/components and static runtime', () => {
  const view = compileSurfaceContractView({ tier: 'static', purpose: 'inform' }, {
    capabilities,
    components,
  });

  assert.deepEqual(view.tools, []);
  assert.deepEqual(view.components, []);
  assert.equal(view.surface.policy.tier, 'static');
  assert.equal(view.surface.plan.runtime, 'static');
  assert.equal(view.surface.mode, 'static');
  assert.equal(view.surface.scriptPolicy, 'forbid');
  assert.deepEqual(view.issues, []);
});

test('declarative search policy includes only selected resource state keys', () => {
  const view = compileSurfaceContractView({
    tier: 'declarative',
    purpose: 'explore',
    grants: ['search'],
  }, { capabilities });

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
  assert.equal(view.surface.plan.runtime, 'declarative');
  assert.equal(view.surface.plan.data, 'host-resource');
  assert.equal(view.surface.plan.authority, 'read');
});

test('component policy includes only selected trusted components without examples', () => {
  const view = compileSurfaceContractView({
    tier: 'declarative',
    components: ['MetricCard'],
  }, { components });

  assert.deepEqual(view.components, [
    {
      name: 'MetricCard',
      description: 'Trusted metric card.',
      propsSchema: '{label: string, value: string}',
      sizing: { width: '320px', height: '112px' },
      surface: { data: 'embedded', authority: 'none' },
    },
  ]);
  assert.equal('examples' in view.components[0]!, false);
});

test('invalid grants/components preserve compile issues in derived view', () => {
  const compiled = compileSurfacePolicy({
    tier: 'declarative',
    grants: ['missing', 'analysis'],
    components: ['MissingComponent', 'WorkerChart'],
  }, { capabilities, components });
  const view = surfaceContractViewFromCompiledPolicy(compiled, {
    id: 'host-layout',
    slots: [{ id: 'hero', purpose: 'Main result' }],
  });

  assert.deepEqual(view.issues.map((issue) => issue.code), [
    'surface-policy-unknown-grant',
    'surface-policy-tier-exceeded',
    'surface-policy-unknown-component',
    'surface-policy-tier-exceeded',
  ]);
  assert.deepEqual(view.layout, {
    id: 'host-layout',
    slots: [{ id: 'hero', purpose: 'Main result' }],
  });
});
