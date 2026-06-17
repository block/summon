# Summon Package Consumption

Summon is consumed as built public packages. Do not import `src/*.ts` paths or
`@summon-internal/*` packages from applications.

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

- `@anarchitecture/summon/browser` for sandbox spawning, Arrow stream
  consumption, trusted component overlays, and strict input.
- `@anarchitecture/summon/engine` for protocol, validation, prompt contract,
  stream diagnostic, and hardening APIs.
- `@anarchitecture/summon/host` for adapter authors who need the full host
  runtime surface.

## React Hosts

```tsx
import { SummonSurface, defineReactComponent } from '@anarchitecture/summon-react';
import { createComponentRegistry } from '@anarchitecture/summon';

<SummonSurface
  envelope={savedEnvelope}
  capabilityRegistry={capabilityRegistry}
  componentRegistry={componentRegistry}
/>;
```

`SummonSurface` renders replay envelopes or Arrow artifacts. Generated
declarations are advisory and are never executable permission. Trusted host
component overlays require the host app to provide `react-dom` as a peer
dependency.

React hosts can register trusted host components:

```tsx
import { z } from 'zod';
import { createComponentRegistry } from '@anarchitecture/summon';
import { defineReactComponent } from '@anarchitecture/summon-react';

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
```

Pass `componentRegistry.toContract().pack` to generation when requesting the
surface. The React component renders in host DOM as an overlay, not inside the
sandbox iframe.

## Frameworkless Hosts

```ts
import {
  compileSurfaceContractView,
  compileSurfacePolicy,
  createComponentRegistry,
  defineComponent,
} from '@anarchitecture/summon';
import {
  consumeSurfaceStream,
  createComponentIslandRegistry,
  spawnSandbox,
  type SandboxHandle,
} from '@anarchitecture/summon/browser';
import { PolicyEngine } from '@anarchitecture/summon/policy';
import { bootstrapSource, tokensSource } from '@anarchitecture/summon/assets';
```

Use `consumeSurfaceStream()` to decode streamed chunks, parse accepted JSONL,
validate Arrow artifacts, update stream diagnostics, and render through the
sandbox handle. The only generated surface payload is:

```json
{"op":"artifact","path":"/artifact","value":{"runtime":"arrow","source":{"main.ts":"..."}}}
```

Spawn the iframe with host-owned contracts:

```ts
const compiledPolicy = compileSurfacePolicy(surfacePolicy, {
  capabilities: capabilityContract.pack,
  components: componentContract.pack,
});

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
    intents: policy.intents,
    capabilities: capabilityContract.validationCapabilities,
    components: componentContract.validationComponents,
    initialState: policy.getState(),
  },
  grantedIntents: policy.intents,
  grantedCapabilities: capabilityContract.validationCapabilities,
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
  validationContext: {
    mode: compiledPolicy.mode,
    scriptPolicy: compiledPolicy.scriptPolicy,
    allowedIntents: policy.intents,
    capabilities: capabilityContract.validationCapabilities,
    components: componentContract.validationComponents,
    surfacePlan: compiledPolicy.surfacePlan,
  },
  onArtifact: (artifact) => handle?.renderArtifact(artifact),
});
```

`compileSurfaceContractView(surfacePolicy, catalogs)` returns the same
policy-derived compact view that the server emits as `/surface-contract` for
policy-backed runs. Use it for previews, Devtools panels, and replay summaries;
do not use it as an enforcement source.

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
hardens streamed JSONL, emits accepted Arrow lines and diagnostics, and returns
a replay summary.

For agent-driven hosts, use `runAgentSurfaceGeneration(input, emit)` when the
end user should not choose Summon-specific configs. The broker converts the
prompt to an advisory `SurfaceIntent`, proposes a `SurfacePolicy`, narrows it
through host-owned policy, then calls the same `runSurfaceGeneration()`
lifecycle.

## Package Gate

Run this before publishing:

```sh
pnpm build
pnpm check:public-packages
pnpm check:public-api
pnpm pack:dry-run
pnpm smoke:public-packages
```
