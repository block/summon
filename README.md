# Summon

> **Summon — generative UI with a design authority.**
> Ghost fingerprints carry the brand; Summon composes surfaces that answer to
> them, inside a sandbox where every action is observable, under a contract
> that yields a verdict.

Summon exists to close the gap between generated UI and designed UI. A Ghost
fingerprint is the design authority, so generated output answers to the brand
instead of the model's taste. Generated code runs in a capability-isolated
sandbox where every action is a typed, observable tool call, making Summon a
methodical drop-in home for model-generated code. Generation is a contract:
output is verified against the fingerprint that requested it, with a verdict
and receipt.

Summon is **governable generative UI**: generated interfaces composed from a
design authority, constrained by explicit capabilities, and returned with a
conformance verdict and receipt. See
[`docs/positioning.md`](./docs/positioning.md) for the thesis and
[`docs/roadmap.md`](./docs/roadmap.md) for the build order.

## See it

The Surface Gallery is the identity demo: it is where fingerprint-driven
surfaces render when Ghost roots are configured. Run `pnpm dev:gallery` and
open `http://localhost:5174`.

The adopter mental model is intentionally small:

| Term | Meaning |
| --- | --- |
| Surface | The generated UI Summon renders. |
| Host tool | A host-owned data source or action the surface may request. |
| Surface Document | The preferred generated artifact shape: `main.html` structure, `main.css` fingerprint styling, optional governed `main.js` behavior. |
| Sandbox | The capability-isolated descriptor runtime where generated behavior runs without ambient browser authority. |
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

## Fingerprint-first path

The default governed path starts from a Ghost fingerprint. When editing
`apps/server/.env` in the quickstart, set `SUMMON_GHOST_ROOTS` before starting
the demos. Each configured root should use the canonical flat Ghost package
layout rooted at `.ghost/manifest.yml`. The Surface Gallery adds a Ghost
fingerprint preset for each root, and the Generate workbench adds a
`Fingerprint · <id>` option. A fingerprint run is not a bundled visual
direction: Summon loads the Ghost flat corpus, prepares a fingerprint surface
brief from its prose nodes, injects token/style CSS, evaluates conformance
checks, and emits a receipt. Summon then applies host-owned policy, tools,
Surface Document validation, runtime isolation, conformance checks, and receipt
generation. Summon does not require Summon-named design tokens or classify the
request into generic response shapes.

The Surface Document contract is documented in
[`docs/spec/surface-document.md`](./docs/spec/surface-document.md).

The full guided path lives in
[docs/adoption/quickstart.md](docs/adoption/quickstart.md).
The architecture boundary is documented in
[docs/integration-with-ghost.md](docs/integration-with-ghost.md).

## Quickstart

```sh
pnpm install
cp apps/server/.env.example apps/server/.env
# edit apps/server/.env and set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY
pnpm dev:gallery
```

Open `http://localhost:5174`.

The Surface Gallery is the first OSS demo. It shows static surfaces, host-backed
search, host-owned actions, approval flows, Surface Document rendering, and
background host work without exposing the maintainer workbench.

For the maintainer workbench:

```sh
pnpm dev:workbench
```

Open `http://localhost:5173/generate`.

1. Choose the **Host resource search** showcase scenario.
2. Confirm the agent ward selects an interactive run with only the `search`
   host tool allowed.
3. Run it, then submit a generated search such as `chicken pasta`.
4. Open `http://localhost:5173/adversarial` and confirm the sandbox
   boundary still holds.

## How It Fits Together

Summon's supported integration path is narrow. The preferred generated artifact
is a Surface Document: `main.html` for inert structure, `main.css` for Ghost
fingerprint styling, and optional `main.js` for governed behavior. HTML is
parsed into a descriptor tree; behavior runs in the owned VM without ambient
browser authority.

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
  presets, compact host tools, Ghost-root presets when configured, a generated
  surface, and a small event strip.
- `/generate` - diagnostic maintainer workbench for ward-selected
  surface configs, allowed host tools, token overrides, validation summaries,
  replay, Ghost steering, Devtools, and stream diagnostics.
- `/batch` - parallel ward harness for prompt coverage, host tool
  wiring, Ghost fingerprint token coverage, throughput, and consistency checks.
- `/adversarial` - sandbox boundary checks for network, storage, parent
  access, and unallowed host tool requests.

## Public Packages

- `@anarchitecture/summon` - curated host-authoring helpers, surface config
  helpers, and explicit subpaths for advanced browser, engine, host, policy,
  envelope, assets, Devtools, and token CSS APIs.
- `@anarchitecture/summon-server` - provider-neutral generation lifecycle,
  runtime validation, conformance diagnostics, and model-provider interfaces.
- `@anarchitecture/summon-react` - `SummonSurface` React adapter for inline
  Summon surfaces and replay envelopes. `react` and `react-dom` are peer dependencies.

## Workspace Map

- `packages/summon*` - public package facades.
- `packages/engine`, `packages/host`, `packages/devtools`,
  `packages/sandbox-runtime`, `packages/server`, `packages/react` - private
  implementation workspaces published only through the public facades.
- `apps/server` - multi-provider demo server for Anthropic, OpenAI, and Gemini,
  Ghost fingerprint loading, runtime diagnostics, and demo backing routes.
- `apps/surface-gallery` - first-run live example app for OSS adopters.
- `apps/demo` - Vite maintainer workbench for generation, batch runs,
  adversarial checks, Ghost steering, and diagnostics.

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

Summon runs optional Surface Document behavior inside a QuickJS/WASM VM against
a descriptor DOM, then mutates the page only through Summon's trusted renderer.
The host explicitly chooses the allowed host tools for each run; declarations
from generated UI are never executable authority. Generated network access is
off by default and product data should flow through host tools.

Run the safety harness before changing the descriptor runtime, generated network
policy, or tool-dispatch behavior:

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
```

`pnpm test:safety` runs the Playwright Chromium and WebKit smoke suite for
sandbox containment and generate-page boot. It starts only the Vite demo app and
does not require a model-provider API key.
