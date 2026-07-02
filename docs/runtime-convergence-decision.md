# Runtime convergence — decision memo (2026-07-02)

> Input to the pending roadmap decision flagged in `roadmap.md` non-goals:
> *"Decision pending: converge on one capability-isolated runtime or explicitly
> own both. No further runtimes until that call is made."*
>
> Adjudicated against `positioning.md`: does each runtime strengthen design
> from a fingerprint authority, keep the safe drop-in path observable, and
> preserve generation as a contract with a verdict?

## Recommendation

**Converge on `domjs-control` as the sole capability-isolated runtime.
Retire `arrow-control` after a deprecation window, keeping it as the frozen
control arm for audits until Tier 1 hardening lands.**

## Evidence

### Paired bakeoff — same 8 prompts, same seed (1), same day, same model

Prompt sets: `technical-noir/evals/prompts.md` (4) +
`signal-stream/evals/interactive-prompts.md` (4). Runs:
`apps/server/.bakeoff/2026-07-02T13-15-49-549Z` (paired),
`2026-07-02T13-29-19-702Z` + `2026-07-02T13-36-00-781Z` (domjs conformance,
after the artifact-extraction fix below).

| Metric | arrow-control | domjs-control |
| --- | ---: | ---: |
| Success | 8/8 (100%) | 8/8 (100%) |
| Blocked | 0 | 0 |
| Safety violations | 0 | 0 |
| Fingerprint conformance (Govern verdict) | 16/16 checks pass | 14/14 evaluated checks pass, 0 fail¹ |
| High-severity check failures | 0 | 0 |
| Mean repairs | 0.1 | 0.1 |
| Mean bundle size | 38.5 KB | 36.3 KB |
| Mean TTI | ~83 s | ~85 s |

¹ Two checks returned *inconclusive* (evaluator timeout / unparseable LLM
verdict — `ghost-conformance.ts` 8 s race). Re-runs pass. This is the known
Tier 1A weakness of the LLM-judged verdict, not a runtime signal; the
deterministic-checks work is the fix.

**Read: full parity on every on-thesis metric.** No fingerprint-conformance
gap, no acceptance gap, no safety gap, no meaningful latency or size gap.
This is consistent with every earlier comparison (visual A/B 2026-06-29,
first bakeoff 2026-06-29, failure audits 2026-06-26/07-02).

### Failure-mode accounting (2026-07-02 audits)

All domjs failure classes observed across three audit runs are now explained
and none indicts the runtime:

- `domjs-unsupported-api` → validator regex false positive (`\bwindow\b`
  matching prose in string literals). Fixed + regression-tested; zero
  occurrences in the post-fix audit (87.5% first-pass, 100% after-repair).
- Envelope nesting (bundle JSON inside `main.js`) → runtime-agnostic
  formatting slip; repair fixes it 100% of the time.
- Runtime-semantics failures: **zero** across 16 fluent generations
  (reactive bindings, `region()`, `state()`, structural mutation all used
  correctly unprompted).

## Why domjs, given parity

Parity means the tiebreak is structural, and every structural argument points
the same way:

1. **The moat runs through code we own.** The governance guarantee is only as
   strong as the runtime enforcing it (roadmap Tier 3: "harden the runtime the
   moat depends on"). domjs is ~500 lines of typed, tested, Summon-owned
   TypeScript (`packages/surface-vm/src/engine/domjs/vm/`). The 2026-07-02
   safety floor — dispatch budgets, interrupt handling, reactive cycle guards,
   function-handle dispatch — was implementable in one session *because* we
   own the runtime. Arrow is a third-party reactive library inside the trust
   boundary whose internals we cannot instrument, and whose isolation-stance
   question (`isolation-options.md`, Tier 3G) we cannot answer on its behalf.
2. **The receipt argument.** Positioning: "a receipt from a closed black box
   is worth nothing." The same logic applies in miniature to the runtime: a
   conformance verdict over a runtime we fully own and can specify is more
   inspectable than one over a vendored dialect. Owning the runtime is owning
   the contract.
3. **Contract economy.** domjs's model-facing contract after the ergonomics
   convergence is "standard DOM + `state()` + `callTool()`" — near-zero prompt
   spend, maximum training-data reinforcement. Arrow's tagged-template dialect
   is prompt weight and a slip surface for smaller models.
4. **Dependency surface.** One fewer third-party library at the most
   security-sensitive seam in the product.

## What retiring arrow costs (named honestly)

- Arrow's reactive engine is battle-tested; our 500 lines are not. The
  cycle-guard work already surfaced one long-tail case (synchronous cascade
  recursion blowing the VM stack before the run counter tripped). We own that
  tail now. Mitigation: the safety test suite (43 surface-vm tests incl.
  runaway/cycle/malformed-message coverage) and `pnpm test:safety` gate.
- The trust-spectrum table in README/positioning names `arrow-control` as the
  fully-governed reference. Docs must move to domjs as the named governed
  runtime (README mental-model table still says "the inline Arrow VM").
- Roadmap Tier 3F ("verify `.value=`/IDL bindings execute in the QuickJS
  sandbox") was written about arrow; the equivalent domjs verification is
  already test-covered (`domjs-ergonomics.test.ts` reflected-property tests).

## Sequencing (respects the roadmap's 80%-to-Tier-1 rule)

1. **Now:** record this decision; keep arrow shipping but frozen (no new
   arrow-side work). Update README trust-spectrum + mental-model tables.
2. **Gate:** Tier 1A deterministic conformance checks + Tier 1B receipt
   hardening land in the public packages, evaluated against domjs surfaces.
   (The conformance evaluator previously *skipped domjs artifacts entirely* —
   `extractArtifactSource` filtered to `runtime === 'arrow'`; fixed
   2026-07-02. The Govern moment now covers both runtimes.)
3. **Then:** small-model bakeoff (the open discriminating experiment for the
   fluency thesis) as the final confirmation, using arrow as the control arm
   one last time.
4. **Then:** remove `arrow-control` from the supported matrix; archive the
   runtime behind a flag for one release; delete.

## Non-decisions

- **`main.html` hybrid structure** (declarative skeleton + imperative
  behavior): filed, not approved. Its live justification is that declarative
  structure makes Tier 1A's *deterministic* checks trivially citable — an
  argument that only matures after the deterministic-checks work exists.
  No design-quality evidence currently supports it (paired bakeoff shows no
  conformance gap to close). Revisit after Tier 1 + this convergence complete.
- **No new runtimes.** This memo *reduces* the runtime count by one; nothing
  here licenses adding any.
