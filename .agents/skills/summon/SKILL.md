---
name: summon
description: "Generate on-brand Summon surfaces from Ghost fingerprints / fingerprint-as-design-authority; build, debug, or integrate the safe drop-in sandbox with SurfacePolicy contracts, Arrow JSONL artifact streaming, host tools/resources, PolicyEngine grants, StreamGraph diagnostics, and safety smoke tests; preserve generation as a contract with conformance verdicts/receipts and adoption docs. Use when working in the Summon repo, adding tools/resources/workers/approval actions, debugging validation or sandbox behavior, checking /ghost-conformance or /ghost-receipt, or creating agent-authored Summon UIs."
---

# Summon

Use this skill when working inside the Summon repo or integrating Summon into a
host app.

## Design Quality

When generating or modifying surfaces, load the relevant Ghost fingerprint as
the design authority: prose, composition, checks, and token/style CSS. Use the
`SUMMON_GHOST_ROOTS` presets. Fingerprint-first is the default path, not
optional flavor.

The bar is: would the brand's design team ship this? Valid-but-generic output
is a bug with the same severity as a validation failure.

Verify visually. Render the surface, screenshot it with agent-browser, and check
the `/ghost-conformance` verdict. The protocol validator alone is not a design
check.

For off-brand output, repair in this order: inspect the fingerprint (compose),
then `/ghost-conformance` (govern), then `/ghost-receipt` (account), before
touching runtime code.

## Start Here

1. Read `README.md` for the current adoption flow and package map.
2. Read `docs/adoption/quickstart.md` for the local golden path.
3. Read `docs/adoption/integration.md` before wiring a host or server.
4. Read `docs/adoption/package-consumption.md` before importing packages,
   publishing packages, or choosing between React/frameworkless/server APIs.
5. Read `docs/adoption/mobile-webviews.md` before discussing mobile WebView or
   native-wrapper behavior.
6. Read `docs/adoption/security.md` before changing sandbox, CSP, grants,
   script policy, worker, approval, or production-tier behavior.
7. Read `docs/adoption/debugging.md` before changing validation, stream graph,
   protocol, Devtools, or sandbox diagnostics.

## Core Architecture

Follow this path unless the user explicitly asks for a runtime redesign:

```txt
host tool registry
  -> SurfacePolicy: tier/grants/purpose/persistence
  -> compiled SurfacePlan: purpose/runtime/data/authority/persistence
  -> createToolRegistry(...).toContract()
  -> compileSystemContracts()
  -> Arrow protocol hardener
  -> StreamGraph artifact diagnostics
  -> PolicyEngine and mountInlineSurface()
```

Tools are host-owned. The model sees the contract; the host owns handlers,
network, credentials, state, grants, and the selected `SurfacePolicy`.
Generated artifacts must not emit or widen `/surface-policy` or `/surface-plan`.

Generation servers should use `runSurfaceGeneration(input, emit)` from
`@anarchitecture/summon-server`. Applications should consume built public
package exports, not `src/*.ts` paths or `@summon-internal/*` packages.

Use `defineAction` and `defineDataResource` for common host-backed
interactivity. Use `defineWorkerAction` / `defineWorkerResource` for host-owned
background work and `defineApprovalAction` when an operation must pass through a
host approval adapter.

## Safe Output Rules

These are non-negotiable invariants and table stakes; they are not the point of
the work, design quality is.

- Grant tools from the host with `grantedTools`; never trust artifact-declared
  tools as permission.
- Keep generated network access disabled by default. Use host tools for product
  data and credentials.
- Prefer Arrow-native generated artifacts with `host-bridge:summon` and
  `callTool()`. Generated custom scripts, unsupported runtime controls, and raw
  section/fragment protocols are rejected before generation or at the parser.
- Use `defineDataResource` for host-backed async data, with loading, error, and
  data state keys.
- Resource UIs must render loading, error, and data states.
- Do not introduce external URLs, unsafe tags, inline handlers, ambient storage,
  parent DOM access, or network access in generated artifacts.
- Keep runtime protocol/API changes out of adoption-doc work unless requested.

## Debug Loop

For generation failures, inspect `/error`, `/validation-summary`,
`/validation-blocked`, `/stream-graph-summary`, `/protocol-skip`,
`/surface-policy`, `/surface-plan`, `/surface-contract`, `/agent-goal`,
`/agent-policy-resolution`, `/shape`, `/token-overrides`, and `/mode-upgraded`.

For off-brand or generic output, inspect `/ghost-conformance`, the fingerprint
inputs (graph slice/nodes), and token/style CSS before suspecting runtime code.

For client behavior, inspect Devtools events: `surface-plan`,
`surface-contract`, `protocol-line`, `protocol-parse-error`, `surface-mounted`,
`render`, `rendered`, `tool-called`, `tool-rejected`,
`tool-dispatched`, `tool-settled`, `state-pushed`, `stream-graph`, and
`surface-runtime-error`.

Use `ContractIssue` plus `hintsForContractIssue(issue)` when feeding validation
problems back to a model or another agent. For surface problems, check whether
the requested grant exceeds the selected `SurfacePolicy` or compiled
`SurfacePlan`.

## Commands

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
does not require `ANTHROPIC_API_KEY`.

Manual smoke path: run `pnpm dev:workbench`, open `http://localhost:5173/generate`, choose the
**Host resource search** showcase scenario, keep **Free layout**, confirm the
contract cockpit shows `explore/arrow/host-resource/read/replayable` and
`Grants 1: search`, run the scenario, submit a generated search such as
`chicken pasta`, inspect the Stream and Devtools drawers, replay from Saved
surfaces, then open `http://localhost:5173/adversarial`. Use `/batch` for
prompt/token health; `/strict` and `/fatal` only retain retired V1 notes.
