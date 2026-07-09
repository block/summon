# Integrating Summon

This is the minimal host/server integration path for the current governed model.

## Flow

1. Define the host tools/resources the generated surface may use.
2. Choose a `SurfacePolicy` for the run.
3. Generate on the server with `runSurfaceGeneration()`.
4. Consume the validated stream on the client.
5. Render accepted artifacts with `SummonSurface` or `mountSummonSurface()`.

The preferred generated artifact is a **Surface Document**:

```txt
main.html  -> inert structure
main.css   -> Ghost fingerprint styling
main.js    -> optional governed behavior
```

See [`../spec/surface-document.md`](../spec/surface-document.md).

## Server sketch

```ts
import { runSurfaceGeneration } from '@decentralized-design/summon-server';

await runSurfaceGeneration({
  prompt,
  surfacePolicy: {
    ceiling: { data: 'host-resource', authority: 'host-action' },
    purpose: 'explore',
  },
  modelProvider,
}, (line) => {
  response.write(`${JSON.stringify(line)}\n`);
});
```

Your `modelProvider` supplies provider-specific generation methods. Surface Document generation uses:

```ts
generateSurfaceDocumentBundle(request)
repairSurfaceDocumentBundle(request)
```

The server owns prompt blocks, schema, validation, repair, conformance, and accepted artifact emission.

## Client sketch

React hosts use `@decentralized-design/summon-react`:

```tsx
import { SummonSurface } from '@decentralized-design/summon-react';

<SummonSurface
  stream={stream}
  grantedTools={['search']}
  onToolCall={async (tool, args) => {
    if (tool === 'search') return { results: await search(args) };
  }}
/>
```

Frameworkless hosts can use browser/host APIs from `@decentralized-design/summon` subpaths and the stream consumer documented in [`package-consumption.md`](./package-consumption.md).

## Authority rule

Generated UI never grants itself permissions. The host-selected policy narrows allowed tools/resources. Generated behavior can only request granted host tools through `callTool()`; the host owns credentials, state, side effects, and dispatch.

## Stream protocol

Accepted artifacts, diagnostics, conformance, and receipts are delivered over the validated JSONL protocol. See [`../spec/protocol.md`](../spec/protocol.md).
