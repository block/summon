# Runtime Experiment Plan

Status: proposal · Owner: TBD · Last updated: 2026-06-23

## Why this exists

We are currently testing multiple output/streaming runtimes through a single
`experimentalRuntime` enum:

| Runtime | Format | Delivery | Validation | Sandbox |
| --- | --- | --- | --- | --- |
| `arrow-control` | Arrow VM | one structured bundle | schema + protocol + TS transpile | QuickJS/WASM, shadow DOM, `host-bridge:summon` |
| `html-static` | HTML | one structured bundle | schema + HTML safety (no script) | iframe `allow-scripts` srcdoc |
| `html-script` | HTML | one structured bundle | schema + HTML safety, **script allowed** | iframe `allow-scripts` srcdoc |
| `html-stream` | HTML | scaffold + patch frames | per-fragment safety, commit-on-close | iframe + posted patches, preview-only until commit |
| `unsafe-html-raw-stream` | HTML | raw token `document.write` | **none** | iframe `allow-scripts`, streamed in |

The enum conflates **two independent decisions** and makes the experiment hard
to reason about:

- **Format axis**: how generated UI executes (`arrow` VM vs `html` iframe). This
  is the *security/trust* question.
- **Delivery axis**: how output arrives (`bundle` once vs `stream` incrementally).
  This is the *perceived-latency* question.

`unsafe-html-raw-stream` is not a product candidate; it is the **control** that
measures the ceiling on streaming UX and the cost of every safety mechanism the
others add.

## Goals

1. Make the experiment legible: separate the two axes so each result answers a
   single question.
2. Remove the duplication that makes adding/removing a runtime expensive
   (`session.ts` has near-duplicate accept/repair/validate methods per runtime).
3. Produce **hard numbers** (TTFP, TTI, repair/block rate, safety violations)
   per runtime via the existing `/batch` + bakeoff harness, instead of anecdotes.
4. Lock down the unsafe control so it can never be selected by accident.
5. Define **kill criteria** before reading results.

## Non-goals

- Design-fidelity / Ghost-rubric scoring (owned by external review tooling and
  `eval-directions`). This plan covers runtime mechanics and latency only.
- Changing the Arrow security model. `arrow-control` stays the secure default.

---

## Workstream A — Split the runtime into two axes

**Problem.** `SummonOutputRuntime` (in `packages/engine/src/output-runtime.ts`)
encodes format, delivery, and trust posture in one string. Branching on it is
scattered across `apps/server/src/main.ts`, `packages/server/src/session.ts`,
`apps/demo/.../GeneratePage.tsx`, and `useSurfaceStream.ts`.

**Approach (additive, non-breaking).** Keep `SummonOutputRuntime` as the wire
value (it crosses the public package boundary and is in
`public-api-manifest.json`), but introduce a typed descriptor that the rest of
the code branches on:

```ts
// packages/engine/src/output-runtime.ts
export interface RuntimeProfile {
  runtime: SummonOutputRuntime;   // wire id, unchanged
  format: 'arrow' | 'html';
  delivery: 'bundle' | 'stream';
  trust: 'sandboxed' | 'iframe-safe' | 'iframe-script' | 'unsafe';
  experimental: boolean;          // not a product candidate
}

export const RUNTIME_PROFILES: Record<SummonOutputRuntime, RuntimeProfile> = {
  'arrow-control':          { runtime: 'arrow-control',          format: 'arrow', delivery: 'bundle', trust: 'sandboxed',     experimental: false },
  'html-static':            { runtime: 'html-static',            format: 'html',  delivery: 'bundle', trust: 'iframe-safe',   experimental: true  },
  'html-script':            { runtime: 'html-script',            format: 'html',  delivery: 'bundle', trust: 'iframe-script', experimental: true  },
  'html-stream':            { runtime: 'html-stream',            format: 'html',  delivery: 'stream', trust: 'iframe-safe',   experimental: true  },
  'unsafe-html-raw-stream': { runtime: 'unsafe-html-raw-stream', format: 'html',  delivery: 'stream', trust: 'unsafe',       experimental: true  },
};

export function runtimeProfile(r: SummonOutputRuntime | undefined): RuntimeProfile;
```

Then replace ad-hoc checks (`isHtmlOutputRuntime`, `=== 'arrow-control'`,
`=== 'unsafe-html-raw-stream'`) with `runtimeProfile(r).format === 'html'`, etc.
`isHtmlOutputRuntime` / `isScriptedHtmlOutputRuntime` become thin wrappers over
the table (keep them — they are exported) so the public API manifest is unchanged.

**Files touched**
- `packages/engine/src/output-runtime.ts` — add table + `runtimeProfile()`.
- `packages/engine/src/contracts.ts`, `prompt.ts` — branch on profile.
- `packages/server/src/session.ts` — see Workstream B.
- `apps/server/src/main.ts` — `runtimeProfileKey` mapping uses the table.
- `apps/demo/.../GeneratePage.tsx`, `useSurfaceStream.ts` — UI groups runtimes
  by `format`/`delivery` instead of a flat dropdown.

**Acceptance**
- `pnpm typecheck` green.
- `pnpm check:public-api` reports no unintended public-surface change.
- No string literal `=== 'arrow-control'` / `'unsafe-html-raw-stream'` outside
  the table and the unsafe gate (Workstream D).

---

## Workstream B — Extract a RuntimeStrategy in the session

**Problem.** `SurfaceGenerationSession` (~1000 lines) forks per runtime:
`consumeProvider` → `consumeHtmlProvider` / `consumeHtmlStreamProvider`;
`acceptBundleWithRepair` vs `acceptHtmlBundleWithRepair`;
`validateAndAcceptBundle` / `validateAndAcceptHtmlBundle` /
`validateAndAcceptHtmlPatch`. Every new runtime forks these again.

**Approach.** Define one strategy interface; the session owns the shared loop
(startup lines, heartbeat, repair budget, timing, finalize), strategies own the
runtime-specific bits.

```ts
// packages/server/src/runtime/strategy.ts
export interface RuntimeStrategy {
  readonly profile: RuntimeProfile;

  /** Provider call(s). Yields candidate artifacts/patches to validate. */
  produce(ctx: RuntimeProduceContext): AsyncIterable<RuntimeCandidate>;

  /** Validate one candidate against the system contracts. */
  validate(candidate: RuntimeCandidate, ctx: RuntimeValidateContext): RuntimeValidation;

  /** Build the model-output-mode meta line for diagnostics. */
  outputModeMeta(repairAttempts: number, repairing?: string[]): ProtocolLine;

  /** Repairable issue codes for this runtime (drives the repair loop). */
  repairableCodes(): ReadonlySet<string>;
}

type RuntimeCandidate =
  | { kind: 'bundle'; bundle: unknown }
  | { kind: 'scaffold'; bundle: unknown }
  | { kind: 'patch'; patch: HtmlSurfacePatch }
  | { kind: 'preview-delta'; value: HtmlStreamPreviewDelta };
```

Implementations:
- `ArrowControlStrategy` — wraps `generateArrowBundle`/`repairArrowBundle`,
  `normalizeArrowBundle`, `arrowArtifactFromBundle`, TS transpile syntax check.
- `HtmlBundleStrategy` — parameterized by `allowScript` (covers `html-static`
  and `html-script`).
- `HtmlStreamStrategy` — wraps `HtmlStreamAccumulator`, emits
  scaffold/patch/preview-delta candidates.
- `UnsafeRawHtmlStreamStrategy` — passthrough; see Workstream D.

The session keeps: `writeStartupLines`, `blockPreflightIssueIfNeeded`,
`withStatusHeartbeat`, repair budgeting, `finalize`, summaries. It drives a
strategy generically:

```
for await (candidate of strategy.produce(ctx)) {
  result = strategy.validate(candidate, ctx);
  if (!result.accepted) { repair-or-block; }
  else { acceptArtifactOrPatch(result); }
}
```

**Migration is mechanical, not behavioral.** Lift existing method bodies into
strategy classes verbatim first; refactor internals after tests pass.

**Files touched**
- New `packages/server/src/runtime/` (strategy + 4 impls + accumulator move).
- `packages/server/src/session.ts` — shrinks to the shared loop.
- `packages/server/test/run-surface-generation.test.ts` — must pass unchanged;
  add per-strategy unit tests.

**Acceptance**
- All existing `packages/server` tests pass with no assertion changes.
- `session.ts` no longer references runtime string literals directly.
- Adding a hypothetical 6th runtime = one new strategy file + one table row.

---

## Workstream C — Per-runtime metrics + bakeoff table

**Problem.** We can see status/timing lines but have no consolidated,
comparable per-runtime numbers. `scripts/runtime-bakeoff-fixtures.mjs` lists a
matrix and scoring axes but nothing computes them.

**Metrics to capture per run** (emit as one protocol meta line; the server
already emits `/timing` lines we can derive most from):

| Metric | Definition | Source |
| --- | --- | --- |
| `ttfb` | request-start → first response byte | client (`useSurfaceStream` already marks `first-byte`) |
| `ttfp` | request-start → first painted/preview content | client; new mark on first preview-delta or first accepted region |
| `tti` | request-start → first accepted `/artifact` (or stream commit) | client (`first-artifact` mark exists) |
| `complete` | request-start → stream end | client (`stream-complete` exists) |
| `repairs` | repair attempts used | server session |
| `blocked` | did the run end blocked | server summary |
| `safetyViolations` | count of block-severity safety issues (unsafe-tag, external-url, inline-handler, script, network) | server validation issues |
| `bytes` | total stream bytes | client |

**Approach.**
1. Add a `/run-metrics` meta line emitted by the session at `finalize`
   (server-known fields) — repairs, blocked, safetyViolations, validation count.
2. `useSurfaceStream` already records timing marks; add a `ttfp` mark and emit a
   client-side `RunMetrics` object in `StreamResult`.
3. Extend `/batch` (`apps/demo/src/pages/BatchPage.tsx`) to run the
   **format × delivery matrix** for a prompt set and render a comparison table
   (one row per runtime, columns = metrics above, averaged across prompts).
4. Add `scripts/runtime-bakeoff.mjs` (companion to the existing fixtures script)
   that drives the matrix headless against a running demo server and writes
   `apps/server/.bakeoff/<timestamp>/{runs.json,report.md}` — mirroring the
   `eval-directions` output convention.

**Kill criteria (decide before reading results).**
- `html-stream` is kept only if it reduces **TTFP by ≥ 40%** vs `html-static`
  **and** keeps **block rate ≤ 1.5×** `html-static` on the same prompts.
- `html-script` is kept only if it unlocks a capability `html-static` cannot
  express in the bakeoff prompts **and** passes the adversarial suite with a
  documented separate security posture (Workstream D/E). Otherwise it folds
  behind the unsafe gate as a research artifact.
- `unsafe-html-raw-stream` is **never** a product candidate; it stays as control.

**Files touched**
- `packages/server/src/session.ts` (or `summary.ts`) — `/run-metrics` line.
- `apps/demo/.../useSurfaceStream.ts`, `types.ts` — `ttfp` mark + `RunMetrics`.
- `apps/demo/src/pages/BatchPage.tsx` — matrix mode + table.
- New `scripts/runtime-bakeoff.mjs`; wire `pnpm runtime-bakeoff` in root
  `package.json`.

**Acceptance**
- `/batch` shows a runtime comparison table for a chosen fingerprint + prompt set.
- `pnpm runtime-bakeoff --dry` validates plumbing with no model calls.
- Report markdown has one row per runtime with all metrics.

---

## Workstream D — Lock down the unsafe control

**Problem.** `unsafe-html-raw-stream` shares code paths with real runtimes
(special-cased in `main.ts` `runtimeProfileKey`, in the artifact-presence check
in `useSurfaceStream`, and in the surface handle). It is too easy to select.

**Approach.**
- Server: reject `unsafe-html-raw-stream` in `/api/generate` unless
  `process.env.SUMMON_ALLOW_UNSAFE_RUNTIME === '1'`. Default = 400.
- UI: hide the unsafe option from the `/generate` runtime picker unless a
  `?unsafe=1` query flag (or a build-time env) is present; show a persistent
  red banner when active.
- `trust: 'unsafe'` from the Workstream A table is the single source of truth
  for these gates.

**Files touched**
- `apps/server/src/main.ts` — env gate.
- `apps/demo/.../GeneratePage.tsx` + runtime picker — visibility gate + banner.

**Acceptance**
- Without the env flag, an `unsafe-html-raw-stream` request returns 400.
- The option is absent from the default UI.

---

## Workstream E — Safety coverage for the HTML runtimes

**Problem.** The Arrow boundary is well covered by `tests/safety-smoke.spec.ts`.
The HTML iframe runtimes (`html-static`, `html-script`, `html-stream`) are newer
and `html-script` deliberately relaxes the script ban.

**Approach.** Add adversarial cases per HTML runtime to the safety harness:
- script injection in `html-static` must be blocked; in `html-script` must be
  contained to the `allow-scripts` iframe with no parent/network/storage reach.
- `html-stream`: malformed/oversized frames, unclosed patches, markers in patch
  bodies, and partial-marker boundaries (the `HtmlStreamAccumulator` edge cases)
  must fail closed, not commit unvalidated HTML.
- preview-vs-commit: assert preview HTML never reaches the committed
  (`allow-scripts`) iframe without validation.

**Files touched**
- `tests/safety-smoke.spec.ts` (+ fixtures), `apps/surface-gallery` adversarial
  presets if used for browser assertions.

**Acceptance**
- `pnpm test:safety` covers all non-unsafe HTML runtimes and passes.
- Documented expectation for each in `docs/adoption/security.md`.

---

## Sequencing

```
A (axis split)  ─┐
                 ├─> B (strategy refactor) ─> C (metrics + bakeoff) ─> read results / apply kill criteria
D (unsafe gate) ─┘
E (safety) runs in parallel with B/C, must land before any html-* is promoted past experimental
```

- **A and D first** (small, enabling, low risk).
- **B** before C (metrics line lives cleanest in the strategy/session seam).
- **C** produces the numbers that drive the keep/cut decision.
- **E** gates promotion regardless of latency wins.

## Decision checkpoint

After C, fill this table from the bakeoff report and decide:

| Runtime | TTFP | TTI | block rate | safety | Keep? | Rationale |
| --- | --- | --- | --- | --- | --- | --- |
| arrow-control | | | | | default | secure baseline |
| html-static | | | | | | |
| html-script | | | | | | needs E + separate posture |
| html-stream | | | | | | apply ≥40% TTFP / ≤1.5× block rule |
| unsafe-html-raw-stream | | | | n/a | control only | never shipped |

## Risks

- **Public API drift.** `SummonOutputRuntime` and the request/repair types cross
  the `@anarchitecture/*` boundary. Keep wire values stable; run
  `pnpm check:public-api` each step.
- **Behavioral drift during B.** Lift-then-refactor; keep
  `run-surface-generation.test.ts` assertions unchanged as the safety net.
- **Scope creep into design fidelity.** Explicitly out of scope; leave to
  `eval-directions` and external review.
