# Package consumption

Summon's public API is exposed through three packages:

```txt
@decentralized-design/summon
@decentralized-design/summon-server
@decentralized-design/summon-react
```

Use public packages rather than importing private workspaces directly.

## Core package

`@decentralized-design/summon` exposes host-side types and helpers through curated subpaths: engine contracts, host utilities, policy helpers, envelopes, Devtools, and assets.

## Server package

`@decentralized-design/summon-server` owns the generation lifecycle:

- prompt/contract assembly
- model-provider interface
- runtime schema selection
- validation and repair
- conformance/receipt emission
- accepted artifact streaming

Surface Document provider methods are:

```ts
generateSurfaceDocumentBundle(request)
repairSurfaceDocumentBundle(request)
```

## React package

`@decentralized-design/summon-react` provides `SummonSurface`, the React adapter for rendering inline Summon surfaces and replay envelopes. It mounts accepted Surface Document output and forwards granted tool calls to the host.

## Artifact expectations

The preferred artifact runtime is `surface-document`:

```json
{
  "op": "artifact",
  "path": "/artifact",
  "value": {
    "runtime": "surface-document",
    "source": {
      "main.html": "...",
      "main.css": "...",
      "main.js": "..."
    }
  }
}
```

Legacy/control runtimes may still appear while Surface Document bakes, but new integrations should treat Surface Document as the contract to follow.

## Replay envelopes

Saved replay envelopes store prompt, surface plan, accepted artifact, protocol lines, validation issues, stream graph, grants, metadata, token CSS, and runtime version. Envelopes are records, not authority; hosts still validate before rendering.
