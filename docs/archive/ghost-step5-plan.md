# Step 5 plan: the conformance verdict (the "govern" moment)

> Migration step 5 from `integration-with-ghost.md`. This is the first genuinely
> NEW capability, not a migration — it operationalizes the moat's middle moment:
> *does the generated surface actually conform to the fingerprint that requested
> it?* `ghost.check/v1` checks are agent-evaluated prose, routed by surface; the
> verdict is a utility-model evaluation of the accepted artifact against each
> routed check, emitted into the run record + trace.

## What this is (and is not)

- **Is:** route the fingerprint's checks for the gathered surface, evaluate the
  *accepted* artifact against each check's prose with the utility model, emit a
  per-check pass/fail verdict (with severity) as a new meta line + fold a summary
  into run-metrics. Advisory by default (reports, does not block).
- **Is not:** a deterministic regex runner (the old `checks.yml` model is dead),
  a repair driver (verdict is post-acceptance, observational in v1), or a hard
  gate (no blocking on conformance failure in v1 — that is a later policy choice).

Ghost's contract is explicit: *"Ghost selects and emits; it never runs the check.
The host agent evaluates."* Summon is that host agent.

## Verified contracts (from Ghost 0.18.0 + Summon code)

- `loadChecksDir(packageDir): Promise<{ checks: GhostCheckDocument[]; invalid }>`
  — exported from `@anarchitecture/ghost/scan`. Reads `<pkg>/checks/*.md`, lints,
  skips invalid.
- `selectChecksForSurfaces(checks, graph, touchedSurfaces): RoutedCheck[]` — from
  `@anarchitecture/ghost/core`. `RoutedCheck = { check: GhostCheckDocument;
  relevance: {kind:'own'|'ancestor', surface, via?} }`.
- `GhostCheckDocument = { frontmatter: { name, description, severity:
  'high'|'medium'|'low', surface? }, body }` — body is the prose rule.
- Summon utility model: `utilityModelProvider.completeText(request, selection)` in
  `main.ts` (~L331) — the same small-model path the agent ward uses.
- Accepted artifact: `summary.emittedLines` after `runSurfaceGeneration` returns
  (~main.ts L603). Run-metrics emitted in `session.ts finalize()` (~L130) via
  `buildRunMetrics`. `/ghost-review-packet` is emitted in main.ts right after the
  summary — the verdict emission sits beside it.

## Where it runs (timing)

In `main.ts`, **after** `runSurfaceGeneration` returns the summary and the
artifact is accepted, parallel to the existing `/ghost-review-packet` block:

1. Only when `ghostContext` is present and the artifact was not blocked.
2. Load + route checks for `ghostContext.surface` against `ghostContext.graph`.
3. For each routed check, evaluate the accepted artifact source against the
   check body via the utility model.
4. Emit `/ghost-conformance` meta (per-check verdicts) + fold a summary count into
   the review packet / a small conformance summary.

This keeps the verdict **out of the hot generation/repair loop** (it is a
post-pass), so it never slows or blocks the stream's artifact delivery.

## Design

### Routing (deterministic, no LLM)
- `loadChecksDir(ghostContext) ` — need the package dir. Catalog: `entry.ghostDir`.
  Root: the resolved `.ghost` dir. Store the package dir on the context in step 5
  (or re-resolve). Most fixtures: console/editorial/garden have 0 checks (no
  `checks/` dir) → verdict is trivially empty; signal-stream/technical-*/redline
  have 1-3.
- `selectChecksForSurfaces(checks, graph, [surface])` → routed checks. Single-core
  fixtures route all `surface: core` checks.

### Evaluation (one utility-model call per check, or one batched call)
- Build an eval prompt: the check's `body` (the rule) + the accepted artifact
  source (main.ts/main.css text) + a strict instruction to return a structured
  verdict. Ask for JSON: `{ pass: boolean, severity, reason: string,
  evidence?: string }`.
- **Batch vs per-check:** prefer ONE call that evaluates all routed checks for the
  surface and returns an array — fewer round-trips, the artifact is sent once.
  Per-check only if a check declares tools/turn_limit (none do in v1). Decision:
  **single batched call**, artifact sent once, returns one verdict per check.
- Use the existing utility model (`utilityModelProvider.completeText`). Reuse the
  ward's JSON-extraction hardening (strip fences, parse, validate). On
  parse/timeout/error: emit an `inconclusive` verdict, never crash the response.
- Gate behind an env flag (e.g. `SUMMON_GHOST_CONFORMANCE`, default ON for ghost
  runs, `=0` to disable) so it is opt-out and adds no cost when checks are absent.

### Emission shape (`summon.ghost-conformance/v1`)
```
/ghost-conformance meta:
{
  schema: 'summon.ghost-conformance/v1',
  surface: string,
  evaluated: boolean,            // false when no checks / disabled
  checks: [
    { name, severity, relevance: 'own'|'ancestor',
      verdict: 'pass'|'fail'|'inconclusive', reason, evidence? }
  ],
  summary: { pass: n, fail: n, inconclusive: n,
             failedHigh: n, failedMedium: n, failedLow: n }
}
```
- Fold a compact signal into run-metrics or the review packet:
  `conformance: { pass, fail, inconclusive }` so the UI's diagnostic line can show it.

### Trace / account (the bridge to step 6)
The verdict is the first real "what-happened-vs-what-was-declared" record:
spec-in = the routed check ids + the gathered surface; what-happened = each
verdict. Step 6 (the receipt) consumes this. Step 5 just emits the meta + logs.

## Scope decisions to confirm

1. **Advisory, not blocking (v1).** A conformance `fail` is reported, not enforced
   — generation still succeeds. (Hard-gating on high-severity fails is a deliberate
   later policy; do NOT bake it in now.) Confirm.
2. **Single batched utility-model call** per generation (artifact + all routed
   checks → array of verdicts), not one call per check. Confirm.
3. **Env-gated, default-on for ghost runs** (`SUMMON_GHOST_CONFORMANCE=0` to
   disable). When a fingerprint has no checks, the pass is a no-op (no model call).
   Confirm.
4. **Utility model, not the generation model**, does the evaluation (cheap, fast;
   matches the ward pattern). Confirm.

## Definition of done

- New module (e.g. `apps/server/src/ghost-conformance.ts`): `routeChecks(context)`
  + `evaluateConformance(checks, artifactSource, utilityCall) → verdict`.
- `main.ts` emits `/ghost-conformance` after generation when ghostContext present
  and not blocked; folds a count into the review packet/metrics.
- Context carries the package dir (or a `checks` accessor) so routing has its input.
- Env gate wired; no model call when checks are empty or disabled.
- `pnpm typecheck`/`test`/`build`/`check:public-api` green. New unit tests:
  routing (single-core), verdict parsing (pass/fail/inconclusive/malformed),
  empty-checks no-op.
- Live smoke: signal-stream (has 2 checks) generates → `/ghost-conformance` emits
  2 verdicts; console-chrome-2001 (0 checks) → `evaluated:false`, no model call.

## Latency budget (HARD requirements)

The verdict is a post-pass on the *accepted* artifact, so it cannot delay the
artifact — but only if we enforce ordering structurally:

| Scenario | Added perceived | Added total |
| --- | --- | --- |
| Fingerprint with no checks (4 of 7 fixtures) | 0 | 0 (no model call) |
| Fingerprint with checks (3 of 7) | ~0 (artifact already rendered) | +1-3s tail (timeout-capped) |
| Utility model hangs | ~0 | +timeout cap, then inconclusive |

Two requirements that turn this from a possible 3s regression into a free tail:

1. **Artifact + run-metrics + review-packet flush BEFORE the verdict call starts.**
   The user's UI has already rendered; the verdict is purely additive tail meta.
   The live smoke MUST confirm the artifact line precedes `/ghost-conformance` in
   the stream.
2. **Hard timeout on the verdict call** (reuse the ward's, ~5-8s); timeout →
   `inconclusive`. The tail can never hang the response beyond the cap.

## Risks

- **Cost:** one extra utility call per ghost generation *that has checks* (the
  4 check-less fixtures incur zero). Utility model, post-pass, off the critical
  path — perceived latency ~0.
- **Verdict reliability:** an LLM judging conformance is inherently soft. Keep it
  ADVISORY in v1, require structured output, and treat `inconclusive` as the safe
  default on any doubt. This is why it is not a gate yet.
- **Determinism in tests:** unit-test the routing + parsing deterministically with
  a stub utility call; do not assert exact LLM verdicts in CI.
