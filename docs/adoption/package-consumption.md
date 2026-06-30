# Summon Package Consumption

Summon is consumed as built public packages. Do not import `src/*.ts` paths or
`@summon-internal/*` packages from applications.

```txt
@anarchitecture/summon
@anarchitecture/summon-server
@anarchitecture/summon-react
```

The root `@anarchitecture/summon` entrypoint is curated for host-authoring:
registering host tools, choosing surface configs, compiling contract views, and
dispatching host-owned requests. Use explicit subpaths when you need lower-level
browser, engine, host, policy, envelope, assets, Devtools, or token CSS APIs:

- `@anarchitecture/summon/browser` for server stream consumption and inline
  sandbox mounting.
- `@anarchitecture/summon/engine` for stream transport types, validation, prompt
  contract, and stream diagnostics APIs.
- `@anarchitecture/summon/host` for adapter authors who need the full host
  runtime surface.
- `@anarchitecture/summon/policy` for direct `PolicyEngine` wiring.
- `@anarchitecture/summon/envelope` for saved replay envelopes.
- `@anarchitecture/summon/assets` for bundled token CSS as `tokensSource`.
- `@anarchitecture/summon/devtools` for event-store types and helpers.
- `@anarchitecture/summon/tokens.css` for bundlers that import CSS directly.

## React Hosts

```tsx
import { SummonSurface } from '@anarchitecture/summon-react';
import { createToolRegistry, defineDataResource } from '@anarchitecture/summon';

const toolRegistry = createToolRegistry([
  defineDataResource({
    name: 'search',
    description: 'Search host data.',
    argsSchema,
    resultSchema,
    defaultData: [],
    stateKeys: {
      loading: 'searchLoading',
      data: 'searchResults',
      error: 'searchError',
    },
    triggers: ['submit', 'mount'],
    fetch: searchHostData,
  }),
]);

<SummonSurface
  envelope={savedEnvelope}
  toolRegistry={toolRegistry}
/>;
```

`SummonSurface` renders replay envelopes or Arrow artifacts through the inline
Arrow sandbox. Generated declarations are advisory and are never executable
permission. Host tools still execute only through the supplied registry or
custom `onToolCall` handler.

For live generation, keep a ref and render accepted artifacts from
`consumeSurfaceStream()`:

```tsx
import { type SummonSurfaceHandle } from '@anarchitecture/summon-react';
import { consumeSurfaceStream } from '@anarchitecture/summon/browser';
import { useRef } from 'react';

const surfaceRef = useRef<SummonSurfaceHandle>(null);

<SummonSurface
  ref={surfaceRef}
  toolRegistry={toolRegistry}
  validationTools={toolRegistry.toContract().validationTools}
/>;

await consumeSurfaceStream(response.body!, {
  mode: compiledPolicy.mode,
  validationContext,
  onSurfaceEvent: (event) => surfaceRef.current?.applyPreviewEvent(event),
  onArtifact: (artifact) => surfaceRef.current?.renderArtifact(artifact),
});
```

## Frameworkless Hosts

```ts
import {
  compileSurfaceContractView,
  compileSurfacePolicy,
  PolicyEngine,
} from '@anarchitecture/summon';
import {
  consumeSurfaceStream,
  mountInlineSurface,
  type InlineSurfaceHandle,
} from '@anarchitecture/summon/browser';
import { tokensSource } from '@anarchitecture/summon/assets';
```

Use `consumeSurfaceStream()` to decode server-owned streamed chunks, parse
accepted stream lines, validate Arrow artifacts, update stream diagnostics, and
render through the inline sandbox handle. The only executable runtime payload
that reaches the sandbox is:

```json
{"op":"artifact","path":"/artifact","value":{"runtime":"arrow","source":{"main.ts":"..."}}}
```

Mount the inline sandbox with host-owned contracts:

```ts
const compiledPolicy = compileSurfacePolicy(surfacePolicy, {
  tools: toolContract.pack,
});

let handle: InlineSurfaceHandle | null = null;
const policy = new PolicyEngine({
  initialState: toolContract.initialState,
  handlers: registry.toPolicyHandlers(),
  onStateChange: (state) => handle?.pushState(state),
});

handle = mountInlineSurface({
  root: surfaceRoot,
  grantedTools: policy.tools,
  validationTools: toolContract.validationTools,
  initialState: policy.getState(),
  tokensSource,
  onToolCall: async (tool, args) => {
    const result = await policy.dispatch(tool, args);
    if (!result.ok) throw new Error(result.error ?? `Tool "${tool}" failed`);
    return result.state;
  },
});

const response = await fetch('/api/generate', {
  method: 'POST',
  body: JSON.stringify({
    prompt,
    surfacePolicy,
    tools: toolContract.pack,
  }),
});

await consumeSurfaceStream(response.body!, {
  mode: compiledPolicy.mode,
  validationContext: {
    mode: compiledPolicy.mode,
    allowedTools: policy.tools,
    tools: toolContract.validationTools,
    surfacePlan: compiledPolicy.surfacePlan,
  },
  onSurfaceEvent: (event) => handle?.applyPreviewEvent(event),
  onArtifact: (artifact) => handle?.renderArtifact(artifact),
});
```

`compileSurfaceContractView(surfacePolicy, catalogs)` returns the same
policy-derived compact view that the server emits as `/surface-contract` for
policy-backed runs. Use it for previews, Devtools panels, and replay summaries;
do not use it as an enforcement source.

Saved replay envelopes are versioned runtime records, not authority. A
`SurfaceEnvelope` stores the prompt, compiled `SurfacePlan`, accepted Arrow
artifact, server stream lines, validation issues, stream graph snapshot,
granted tools/validation tools, optional metadata, token CSS, and runtime
version.
`SummonSurface` can replay one, but live host handlers still come from the
current `toolRegistry` or `onToolCall` wiring.

## Generation Servers

```ts
import {
  runAgentSurfaceGeneration,
  runSurfaceGeneration,
  type SurfaceModelProvider,
} from '@anarchitecture/summon-server';
```

`runSurfaceGeneration()` is provider-neutral. The provider receives compiled
prompt blocks plus the structured Arrow bundle schema, then returns a
`summon.arrow-bundle/v1` object from its tool/function-calling integration. The
runner applies the surface config, validates and optionally repairs the bundle,
emits server-owned preview/artifact/diagnostic lines, and returns a replay
summary.

For agent-driven hosts, use `runAgentSurfaceGeneration(input, emit)` when the
end user should not choose Summon-specific configs. The ward converts the
prompt to an advisory `SurfaceGoal`, proposes a `SurfacePolicy`, narrows it
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
