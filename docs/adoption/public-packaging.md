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

`@anarchitecture/summon` is the frameworkless client/core package. Its root
entrypoint is curated for host-authoring helpers: capability and component
registries, `PolicyEngine`, and `SurfacePlan` helpers/types. Advanced runtime
surfaces live behind explicit subpaths:

```txt
@anarchitecture/summon/browser
@anarchitecture/summon/engine
@anarchitecture/summon/host
@anarchitecture/summon/policy
@anarchitecture/summon/envelope
@anarchitecture/summon/assets
@anarchitecture/summon/devtools
```

Use `/browser` for iframe spawning, stream consumption, component islands, and
strict input. Use `/engine` for protocol, validation, prompt contracts, stream
graph, and hardening. Use `/host` only when writing adapters that need the full
host runtime surface.

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
- Build public packages by copying implementation `dist` output and rewriting
  private imports to public or relative imports.
- Fail CI if public JS or `.d.ts` imports `@summon-internal/*`.
- Fail CI if the public root export snapshot drifts without an intentional
  update to `scripts/check-public-api.mjs`.
- Do source-health work here when it is destination-agnostic: tests, security
  fixes, API cleanup, build reliability, and package metadata correctness.

## Release Gate

Run this before publishing:

```sh
pnpm build
pnpm check:public-packages
pnpm check:public-api
pnpm pack:dry-run
pnpm smoke:public-packages
pnpm test:safety
```
