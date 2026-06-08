# Summon Package Consumption

Summon V1 is consumed as built workspace packages. Do not import `src/*.ts`
paths from applications.

For the follow-up package boundary, see
[Public Packaging Plan](public-packaging.md). Public scope and package renames
should happen in that package-boundary PR, not in the clean source import.

## React Hosts

```ts
import { SummonSurface, defineReactComponent } from '@summon/react';
import { createCapabilityRegistry, defineAction } from '@summon/host';
import { tokensSource } from '@summon/sandbox-runtime/assets';
```

`SummonSurface` accepts an envelope or direct `html` / `protocolLines`. Pass a
host-owned `capabilityRegistry`; artifact-declared grants are advisory and are
never executable permission.
React component islands require the host app to provide `react-dom` as a peer
dependency.

React hosts can register component islands with host-owned React components:

```tsx
import { z } from 'zod';
import { createComponentRegistry } from '@summon/host';
import { SummonSurface, defineReactComponent } from '@summon/react';

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
surface. The React component renders in host DOM as an overlay island, not
inside the sandbox iframe.

When a React component needs to call a host-granted intent, map the runtime
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
  deriveSurfacePlanControls,
} from '@summon/engine';
import {
  consumeSurfaceStream,
  createComponentIslandRegistry,
  spawnSandbox,
  type SandboxHandle,
} from '@summon/host/browser';
import {
  createComponentRegistry,
  defineComponent,
} from '@summon/host';
import { PolicyEngine } from '@summon/host/policy';
import {
  bootstrapSource,
  tokensSource,
} from '@summon/sandbox-runtime/assets';
```

Use `consumeSurfaceStream()` to decode streamed chunks, parse accepted protocol
lines, maintain section HTML and stream graph health, and render through the
sandbox handle. Spawn the iframe with `grantedIntents` and
`grantedCapabilities` from host-owned contracts.
`deriveSurfacePlanControls(surfacePlan)` is available for host UI defaults such
as mode and script policy; it is a convenience helper, not a security boundary.

```ts
const controls = deriveSurfacePlanControls(surfacePlan);
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
    surfacePlan,
    scriptPolicy: controls.scriptPolicy,
    components: componentContract.pack,
  }),
});

await consumeSurfaceStream(response.body!, {
  mode: controls.mode,
  onRenderHtml: (html) => handle?.render(html),
});
```

## Generation Servers

```ts
import {
  runSurfaceGeneration,
  type SummonModelProvider,
} from '@summon/server';
```

`runSurfaceGeneration()` is provider-neutral. The provider receives compiled
prompt blocks and returns text chunks. The runner compiles contracts, emits
host-owned meta lines such as `/surface-plan`, validates JSONL, optionally runs
targeted repair, emits accepted Summon lines and diagnostics, and returns a
replay summary.

`generateSurfaceStream()` remains available for existing integrations that
consume an async generator, but new servers should prefer
`runSurfaceGeneration(input, emit)`.

## Package Gate

Run this before publishing:

```sh
pnpm build
pnpm pack:dry-run
```
