import assert from 'node:assert/strict';
import test from 'node:test';
import {
  IntentArgsError,
  PolicyEngine,
  createCapabilityRegistry,
  createComponentRegistry,
  createSurfaceEnvelope,
  defineAction,
  defineApprovalAction,
  defineCapability,
  defineDataResource,
  defineComponent,
  defineWorkerAction,
  defineWorkerResource,
  parseSurfaceEnvelope,
} from '../src/index.ts';
import { z } from 'zod';

test('registry converts actions and resources into prompt and validation metadata', () => {
  const registry = createCapabilityRegistry([
    defineAction({
      name: 'counter',
      description: 'Adjust the counter.',
      argsSchema: z.object({ delta: z.number() }),
      stateShape: '{count: number}',
      patterns: [{ name: 'Counter', code: '<button>+</button>' }],
      handler: () => {},
    }),
    defineDataResource({
      name: 'lookup',
      description: 'Fetch a lookup result.',
      argsSchema: z.object({ query: z.string() }),
      resultSchema: z.object({ title: z.string() }),
      defaultData: { title: 'Default result' },
      stateKeys: { loading: 'lookupLoading', data: 'lookupResult', error: 'lookupError' },
      triggers: ['submit', 'mount'],
      fetch: async () => ({ title: 'Result' }),
    }),
  ]);

  const contract = registry.toContract();
  assert.deepEqual(contract.pack, {
    intents: [
      {
        name: 'counter',
        description: 'Adjust the counter.',
        argsSchema: '{delta: number}',
        stateShape: '{count: number}',
        kind: 'action',
        triggers: ['click', 'submit'],
        surface: { authority: 'host-action' },
      },
      {
        name: 'lookup',
        description: 'Fetch a lookup result.',
        argsSchema: '{query: string}',
        stateShape:
          '{lookupLoading: boolean, lookupResult: {title: string} | null, lookupError: string | null}',
        kind: 'resource',
        triggers: ['submit', 'mount'],
        stateKeys: { loading: 'lookupLoading', data: 'lookupResult', error: 'lookupError' },
        resultSchema: '{title: string}',
        defaultDataShape: '{"title":"Default result"}',
        defaultData: { title: 'Default result' },
        surface: { data: 'host-resource', authority: 'read' },
      },
    ],
    patterns: [{ name: 'Counter', code: '<button>+</button>', intent: 'counter' }],
  });
  assert.deepEqual(contract.validationCapabilities, [
    { name: 'counter', kind: 'action', triggers: ['click', 'submit'], surface: { authority: 'host-action' } },
    {
      name: 'lookup',
      kind: 'resource',
      triggers: ['submit', 'mount'],
      stateKeys: { loading: 'lookupLoading', data: 'lookupResult', error: 'lookupError' },
      surface: { data: 'host-resource', authority: 'read' },
    },
  ]);
  assert.deepEqual(contract.initialState, {
    lookupLoading: false,
    lookupResult: { title: 'Default result' },
    lookupError: null,
  });
});

test('component registry formats contracts and validates props', () => {
  const registry = createComponentRegistry([
    defineComponent({
      name: 'MetricCard',
      description: 'Displays a KPI.',
      propsSchema: z.object({
        label: z.string(),
        value: z.string(),
        tone: z.enum(['neutral', 'good']).optional(),
      }),
      sizing: { height: '112px' },
      examples: [
        {
          name: 'Metric',
          code: '<div data-summon-component="MetricCard"></div>',
        },
      ],
    }),
  ]);

  const contract = registry.toContract();
  assert.deepEqual(contract.pack.components, [
    {
      name: 'MetricCard',
      description: 'Displays a KPI.',
      propsSchema: '{label: string, value: string, tone?: "neutral" | "good"}',
      surface: { data: 'embedded', authority: 'none' },
      examples: [
        {
          name: 'Metric',
          code: '<div data-summon-component="MetricCard"></div>',
        },
      ],
      sizing: { height: '112px' },
    },
  ]);
  assert.deepEqual(contract.validationComponents, [
    { name: 'MetricCard', surface: { data: 'embedded', authority: 'none' } },
  ]);
  assert.deepEqual(registry.validateProps('MetricCard', {
    label: 'Revenue',
    value: '$284k',
    tone: 'good',
  }), {
    ok: true,
    data: { label: 'Revenue', value: '$284k', tone: 'good' },
  });
  assert.equal(registry.validateProps('MetricCard', { label: 'Revenue' }).ok, false);
  assert.equal(registry.validateProps('Missing', {}).ok, false);
});

test('component registry rejects duplicate names and dispatches render lifecycle', () => {
  assert.throws(() => createComponentRegistry([
    defineComponent({
      name: 'MetricCard',
      description: 'Displays a KPI.',
      propsSchema: z.object({ label: z.string() }),
    }),
    defineComponent({
      name: 'MetricCard',
      description: 'Duplicate.',
      propsSchema: z.object({ label: z.string() }),
    }),
  ]), /Duplicate component/);

  const calls: string[] = [];
  const registry = createComponentRegistry([
    defineComponent({
      name: 'MetricCard',
      description: 'Displays a KPI.',
      propsSchema: z.object({ label: z.string() }),
      render: ({ props, componentId }) => {
        calls.push(`render:${componentId}:${props.label}`);
      },
      destroy: ({ componentId }) => {
        calls.push(`destroy:${componentId}`);
      },
    }),
  ]);

  const container = {} as HTMLElement;
  registry.render('MetricCard', {
    container,
    props: { label: 'Revenue' },
    componentId: 'metric',
    sandboxId: 'sandbox',
    emitIntent: () => {},
  });
  registry.destroy('MetricCard', {
    container,
    componentId: 'metric',
    sandboxId: 'sandbox',
    emitIntent: () => {},
  });
  assert.deepEqual(calls, ['render:metric:Revenue', 'destroy:metric']);
});

test('registry formats richer Zod schemas for prompts', () => {
  enum NativeKind {
    Alpha = 'alpha',
    Beta = 'beta',
  }
  const registry = createCapabilityRegistry([
    defineAction({
      name: 'complex',
      description: 'Exercise schema formatting.',
      argsSchema: z.object({
        required: z.string(),
        optional: z.number().optional(),
        nullable: z.string().nullable(),
        choice: z.enum(['one', 'two']),
        literal: z.literal('fixed'),
        union: z.union([z.string(), z.number()]),
        native: z.nativeEnum(NativeKind),
        list: z.array(z.object({ id: z.string(), score: z.number().nullable() })),
        record: z.record(z.boolean()),
        nested: z.object({ 'display-name': z.string().optional() }),
      }),
      stateShape: '{}',
      handler: () => {},
    }),
  ]);

  assert.equal(
    registry.toContract().pack.intents[0]!.argsSchema,
    '{required: string, optional?: number, nullable: string | null, choice: "one" | "two", literal: "fixed", union: string | number, native: "alpha" | "beta", list: {id: string, score: number | null}[], record: {[key: string]: boolean}, nested: {"display-name"?: string}}',
  );
});

test('registry converts capabilities into PolicyEngine handlers', async () => {
  const registry = createCapabilityRegistry([
    defineCapability({
      name: 'counter',
      description: 'Adjust the counter.',
      argsSchema: z.object({ delta: z.number() }),
      stateShape: '{count: number}',
      handler: ({ args, push }) => {
        push({ count: args.delta });
      },
    }),
  ]);

  let latestState: Record<string, unknown> = {};
  const policy = new PolicyEngine({
    handlers: registry.toPolicyHandlers(),
    onStateChange: (state) => {
      latestState = state;
    },
  });

  assert.deepEqual(policy.intents, ['counter']);
  await policy.dispatch('counter', { delta: 3 });
  assert.equal(latestState.count, 3);
});

test('registry-generated handlers reject invalid args before execution', async () => {
  let calls = 0;
  const errors: Error[] = [];
  const registry = createCapabilityRegistry([
    defineCapability({
      name: 'counter',
      description: 'Adjust the counter.',
      argsSchema: z.object({ delta: z.number() }),
      stateShape: '{count: number}',
      handler: () => {
        calls += 1;
      },
    }),
  ]);

  const policy = new PolicyEngine({
    handlers: registry.toPolicyHandlers(),
    onStateChange: () => {},
    onHandlerError: (_intent, error) => {
      errors.push(error);
    },
  });

  await policy.dispatch('counter', { delta: 'nope' });

  assert.equal(calls, 0);
  assert.equal(errors.length, 1);
  assert.ok(errors[0] instanceof IntentArgsError);
});

test('controlled actions push pending, done, and error lifecycle state', async () => {
  const states: Record<string, unknown>[] = [];
  const registry = createCapabilityRegistry([
    defineAction({
      name: 'save',
      description: 'Save a selection.',
      argsSchema: z.object({ label: z.string() }),
      stateShape: '{savedLabel: string | null}',
      controlled: true,
      handler: async ({ args, push }) => {
        push({ savedLabel: args.label });
      },
    }),
  ]);

  const contract = registry.toContract();
  assert.deepEqual(contract.pack.intents[0]?.actionStateKeys, {
    pending: 'savePending',
    done: 'saveDone',
    error: 'saveError',
  });
  assert.deepEqual(contract.initialState, {
    savePending: false,
    saveDone: false,
    saveError: null,
  });

  const policy = new PolicyEngine({
    handlers: registry.toPolicyHandlers(),
    onStateChange: (state) => states.push(state),
  });

  await policy.dispatch('save', { label: 'Balanced path' });

  assert.deepEqual(states[0], {
    savePending: true,
    saveDone: false,
    saveError: null,
  });
  assert.equal(states[1]?.savedLabel, 'Balanced path');
  assert.equal(states.at(-1)?.savePending, false);
  assert.equal(states.at(-1)?.saveDone, true);
  assert.equal(states.at(-1)?.saveError, null);
});

test('controlled actions support custom state keys and rethrow failures to diagnostics', async () => {
  const states: Record<string, unknown>[] = [];
  const errors: Error[] = [];
  const registry = createCapabilityRegistry([
    defineAction({
      name: 'save',
      description: 'Save a selection.',
      argsSchema: z.object({ label: z.string() }),
      stateShape: '{}',
      controlled: {
        stateKeys: {
          pending: 'saving',
          done: 'saved',
          error: 'saveFailure',
        },
      },
      handler: () => {
        throw new Error('write failed');
      },
    }),
  ]);

  const policy = new PolicyEngine({
    handlers: registry.toPolicyHandlers(),
    onStateChange: (state) => states.push(state),
    onHandlerError: (_intent, error) => errors.push(error),
  });

  await policy.dispatch('save', { label: 'Balanced path' });

  assert.equal(states[0]?.saving, true);
  assert.equal(states.at(-1)?.saving, false);
  assert.equal(states.at(-1)?.saved, false);
  assert.equal(states.at(-1)?.saveFailure, 'write failed');
  assert.equal(errors[0]?.message, 'write failed');
});

test('default actions do not receive controlled lifecycle state', () => {
  const registry = createCapabilityRegistry([
    defineAction({
      name: 'save',
      description: 'Save a selection.',
      argsSchema: z.object({ label: z.string() }),
      stateShape: '{}',
      handler: () => {},
    }),
  ]);

  const contract = registry.toContract();
  assert.equal(contract.pack.intents[0]?.actionStateKeys, undefined);
  assert.deepEqual(contract.initialState, {});
});

test('data resource handlers push loading, data, and error state', async () => {
  const registry = createCapabilityRegistry([
    defineDataResource({
      name: 'lookup',
      description: 'Fetch a lookup result.',
      argsSchema: z.object({ query: z.string() }),
      resultSchema: z.object({ title: z.string() }),
      defaultData: { title: 'Default result' },
      stateKeys: { loading: 'lookupLoading', data: 'lookupResult', error: 'lookupError' },
      triggers: ['submit'],
      onStart: ({ query }) => ({ lookupQuery: query }),
      fetch: async ({ query }) => ({ title: `Result for ${query}` }),
    }),
  ]);

  const states: Record<string, unknown>[] = [];
  const policy = new PolicyEngine({
    handlers: registry.toPolicyHandlers(),
    onStateChange: (state) => {
      states.push(state);
    },
  });

  await policy.dispatch('lookup', { query: 'summon' });

  assert.deepEqual(states, [
    {
      lookupLoading: true,
      lookupResult: { title: 'Default result' },
      lookupError: null,
      lookupQuery: 'summon',
    },
    {
      lookupLoading: false,
      lookupResult: { title: 'Result for summon' },
      lookupError: null,
      lookupQuery: 'summon',
    },
  ]);
});

test('data resource handlers expose optional empty state after successful empty results', async () => {
  let nextResult: { title: string }[] = [];
  const registry = createCapabilityRegistry([
    defineDataResource({
      name: 'lookup',
      description: 'Fetch lookup results.',
      argsSchema: z.object({ query: z.string() }),
      resultSchema: z.array(z.object({ title: z.string() })),
      defaultData: [],
      stateKeys: {
        loading: 'lookupLoading',
        data: 'lookupResults',
        error: 'lookupError',
        empty: 'lookupEmpty',
      },
      triggers: ['submit'],
      fetch: async () => nextResult,
    }),
  ]);

  assert.deepEqual(registry.toContract().initialState, {
    lookupLoading: false,
    lookupResults: [],
    lookupError: null,
    lookupEmpty: false,
  });

  const states: Record<string, unknown>[] = [];
  const policy = new PolicyEngine({
    handlers: registry.toPolicyHandlers(),
    onStateChange: (state) => states.push(state),
  });

  await policy.dispatch('lookup', { query: 'none' });
  assert.equal(states[0]?.lookupEmpty, false);
  assert.equal(states.at(-1)?.lookupEmpty, true);

  nextResult = [{ title: 'Found' }];
  await policy.dispatch('lookup', { query: 'found' });
  assert.equal(states.at(-2)?.lookupEmpty, false);
  assert.equal(states.at(-1)?.lookupEmpty, false);
});

test('data resource empty state resets false on invalid and failed host results', async () => {
  let mode: 'invalid' | 'throw' = 'invalid';
  const registry = createCapabilityRegistry([
    defineDataResource({
      name: 'lookup',
      description: 'Fetch lookup results.',
      argsSchema: z.object({ query: z.string() }),
      resultSchema: z.array(z.object({ title: z.string() })),
      defaultData: [],
      stateKeys: {
        loading: 'lookupLoading',
        data: 'lookupResults',
        error: 'lookupError',
        empty: 'lookupEmpty',
      },
      triggers: ['submit'],
      fetch: async () => {
        if (mode === 'throw') throw new Error('network down');
        return [{ title: 42 }] as any;
      },
    }),
  ]);

  let latestState: Record<string, unknown> = {};
  const policy = new PolicyEngine({
    handlers: registry.toPolicyHandlers(),
    onStateChange: (state) => {
      latestState = state;
    },
  });

  await policy.dispatch('lookup', { query: 'bad' });
  assert.equal(latestState.lookupEmpty, false);
  assert.equal(latestState.lookupError, 'Resource "lookup" returned invalid data');

  mode = 'throw';
  await policy.dispatch('lookup', { query: 'bad' });
  assert.equal(latestState.lookupEmpty, false);
  assert.equal(latestState.lookupError, 'network down');
});

test('data resource empty state supports custom isEmpty logic', async () => {
  const registry = createCapabilityRegistry([
    defineDataResource({
      name: 'lookup',
      description: 'Fetch lookup result.',
      argsSchema: z.object({ query: z.string() }),
      resultSchema: z.object({ items: z.array(z.string()), total: z.number() }),
      defaultData: { items: [], total: 0 },
      stateKeys: {
        loading: 'lookupLoading',
        data: 'lookupResult',
        error: 'lookupError',
        empty: 'lookupEmpty',
      },
      triggers: ['submit'],
      isEmpty: (result) => result.total === 0,
      fetch: async () => ({ items: ['cached suggestion'], total: 0 }),
    }),
  ]);

  let latestState: Record<string, unknown> = {};
  const policy = new PolicyEngine({
    handlers: registry.toPolicyHandlers(),
    onStateChange: (state) => {
      latestState = state;
    },
  });

  await policy.dispatch('lookup', { query: 'none' });
  assert.deepEqual(latestState.lookupResult, { items: ['cached suggestion'], total: 0 });
  assert.equal(latestState.lookupEmpty, true);
});

test('data resource result validation converts invalid host data into error state', async () => {
  const errors: string[] = [];
  const registry = createCapabilityRegistry([
    defineDataResource({
      name: 'lookup',
      description: 'Fetch a lookup result.',
      argsSchema: z.object({ query: z.string() }),
      resultSchema: z.object({ title: z.string() }),
      defaultData: { title: 'Default result' },
      stateKeys: { loading: 'lookupLoading', data: 'lookupResult', error: 'lookupError' },
      triggers: ['submit'],
      onError: (message) => errors.push(message),
      fetch: async () => ({ title: 42 } as any),
    }),
  ]);

  let latestState: Record<string, unknown> = {};
  const policy = new PolicyEngine({
    handlers: registry.toPolicyHandlers(),
    onStateChange: (state) => {
      latestState = state;
    },
  });

  await policy.dispatch('lookup', { query: 'summon' });

  assert.equal(latestState.lookupLoading, false);
  assert.deepEqual(latestState.lookupResult, { title: 'Default result' });
  assert.equal(latestState.lookupError, 'Resource "lookup" returned invalid data');
  assert.deepEqual(errors, ['Resource "lookup" returned invalid data']);
});

test('defineDataResource validates default data against result schema', () => {
  assert.throws(
    () => defineDataResource({
      name: 'lookup',
      description: 'Fetch a lookup result.',
      argsSchema: z.object({ query: z.string() }),
      resultSchema: z.object({ title: z.string() }),
      defaultData: { title: 42 } as any,
      stateKeys: { loading: 'lookupLoading', data: 'lookupResult', error: 'lookupError' },
      triggers: ['submit'],
      fetch: async () => ({ title: 'Result' }),
    }),
    /Default data for data resource "lookup" does not match resultSchema/,
  );
});

test('data resource handlers restore default data on host errors', async () => {
  const registry = createCapabilityRegistry([
    defineDataResource({
      name: 'lookup',
      description: 'Fetch a lookup result.',
      argsSchema: z.object({ query: z.string() }),
      resultSchema: z.object({ title: z.string() }),
      defaultData: { title: 'Fallback' },
      stateKeys: { loading: 'lookupLoading', data: 'lookupResult', error: 'lookupError' },
      triggers: ['submit'],
      fetch: async () => {
        throw new Error('network down');
      },
    }),
  ]);

  let latestState: Record<string, unknown> = {};
  const policy = new PolicyEngine({
    handlers: registry.toPolicyHandlers(),
    onStateChange: (state) => {
      latestState = state;
    },
  });

  await policy.dispatch('lookup', { query: 'summon' });

  assert.equal(latestState.lookupLoading, false);
  assert.deepEqual(latestState.lookupResult, { title: 'Fallback' });
  assert.equal(latestState.lookupError, 'network down');
});

test('data resource handlers drop duplicate work when concurrency is drop', async () => {
  let calls = 0;
  let release!: (value: { ok: boolean }) => void;
  const pending = new Promise<{ ok: boolean }>((resolve) => {
    release = resolve;
  });
  const registry = createCapabilityRegistry([
    defineDataResource({
      name: 'slow',
      description: 'Run one slow lookup.',
      argsSchema: z.object({ id: z.string() }),
      resultSchema: z.object({ ok: z.boolean() }),
      stateKeys: { loading: 'slowLoading', data: 'slowResult', error: 'slowError' },
      triggers: ['submit'],
      concurrency: 'drop',
      fetch: async () => {
        calls += 1;
        return pending;
      },
    }),
  ]);
  const policy = new PolicyEngine({
    handlers: registry.toPolicyHandlers(),
    onStateChange: () => {},
  });

  const first = policy.dispatch('slow', { id: 'first' });
  await policy.dispatch('slow', { id: 'second' });
  assert.equal(calls, 1);

  release({ ok: true });
  await first;
});

test('data resource handlers abort stale work when concurrency is latest', async () => {
  const signals: AbortSignal[] = [];
  let latestState: Record<string, unknown> = {};
  const registry = createCapabilityRegistry([
    defineDataResource({
      name: 'slow',
      description: 'Run the latest lookup.',
      argsSchema: z.object({ id: z.string() }),
      resultSchema: z.object({ id: z.string() }),
      stateKeys: { loading: 'slowLoading', data: 'slowResult', error: 'slowError' },
      triggers: ['submit'],
      concurrency: 'latest',
      fetch: async ({ id }, signal) => {
        signals.push(signal);
        if (signals.length === 1) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        return { id };
      },
    }),
  ]);
  const policy = new PolicyEngine({
    handlers: registry.toPolicyHandlers(),
    onStateChange: (state) => {
      latestState = state;
    },
  });

  const first = policy.dispatch('slow', { id: 'first' });
  await policy.dispatch('slow', { id: 'second' });
  await first;

  assert.equal(signals.length, 2);
  assert.equal(signals[0]!.aborted, true);
  assert.deepEqual(latestState.slowResult, { id: 'second' });
});

test('without removes a capability from both pack and handlers', () => {
  const registry = createCapabilityRegistry([
    defineCapability({
      name: 'counter',
      description: 'Adjust the counter.',
      argsSchema: z.object({ delta: z.number() }),
      stateShape: '{count: number}',
      handler: () => {},
    }),
    defineCapability({
      name: 'summon',
      description: 'Spawn a child UI.',
      argsSchema: z.object({ prompt: z.string() }),
      stateShape: '{summonedCount: number}',
      handler: () => {},
    }),
  ]).without(['summon']);

  assert.deepEqual(
    registry.toContract().pack.intents.map((intent) => intent.name),
    ['counter'],
  );
  assert.deepEqual(Object.keys(registry.toPolicyHandlers()), ['counter']);
  assert.deepEqual(registry.toContract().validationCapabilities, [
    { name: 'counter', kind: 'action', triggers: ['click', 'submit'], surface: { authority: 'host-action' } },
  ]);
  assert.deepEqual(registry.intents(), ['counter']);
});

test('worker helpers annotate capabilities without changing policy dispatch', async () => {
  const registry = createCapabilityRegistry([
    defineWorkerAction({
      name: 'analyze',
      description: 'Run host-owned analysis.',
      argsSchema: z.object({ id: z.string() }),
      stateShape: '{analysisDone: boolean}',
      handler: ({ args, push }) => push({ analysisDone: args.id === 'a' }),
    }),
    defineWorkerResource({
      name: 'worker_lookup',
      description: 'Fetch through a host worker.',
      argsSchema: z.object({ query: z.string() }),
      resultSchema: z.object({ ok: z.boolean() }),
      stateKeys: { loading: 'workerLoading', data: 'workerData', error: 'workerError' },
      triggers: ['submit'],
      fetch: async () => ({ ok: true }),
    }),
  ]);

  const contract = registry.toContract();
  assert.deepEqual(contract.validationCapabilities.map((capability) => capability.surface), [
    { data: 'worker', authority: 'host-action' },
    { data: 'worker', authority: 'read' },
  ]);

  let latestState: Record<string, unknown> = {};
  const policy = new PolicyEngine({
    handlers: registry.toPolicyHandlers(),
    onStateChange: (state) => {
      latestState = state;
    },
  });
  await policy.dispatch('analyze', { id: 'a' });
  assert.equal(latestState.analysisDone, true);
});

test('approval action runs approved handler only after approval', async () => {
  let approvedCalls = 0;
  const states: Record<string, unknown>[] = [];
  const registry = createCapabilityRegistry([
    defineApprovalAction({
      name: 'publish',
      description: 'Publish after approval.',
      argsSchema: z.object({ title: z.string() }),
      stateShape: '{published: boolean}',
      approval: {
        request: ({ title }) => title === 'ok' ? 'approved' : { status: 'denied', reason: 'Not this one' },
      },
      handler: ({ push }) => {
        approvedCalls += 1;
        push({ published: true });
      },
    }),
  ]);

  const contract = registry.toContract();
  assert.equal(contract.validationCapabilities[0]?.surface?.authority, 'approval-gated');
  assert.match(contract.pack.intents[0]?.stateShape ?? '', /publishApprovalRequestId: string \| null/);

  const policy = new PolicyEngine({
    handlers: registry.toPolicyHandlers(),
    onStateChange: (state) => {
      states.push(state);
    },
  });

  await policy.dispatch('publish', { title: 'no' });
  assert.equal(approvedCalls, 0);
  assert.equal(states.at(-1)?.publishApprovalDenied, true);
  assert.equal(states.at(-1)?.publishApprovalError, 'Not this one');
  assert.equal(states.at(-2)?.publishApprovalPending, true);
  assert.equal(typeof states.at(-2)?.publishApprovalRequestId, 'string');

  await policy.dispatch('publish', { title: 'ok' });
  assert.equal(approvedCalls, 1);
  assert.equal(states.at(-1)?.published, true);
  assert.equal(states.at(-1)?.publishApprovalApproved, true);
});

test('approval action rejects invalid args before requesting approval', async () => {
  let prepareCalls = 0;
  let approvalCalls = 0;
  let approvedCalls = 0;
  const registry = createCapabilityRegistry([
    defineApprovalAction({
      name: 'publish',
      description: 'Publish after approval.',
      argsSchema: z.object({ title: z.string() }),
      stateShape: '{published: boolean}',
      approval: {
        prepare: ({ title }) => {
          prepareCalls += 1;
          return { summary: `Publish ${title}`, plan: { title } };
        },
        request: () => {
          approvalCalls += 1;
          return 'approved';
        },
      },
      handler: () => {
        approvedCalls += 1;
      },
    }),
  ]);

  const errors: Error[] = [];
  const policy = new PolicyEngine({
    handlers: registry.toPolicyHandlers(),
    onStateChange: () => {},
    onHandlerError: (_intent, error) => errors.push(error),
  });

  await policy.dispatch('publish', { title: 42 });
  assert.equal(prepareCalls, 0);
  assert.equal(approvalCalls, 0);
  assert.equal(approvedCalls, 0);
  assert.ok(errors[0] instanceof IntentArgsError);
});

test('approval action prepares a frozen request for host approval and approved handler', async () => {
  let prepareCalls = 0;
  let seenRequest:
    | {
        id: string;
        capability: string;
        summary: string;
        details?: unknown;
        plan: unknown;
        status: string;
        expiresAt?: string;
      }
    | undefined;
  let handlerPlan: unknown;
  const states: Record<string, unknown>[] = [];
  const registry = createCapabilityRegistry([
    defineApprovalAction({
      name: 'publish',
      description: 'Publish after approval.',
      argsSchema: z.object({ title: z.string() }),
      stateShape: '{publishedTitle: string | null}',
      approval: {
        prepare: ({ title }) => {
          prepareCalls += 1;
          return {
            summary: `Publish "${title}"`,
            details: { channel: 'demo-updates' },
            plan: { operation: 'publish', title: title.toUpperCase() },
            expiresAt: '2026-06-10T12:00:00.000Z',
          };
        },
        request: (_args, request) => {
          seenRequest = request;
          return 'approved';
        },
      },
      handler: ({ approval, push }) => {
        handlerPlan = approval?.plan;
        const plan = approval?.plan as { title: string };
        push({ publishedTitle: plan.title });
      },
    }),
  ]);

  const policy = new PolicyEngine({
    handlers: registry.toPolicyHandlers(),
    onStateChange: (state) => {
      states.push(state);
    },
  });

  await policy.dispatch('publish', { title: 'launch note' });

  assert.equal(prepareCalls, 1);
  assert.ok(seenRequest);
  assert.equal(seenRequest.capability, 'publish');
  assert.equal(seenRequest.summary, 'Publish "launch note"');
  assert.deepEqual(seenRequest.details, { channel: 'demo-updates' });
  assert.deepEqual(seenRequest.plan, { operation: 'publish', title: 'LAUNCH NOTE' });
  assert.equal(seenRequest.status, 'pending');
  assert.equal(seenRequest.expiresAt, '2026-06-10T12:00:00.000Z');
  assert.equal(states[0]?.publishApprovalPending, true);
  assert.equal(states[0]?.publishApprovalRequestId, seenRequest.id);
  assert.deepEqual(handlerPlan, { operation: 'publish', title: 'LAUNCH NOTE' });
  assert.equal(states.at(-1)?.publishedTitle, 'LAUNCH NOTE');
});

test('surface envelope serializes replay metadata', () => {
  const envelope = createSurfaceEnvelope({
    prompt: 'compare options',
    surfacePlan: {
      purpose: 'compare',
      runtime: 'static',
      data: 'embedded',
      authority: 'none',
      persistence: 'replayable',
    },
    protocolLines: [{ op: 'set', path: '/screen', value: { sections: ['hero'] } }],
    html: '<section>Saved</section>',
    grants: { intents: [] },
    metadata: { directionId: 'ghost', mode: 'static' },
    runtimeVersion: 'test',
  });

  assert.equal(envelope.version, 1);
  assert.equal(envelope.prompt, 'compare options');
  assert.equal(envelope.metadata.directionId, 'ghost');
  assert.deepEqual(envelope.protocolLines, [
    { op: 'set', path: '/screen', value: { sections: ['hero'] } },
  ]);
});

test('surface envelope parser accepts valid replay envelopes', () => {
  const envelope = createSurfaceEnvelope({
    prompt: 'compare options',
    surfacePlan: {
      purpose: 'compare',
      runtime: 'static',
      data: 'embedded',
      authority: 'none',
      persistence: 'replayable',
    },
    protocolLines: [
      { op: 'set', path: '/screen', value: { sections: ['hero'] } },
      { op: 'add', path: '/section/hero', html: '<p>Saved</p>' },
    ],
    html: '<section>Saved</section>',
    grants: { intents: [] },
    metadata: { mode: 'static' },
  });

  assert.equal(parseSurfaceEnvelope(JSON.stringify(envelope))?.id, envelope.id);
});

test('surface envelope parser rejects malformed, wrong-version, and escalating envelopes', () => {
  const envelope = createSurfaceEnvelope({
    prompt: 'pick an option',
    surfacePlan: {
      purpose: 'collect',
      runtime: 'declarative',
      data: 'embedded',
      authority: 'host-action',
      persistence: 'replayable',
    },
    protocolLines: [
      {
        op: 'add',
        path: '/section/hero',
        html: '<button data-summon-on-click="delete_everything">Bad</button>',
      },
    ],
    html: '<button data-summon-on-click="delete_everything">Bad</button>',
    grants: { intents: ['choose'], capabilities: [{ name: 'choose', triggers: ['click'] }] },
    metadata: { mode: 'interactive' },
  });

  assert.equal(parseSurfaceEnvelope('{bad'), null);
  assert.equal(parseSurfaceEnvelope({ ...envelope, version: 2 }), null);
  assert.equal(parseSurfaceEnvelope(envelope), null);
});
