# M3 plan: Summon integration

Status: plan (2026-06-29). Prereqs: M0 ✅, M1 ✅, M2 ✅ (domjs engine, 21/21).

## Intention (re-read)

> Make `surface-vm` + `domjs` a real, selectable Summon runtime, end to end,
> behind the experimental flag. **Reuse what exists. Don't fork the protocol.
> The bridge is the only new capability surface — test it like one.**

M3 touches three packages (surface-vm, engine, server, host). Keep each change a
small, boring shape that mirrors the Arrow path already in the repo.

## Scope discipline

This is the biggest milestone. To keep it focused, M3 ships in **four ordered
sub-steps, each independently green**. If time runs short, stopping after M3.2
still leaves a usable, tested host-bridge-enabled runtime — just not yet wired
into the demo.

```
M3.1  bridge          surface-vm: host-bridge:summon (callTool/getState/onState)
M3.2  artifact+validate engine: domjs bundle shape + validator -> repair codes
M3.3  server+prompt    server: DomjsControlStrategy + output-runtime + prompt block
M3.4  host+app-safety  inline-surface domjs branch + app-level safety cases
```

---

## M3.1 — Host bridge (the only new capability surface)  ✅ DONE (2026-06-29)

Goal: domjs surfaces can `await callTool(name, args)`, `getState()`, and
`onState(cb)` — identical contract to today's `inline-surface.ts` Arrow bridge.

Shipped: `protocol.ts` (`{type:'state'}` message + `HostBridge` type),
`runner.ts` (`__hostBridge` async promise-handle injection, both globals revoked
after boot), domjs core (`callTool`/`getState`/`onState` + state dispatch),
bootstrap globals, `mount.ts` (`hostBridge`/`initialState`/`pushState`),
`test/bridge.test.ts` (4). 25/25 tests pass; build + typecheck clean.

Bug the tests caught (the exact risk the plan flagged): reading QuickJS arg
handles inside a deferred `.then` threw "Lifetime not alive" — handles are freed
when the host function returns. Fix: read `getString` synchronously, then go
async. Args/results cross as JSON, so functions/live objects are dropped at the
boundary (asserted).

### Shape (mirror Arrow, reduced)
- `runner.ts`: add an optional `hostBridge` to `VmRunnerOptions`. Inject one VM
  global `__hostBridge(name, args)` that returns a **promise handle** (port the
  async deferred pattern from Arrow's `__arrowHostBridge`, quickjs.ts:866). State
  push goes the other way: a host->VM message `{type:'state', state}` dispatched
  through the existing `__dispatch`.
- `protocol.ts`: add `{ type: 'state'; state: ... }` to `HostToVmMessage` and a
  `{ type: 'tool'; ... }`-free design — tool calls go through `__hostBridge`, not
  the render channel. (Keep render/patch channel pure UI.)
- domjs core: expose `callTool`, `getState`, `onState` from a
  `host-bridge:summon` virtual module the bootstrap re-exports as globals.
  `getState` returns the last pushed state; `onState` registers a listener fired
  on each `{type:'state'}` dispatch.

### Decisions
- **One bridge module, three functions.** No generic bridge framework.
- **State is plain data, validated host-side** (host already clones/validates in
  `inline-surface.ts`). The VM just stores and notifies.
- `callTool` is async and returns the host result (or rejects). domjs already
  `await`s handlers in `__dispatch`, so this composes cleanly.

### Tests (surface-vm)
- `callTool('x', {...})` round-trips: VM calls, host handler runs, VM gets result.
- ungranted/unknown tool name rejects with a clear error.
- bridge args/return are plain data only (no functions, no nodes).
- `{type:'state'}` dispatch fires `onState` listeners and updates `getState()`.

**Exit M3.1:** bridge round-trips and isolation holds. surface-vm tests green.

---

## M3.2 — domjs artifact shape + validator  ✅ DONE (2026-06-29)

Goal: a `domjs` bundle the server can validate and feed into the existing repair
loop. Mirror `arrow-bundle.ts` / `arrow-artifact.ts`.

Shipped: `engine/domjs-artifact.ts` (`DomjsSurfaceArtifact` + normalize +
validate, with the conservative unsupported-API scan), `engine/domjs-bundle.ts`
(`summon.domjs-bundle/v1` normalize + artifact conversion + tool/schema), engine
index exports, hints in `contracts.ts`, repairable codes registered in
`server/runtime/bundle.ts`, `engine/test/domjs-artifact.test.ts` (10).
Engine 66/66, server 40/40; both build + typecheck clean.

The validator catches, pre-mount, exactly what the surface-vm domjs facade would
throw on at runtime (innerHTML/querySelector/style/window/insertBefore/...) and
emits the repairable `domjs-unsupported-api` block code — turning a runtime crash
into a repair-loop fix, the original `.map`-crash lesson applied to domjs.

### Shape (engine package)
- New `domjs-artifact.ts`: `DomjsSurfaceArtifact { runtime:'domjs', source: {'main.js', 'main.css'?} }`
  + `validateDomjsSurfaceArtifact(...)`. Reuse the structure of
  `validateArrowSurfaceArtifact`: single entry, size limit, fetch-not-granted
  check.
- **Static facade-unsupported check** (the high-value part): a small regex/scan
  for the APIs domjs throws on (`innerHTML`, `.style`, `querySelector`,
  `getElementById`, `insertBefore`, `window`, `document.body`). Emit repairable
  codes, e.g. `domjs-unsupported-api`. This turns a runtime throw into a
  pre-mount repair — exactly the lesson from the original `.map` crash.
- `domjs-bundle.ts`: `normalizeDomjsBundle` paralleling `arrow-bundle.ts`
  (`schema: "summon.domjs-bundle/v1"`, one `main.js`). Reuse the coercion helpers
  pattern; don't reinvent.
- `contracts.ts`: hints for the new codes (phrase = the throw messages domjs
  already uses — single source of truth).

### Repair wiring (server)
- Add the new codes to the `repairable` set in `runtime/bundle.ts`.

### Decisions
- **The validator's job is to catch what domjs would throw, earlier.** Keep the
  static check conservative (string/regex on obvious tokens), like the existing
  `FETCH_USAGE_RE` / `ARROW_IDL_BINDING_RE`. False positives are worse than a
  caught runtime error, so only flag unambiguous usages.
- CSS: reuse `html-artifact.ts` CSS allowlist for `main.css`. No new CSS logic.

### Tests (engine)
- valid domjs bundle normalizes/validates clean.
- each unsupported API → its repairable code.
- correct usage (createElement/append/region) → no issues.

**Exit M3.2:** domjs bundles validate; unsupported APIs are repairable block
codes; engine tests green.

---

## M3.3 — Server strategy + output runtime + prompt  ✅ DONE (2026-06-29)

Goal: `domjs-control` is a selectable runtime that generates, validates, repairs,
and emits a domjs artifact.

Shipped: `output-runtime.ts` (`domjs-control` profile, new `format:'domjs'`,
`trust:'sandboxed'`), protocol-validator `domjs` artifact branch,
`server/runtime/domjs-control.ts` (`DomjsControlStrategy` mirroring arrow, JS
syntax check), strategy-factory case, provider `generateDomjsBundle`/
`repairDomjsBundle` hooks, `writeInitialOutputMode`/`missingArtifactIssue` domjs
branches, prompt blocks `SUMMON_FIXED_DOMJS_INSTRUCTIONS` +
`SUMMON_STRUCTURED_DOMJS_BUNDLE_INSTRUCTIONS` (the inverse of arrow-subset),
`server/test/domjs-control.test.ts` (5). engine 66/66, server 45/45, surface-vm
25/25; all typecheck clean.

Note: domjs bundles carry no preview (the surface-vm render tree drives the live
preview), so the strategy emits a single rendering-status line instead of
`previewLinesFromBundle`.

### Shape
- `output-runtime.ts`: add `'domjs-control'` to the union / values / profiles
  (`format:'html'`, `delivery:'bundle'`, `trust:'sandboxed'`, `experimental:true`).
  Note: `format:'html'` means "HTML/JS authoring"; the artifact runtime is domjs.
  Add a small `artifactRuntime`/schema hook so `model-output-mode` reports
  `summon.domjs-bundle/v1`.
- `runtime/domjs-control.ts`: a `BundleRuntimeStrategy` mirroring
  `ArrowControlStrategy` — generate bundle via provider, normalize, validate,
  emit `{op:'artifact', value:{runtime:'domjs', source}}`. Reuse
  `runBundleRepairLoop`.
- `runtime/strategy.ts`: add the `case 'domjs-control'`.
- Provider: add `generateDomjsBundle` / `repairDomjsBundle` to the provider
  interface (parallel to arrow). Tool/schema from a `createDomjsBundleToolDefinition`.
- Prompt: a short `SUMMON_FIXED_DOMJS_INSTRUCTIONS` block — the **inverse of
  `arrow-subset.ts`**. Teach the supported facade subset, `region(...)` for
  lists, no `innerHTML`/`querySelector`/`window`, host tools via
  `host-bridge:summon`. Short, because this is the model's strength.

### Decisions
- **Mirror ArrowControlStrategy structurally.** Same lifecycle, different
  bundle/validator. No new abstraction.
- Prompt block stays minimal; the validator+repair loop is the safety net.

### Tests (server/engine)
- strategy factory maps `domjs-control`.
- output-mode reports the domjs schema.
- a fake provider returning a domjs bundle flows through validate→artifact.

**Exit M3.3:** server can run a `domjs-control` generation end to end with a
stub provider; tests green.

---

## M3.4 — Host mount + app-level safety  ✅ DONE (2026-06-29)

Goal: the demo renders a domjs artifact, a tool call round-trips, safety passes.

Shipped: `inline-surface.ts` `domjs` branch in `renderArtifact` (mounts via
`surface-vm` `mountSurface` + `buildDomjsModules`), the bridge forwards to the
existing `callToolInternal`, host->VM state sync via a subscriber that calls
`surface.pushState`, domjs errors routed to `reportRuntimeError`, teardown in
dispose, `@summon-internal/surface-vm` workspace dep, root tsconfig path,
`host/test/domjs-surface.test.ts` (4, happy-dom). Host 51/51.

Full M3 sweep: surface-vm 25, engine 66, server 45, host 51 = 187 tests, 0
failures; all four packages build clean.

Note: app-level safety here is exercised through `mountInlineSurface` (render,
granted-tool round-trip, ungranted-tool rejection, runtime-error reporting). The
browser Playwright `safety-smoke` suite (chromium/webkit) remains the end-to-end
gate to extend with a domjs preset when the demo exposes the runtime in its UI.

### Shape
- `inline-surface.ts`: add a `domjs` branch in `renderArtifact`. When
  `artifact.runtime === 'domjs'`, mount via `surface-vm`'s `mountSurface` +
  `buildDomjsModules`, wiring the existing `callToolInternal`/state machinery as
  the `host-bridge:summon` implementation. Arrow branch untouched.
- Map domjs `{type:'error'}` to the existing `reportRuntimeError` path (same UX
  as Arrow runtime errors — the message the user first reported).
- App safety: add domjs cases to `tests/safety-smoke.spec.ts` (or a focused
  variant): no browser globals, no generated network, ungranted tool rejected,
  no parent-DOM access — the app-level complement to M0's VM-level gate.

### Decisions
- **Reuse the host's existing state/tool plumbing verbatim.** The bridge just
  forwards to `callToolInternal` and the subscriber set already in
  `inline-surface.ts`.
- Keep the domjs branch small; share teardown/revision logic with Arrow where
  trivial, but don't refactor the Arrow path.

**Exit M3.4:** generate a domjs surface in the demo, it renders, a granted tool
call round-trips, safety suite passes.

---

## What M3 does NOT do

- No bakeoff/metrics — that's M4.
- No new protocol patch ops, no reactivity.
- No multi-engine framework; domjs and arrow remain separate strategies.
- No CSS engine work beyond reusing the html allowlist.
- No prompt tuning beyond the one minimal facade block (M4 informs tuning).

## Risks

- **Async bridge across the VM boundary** is the one genuinely fiddly port
  (promise handles + pending-job draining). Mitigation: port Arrow's pattern
  closely; M3.1 tests it in isolation before any UI.
- **Validator false positives** on the unsupported-API scan. Mitigation: flag
  only unambiguous tokens; lean on the runtime throw + repair as backstop.
- **Scope.** Four sub-steps, each green on its own. Don't start M3.3 until M3.1+2
  are merged-quality.

## First action

M3.1: extend `protocol.ts` (`{type:'state'}`), add `hostBridge` injection +
`__hostBridge` global to `runner.ts`, expose `callTool/getState/onState` via a
`host-bridge:summon` VM module, and write the bridge round-trip + isolation tests.
