# Summon Public Packaging Plan

This note records Summon's public package boundary. Public packages are facades
over private implementation workspaces so consumer APIs are organized by install
environment rather than monorepo internals.

## Decision

Publish by install environment, not by internal implementation layer.

```txt
@anarchitecture/summon
@anarchitecture/summon-server
@anarchitecture/summon-react
```

`@anarchitecture/summon` is the shared host/contract package. Its root export is
kept narrow: protocol parsing, surface-plan helpers, host capability/component
contract helpers, and public diagnostics types. Browser runtime, policy,
envelope, assets, and Devtools APIs live on explicit subpaths such as
`@anarchitecture/summon/browser` and `@anarchitecture/summon/policy`.

`@anarchitecture/summon-server` is the provider-neutral generation package. It
owns `runSurfaceGeneration`, prompt/contract assembly, repair feedback, summary
helpers, and model-provider interfaces. It may depend on the core package but
should not pull in browser or React peers.

`@anarchitecture/summon-react` is the React adapter. It owns `SummonSurface`,
`defineReactComponent`, and React component island lifecycle. It depends on the
core package and has `react` / `react-dom` as peer dependencies.

Future adapters should follow the same rule:

```txt
@anarchitecture/summon-svelte
@anarchitecture/summon-vue
@anarchitecture/summon-acp
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

## Implementation Policy

Keep the private implementation graph boring:

- Keep `@summon-internal/*` workspace names private.
- Keep docs/examples on public package names.
- Publish only `@anarchitecture/summon`, `@anarchitecture/summon-server`, and
  `@anarchitecture/summon-react`.
- Build public packages by copying implementation `dist` output under
  `dist/_internal/*` and writing explicit public wrapper files.
- Fail CI if public JS or `.d.ts` imports `@summon-internal/*`, public wrappers
  use `export *`, public-looking implementation dirs appear at `dist/*`, or
  wrapper exports drift from `scripts/public-api-manifest.json`.
- Do source-health work here when it is destination-agnostic: tests, security
  fixes, API cleanup, build reliability, and package metadata correctness.

## Release Gate

Run this before publishing:

```sh
pnpm build
pnpm check:public-packages
pnpm pack:dry-run
pnpm test:safety
```
