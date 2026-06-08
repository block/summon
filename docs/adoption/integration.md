# Summon Integration Guide

Use this when wiring Summon into a host app or server. The goal is to reuse the
current contract path and package-owned generation lifecycle.

## 1. Define Host Capabilities

Capabilities are host-owned. The model receives the contract, but only the host
gets handlers, credentials, network, and durable state.

```ts
import { z } from 'zod';
import {
  createCapabilityRegistry,
  defineAction,
  defineDataResource,
} from '@anarchitecture/summon';

const registry = createCapabilityRegistry([
  defineAction({
    name: 'choose_recipe',
    description: 'Remember the recipe the user picked.',
    argsSchema: z.object({ id: z.string(), title: z.string() }),
    stateShape: { selectedRecipe: { id: 'string', title: 'string' } },
    triggers: ['click'],
    handler: ({ args, push }) => {
      push({ selectedRecipe: args });
    },
  }),

  defineDataResource({
    name: 'search',
    description: 'Search weeknight dinner ideas.',
    argsSchema: z.object({ query: z.string().min(1) }),
    resultSchema: z.array(z.object({
      id: z.string(),
      title: z.string(),
      timeMinutes: z.number(),
    })),
    defaultData: [],
    stateKeys: {
      loading: 'searchLoading',
      data: 'searchResults',
      error: 'searchError',
    },
    triggers: ['submit'],
    fetch: async ({ query }, signal) => {
      const response = await fetch(`/api/recipes?q=${encodeURIComponent(query)}`, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
  }),
]);

const capabilityContract = registry.toContract();
```

`capabilityContract.pack` is model-facing. `capabilityContract.validationCapabilities`
and `capabilityContract.initialState` are runtime-facing.

## 2. Define Component Islands

Component islands are also host-owned. The model receives names, descriptions,
prop schemas, examples, sizing hints, and placeholder rules. It never receives
component implementations.

```ts
import { z } from 'zod';
import {
  createComponentRegistry,
  defineComponent,
} from '@anarchitecture/summon';

const componentRegistry = createComponentRegistry([
  defineComponent({
    name: 'MetricCard',
    description: 'Compact KPI card with label, value, and optional delta.',
    propsSchema: z.object({
      label: z.string(),
      value: z.string(),
      delta: z.string().optional(),
    }),
    sizing: { height: '96px', description: 'Use in compact dashboard grids.' },
    examples: [{
      label: 'Revenue metric',
      code: `<div data-summon-component="MetricCard" data-summon-component-id="revenue" data-summon-props='{"label":"Revenue","value":"$284,120","delta":"+3.2%"}'></div>`,
    }],
    render: ({ container, props }) => {
      container.textContent = `${props.label}: ${props.value}`;
    },
  }),
]);

const componentContract = componentRegistry.toContract();
```

`componentContract.pack` is model-facing. `componentContract.validationComponents`
is runtime-facing. The default component surface is
`{ data: "embedded", authority: "none" }`; declare `host-resource/read` or
`host-action` only when the trusted host component actually reads host data or
emits host actions.

## 3. Run Server Generation

The generation server should use `@anarchitecture/summon-server` for the repeatable lifecycle:
compile contracts, emit host-owned meta lines, harden model JSONL, optionally
repair retryable sections, and end with validation and stream-graph summaries.

```ts
import {
  runSurfaceGeneration,
  type SummonModelProvider,
} from '@anarchitecture/summon-server';
import type { SurfacePlan } from '@anarchitecture/summon';

const surfacePlan: SurfacePlan = {
  purpose: 'explore',
  runtime: 'declarative',
  data: 'host-resource',
  authority: 'read',
  persistence: 'replayable',
};

const modelProvider: SummonModelProvider = async function* ({ prompt, promptBlocks }) {
  // Convert promptBlocks into your provider's system-message shape, then yield
  // provider text chunks as they arrive.
  yield* callYourModel({ prompt, promptBlocks });
};

await runSurfaceGeneration({
  prompt,
  modelProvider,
  mode: 'interactive',
  // Production default: declarative data-summon-* interactivity only.
  // Use "allow" only for hosts that intentionally permit custom artifact scripts.
  scriptPolicy: 'forbid',
  surfacePlan,
  direction,
  layout,
  capabilities: capabilityContract.pack,
  components: componentContract.pack,
  activeTokensCss: direction?.tokensCss ?? null,
  preludeLines: [
    { op: 'meta', path: '/shape', value: shape },
  ],
}, (line) => {
  response.write(`${JSON.stringify(line)}\n`);
});
```

Surface plans are host-owned. A model may react to the selected plan, but it
must not emit or widen `/surface-plan`; `runSurfaceGeneration()` emits that meta
line before model output for clients and replay envelopes.

Common plans:

| Situation | SurfacePlan |
| --- | --- |
| Static summary | `inform/static/embedded/none/replayable` |
| Host-backed search | `explore/declarative/host-resource/read/replayable` |
| Worker-backed analysis | `explore/worker/worker/host-action/replayable` |
| Approval-gated operation | `operate/declarative/embedded/approval-gated/replayable` |

To enable targeted repair, pass `repair: { enabled: true, provider, maxAttempts,
maxTargets }`. The repair provider receives the compiled prompt blocks and a
single replacement prompt; return one replacement JSONL line for the same
section path.

## 4. Apply Protocol On The Client

The client should let `@anarchitecture/summon` own chunk decoding, protocol parsing,
section accumulation, stream health, and render timing. Product hosts still own
fetching, aborts, request payloads, and product-specific meta interpretation.

```ts
import { deriveSurfacePlanControls } from '@anarchitecture/summon';
import { consumeSurfaceStream } from '@anarchitecture/summon/browser';

const controls = deriveSurfacePlanControls(surfacePlan);
const response = await fetch('/api/generate', {
  method: 'POST',
  body: JSON.stringify({
    prompt,
    surfacePlan,
    scriptPolicy: controls.scriptPolicy,
  }),
});

const result = await consumeSurfaceStream(response.body!, {
  mode: controls.mode,
  onMeta: (line) => {
    if (line.path === '/status') renderStatus(String(line.value));
  },
  onGraph: (snapshot) => {
    events.push({ kind: 'stream-graph', at: Date.now(), health: snapshot.health });
  },
  onRenderHtml: (html) => {
    sandbox?.render(html);
  },
});
```

Static streams render as accepted structural lines change. Interactive streams
render once at completion so scripts execute against a complete DOM. Devtools
consumers can publish `stream-graph` events from the snapshots so engineers can
inspect section health without reading raw JSONL.

## 5. Spawn The Sandbox

The sandbox is the only place generated HTML runs. Grants come from the host,
not from the artifact.

```ts
import {
  createComponentIslandRegistry,
  PolicyEngine,
  spawnSandbox,
  type SandboxHandle,
} from '@anarchitecture/summon';
import {
  bootstrapSource,
  tokensSource,
} from '@anarchitecture/summon/assets';

let sandbox: SandboxHandle | null = null;
const islands = createComponentIslandRegistry({
  outerIframe: iframe,
  registry: componentRegistry,
});

const policy = new PolicyEngine({
  initialState: capabilityContract.initialState,
  handlers: registry.toPolicyHandlers(),
  onStateChange: (state) => {
    sandbox?.pushState(state);
  },
});

sandbox = spawnSandbox({
  iframe,
  artifact: {
    intents: policy.intents,
    capabilities: capabilityContract.validationCapabilities,
    components: componentContract.validationComponents,
    html: '',
    initialState: policy.getState(),
  },
  grantedIntents: policy.intents,
  grantedCapabilities: capabilityContract.validationCapabilities,
  bootstrapSource,
  tokensSource,
  onIntent: (intent, args) => {
    void policy.dispatch(intent, args);
  },
  onComponents: (components, sandboxId) => {
    islands.sync(components, {
      sandboxId,
      emitIntent: (intent, args = {}) => {
        void policy.dispatch(intent, args);
      },
    });
  },
});
```

This preserves the core invariant: the iframe may emit only host-granted intent
names, and handlers run only after schema validation inside `PolicyEngine`.

For LLM-authored artifacts, always pass `grantedIntents` and
`grantedCapabilities` from host-owned contracts. `artifact.intents` and
`artifact.capabilities` describe what the artifact claims to use; they are not
permission.

Component placeholders stay inside the sandbox HTML, but trusted component DOM is
rendered by the host overlay. The sandbox only sends `SUMMON_COMPONENTS` bounds
and props with its `sandbox_id`; it cannot inspect the host-rendered island DOM.

## 6. Resource Markup The Model Should Emit

Data resources use declarative bindings. A generated search form should look
like this shape:

```html
<section data-summon-resource="search" data-summon-resource-as="recipes">
  <form data-summon-resource-trigger="submit">
    <input name="query" placeholder="Ingredient or craving">
    <button type="submit">Search</button>
  </form>

  <p data-summon-show="$recipes.loading">Searching...</p>
  <p data-summon-show="$recipes.error" data-summon-bind="$recipes.error"></p>

  <div data-summon-show="$recipes.data">
    <template data-summon-foreach="$recipes.data" data-summon-as="recipe">
      <button
        type="button"
        data-summon-on-click="choose_recipe"
        data-summon-args='{"id":"$recipe.id","title":"$recipe.title"}'
        data-summon-bind="$recipe.title"
      ></button>
    </template>
  </div>
</section>
```

Use `data-summon-*` bindings instead of inline handlers. External URLs, unsafe
tags, ungranted intents, and missing resource states are contract issues.

Component placeholders follow the same declarative pattern:

```html
<div
  data-summon-component="MetricCard"
  data-summon-component-id="revenue-card"
  data-summon-props='{"label":"Revenue","value":"$284,120","delta":"+3.2%"}'
  style="min-height:var(--space-10);"
></div>
```

Use placeholders only when a registered component materially improves fidelity.
Freeform HTML and CSS remain the primary composition layer.
