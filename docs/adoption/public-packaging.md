# Summon Public Packaging Plan

This note records the intended public package boundary for the follow-up
package-boundary PR. The clean source import keeps the existing `@summon/*`
workspace package names so the first public review is source-only.

## Decision

Publish by install environment, not by internal implementation layer.

```txt
@<public-scope>/summon
@<public-scope>/summon-server
@<public-scope>/summon-react
```

`@<public-scope>/summon` is the frameworkless client/core package. It owns the
browser-facing runtime contract: protocol types and parsers, surface envelopes,
capability registry helpers, `PolicyEngine`, stream consumption,
`spawnSandbox`, runtime assets, validation helpers, and Devtools event store
exports.

`@<public-scope>/summon-server` is the provider-neutral generation package. It
owns `runSurfaceGeneration`, prompt/contract assembly, repair feedback, summary
helpers, and model-provider interfaces. It may depend on the core package but
should not pull in browser or React peers.

`@<public-scope>/summon-react` is the React adapter. It owns `SummonSurface`,
`defineReactComponent`, and React component island lifecycle. It depends on the
core package and has `react` / `react-dom` as peer dependencies.

Future adapters should follow the same rule:

```txt
@<public-scope>/summon-svelte
@<public-scope>/summon-vue
@<public-scope>/summon-acp
```

Do not publish separate packages for `engine`, `host`, `sandbox-runtime`, and
`devtools` unless those layers become independently useful to consumers. They
are currently coordinated pieces of one core runtime.

## Why

This follows the package boundary used by similar open-source AI UI projects:

- Core/protocol package plus framework adapters: AI SDK, json-render, AG-UI.
- Server/client split when generation and rendering run in different
  environments: MCP-UI, CopilotKit.
- React/Svelte/Vue adapters are separate because they bring framework lifecycle,
  renderer semantics, and peer dependencies.

For Summon, the public question is "where am I installing this?" rather than
"how is the monorepo organized internally?"

Useful references:

- AI SDK: https://github.com/vercel/ai
- json-render: https://github.com/vercel-labs/json-render
- OpenUI: https://github.com/thesysdev/openui
- CopilotKit architecture: https://docs.copilotkit.ai/deepagents/concepts/architecture
- AG-UI JavaScript SDK: https://docs.ag-ui.com/sdk/js/core/overview
- MCP-UI client package: https://www.npmjs.com/package/@mcp-ui/client
- assistant-ui packages: https://www.assistant-ui.com/packages
- Tambo: https://github.com/tambo-ai/tambo

## Clean Import Policy

Keep the clean source import boring:

- Keep `@summon/*` workspace names in source until the package-boundary PR.
- Keep docs/examples on current workspace package names in the import PR.
- Do source-health work here when it is destination-agnostic: tests, security
  fixes, API cleanup, build reliability, and package metadata correctness.

## Port Sequence

1. Start from the public repo template commit so license, governance,
   `CODEOWNERS`, Renovate, and issue templates survive.
2. Overlay the current Summon source as a single clean import commit, without
   private history.
3. Convert package names and import examples to the public scope in the
   follow-up package-boundary PR.
4. Add CI before the import PR lands. Minimum gates: `pnpm test`, `pnpm build`,
   and `pnpm test:safety` once browser dependencies are available.
5. Choose the packaging implementation:
   - Collapse source into the three public package directories during the port,
     or
   - Keep internal workspaces private and bundle their output into the three
     public packages at publish time.
6. Run `pnpm build`, `pnpm test`, `pnpm test:safety`, and `pnpm pack:dry-run`
   before tagging or publishing.

## Open Implementation Question

The three-package public shape is the desired consumer API. The mechanical
implementation still needs a choice:

- Collapsing source makes npm packaging simple but creates a larger file move.
- Bundling keeps the current internal development graph but requires a publish
  build that inlines internal packages and leaves only real external
  dependencies in the published manifests.

Make that choice in the package-boundary branch, where package names and npm
scope changes are expected.
