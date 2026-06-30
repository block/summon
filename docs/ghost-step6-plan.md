# Step 6 plan: the receipt (the "account" moment)

> Migration step 6 from `integration-with-ghost.md`. Completes the three-moment
> moat: compose (✓ steps 2-4), govern (✓ step 5), **account** — a single
> inspectable artifact tying *spec-in* (what the fingerprint declared) to
> *what-happened* (what generation actually did), so a Summon surface ships with
> a receipt instead of a black box.

## The core insight: this is consolidation, not new collection

All the receipt's data is ALREADY emitted during a generation, scattered across
~10 meta lines:

| Meta line | Carries | Receipt role |
| --- | --- | --- |
| `/ghost-context` | source, surface, gatheredNodes, product, styleSource, catalog meta | spec-in (design) |
| `/ghost-token-source` | token kind/source/css/warnings | spec-in (style) |
| `/ghost-conformance` (step 5) | per-check verdicts + summary | what-happened (govern) |
| `/ghost-review-packet` | source, surface, gatheredNodes, validation, artifactFiles | mixed (the proto-receipt) |
| `/run-metrics` | runtime, repairs, blocked, validationCount, safetyViolations | what-happened (generation) |
| `/validation-blocked` `/validation-observed` | per-issue detail | what-happened (validation) |
| `/timing` | phase timings | what-happened (perf) |
| `/agent-goal` `/agent-policy-resolution` | ward plan | spec-in (capability) |

`GhostReviewPacket` is already ~80% of the receipt. Step 6 is: **define the
canonical receipt shape, fold conformance + the missing provenance into it, and
emit it as the single authoritative `summon.ghost-receipt/v1` artifact** — while
keeping the granular meta lines for live streaming/diagnostics.

## What the receipt is

A self-contained record, emitted once at the end of a ghost generation, that
answers two questions inspectably:

1. **What was declared (spec-in):** which fingerprint, which surface, which nodes
   were gathered (with provenance: own/ancestor/edge), the token source, the
   resolved capability (granted tools / surface policy), the routed checks.
2. **What happened (what-happened):** the artifact runtime + files, repairs,
   blocks, validation issue counts/codes, safety violations, the conformance
   verdict (per-check pass/fail/inconclusive with evidence), and timing.

The repair-path table from `positioning.md` becomes literally answerable from one
object: *wrong look → inspect gatheredNodes + tokenSource; wrong behavior → inspect
grantedTools + conformance; wrong what-happened → inspect repairs/validation/timing.*

## Decision: extend the review packet into the receipt, or add a new line?

Two options:
- **(A) Rename/extend `/ghost-review-packet` → `/ghost-receipt`** as the canonical
  artifact. The packet already aggregates most of it; fold in conformance +
  provenance + capability. One authoritative line.
- **(B) Add a separate `/ghost-receipt` that references the others.** More lines,
  more duplication.

**Recommendation: (A).** The review packet WAS the proto-receipt; promote it.
Rename to `summon.ghost-receipt/v1`, keep the schema-versioned shape, and the
demo UI's existing `/ghost-review-packet` reader migrates to `/ghost-receipt`
(it only reads 4 fields). This avoids a third overlapping artifact. The granular
streaming meta lines (`/ghost-conformance`, `/run-metrics`, `/timing`) STAY for
live diagnostics — the receipt is the *consolidated, persisted* view.

## Receipt shape (`summon.ghost-receipt/v1`)

```
{
  schema: 'summon.ghost-receipt/v1',
  // --- spec-in ---
  fingerprint: {
    source: 'root' | 'catalog',
    id: string,                  // rootId or catalogId
    name?: string,               // catalog name
    product: string,
    surface: string,
    cascade: string[],           // surface + ancestors
    gatheredNodes: Array<{ id: string; provenance: 'own'|'ancestor'|'edge' }>,
    tokenSource: { kind, source, definedTokenCount, warnings },
    routedChecks: Array<{ name: string; severity: string }>,
  },
  capability: {
    mode: 'static'|'interactive',
    grantedTools: string[],
    layoutId: string | null,
  },
  // --- what-happened ---
  generation: {
    runtime: string,
    artifactRuntime: 'arrow' | null,
    artifactFiles: string[],
    repairs: number,
    blocked: boolean,
    validation: { blocked: number; warnings: number; codes: Record<string,number> },
    safetyViolations: string[],
  },
  conformance: {
    evaluated: boolean,
    summary: { pass, fail, inconclusive, failedHigh, failedMedium, failedLow },
    checks: Array<{ name, severity, verdict, reason }>,   // the step-5 verdict, folded in
  },
}
```

Note: the receipt carries a *compact* conformance (verdicts + reasons; evidence
strings can stay in the streamed `/ghost-conformance` to keep the receipt lean,
or be included — decide).

## Where it's built (timing)

In `main.ts`, the receipt is the LAST thing emitted (after generation, after the
step-5 conformance verdict is computed), so it can include everything. It
replaces the current `/ghost-review-packet` emission:

1. Generate (artifact streams).
2. Compute conformance (step 5).
3. Build + emit `/ghost-receipt` with conformance folded in.

This keeps the latency profile from step 5 (receipt is tail meta, off the render
path). The conformance call already happens here; the receipt just assembles
around it.

## Scope decisions to confirm

1. **Promote `/ghost-review-packet` → `/ghost-receipt`** (`summon.ghost-receipt/v1`),
   not a third artifact. Migrate the demo UI reader. Confirm.
2. **Keep granular meta lines** (`/ghost-conformance`, `/run-metrics`, `/timing`,
   validation) for live streaming; the receipt is the consolidated view. Confirm.
3. **Provenance in gatheredNodes:** include each node's own/ancestor/edge
   provenance (richer than today's flat id list). Confirm.
4. **Conformance evidence:** include full evidence strings in the receipt, or keep
   them only in the streamed `/ghost-conformance` and put just verdict+reason in
   the receipt (leaner)? Lean: verdict+reason in receipt, evidence in the stream.

## Definition of done

- `buildGhostReceipt(...)` replaces `buildGhostReviewPacket`; `GhostReceipt` type
  with the shape above; emitted at `/ghost-receipt`.
- Conformance verdict folded into the receipt (the receipt is built after the
  step-5 evaluation, taking its result as input).
- gatheredNodes carries provenance.
- Demo UI (`useSurfaceStream`) reads `/ghost-receipt` (migrate from
  `/ghost-review-packet`); its diagnostic line shows the same 4 fields + a
  conformance pass/fail count.
- `pnpm typecheck`/`test`/`build`/`check:public-api` green; tests updated.
- Live smoke: signal-stream emits one `/ghost-receipt` with spec-in + what-happened
  + folded conformance (2 checks); console-chrome-2001 emits a receipt with
  `conformance.evaluated:false`.

## Out of scope

- Persisting the receipt to disk / a store (it's emitted on the stream; a host
  can capture it). Persistence is a host concern, not Summon's.
- Hard-gating on the receipt (advisory, same as step 5).
- The `/ghost-conformance` line removal — keep it; the receipt complements, not
  replaces, the live stream.

## After step 6

Step 7 (cleanup) is the last: delete the legacy `fingerprint/` dirs + `tokens.css`
from the 7 bundles (now that `.ghost/` is the sole source), drop the
`tokenCssPath` fallback in `fingerprint-catalog.ts`, and unlink/repin Ghost when
it publishes. That closes the migration.
