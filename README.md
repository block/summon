# Summon

Sandboxed, self-contained generative UI. An LLM streams HTML, CSS, and
JavaScript into a locked-down iframe; the UI communicates with the host only
through a typed intent bridge. Data in, data out, nothing leaks.

Summon is also an adoption architecture. Hosts declare capabilities, compile
prompt and validation contracts, harden the streamed protocol, and render only
accepted output inside the sandbox. The model can propose UI, but the host owns
network, credentials, state, handlers, grants, and persistence.

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
pnpm dev:all
```

Open `http://localhost:5173/generate.html`.

1. Choose the **Host-resource search** showcase scenario.
2. Confirm the contract cockpit shows
   `explore/declarative/host-resource/read/replayable` with the `search` grant.
3. Run it, submit a generated search, then inspect the **Stream** and
   **Devtools** drawers.
4. Open `http://localhost:5173/adversarial.html` and confirm the sandbox
   boundary still holds.

The full guided path lives in
[docs/adoption/quickstart.md](docs/adoption/quickstart.md).

## Architecture

Summon's supported integration path is intentionally narrow:

```txt
host capability registry
  -> SurfacePlan: purpose/runtime/data/authority/persistence
  -> createCapabilityRegistry(...).toContract()
  -> compileSystemContracts()
  -> protocol hardener + repair feedback
  -> SectionAccumulator + StreamGraph
  -> PolicyEngine + spawnSandbox()
```

No generated artifact gets to mint permissions for itself. Artifact-declared
intents are advisory; execution is governed by host grants.

Surface planning is Summon's lifecycle layer. A host can declare the minimum
safe surface across purpose, runtime, data, authority, and persistence before
generation starts. The model sees that plan as a contract but cannot widen it.
Prompt-based `suggestSurfacePlan()` output is only advisory host UI scaffolding;
generation falls back to no host data or authority unless the host submits an
explicit accepted `SurfacePlan`.

## Demo Map

- `/generate.html` - contract cockpit with scenario grants, surface plans,
  static/declarative/scripted/worker tiers, component islands, host resources,
  token overrides, repair diagnostics, edit/replay, Ghost steering, Devtools,
  and stream graph events.
- `/batch.html` - parallel prompt harness for prompt coverage, intent wiring,
  direction-token visual coverage, throughput, and consistency checks.
- `/adversarial.html` - sandbox boundary checks for network, storage, parent
  access, and ungranted intents.
- `/strict.html` - trusted host overlay for sensitive input inside an outer
  sandbox description.
- `/fatal.html` - sandbox startup failure handling.

## Public Packages

- `@anarchitecture/summon` - curated host-authoring helpers, policy helpers,
  and surface-plan APIs. Advanced browser, engine, host, policy, envelope,
  assets, and Devtools APIs live on explicit subpaths.
- `@anarchitecture/summon-server` - provider-neutral generation lifecycle,
  repair, summaries, and model-provider interfaces.
- `@anarchitecture/summon-react` - `SummonSurface` and React component island
  adapter. `react` and `react-dom` are peer dependencies.

## Workspace Map

- `packages/summon*` - public package facades.
- `packages/engine`, `packages/host`, `packages/devtools`,
  `packages/sandbox-runtime`, `packages/server`, `packages/react` - private
  implementation workspaces published only through the public facades.
- `apps/server` - Anthropic-backed demo server, direction loading, repair
  feedback, and demo backing routes.
- `apps/demo` - Vite host app for generation, batch runs, adversarial checks,
  strict input, and fatal sandbox testing.

## Adoption Docs

- [Quickstart](docs/adoption/quickstart.md) - one golden end-to-end path.
- [Integration](docs/adoption/integration.md) - minimal host/server wiring with
  current APIs.
- [Package Consumption](docs/adoption/package-consumption.md) - how React apps
  and frameworkless hosts should import built Summon packages.
- [Mobile WebViews](docs/adoption/mobile-webviews.md) - web-first requirements
  for iOS/Android WebView embedding.
- [Security Posture](docs/adoption/security.md) - production tiers, host rules,
  and browser-test expectations.
- [Debugging](docs/adoption/debugging.md) - validation, repair, stream graph,
  and Devtools diagnostics.
- [Agent skill](.agents/skills/summon/SKILL.md) - repo-local operating guide
  for AI agents working on Summon.

## Security Boundary

Summon renders generated UI in a null-origin iframe with a restrictive CSP and a
typed postMessage bridge. The host grants intents and capabilities explicitly;
artifact-declared permissions are never executable authority.

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
pnpm build
pnpm check:public-api
pnpm smoke:public-packages
pnpm pack:dry-run
pnpm dev:all
pnpm port-direction <path-to-expression.md> [id]
pnpm eval-directions [--prompts N] [--directions id,id] [--seed N] [--dry]
```

`pnpm test:safety` runs the Playwright Chromium and WebKit smoke suite for
sandbox containment, bootstrap fatal checks, strict input, and generate-page
boot. It starts only the Vite demo app and does not require
`ANTHROPIC_API_KEY`.
