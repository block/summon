# Summon

Summon renders AI-generated UI in an inline Arrow sandbox. The generated UI can
only use host tools you register, so the host keeps control of data, actions,
credentials, network access, state, and persistence.

Summon is **governable generative UI**: a Ghost fingerprint is the authority for
how a surface is composed, why, and whether it conformed. See
[`docs/positioning.md`](./docs/positioning.md) for the thesis and
[`docs/roadmap.md`](./docs/roadmap.md) for the build order.

The adopter mental model is intentionally small:

| Term | Meaning |
| --- | --- |
| Surface | The generated UI Summon renders. |
| Host tool | A host-owned data source or action the surface may request. |
| Sandbox | The inline Arrow VM and trusted renderer where generated UI runs. |
| Surface config | The host's choice of what the surface is allowed to do. |
| Diagnostics | Stream and Devtools information used when something breaks. |

In the TypeScript API, a surface config is `SurfacePolicy`. Summon compiles it
into a stricter `SurfacePlan` plus a read-only `SurfaceContractView` before any
model-authored output is accepted.

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
# edit apps/server/.env and set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY
pnpm dev:gallery
```

Open `http://localhost:5174`.

The Surface Gallery is the first OSS demo. It shows static surfaces, host-backed
search, host-owned actions, approval flows, direct Arrow composition, and
background host work without exposing the maintainer workbench.

For the maintainer workbench:

```sh
pnpm dev:workbench
```

Open `http://localhost:5173/generate`.

1. Choose the **Host resource search** showcase scenario.
2. Confirm the agent broker selects an interactive run with only the `search`
   host tool allowed.
3. Run it, then submit a generated search such as `chicken pasta`.
4. Open `http://localhost:5173/adversarial` and confirm the sandbox
   boundary still holds.

To steer generation from a Ghost fingerprint, set `SUMMON_GHOST_ROOTS` in
`apps/server/.env` before starting the demos. Each configured root should use
the canonical `.ghost/fingerprint/manifest.yml` package layout. The Surface
Gallery adds a Ghost fingerprint preset for each root, and the Generate
workbench adds a `Fingerprint · <id>` option. A fingerprint run is not a bundled
visual direction: Summon consumes the Ghost relay brief plus the fingerprint's
prose, inventory, composition, checks, and token/style CSS as product design
context. Summon then applies host-owned policy, tools, Arrow runtime validation,
and sandbox boundaries. Summon does not require Summon-named design tokens or
classify the request into generic response shapes.

The full guided path lives in
[docs/adoption/quickstart.md](docs/adoption/quickstart.md).
The architecture boundary is documented in
[docs/ghost-fingerprint-architecture.md](docs/ghost-fingerprint-architecture.md).

## How It Fits Together

Summon's supported integration path is narrow:

1. Register the host tools the surface may use.
2. Choose a surface config for the run.
3. Generate the surface on the server.
4. Render accepted output in the sandbox.
5. Use diagnostics when generation or interaction fails.

The model can propose UI, but it cannot give itself permissions. Generated
requests are advisory until the host validates them and dispatches them through
registered host tools.

To run both demo apps at once:

```sh
pnpm dev:demos
```

## Demo Map

- `apps/surface-gallery` - primary adopter gallery with curated live
  presets, compact host tools, Ghost-root presets when configured, an inline
  Arrow surface, and a small event strip.
- `/generate` - diagnostic maintainer workbench for broker-selected
  surface configs, allowed host tools, token overrides, validation summaries,
  replay, Ghost steering, Devtools, and stream diagnostics.
- `/batch` - parallel broker harness for prompt coverage, host tool
  wiring, direction-token visual coverage, throughput, and consistency checks.
- `/adversarial` - sandbox boundary checks for network, storage, parent
  access, and unallowed host tool requests.
- `/strict` - retired overlay note; the current runtime is the inline Arrow
  sandbox.
- `/fatal` - retired boot note; current errors surface through the inline Arrow
  handle and Devtools events.

## Public Packages

- `@anarchitecture/summon` - curated host-authoring helpers, surface config
  helpers, and explicit subpaths for advanced browser, engine, host, policy,
  envelope, assets, Devtools, and token CSS APIs.
- `@anarchitecture/summon-server` - provider-neutral generation lifecycle,
  Arrow protocol hardening, validation summaries, and model-provider
  interfaces.
- `@anarchitecture/summon-react` - `SummonSurface` React adapter for inline
  Arrow surfaces. `react` and `react-dom` are peer dependencies.

## Workspace Map

- `packages/summon*` - public package facades.
- `packages/engine`, `packages/host`, `packages/devtools`,
  `packages/sandbox-runtime`, `packages/server`, `packages/react` - private
  implementation workspaces published only through the public facades.
- `apps/server` - multi-provider demo server for Anthropic, OpenAI, and Gemini,
  direction loading, Arrow protocol diagnostics, and demo backing routes.
- `apps/surface-gallery` - first-run live example app for OSS adopters.
- `apps/demo` - Vite maintainer workbench for generation, batch runs,
  adversarial checks, Ghost steering, diagnostics, and retired iframe-era notes.

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
  broken controls, missing data, runtime errors, and sandbox safety.
- [Agent skill](.agents/skills/summon/SKILL.md) - repo-local operating guide
  for AI agents working on Summon.

## Security Boundary

Summon runs generated Arrow logic inside a QuickJS/WASM VM and mutates the page
only through Arrow's trusted renderer. The host explicitly chooses the allowed
host tools for each run; declarations from generated UI are never executable
authority. Generated network access is off by default and product data should
flow through host tools.

Run the safety harness before changing the inline runtime, Arrow bridge,
generated network policy, or tool-dispatch behavior:

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
pnpm dev:workbench
pnpm dev:demos
pnpm port-direction <path-to-expression.md> [id]
pnpm eval-directions [--prompts N] [--directions id,id] [--seed N] [--dry]
```

`pnpm test:safety` runs the Playwright Chromium and WebKit smoke suite for
sandbox containment and generate-page boot. It starts only the Vite demo app and
does not require a model-provider API key.
