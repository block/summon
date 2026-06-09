# Summon Integration Guide

Use this when wiring Summon into a host app or server. The product model is:

1. Register host tools.
2. Register trusted host components.
3. Choose a surface config.
4. Generate the surface.
5. Render it in the sandbox.
6. Inspect diagnostics when needed.

The TypeScript APIs still use precise runtime names such as capability,
`SurfacePolicy`, and `PolicyEngine`. In adopter-facing prose, think of them as
host tools, surface config, and host dispatch.

## 1. Register Host Tools

Host tools are data sources or actions the generated UI may request. The host
owns handlers, credentials, network, validation, and durable state. The model
receives only a description of the tool.

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

## 2. Register Trusted Host Components

Trusted host components let the generated UI place a host-rendered component
without receiving its implementation. The model receives names, descriptions,
prop schemas, examples, sizing hints, and placeholder rules.

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

## 3. Choose A Surface Config

A surface config is the host's per-run choice of what the generated UI is
allowed to do. The API type is `SurfacePolicy`.

```ts
import type { SurfacePolicy } from '@anarchitecture/summon';

const surfacePolicy: SurfacePolicy = {
  tier: 'declarative',
  purpose: 'explore',
  grants: ['search'],
};
```

Common configs:

| Situation | Surface config |
| --- | --- |
| Read-only summary | `{ tier: "static", purpose: "inform" }` |
| Host-backed search | `{ tier: "declarative", purpose: "explore", grants: ["search"] }` |
| Background host work | `{ tier: "worker", purpose: "review", grants: ["analysis"] }` |
| Requires approval | `{ tier: "approval", purpose: "operate", grants: ["publish_summary"] }` |

Hosts choose the config before generation. The model may react to the compiled
safety details, but it cannot widen what the host allowed.

## 4. Generate The Surface

The generation server should use `@anarchitecture/summon-server` for the
repeatable lifecycle: assemble prompts, apply the surface config, validate
streamed JSONL, optionally retry invalid sections, and emit diagnostics.

```ts
import {
  runSurfaceGeneration,
  type SummonModelProvider,
} from '@anarchitecture/summon-server';

const modelProvider: SummonModelProvider = async function* ({ prompt, promptBlocks }) {
  // Convert promptBlocks into your provider's system-message shape, then yield
  // provider text chunks as they arrive.
  yield* callYourModel({ prompt, promptBlocks });
};

await runSurfaceGeneration({
  prompt,
  modelProvider,
  surfacePolicy,
  direction,
  layout,
  // Full host tool/component catalog. Summon narrows it from the surface config
  // before constructing model-facing and validation contracts.
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

To enable validation retries, pass
`repair: { enabled: true, provider, maxAttempts, maxTargets }`. The provider
receives the compiled prompt blocks and a single replacement prompt; return one
replacement JSONL line for the same section path.

## 5. Render In The Sandbox

The client should let `@anarchitecture/summon` own chunk decoding, protocol
parsing, stream diagnostics, and render timing. Product hosts still own
fetching, aborts, request payloads, and product-specific meta interpretation.

```ts
import { compileSurfacePolicy } from '@anarchitecture/summon';
import {
  consumeSurfaceStream,
  createComponentIslandRegistry,
  spawnSandbox,
  type SandboxHandle,
} from '@anarchitecture/summon/browser';
import { PolicyEngine } from '@anarchitecture/summon/policy';
import {
  bootstrapSource,
  tokensSource,
} from '@anarchitecture/summon/assets';

const compiledPolicy = compileSurfacePolicy(surfacePolicy, {
  capabilities: capabilityContract.pack,
  components: componentContract.pack,
});

let sandbox: SandboxHandle | null = null;
const grantedCapabilities = capabilityContract.validationCapabilities;
const policy = new PolicyEngine({
  initialState: capabilityContract.initialState,
  handlers: registry.toPolicyHandlers(),
  onStateChange: (state) => sandbox?.pushState(state),
});

const islands = createComponentIslandRegistry({
  outerIframe: iframe,
  registry: componentRegistry,
});

sandbox = spawnSandbox({
  iframe,
  artifact: {
    html: '',
    intents: policy.intents,
    capabilities: grantedCapabilities,
    components: componentContract.validationComponents,
    initialState: policy.getState(),
  },
  grantedIntents: policy.intents,
  grantedCapabilities,
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

const response = await fetch('/api/generate', {
  method: 'POST',
  body: JSON.stringify({
    prompt,
    surfacePolicy,
    capabilities: capabilityContract.pack,
    components: componentContract.pack,
  }),
});

await consumeSurfaceStream(response.body!, {
  mode: compiledPolicy.mode,
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

This preserves the main invariant: the sandbox may request only host-allowed
tool names, and handlers run only after schema validation in the host.

Generated data-resource UI should use safe `data-summon-*` bindings instead of
inline handlers:

```html
<form data-summon-resource="search" data-summon-resource-trigger="submit">
  <input name="query" placeholder="Search recipes" />
  <button type="submit">Search</button>
  <p data-summon-show="$search.loading">Searching...</p>
  <p data-summon-show="$search.error" data-summon-text="$search.error"></p>
  <ul data-summon-foreach="$search.data">
    <li>
      <span data-summon-text="$item.title"></span>
      <span data-summon-text="$item.timeMinutes"></span>
    </li>
  </ul>
</form>
```

Trusted component placeholders follow the same declarative pattern:

```html
<div
  data-summon-component="MetricCard"
  data-summon-component-id="revenue"
  data-summon-props='{"label":"Revenue","value":"$284,120","delta":"+3.2%"}'
></div>
```

## 6. Inspect Diagnostics

Diagnostics are for failures and maintainer investigation, not the first thing
an adopter needs to learn.

- If generation fails, inspect `/error`, `/validation-summary`,
  `/validation-blocked`, and validation retry feedback in the Stream drawer.
- If a generated control does nothing, inspect Devtools for rejected host tool
  requests, host dispatch, handler completion, and pushed state.
- If trusted components do not appear, inspect component sync and component
  error events.
- If sandbox safety looks suspect, run `pnpm test:safety` and inspect
  `spawnSandbox` before changing iframe sandbox attributes or CSP.
