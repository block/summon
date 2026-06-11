# Summon Package Consumption

Summon V1 is consumed as built public packages. Do not import `src/*.ts` paths
or `@summon-internal/*` packages from applications.

For package boundary rationale, see
[Public Packaging Plan](public-packaging.md).

Use the public packages by install environment:

```txt
@anarchitecture/summon
@anarchitecture/summon-server
@anarchitecture/summon-react
```

The root `@anarchitecture/summon` entrypoint is curated for host-authoring:
registering host tools, registering trusted host components, choosing surface
configs, and dispatching host-owned requests. Use explicit subpaths when you
need lower-level browser, engine, host, policy, envelope, assets, or Devtools
APIs:

- `@anarchitecture/summon/browser` for sandbox spawning, stream consumption,
  trusted component overlays, and strict input.
- `@anarchitecture/summon/engine` for advanced protocol, validation, prompt
  contract, stream diagnostic, and hardening APIs.
- `@anarchitecture/summon/host` for adapter authors who need the full host
  runtime surface.

## React Hosts

```ts
import { SummonSurface, defineReactComponent } from '@anarchitecture/summon-react';
import { createCapabilityRegistry, defineAction } from '@anarchitecture/summon';
import { tokensSource } from '@anarchitecture/summon/assets';
```

`SummonSurface` accepts a replay envelope or direct `html` / `protocolLines`.
Pass a host-owned `capabilityRegistry`; generated declarations are advisory and
are never executable permission. Trusted host component overlays require the
host app to provide `react-dom` as a peer dependency.

React hosts can register trusted host components:

```tsx
import { z } from 'zod';
import { createComponentRegistry } from '@anarchitecture/summon';
import { SummonSurface, defineReactComponent } from '@anarchitecture/summon-react';

const componentRegistry = createComponentRegistry([
  defineReactComponent({
    name: 'MetricCard',
    description: 'Compact KPI card with label, value, and optional delta.',
    propsSchema: z.object({
      label: z.string(),
      value: z.string(),
      delta: z.string().optional(),
    }),
    component: MetricCard,
  }),
]);

<SummonSurface
  html={html}
  componentRegistry={componentRegistry}
/>;
```

Pass `componentRegistry.toContract().pack` to generation when requesting the
surface. The React component renders in host DOM as an overlay, not inside the
sandbox iframe.

When a React component needs to request a host-owned action, map the runtime
context into explicit component props:

```tsx
defineReactComponent({
  name: 'ApprovalStatus',
  description: 'Approval state with a host-owned action.',
  propsSchema: approvalStatusSchema,
  component: ApprovalStatus,
  mapProps: (props, { emitIntent }) => ({
    ...props,
    onApprove: () => emitIntent('choose', { id: props.id }),
  }),
});
```

## Frameworkless Hosts

```ts
import {
  compileSurfaceContractView,
  compileSurfacePolicy,
  createComponentRegistry,
  defineComponent,
  type SurfaceContractView,
} from '@anarchitecture/summon';
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
```

Use `consumeSurfaceStream()` to decode streamed chunks, parse accepted protocol
lines, maintain generated HTML, update stream diagnostics, and render through
the sandbox handle. Spawn the iframe with allowed host tools from host-owned
contracts.

`compileSurfacePolicy(surfacePolicy, catalogs)` gives the client the stream
mode and narrowed contracts that the server will enforce. Generation authority
comes from the explicit surface config the host submits.

`compileSurfaceContractView(surfacePolicy, catalogs)` returns the same
policy-derived compact view that the server emits as `/surface-contract` for
policy-backed runs. Use it for previews, Devtools panels, and replay summaries;
do not use it as an enforcement source.

```ts
const componentRegistry = createComponentRegistry([
  defineComponent({
    name: 'MetricCard',
    description: 'Compact KPI card.',
    propsSchema,
    render: ({ container, props }) => {
      container.replaceChildren(renderMetricCard(props));
    },
  }),
]);

const componentContract = componentRegistry.toContract();
const compiledPolicy = compileSurfacePolicy(surfacePolicy, {
  capabilities: capabilityContract.pack,
  components: componentContract.pack,
});
const grantedCapabilities = capabilityContract.validationCapabilities;

let handle: SandboxHandle | null = null;
const islands = createComponentIslandRegistry({
  outerIframe: iframe,
  registry: componentRegistry,
});
const policy = new PolicyEngine({
  initialState,
  handlers,
  onStateChange: (state) => handle?.pushState(state),
});

handle = spawnSandbox({
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
  onIntent: (intent, args) => void policy.dispatch(intent, args),
  onComponents: (components, sandboxId) => {
    islands.sync(components, {
      sandboxId,
      emitIntent: (intent, args = {}) => void policy.dispatch(intent, args),
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
  onRenderHtml: (html) => handle?.render(html),
});
```

## Generation Servers

```ts
import {
  runAgentSurfaceGeneration,
  runSurfaceGeneration,
  type SummonModelProvider,
} from '@anarchitecture/summon-server';
```

`runSurfaceGeneration()` is provider-neutral. The provider receives compiled
prompt blocks and returns text chunks. The runner applies the surface config,
validates streamed JSONL, optionally runs targeted validation retries, emits
accepted Summon lines and diagnostics, and returns a replay summary.

`generateSurfaceStream()` remains available for existing integrations that
consume an async generator, but new servers should prefer
`runSurfaceGeneration(input, emit)`.

For agent-driven hosts, use `runAgentSurfaceGeneration(input, emit)` when the
end user should not choose Summon-specific configs. The harness supplies the
prompt, model provider, host tool catalog, trusted component catalog, and any
host policy resolver. The broker converts the prompt to an advisory
`SurfaceIntent`, proposes a `SurfacePolicy`, narrows it through host-owned
policy, then calls the same `runSurfaceGeneration()` lifecycle.

```ts
await runAgentSurfaceGeneration({
  prompt,
  modelProvider,
  capabilities: capabilityContract.pack,
  components: componentContract.pack,
  hostPolicyResolver: ({ proposedSurfacePolicy }) => {
    return productPolicy.narrow(proposedSurfacePolicy);
  },
}, (line) => {
  response.write(`${JSON.stringify(line)}\n`);
});
```

The intent converter can use rules, a model-assisted `intentModel`, or a custom
`intentProvider`. Its output is never authority. The host resolver and
`compileSurfacePolicy()` still decide which host tools, components, runtime,
and approval paths are actually available.

## Package Gate

Run this before publishing:

```sh
pnpm build
pnpm check:public-packages
pnpm check:public-api
pnpm pack:dry-run
pnpm smoke:public-packages
```
