# Plan: separate the ward's capability clamp from its intent guess

> The agent ward was built to *parse intent and be dynamic about what's best*.
> In practice its default path is a regex keyword classifier, and its output
> (`purpose`, `data`, `authority`) is injected verbatim into the generation
> model's system prompt via `buildSurfacePlanBlock`. That means a low-confidence
> intent guess and a hard, sandbox-enforced security fact reach the model in the
> same authoritative voice — so a misread regex becomes a false instruction the
> model obeys. This plan splits those two concerns cleanly: keep the ward as a
> deterministic **capability clamp**, and stop it from **wrongfully steering**
> the model with intent it only guessed at.

## Current state

- `packages/server/src/agent-ward.ts` does two jobs in one pass:
  1. **Capability authorization** — `policyFromGoal` + `narrowSurfacePolicy`
     pick a tier and clamp grants against the tool ceiling. This is correct:
     14/14 demo scenarios match the human-authored tier, never over-grants,
     `source=default fallback=false`.
  2. **Intent inference** — `inferSurfaceGoal` classifies the prompt with regex
     (`APPROVAL_RE`, `SEARCH_RE`, `FORM_RE`, …) and `inferPurpose`. The model
     classifier path exists but is **off unless `SUMMON_AGENT_GOAL_MODEL` is
     set**, so the regex is the default.
- The ward's plan flows into the model prompt at
  `packages/engine/src/contracts.ts:369` → `buildSurfacePlanBlock`.
- **Already shipped (step 0, done):** `buildSurfacePlanBlock` re-voiced so
  capability fields read as hard constraints and `purpose` reads as a soft,
  overrulable hint. Engine 66/66, server ghost-adapter 8/8 + generate-route 8/8
  green. This removed the worst of the wrongful steering at the prompt layer
  without touching the security model.
- **Ghost overlap:** `selectGhostSurface` (apps/server/src/ghost-adapter.ts)
  already parses the same prompt semantically and explicitly *"does no NLP in
  code; Summon does not re-implement that matching in code."* The ward's regex
  path is exactly the thing Ghost's design refuses to do. Two parsers, opposite
  philosophies, same pipeline.

## Two failure modes this plan targets

1. **The static-fallback cliff.** When an approval/worker keyword fires but no
   matching tool is in the ceiling, `narrowSurfacePolicy` collapses the whole
   surface to `static` with zero tools (verified: "update my pick", "post a
   message", "publish the release note" → dead read-only surfaces). It
   fails-closed on *capability to function*, not just on *authority*.
2. **Regex intent steering.** The deterministic path guesses `purpose` and tool
   intent with keyword matching and, pre-step-0, asserted those guesses to the
   model as host decisions.

## Scope boundary (what this plan is NOT)

- **Not** handing capability/authority decisions to a model. Approval-gating,
  worker access, and network grants stay deterministic, host-owned, fail-closed.
  That conservatism is correct and stays.
- **Not** deleting the ward. The clamp is load-bearing and proven.
- **Not** merging ward and Ghost. The boundary ("ward = authority, Ghost =
  composition") is good; we only make the *intent half* follow Ghost's
  no-NLP-in-code discipline instead of contradicting it.

## Steps

### Step 1 — Next-legal-tier fallback (replace the static cliff) — DONE

`narrowSurfacePolicy` in `packages/server/src/agent-ward.ts`: when the
proposed tier can't be satisfied by the available tools, it now falls back to
`declarative` with the legal (host-action/read) subset of tools instead of
collapsing to `static`. Only collapses to `static` when there are genuinely no
usable interactive tools, or when the downgraded policy still fails to compile.

Fail-closed on *authority* (never grants an approval/worker capability the host
didn't authorize), not on *the surface's ability to function*. Mirrors Ghost's
"fall back to `core` — keep everything, lose focus" instead of "fall back to
nothing." Rejection diagnostics recomputed against the downgraded tier so a tool
that is legal at `declarative` is no longer falsely reported as rejected.

**Verified:**
- Cliff prompts "update my pick" (choose-only) and "post a message" (ai-only)
  now resolve to `declarative` + the legal tool, `mode=interactive`,
  `fallback=true`, `rejected=[]` — previously dead `static` surfaces.
- "publish" with no usable tool still resolves to `static` (correct).
- All 14 demo scenarios unchanged (tier-for-tier match with authored policy).
- New regression test added; `agent-ward.test.ts` 11/11, server pkg 47/47,
  `apps/server` 26/26 green.

### Step 2 — Make intent inference semantic, regex as fallback

> **Key fact:** the semantic classifier already exists. `inferGoalWithModel` +
> `buildGoalClassifierPrompt` (agent-ward.ts) hand the model the tool catalog
> (each line already carries `data=`/`authority=`/`kind=` metadata) and parse a
> bounded goal JSON. It is just **gated off by default** — `main.ts` only passes
> `goalModel` when `SUMMON_AGENT_GOAL_MODEL !== '0'` AND the host didn't disable
> it, but the *intent* of the env var today reads as opt-in. Compare Ghost
> surface-select, which is **default-on** (`SUMMON_GHOST_SURFACE_SELECT=0` to
> disable). Step 2 flips the ward to match Ghost's posture, hardens the
> semantic path, and removes the redundant second model pass.

#### Current state of the two passes

| | ward goal (`inferGoalWithModel`) | Ghost (`selectGhostSurface`) |
|---|---|---|
| input to model | tool catalog + `data`/`authority` per tool | surface menu (id + description) |
| default | effectively opt-in via `SUMMON_AGENT_GOAL_MODEL` | **default-on**, `…SELECT=0` disables |
| fallback | regex `inferSurfaceGoal` | returns `core` |
| timing in `main.ts` | ~L462 (policy resolve) | ~L488 (`prepareGhostSurfacePrompt`) |
| model client | `utilityModelProvider.completeText` | same |
| confidence floor | `MIN_MODEL_CONFIDENCE` (0.45), else null→regex | n/a (menu match) |

Both call the **same utility model** on the **same prompt**, ~26ms apart in the
pipeline, with no shared result. That is the redundant round-trip to remove.

#### 2A. Default-on posture + flag rename — DONE

**Correction from code review:** the semantic classifier is **already
default-on**. The gate (main.ts:465) is `goalModel: env === '0' || req ===
'off' ? null : {…}` — it runs unless explicitly disabled. So the only real work
here is the **rename** (Q3 → rename): `SUMMON_AGENT_GOAL_MODEL` reads like "set a
model," not a toggle. Renamed to `SUMMON_AGENT_GOAL_SELECT` (parallels
`SUMMON_GHOST_SURFACE_SELECT`); `=0` is the kill switch, per-request
`agentOptions.goalModel: 'off'` override preserved. 7 test env blocks updated.
**Verified:** typecheck clean, `apps/server` 26/26 green.

- `inferSurfaceGoal` (regex) already is the no-model/timeout/low-confidence
  fallback (`inferGoalWithModel` returns null → regex). No change.
- Capability clamp (`policyFromGoal` + `narrowSurfacePolicy`, incl. Step 1
  downgrade) unchanged. A model can never widen authority past the ceiling
  (`sanitizeSurfaceGoal` filters to real names; clamp re-narrows).

#### 2B. Multi-tool surfaces under a model goal — DONE

**Verified:** a model/provided goal with `requestedTools: [choose, counter]`
survives the clamp intact (`grants: [choose, counter]`, tier `declarative`,
`fallback=false`). The regex `singleCandidate` guard only affects the
deterministic path, which remains the fallback. Regression test added
(`agent-ward.test.ts` 12/12). No logic change needed.

#### 2C. Unify the two model passes into one intent resolution — DONE (Option B: parallel)

**Correction from code review (revises Q2):** "ward owns the single pass"
(option i) is **not viable**. The ward lives in `packages/server`, the
published *provider-neutral* package, and is deliberately **Ghost-agnostic**
(Ghost lives app-side in `apps/server/src/ghost-adapter.ts`). The ward cannot
own Ghost anchor selection without leaking Ghost into a neutral package. The two
passes also ask different questions — ward: *which tools/purpose*; Ghost:
*which surface node* — so neither derives from the other.

**Revised approach — shared pre-pass in `main.ts` (option ii):**
- Add **one** combined classifier call in `main.ts` (app layer, where both Ghost
  and the ward are visible) that reads the prompt once and returns both
  projections: a `SurfaceGoal` and a Ghost anchor id.
- Feed the parsed `goal` into `planAgentSurface({ goal })` (the ward already
  accepts a pre-supplied goal and reports `goalSource: 'provided'`), so the
  ward skips its own model call.
- Feed the chosen anchor into `prepareGhostSurfacePrompt` (extend it to accept a
  pre-selected surface and skip `selectGhostSurface`'s model call when supplied).
- Must preserve: Ghost's single-`core` skip (no call when only `core`), the
  ward's no-tools skip, both timeouts, and the existing disable flags.
- **Sequencing risk:** the combined call needs the tool catalog (for goal) and
  the Ghost gather menu (for anchor). Both are available in `main.ts` before
  L462. If a single combined prompt is too coupled, the acceptable fallback is
  **two parallel calls** (`Promise.all`) instead of today's two *sequential*
  calls — still halves latency and keeps the layering clean. Decide at execution
  time based on classifier-prompt quality.

**Shipped — Option B (parallel, decided):** kept the two classifiers separate
(independently tunable, distinct failure modes/timeouts) but removed the
*sequential* coupling.
- `main.ts` now kicks off `selectGhostSurface` **before** the policy branch, so
  the Ghost anchor model call runs concurrently with the ward's goal model
  call instead of after it. The ghost block awaits the pre-resolved anchor.
- `prepareGhostSurfacePrompt` gained a `preselectedSurface` option: when set it
  skips its own `selectGhostSurface` call and uses the anchor directly, validated
  against the graph menu (`validatePreselectedSurface`), falling back to `core`
  for an unknown id — same contract as fresh selection.
- Layering preserved: the ward stays Ghost-agnostic in `packages/server`; the
  app layer (`main.ts`) orchestrates both. No combined/coupled prompt.
- Gate matches the prior behavior exactly (`!!ghostContext &&
  SUMMON_GHOST_SURFACE_SELECT !== '0'`); selection skipped → anchor `core`, no
  model call.
- **Verified:** new adapter test proves a preselected anchor (and an unknown id)
  makes **zero** selection model calls. Engine 66/66, server pkg 48/48,
  `apps/server` 27/27 green; typecheck clean.

#### 2D. Reconcile confidence/voicing with Step 0/3

A model-sourced goal should carry `source='model'` and its confidence into
`buildSurfacePlanBlock` (Step 3) so the purpose hint's firmness reflects
provenance. No inferred field becomes a hard constraint regardless of source.

**Done when:**
- Semantic goal inference is default-on with a kill switch, regex is the
  fallback, and `main.ts` makes **one** utility-model call that feeds both the
  policy clamp and Ghost anchor selection (no redundant second call).
- Multi-tool prompts request the full legal tool set under a model goal
  (`singleCandidate` no longer silently drops tools when the model is present).
- Capability/authority clamp output is byte-identical to today for all 14 demo
  scenarios; no demo tier changes.
- With the model disabled, behavior is exactly today's regex path.
- Tests: multi-tool model goal survives the clamp; unified pass calls the model
  once; Ghost `core`-only and ward no-tools skips still hold; ward + server
  suites green; stress/demo probes rerun and recorded.

### Step 3 — Confidence-aware prompt voicing — DONE

**Critical correction from code review:** Step 0 re-voiced `buildSurfacePlanBlock`,
but that block is **almost never rendered**. In `session.ts`, whenever a
`surfacePolicy` is set (always true on the ward path), a `surfaceContract` is
built and `compileSystemContracts` renders **`buildSurfaceContractBlock`
instead** of `buildSurfacePlanBlock`. The live block is the *surface contract*,
and it was still voicing `purpose` **twice** (Policy line + Plan line) as
authoritative "host-owned boundaries" — the exact wrongful steering Step 0
targeted, on the path that actually ships. Step 3 therefore (a) applies the
anti-steering treatment to the *live* block and (b) adds the confidence scaling.

Shipped:
- `buildSurfaceContractBlock` (`prompt.ts`) `### Surface` section rewritten:
  capability fields (`tier`, `runtime`, `data`, `authority`, `persistence`,
  `mode`) are grouped as **"Capability boundaries (hard limits)"**; `purpose` is
  pulled out as a single **"Purpose (hint)"** with explicit overrule language.
  Purpose no longer appears on the old `Policy:`/`Plan:` hard lines.
- Firmness scales with provenance via a new optional `SurfaceIntentProvenance`
  (`{ source, confidence }`) threaded:
  `main.ts` (`agentPlan.goalSource` + `goal.confidence`) →
  `SurfaceGenerationInput.intent` → `session.ts` →
  `surfaceContractViewFromCompiledPolicy(…, intent)` →
  `SurfaceContractSurface.intent` → `buildSurfaceContractBlock`.
  - confident `model`/`provided` (conf ≥ 0.7 or unset) → "a strong suggestion,
    still not a constraint".
  - `deterministic` / low-confidence / host-authored (no provenance) → "a weak
    signal, not a constraint; when in doubt, follow [the request] over this hint".
  - Capability boundaries are byte-identical across all firmness levels.

**Verified:**
- Probe rendered all four firmness levels; boundaries identical, hint language
  scales as intended.
- New engine tests: contract block voices purpose as overrulable (not on hard
  lines); firmness scales while boundaries stay equal. Engine 68/68.
- Updated `generate-route.test.ts` assertions to the new `Runtime:`/`data:`
  format. Server pkg 48/48, `apps/server` 27/27, all typechecks clean.
- Rebuilt the public `@anarchitecture/summon` bundle so the live wording ships.

## Definition of done

- Capability/authority behavior is byte-identical to today for all 14 demo
  scenarios (the security clamp is untouched).
- The static-fallback cliff is gone: capability-starved prompts degrade to the
  strongest *legal* interactive tier, not a dead surface.
- Intent inference is semantic when a model is present, regex only as fallback,
  and shares one pass with Ghost surface selection.
- No inferred field is ever phrased to the model as a host-enforced constraint.
- Engine + server test suites green; ward/stress probes rerun and recorded.

## Step 4 — Consolidation + aggressive collapse to one surface block — DONE

Final pass to remove terminology sprawl and redundant shape (pre-1.0, breaking
changes acceptable).

- **Deduped the source enum.** `'deterministic' | 'model' | 'provided'` was
  declared twice (ward `SurfaceGoalSource` + inline in the engine). Canonical
  `SurfaceGoalSource` now lives in the engine (`surface-contract.ts`), consumed
  by `SurfaceIntentProvenance`; the ward re-exports it. One definition,
  dependency arrow respected (server → engine).
- **Collapsed two surface blocks into one (breaking).** `buildSurfacePlanBlock`
  and the `surfacePlan` input to `compileSystemContracts` were a redundant second
  way to describe the surface that **production never hit** — every prod path
  sets a `surfacePolicy`, which always builds a `surfaceContract`, which selects
  `buildSurfaceContractBlock`. Removed:
  - `buildSurfacePlanBlock` (engine `surface-plan.ts`) + its index export + its
    entry in the public API manifest / build allowlist.
  - the `surfacePlan?` field on `SystemContractInput` and the dead
    `else if (activeSurfacePlan)` branch in `compileSystemContracts`.
  - the `surfacePlan` arg session.ts passed to the compiler.
  - the engine unit test that only exercised the dead block; the HTML-static
    test converted to drive the surface **contract** path.
  The surface contract block (`buildSurfaceContractBlock`) is now the single
  place a surface is described to the model — and it is the one carrying the
  Step 3 boundaries-hard / purpose-hint voicing.

**Verified:** engine 67/67, server pkg 48/48, `apps/server` 27/27, all
typechecks clean; public `@anarchitecture/summon` bundle rebuilt with
`buildSurfacePlanBlock` fully removed.

## Step 5 — Terminology unification (goal, not intent) — DONE

Final cosmetic pass to collapse the `goal`/`intent` synonym split. The ward's
established domain term is **goal** (`SurfaceGoal`, `goalSource`); `intent` was a
newcomer I introduced for the same concept. Eliminated it:

- `SurfaceIntentProvenance` → **`SurfaceGoalProvenance`** (engine).
- `SurfaceContractSurface.intent` → **`goalProvenance`**;
  `surfaceContractViewFromCompiledPolicy(…, intent)` →
  `(…, goalProvenance)`.
- `SurfaceGenerationInput.intent` → **`goalProvenance`** (server types +
  session + `main.ts` call site).
- Prompt prose lead "Intent hint (…)" → **"Purpose hint (…)"**, matching the
  `Purpose (hint):` bullet it introduces.

One word for the concept everywhere: **goal** (provenance/source), surfaced to
the model as the overrulable **purpose** hint. **Verified:** engine 67/67,
server 48/48, `apps/server` 27/27, typechecks clean, public bundle rebuilt, zero
lingering `intent` references in `src`.

## Open questions to confirm before executing

1. ~~Step 1 fallback: drop to `declarative` or further to `read`-only?~~
   **Resolved:** drop to `declarative` with the legal host-action subset.
   Host-action is host-owned and schema-validated, so it is safe; failing to
   `read`-only would needlessly strip working interactivity. Shipped in Step 1.
2. (Step 2, Q2) Unification: should the single intent pass live in the ward
   (and Ghost consumes the parsed goal) or in a shared `main.ts` pre-pass both
   consume? Timing (ward ~L462, ghost prepare ~L488) allows either. Leaning
   (i) ward-owns, since the ward already runs first and Ghost prepare
   already receives `surfacePlan`/`tools` — passing the goal alongside is a
   small surface change. Confirm before executing 2C.
3. (Step 2, Q3) Keep `SUMMON_AGENT_GOAL_MODEL` as the flag name, or rename to a
   `…GOAL_SELECT` form paralleling `SUMMON_GHOST_SURFACE_SELECT`? Either way the
   default flips to on with a kill switch. Naming-only; confirm before 2A.
