# M4 plan: provider wiring + bakeoff (the decision milestone)

Status: plan (2026-06-29). Prereqs: M0–M3 ✅ (187 tests, 0 fail, 4 packages build).

## Intention (re-read)

> Decide, with evidence, whether the domjs runtime is worth promoting past
> experimental. The metric that started this whole thread is **runtime-crash
> rate**; the bet is that fluent HTML/JS lifts first-pass acceptance and lowers
> crashes vs Arrow. **Measure, don't assume.** Build only what the measurement
> needs.

M4 is two parts: a **prerequisite** (a real provider so domjs can generate live)
and the **measurement** (bakeoff + analysis). Keep both minimal — mirror the
existing arrow/html provider code exactly; do not invent new infra.

## Where the gap is (verified)

- `scripts/runtime-bakeoff.mjs` hits a live `POST /api/generate` with
  `experimentalRuntime`. It already accepts `--runtimes`, so adding
  `domjs-control` to its `runtimeValues` is a one-line change.
- BUT `apps/server/src/model-providers.ts` implements `generateArrowBundle`,
  `generateHtmlBundle`, etc. for all three adapters (anthropic/openai/gemini) and
  has **no `generateDomjsBundle`**. The server strategy (M3.3) calls
  `ctx.input.modelProvider.generateDomjsBundle!(...)`, so without it every domjs
  run blocks with `missing-domjs-provider`.
- `ModelProfileKey` / `MODEL_PROFILE_KEYS` lack `domjs-control`, so there's no
  model selection entry for it.

So M4.1 (provider) is a hard prerequisite for M4.2 (bakeoff).

---

## M4.1 — Provider wiring (prerequisite, mirror arrow exactly)  ✅ DONE (2026-06-29)

Goal: `generateDomjsBundle` + `repairDomjsBundle` on all three adapters, so a
live domjs generation works end to end.

Shipped: re-exported `DomjsBundleRequest`/`DomjsBundleRepairRequest` through
`server` + `summon-server` indexes; `model-providers.ts` — `domjs-control` added
to `ModelProfileKey`/`MODEL_PROFILE_KEYS`/`defaultModelProfiles`, `emit_domjs_surface`
tool constants, `generateDomjsBundle`+`repairDomjsBundle` on anthropic/openai/
gemini (mirroring the html methods), a dedicated `repairDomjsPrompt`, interface
methods; `main.ts` — `domjs-control` in `MODEL_PROFILE_KEY_BY_RUNTIME` and the
provider adapter forwards the two new methods. domjs-control reuses the
generation model + token budget (the planned default). All packages + the
demo-server app typecheck clean; full sweep 213 tests, 0 fail.

### Shape (each change mirrors an existing arrow/html one)
- `model-providers.ts`:
  - Add `'domjs-control'` to `ModelProfileKey` and `MODEL_PROFILE_KEYS`.
  - Add a tool-name/description constant pair (e.g. `DOMJS_SURFACE_TOOL_NAME =
    'emit_domjs_surface'`) next to the arrow/html ones.
  - On each adapter (anthropic, openai, gemini), add `generateDomjsBundle` and
    `repairDomjsBundle` — copy the `generateHtmlBundle`/`repairHtmlBundle` bodies
    verbatim, swap profile key → `'domjs-control'`, tool name → domjs, schema →
    `request.schema` (already the domjs schema from the strategy).
  - Add the methods to the `ModelProviderAdapter` interface.
- `main.ts` (or wherever the registry → SurfaceModelProvider adapter is built):
  forward `generateDomjsBundle`/`repairDomjsBundle` like the html ones.
- Model catalog: give `domjs-control` a default model mapping (reuse the same
  model as `arrow-control` — both are "write code in a niche-ish dialect" tasks;
  this is a starting point, tune later).

### Decision
- **Reuse `arrow-control`'s model + token budget** for `domjs-control` initially.
  No new tuning until the bakeoff says otherwise.
- The repair prompt path is identical (`repairPrompt(request)` already generic
  over bundle requests via `hints`).

### Tests
- A unit test in `apps/server` (or reuse the stub pattern) that the adapter
  exposes `generateDomjsBundle` and routes the domjs tool name. Keep it light —
  the heavy validation lives in the server/engine tests already shipped.

**Exit M4.1:** a live (or recorded) domjs generation produces an accepted
artifact through `/api/generate` with `experimentalRuntime: 'domjs-control'`.

---

## M4.2 — Bakeoff harness wiring  ✅ DONE (2026-06-29)

Goal: domjs is a first-class row in the bakeoff matrix.

Shipped: `scripts/runtime-bakeoff.mjs` — `domjs-control` added to `runtimeValues`
(so `--runtimes domjs-control` validates) and a ttfp fallback to artifact-arrival
time for domjs (it emits no paint/preview event). Not a stream runtime, so no
`streamRuntimes` change.

Pre-existing blocker for M4.3 in this checkout: the harness's per-bundle
`promptFile` paths point at curated dogfood prompt files that are NOT present
here (only `technical-noir/evals/prompts.md` exists). This predates the domjs
work and is unrelated to it. To run M4.3, either restore those prompt files or
repoint `bundles[].promptFile` at existing prompt sources.

### Shape
- `scripts/runtime-bakeoff.mjs`: add `'domjs-control'` to `runtimeValues`. (It is
  not a stream runtime, so no `streamRuntimes` change.)
- Confirm the harness's `ttfp`/`tti` detection works for domjs: domjs emits an
  `artifact` line (so `artifactTti` fires) and a `surface.status` rendering event
  (M3.4) rather than a paint/preview event. **Check `isPaintEvent` / ttfp logic
  recognizes the domjs status line, or accept that ttfp == artifact time for
  domjs** (document which). Small, may need a one-line tweak.
- Nothing else: the harness already records repairs, blocked, validationCount,
  safetyViolations, bytes from `/run-metrics`.

### Decision
- Don't add domjs-specific metrics. The existing metric set already captures the
  decision-relevant signals (blocked, repairs, safetyViolations, artifactSeen).

**Exit M4.2:** `node scripts/runtime-bakeoff.mjs --runtimes arrow-control,domjs-control`
runs clean and writes `runs.json` + `report.md`.

---

## M4.3 — Run + analyze (the actual decision)

Goal: a head-to-head, evidence-backed comparison.

### Method
- Run the existing fingerprint prompt sets (redline-cinema, console-chrome-2001,
  signal-stream, technical-contrast) across `arrow-control` vs `domjs-control`,
  same seed, same prompt sample.
- Compare, per runtime:
  - **first-pass acceptance** = runs where `ok && repairs === 0`.
  - **acceptance after repair** = `ok` overall.
  - **runtime-crash proxy** = blocked runs whose issues are runtime/-fatal codes
    (the `.map`-style class) — this is THE metric from the original report.
  - repairs-to-green, safetyViolations, ttfp/tti/bytes (secondary).
- Write a short `docs/surface-vm-bakeoff-findings.md`: the numbers + a call.

### The decision rule (commit to it before running)
- **Promote toward first-class** if domjs shows materially higher first-pass
  acceptance OR materially lower runtime-crash proxy, with no safety regression.
- **Keep experimental / archive** if domjs is at parity or worse, or if it trades
  crashes for a higher block rate. Either way the cost was bounded and we learned.

**Exit M4.3:** findings doc with numbers and a promote/keep/archive
recommendation.

---

## What M4 does NOT do

- No model/prompt tuning loops before the first measurement (measure the honest
  baseline first; tune only if the baseline is promising-but-rough).
- No new bakeoff metrics or infra.
- No demo UI work (the bakeoff hits the API directly; a runtime selector in the
  demo is separate polish, not needed to decide).
- No multi-model sweep (start with the default provider; widen only if results
  are model-sensitive).

## Risks

- **Provider divergence.** Copying arrow→domjs bodies risks a stale tool name or
  profile key. Mitigation: the three adapters are near-identical; diff against
  the html methods which were the last ones added.
- **Cost/time of live runs.** Bakeoff makes real model calls. Mitigation: start
  with a small `--prompts` sample and one fingerprint, expand once green.
- **ttfp semantics differ** for domjs (status event vs paint). Mitigation:
  document that domjs ttfp≈artifact time; don't over-index on it — acceptance and
  crash rate are the decision metrics, not paint timing.
- **Baseline fairness.** domjs reuses arrow's model/budget; if results are close,
  a quick model/prompt tune may change the call. Note this in findings rather
  than pre-tuning.

## First action

M4.1: add `domjs-control` to `ModelProfileKey`/`MODEL_PROFILE_KEYS`, the domjs
tool-name constants, and `generateDomjsBundle`/`repairDomjsBundle` on the
anthropic adapter (then openai, gemini), mirroring the html methods. Wire them
through the registry→provider adapter in `main.ts`.
