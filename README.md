# Summon

Sandboxed, self-contained generative UI. An LLM streams HTML, CSS, and
JavaScript into a locked-down iframe; the UI communicates with the host only
through a typed intent bridge. Data in, data out, nothing leaks.

Summon is also an adoption architecture. Hosts declare capabilities, compile
prompt and validation contracts, harden the streamed protocol, and render only
accepted output inside the sandbox. The model can propose UI, but the host owns
network, credentials, state, handlers, grants, and persistence.

## Project Status: Beta

Summon is pre-1.0 and under active development. The protocol, package layout,
workspace package names, generated-surface contract, and public JavaScript
exports may change before a stable release.

This initial public import keeps the existing `@summon/*` workspace package
names. Public npm packaging will be introduced in a follow-up change.

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

## Workspace Map

- `packages/sandbox-runtime` - built `bootstrap.js`, `tokens.css`, and
  `@summon/sandbox-runtime/assets` string exports for non-Vite consumers.
- `packages/host` - policy, capability registry, envelope helpers, and the
  browser-only `spawnSandbox` iframe primitive.
- `packages/engine` - protocol constants/parsers, `SectionAccumulator`,
  `StreamGraph`, contract compilers, protocol hardener, token validation, and
  parser-based runtime validation.
- `packages/devtools` - `EventStore` and typed lifecycle, protocol, intent,
  state, render, and stream-graph events.
- `packages/react` - controlled `SummonSurface` component for React hosts.
- `packages/server` - provider-neutral generation primitives; no Express
  routes.
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
pnpm pack:dry-run
pnpm dev:all
pnpm port-direction <path-to-expression.md> [id]
pnpm eval-directions [--prompts N] [--directions id,id] [--seed N] [--dry]
```

`pnpm test:safety` runs the Playwright Chromium and WebKit smoke suite for
sandbox containment, bootstrap fatal checks, strict input, and generate-page
boot. It starts only the Vite demo app and does not require
`ANTHROPIC_API_KEY`.
