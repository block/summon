# Summon Integration Guide

Use this when wiring Summon into a host app or server. The current product
model is:

1. Register host tools.
2. Choose a surface config.
3. Generate an Arrow artifact on the server.
4. Mount the accepted artifact with the inline Arrow sandbox.
5. Inspect diagnostics when needed.

The TypeScript APIs still use precise runtime names such as tool,
`SurfacePolicy`, and `PolicyEngine`. In adopter-facing prose, think of them as
host tools, surface config, and host dispatch.

## 1. Register Host Tools

Host tools are data sources or actions the generated UI may request. The host
owns handlers, credentials, network, validation, durable state, and approvals.
The model receives only a description of each tool.

```ts
import { z } from 'zod';
import {
  createToolRegistry,
  defineAction,
  defineApprovalAction,
  defineDataResource,
} from '@anarchitecture/summon';

const registry = createToolRegistry([
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

const toolContract = registry.toContract();
```

`toolContract.pack` is model-facing. `toolContract.validationTools` and
`toolContract.initialState` are runtime-facing.

Data resources can expose a host-owned empty state when "no results" is a
merchant-facing condition. Add `stateKeys.empty` and, when array length is not
the right definition, `isEmpty(data)`. The generated surface should render the
declared empty key; it should not infer "no results" from missing pre-load data.

Actions can opt into a small lifecycle with `controlled: true`. Summon then
pushes pending, done, and error state around the host handler so generated UI can
disable the trigger, show host errors, and render success only after the host
actually finishes.

Approval actions are still host tools. The difference is that the host prepares
the exact operation before asking for a decision. The generated surface gets
only small status state such as pending, approved, denied, failed, and a request
id; approve and deny controls stay in trusted host UI.

```ts
defineApprovalAction({
  name: 'publish_summary',
  description: 'Publish a prepared summary only after host approval.',
  argsSchema: z.object({ draftId: z.string(), title: z.string() }),
  stateShape: {
    published: 'boolean',
    publishedDraftId: 'string | null',
    publishApprovalRequestId: 'string | null',
    publishApprovalPending: 'boolean',
    publishApprovalApproved: 'boolean',
    publishApprovalDenied: 'boolean',
    publishApprovalError: 'string | null',
  },
  approval: {
    prepare: ({ draftId, title }) => ({
      summary: `Publish "${title}"`,
      details: { draftId },
      plan: { draftId, endpoint: `/api/drafts/${draftId}/publish` },
    }),
    request: (_args, request) => approvalPanel.open(request),
  },
  handler: async ({ approval, push }) => {
    const plan = approval!.plan as { draftId: string; endpoint: string };
    await fetch(plan.endpoint, { method: 'POST' });
    push({ published: true, publishedDraftId: plan.draftId });
  },
});
```

Hosts that need durable approvals should persist the `ApprovalRequest` they
receive in `request`; Summon core intentionally does not add a workflow store.

## 2. Choose A Surface Config

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

### Agent-Driven Configs

When a user is talking to an agent or another harness, the user should not need
to choose Summon tiers, grants, or surface plans. Use the server broker to
translate the prompt into a bounded host-owned config:

```ts
import { runAgentSurfaceGeneration } from '@anarchitecture/summon-server';

await runAgentSurfaceGeneration({
  prompt,
  modelProvider,
  tools: toolContract.pack,
  hostPolicyResolver: ({ proposedSurfacePolicy }) => {
    return productPolicy.narrow(proposedSurfacePolicy);
  },
}, emit);
```

The broker emits `/agent-goal` and `/agent-policy-resolution` diagnostics,
including whether the goal came from a provided value, model classifier, or
deterministic fallback. Generation then continues through the normal
`/surface-policy`, `/surface-plan`, and `/surface-contract` path. `SurfaceGoal`
is advisory; the host resolver and `compileSurfacePolicy()` decide which tools,
data, authority, and approval paths are actually available.

### Surface Contract View

When a server receives a `SurfacePolicy`, Summon also derives a read-only
`SurfaceContractView` from the compiled policy. This view gives prompts,
Devtools, replay/debug tooling, and host UIs one compact answer to "what can
this generated surface do?"

The view includes:

- The normalized host policy, compiled `SurfacePlan`, and derived static or
  interactive mode.
- Narrowed host tools/resources, including triggers, schemas, state keys, result
  schema, and surface data/authority.
- Optional host layout slots.
- Any `ContractIssue[]` produced while compiling the surface policy.

`SurfaceContractView` is diagnostic and prompt-facing only. It is not a JSON UI
schema and it is not an authority source. Enforcement still lives in
`SurfacePolicy` compilation, runtime validators, the inline sandbox grant list,
and `PolicyEngine`.

## 3. Generate The Surface

The generation server should use `@anarchitecture/summon-server` for the
repeatable lifecycle: assemble prompts, apply the surface config, validate
streamed JSONL, accept only Arrow artifacts, and emit diagnostics.

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
  tools: toolContract.pack,
  activeTokensCss: direction?.tokensCss ?? null,
  preludeLines: [
    { op: 'meta', path: '/shape', value: shape },
  ],
}, (line) => {
  response.write(`${JSON.stringify(line)}\n`);
});
```

For policy-backed runs, `runSurfaceGeneration()` emits host-owned metadata in
this order before model-authored output:

1. `/surface-policy` - the normalized host policy.
2. `/surface-plan` - the compiled safety plan.
3. `/surface-contract` - the compact derived `SurfaceContractView`.

The only executable generated payload is an Arrow artifact:

```json
{"op":"artifact","path":"/artifact","value":{"runtime":"arrow","source":{"main.ts":"..."}}}
```

Generated network access is off by default. If the selected surface plan has
`network: "none"`, Summon rejects artifact source that calls `fetch()` and the
inline runtime removes the Arrow VM's fetch global before mounting the artifact.
Use host tools for product data, credentials, and external APIs.

## 4. Render In The Inline Sandbox

The client should let `@anarchitecture/summon` own chunk decoding, protocol
parsing, stream diagnostics, and render timing. Product hosts still own
fetching, aborts, request payloads, and product-specific meta interpretation.

```ts
import {
  compileSurfacePolicy,
  PolicyEngine,
} from '@anarchitecture/summon';
import {
  consumeSurfaceStream,
  mountInlineSurface,
  type InlineSurfaceHandle,
} from '@anarchitecture/summon/browser';
import { tokensSource } from '@anarchitecture/summon/assets';

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
  onToolCall: (tool, args) => {
    return policy.dispatch(tool, args).then((result) => result.state);
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
  onMeta: (line) => {
    if (line.path === '/status') renderStatus(String(line.value));
    if (line.path === '/surface-contract') renderContractSummary(line.value);
    if (line.path === '/protocol-skip') renderSkippedLine(line.value);
  },
  onGraph: (snapshot) => {
    events.push({
      kind: 'stream-graph',
      at: Date.now(),
      health: snapshot.health,
      artifacts: snapshot.artifacts,
    });
  },
  onSurfaceEvent: (event) => {
    handle?.applyPreviewEvent(event);
  },
  onArtifact: (artifact) => {
    handle?.renderArtifact(artifact);
  },
});
```

This preserves the main invariant: the generated surface may request only
host-allowed tool names, and handlers run only after schema validation in the
host.

`renderArtifact()` mounts the accepted Arrow source into an inline
`<arrow-sandbox>` element. User-authored logic runs in Arrow's QuickJS/WASM VM;
the host page mutates DOM through the trusted Arrow renderer. Devtools records
`render` when the host sends an accepted artifact and `rendered` when the inline
sandbox has mounted it.

Generated data-resource UI should call host tools through the Arrow host bridge
and render state returned by the host:

```ts
import { html, reactive } from '@arrow-js/core';
import { getState, callTool, onState } from 'host-bridge:summon';

const state = reactive({ loading: false, results: [], error: '' });

function syncHostState(hostState: Record<string, unknown>) {
  state.loading = Boolean(hostState.searchLoading);
  state.error = String(hostState.searchError ?? '');
  state.results = Array.isArray(hostState.searchResults)
    ? hostState.searchResults
    : [];
}

syncHostState(await getState());
onState(syncHostState);

async function search(event: Event) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const query = String(new FormData(form).get('query') ?? '');
  const result = await callTool('search', { query });
  if (result.ok) syncHostState(result.state);
  else state.error = result.error ?? 'Search failed';
}

export default html`
  <form @submit="${search}">
    <input name="query" value="recipes" />
    <button>Search</button>
    <p>${() => state.loading ? 'Searching...' : ''}</p>
    <p>${() => state.error}</p>
    <ul>${() => state.results.map((item) => html`<li>${item.title}</li>`)}</ul>
  </form>
`;
```

## 5. Inspect Diagnostics

Diagnostics are for failures and maintainer investigation, not the first thing
an adopter needs to learn.

- If generation fails, inspect `/error`, `/validation-summary`,
  `/validation-blocked`, and `/protocol-skip` in the Stream drawer.
- If a generated control does nothing, inspect Devtools for rejected host tool
  requests, host dispatch, handler completion, and pushed state.
- If the surface stays blank, inspect Stream diagnostics for accepted Arrow
  `/artifact` revisions, then inspect Devtools for `render`, `rendered`, and
  `surface-runtime-error`.
- If sandbox safety looks suspect, run the adversarial page and the safety
  harness before changing inline runtime, Arrow bridge, or tool-dispatch code.
