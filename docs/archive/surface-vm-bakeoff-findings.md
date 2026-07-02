# domjs vs arrow — first bakeoff findings

Date: 2026-06-29. Status: **first real run. Small sample — directional, not conclusive.**

## Setup

- Live server on `http://localhost:3001` (Anthropic, `claude-opus-4-8`).
- Harness: `scripts/runtime-bakeoff.mjs --runtimes arrow-control,domjs-control --seed 1`.
- Prompts: `technical-noir/evals/prompts.md` — **4 prompts**, 1 fingerprint.
- Matrix: 4 prompts × 2 runtimes = **8 generations**.
- This is the only prompt file present in this checkout; the other curated
  dogfood sets are missing, so the sample is small and single-fingerprint.

## Results (per run)

| prompt | runtime | ok | blocked | repairs | safety | bytes | tti(s) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tn-01 | arrow | ✅ | no | 1 | 0 | 37537 | 119 |
| tn-01 | domjs | ✅ | no | 0 | 0 | 27558 | 68 |
| tn-02 | arrow | ✅ | no | 0 | 0 | 35281 | 81 |
| tn-02 | domjs | ✅ | no | 1 | 0 | 39883 | 155 |
| tn-03 | arrow | ✅ | no | 0 | 0 | 30949 | 67 |
| tn-03 | domjs | ✅ | no | 0 | 0 | 28167 | 71 |
| tn-04 | arrow | ✅ | no | 0 | 0 | 34491 | 82 |
| tn-04 | domjs | ✅ | no | 0 | 0 | 34680 | 93 |

## Aggregate

| metric | arrow-control | domjs-control |
| --- | --- | --- |
| runs | 4 | 4 |
| success (ok) | **4/4 (100%)** | **4/4 (100%)** |
| first-pass (ok, 0 repairs) | **3/4** | **3/4** |
| blocked | 0 | 0 |
| total repairs | 1 | 1 |
| safety violations | **0** | **0** |
| mean TTFP | 2595 ms | 2360 ms |
| mean TTI | 86993 ms | 96590 ms |
| mean bytes | 34565 | 32572 |

## Honest read

- **Parity on the metrics that matter.** Both runtimes: 100% acceptance, 3/4
  first-pass, 1 repair each, **zero blocks, zero safety violations**. On this
  sample there is **no measurable quality gap** between domjs and arrow.
- **The crash this whole effort started from did not occur** in either runtime
  here — but note arrow already has the `.map`-callback validator (shipped
  earlier), so this run does not re-measure the original failure. The honest
  framing: domjs **matched** arrow's clean record on these prompts; it did not
  demonstrably beat it.
- **No fluency win is visible yet.** The hypothesis was that fluent HTML/JS would
  lift first-pass acceptance. At n=4 it's identical (3/4 each). Either the gap is
  small, or this sample is too easy/too small to surface it.
- **TTI is slightly worse for domjs** (~96s vs ~87s mean), driven by one slow
  run (tn-02, 155s). Not meaningful at n=4; both are dominated by model latency,
  not runtime.
- **Bytes are slightly smaller for domjs** (~32.6k vs ~34.6k). Marginal.

## Verdict (against the pre-committed decision rule)

The rule was: **promote** if domjs shows materially higher first-pass acceptance
OR lower crash rate with no safety regression; **keep experimental** if at parity
or worse.

→ **Keep domjs experimental.** This run shows **parity, not advantage.** domjs is
proven to work end to end (generate → validate → accept → mount), is safe (0
violations), and is competitive — but it has **not** earned promotion on
evidence. The interesting hypothesis (fluency lifts acceptance / cuts crashes) is
**not yet tested at meaningful scale.**

## What would actually settle it

1. **More prompts, more fingerprints.** n=4 on one fingerprint cannot detect a
   real difference. Restore the curated dogfood prompt sets (redline-cinema,
   console-chrome-2001, signal-stream, technical-contrast) and rerun — target
   30–50+ prompts per runtime.
2. **Harder/interactive prompts.** These four are mostly compositional surfaces.
   The fluency hypothesis is strongest on *interactive* surfaces (lists, dynamic
   state) where arrow's `.map`/IDL-binding quirks bite. Add prompts that force
   interactivity.
3. **A crash-rate comparison with arrow's validator OFF**, or on prompts arrow's
   validator doesn't cover, to actually measure the original failure class.
4. **Multi-model.** Try a smaller/cheaper model where dialect fluency matters
   more — that's where domjs should pull ahead if the thesis holds.

## Raw data

`apps/server/.bakeoff/2026-06-29T23-45-46-548Z/` (`runs.json`, `report.md`).

---

# Run 2 — interactive prompts, signal-stream fingerprint (2026-06-30)

Probe targeting the fluency hypothesis directly: **interactive** surfaces
(dynamic lists, local state, event handling, tabs, cart) on a **different
fingerprint** (signal-stream). Prompts: `signal-stream/evals/interactive-prompts.md`
(ss-todo, ss-filter-feed, ss-counter-tabs, ss-cart). 4 prompts × 2 runtimes = 8.

## Results (per run)

| prompt | runtime | ok | blocked | repairs | bytes | tti(s) |
| --- | --- | --- | --- | --- | --- | --- |
| ss-01 todo | arrow | ✅ | no | 0 | 28708 | 54 |
| ss-01 todo | domjs | ✅ | no | 0 | 20244 | 40 |
| ss-02 filter-feed | arrow | ✅ | no | 0 | 29542 | 62 |
| ss-02 filter-feed | domjs | ✅ | no | 0 | 24351 | 55 |
| ss-03 counter-tabs | arrow | **❌ BLOCKED** | yes | 1 | 15007 | — |
| ss-03 counter-tabs | domjs | ✅ | no | 0 | 23357 | 51 |
| ss-04 cart | arrow | ✅ | no | 0 | 31106 | 62 |
| ss-04 cart | domjs | ✅ | no | 1 | 30059 | 101 |

## Aggregate

| metric | arrow-control | domjs-control |
| --- | --- | --- |
| success | **3/4 (75%)** | **4/4 (100%)** |
| first-pass | 3/4 | 3/4 |
| **blocked** | **1 (25%)** | **0** |
| total repairs | 1 | 1 |
| safety violations | **0** | **0** |
| mean TTFP | 2076 ms | 2404 ms |
| mean TTI | ~60 s (of the 3 ok) | 61.6 s |
| mean bytes | 26091 | 24503 |

## Honest read

- **First divergence: arrow blocked on ss-03 (tabs + counter), domjs did not.**
  Arrow failed validation, attempted 1 repair, and **still blocked** (no
  artifact). domjs produced an accepted artifact first try on the same prompt.
  This is the first run where domjs > arrow on the metric that matters
  (acceptance).
- **BUT — strong caveat: the arrow block is non-deterministic.** A single
  isolated re-run of the *same* arrow ss-03 prompt afterward **succeeded** (0
  repairs, not blocked). So this is not "arrow structurally cannot do tabs"; it's
  "arrow had a bad sample on this run that even repair didn't recover, on a more
  complex interactive prompt." domjs happened to get a good sample. At n=1 per
  cell, one block is one data point, not a rate.
- **Directionally consistent with the thesis, not proof of it.** The fluency
  hypothesis predicts arrow stumbles more on complex interactivity. We saw
  exactly one instance of that. It's suggestive — the *kind* of failure the
  thesis predicts, on the *kind* of prompt it predicts — but a single
  non-deterministic block cannot establish a rate.
- **domjs was consistently more compact** (smaller bytes on 3/4) and competitive
  on latency.

## Verdict update

Run 1 (compositional) = parity. Run 2 (interactive) = **first signal in domjs's
favor (75% vs 100% acceptance), but from a single non-deterministic block.**

→ Still **keep experimental — but the thesis now has its first supporting
data point.** The honest call: this is enough to justify a *bigger* run, not
enough to promote. The next run must be sized to turn "one block" into a real
**block-rate** comparison.

## What the next run needs (to make ss-03 a rate, not an anecdote)

1. **Repeats per prompt.** Run each interactive prompt 5–10× per runtime (same
   prompt, different samples) so non-determinism averages into a block-rate.
   ss-03 specifically: how often does arrow block vs domjs?
2. **More interactive prompts** across 2–3 fingerprints.
3. **Cheaper/smaller model** — the fluency gap should widen where the model is
   weaker at the niche arrow dialect.

## Raw data (run 2)

`apps/server/.bakeoff/2026-06-30T00-27-21-138Z/` (`runs.json`, `report.md`).

---

# Run 3 — ss-03 repeat probe (2026-06-30): the run-2 signal was noise

To turn run 2's single arrow block into a rate, I re-ran the EXACT ss-03 prompt
(tabs + counter) 6× per runtime via `scripts/ss03-repeat-probe.mjs`.

| | arrow-control | domjs-control |
| --- | --- | --- |
| accepted | **6/6** | **6/6** |
| blocked | **0 (0%)** | **0 (0%)** |
| first-pass | 4/6 | 5/6 |
| total repairs | 2 | 1 |
| safety | 0 | 0 |

**The run-2 arrow block did not reproduce. Across 12 fresh samples of the prompt
that blocked, arrow blocked zero times.** The run-2 block was a single unlucky
sample (an arrow generation that even 1 repair didn't recover), NOT a durable
gap. Stopping at run 2 and declaring "domjs wins on interactivity" would have
been wrong — a trend drawn from one non-deterministic point. This probe is what
prevented that error.

## Pooled standing (all real data so far)

- Run 1 (4 compositional): arrow 4/4, domjs 4/4.
- Run 2 (4 interactive): arrow 3/4, domjs 4/4 (one block).
- Run 3 (6+6 repeats of the blocker): arrow 6/6, domjs 6/6.
- **Total: arrow 13/14 accepted, domjs 14/14. ~30 generations, 0 safety
  violations either runtime.** The single arrow miss is within sampling noise.

## Verdict (final, this session)

**Keep domjs experimental.** Proven end-to-end, consistently safe, competitive on
size/latency — but **no demonstrated quality or crash advantage over arrow**. The
fluency hypothesis remains **unproven**; its one supporting data point evaporated
under repetition.

## Methodological lesson (the real takeaway)

LLM output is nondeterministic, so **single runs mislead in both directions** —
run 2 flattered domjs by luck; run 3 corrected it. A real promote/archive call
needs a **repeat-based, multi-fingerprint, multi-model** run sized to measure a
*rate*, not the handful affordable against one frontier model on a laptop.

## Raw data (run 3)

Script: `scripts/ss03-repeat-probe.mjs` (stdout only; not written to .bakeoff).
