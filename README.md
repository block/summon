# Summon

Summon renders AI-generated UI in a locked iframe. The generated UI can only use
host tools you register, so the host keeps control of data, actions, credentials,
network access, state, and persistence.

The adopter mental model is intentionally small:

| Term | Meaning |
| --- | --- |
| Surface | The generated UI Summon renders. |
| Host tool | A host-owned data source or action the surface may request. |
| Sandbox | The locked iframe where generated UI runs. |
| Surface config | The host's choice of what the surface is allowed to do. |
| Diagnostics | Stream and Devtools information used when something breaks. |

## Project Status: Beta

Summon is pre-1.0 and under active development. The protocol,
generated-surface contract, and public JavaScript exports may change before a
stable release.

The public package boundary is:

```txt
@anarchitecture/summon
@anarchitecture/summon-server
@anarchitecture/summon-react
```

## Quickstart

```sh
pnpm install
cp apps/server/.env.example apps/server/.env
# edit apps/server/.env and set ANTHROPIC_API_KEY
pnpm dev:gallery
```

Open `http://localhost:5174`.

The Surface Gallery is the first OSS demo. It shows static surfaces, host-backed
search, host-owned actions, approval flows, trusted host components, and
background host work without exposing the maintainer workbench.

For the maintainer workbench:

```sh
pnpm dev:all
```

Open `http://localhost:5173/generate.html`.

1. Choose the **Host Data Search** showcase scenario.
2. Confirm the run is interactive and only the `search` host tool is allowed.
3. Run it, then submit a generated search such as `chicken pasta`.
4. Open `http://localhost:5173/adversarial.html` and confirm the sandbox
   boundary still holds.

The full guided path lives in
[docs/adoption/quickstart.md](docs/adoption/quickstart.md).

## How It Fits Together

Summon's supported integration path is narrow:

1. Register the host tools and trusted host components the surface may use.
2. Choose a surface config for the run.
3. Generate the surface on the server.
4. Render accepted output in the sandbox.
5. Use diagnostics when generation or interaction fails.

The model can propose UI, but it cannot give itself permissions. Generated
requests are advisory until the host validates them and dispatches them through
registered host tools.

## Demo Map

- `examples/surface-gallery` - first-run OSS gallery with curated live presets,
  compact host tools, a sandboxed surface, and a small event strip.
- `/generate.html` - maintainer workbench for surface configs, allowed host
  tools, trusted host components, token overrides, validation retries,
  edit/replay, Ghost steering, Devtools, and stream diagnostics.
- `/batch.html` - parallel prompt harness for prompt coverage, host tool wiring,
  direction-token visual coverage, throughput, and consistency checks.
- `/adversarial.html` - sandbox boundary checks for network, storage, parent
  access, and unallowed host tool requests.
- `/strict.html` - trusted host overlay for sensitive input inside a generated
  sandbox description.
- `/fatal.html` - sandbox startup failure handling.

## Public Packages

- `@anarchitecture/summon` - curated host-authoring helpers, surface config
  helpers, and explicit subpaths for advanced browser, engine, host, policy,
  envelope, assets, and Devtools APIs.
- `@anarchitecture/summon-server` - provider-neutral generation lifecycle,
  validation retries, summaries, and model-provider interfaces.
- `@anarchitecture/summon-react` - `SummonSurface` and React trusted-component
  adapter. `react` and `react-dom` are peer dependencies.

## Workspace Map

- `packages/summon*` - public package facades.
- `packages/engine`, `packages/host`, `packages/devtools`,
  `packages/sandbox-runtime`, `packages/server`, `packages/react` - private
  implementation workspaces published only through the public facades.
- `examples/surface-gallery` - first-run live example app for OSS adopters.
- `apps/server` - Anthropic-backed demo server, direction loading, validation
  retry feedback, and demo backing routes.
- `apps/demo` - Vite maintainer workbench for generation, batch runs,
  adversarial checks, strict input, Ghost steering, diagnostics, and fatal
  sandbox testing.

## Adoption Docs

- [Quickstart](docs/adoption/quickstart.md) - one golden end-to-end path.
- [Integration](docs/adoption/integration.md) - minimal host/server wiring with
  current APIs.
- [Package Consumption](docs/adoption/package-consumption.md) - how React apps
  and frameworkless hosts should import built Summon packages.
- [Mobile WebViews](docs/adoption/mobile-webviews.md) - web-first requirements
  for iOS/Android WebView embedding.
- [Security Posture](docs/adoption/security.md) - surface types, host rules,
  and browser-test expectations.
- [Debugging](docs/adoption/debugging.md) - diagnostics for failed generation,
  broken controls, missing data, trusted components, and sandbox safety.
- [Agent skill](.agents/skills/summon/SKILL.md) - repo-local operating guide
  for AI agents working on Summon.

## Security Boundary

Summon renders generated UI in a null-origin iframe with a restrictive CSP and a
typed postMessage bridge. The host explicitly chooses the allowed host tools for
each run; declarations from generated UI are never executable authority.

Run the safety harness before changing iframe sandbox attributes, CSP,
postMessage routing, bootstrap startup checks, or script execution behavior:

```sh
pnpm test:safety
```

## Useful Commands

```sh
pnpm typecheck
pnpm test
pnpm test:safety
pnpm test:gallery
pnpm build
pnpm check:public-api
pnpm smoke:public-packages
pnpm pack:dry-run
pnpm dev:gallery
pnpm dev:all
pnpm port-direction <path-to-expression.md> [id]
pnpm eval-directions [--prompts N] [--directions id,id] [--seed N] [--dry]
```

`pnpm test:safety` runs the Playwright Chromium and WebKit smoke suite for
sandbox containment, bootstrap fatal checks, strict input, and generate-page
boot. It starts only the Vite demo app and does not require
`ANTHROPIC_API_KEY`.
