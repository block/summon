# Roadmap

> Build order derived from [`positioning.md`](./positioning.md). The strategy
> implies a specific sequence: make design from a fingerprint authority visibly
> real, make the safe drop-in governed home the default, and preserve generation
> as a contract with a verdict and receipt. Add surface area only after the core
> is provably inspectable.

## The organizing test

Before any work goes on this list, it must answer **yes** to one of:

1. Does it make fingerprint-driven output visibly closer to what the brand's design team would ship?
2. Does it make the **governed path the default path**?
3. Does it make a fingerprint's authority **real** at *compose / govern / account*?
4. Does it make the conformance claim **inspectable** (credibility)?

If not, it is runtime-soup and it waits.

---

## Tier 0 — Clean state (cheap, this week)

The repo should read like a reference implementation of a stance, not a lab.

- [ ] **Prune the merged dead branches** (~22 at 0-ahead of main). One command.
- [x] **Land `positioning.md`** — the north star every later decision is judged against.
- [x] **Land this roadmap** and link both from the README.

## Tier 1 — Make the three moments real (≈80% of energy)

`Compose` works and is tested. First cuts of `Govern` and `Account` have
shipped in the demo server; the remaining Tier 1 work is hardening them and
moving them into the public packages.

- [x] **A. Govern — fingerprint conformance verdict.** *(first cut shipped)*
  Lives in `apps/server/src/ghost-conformance.ts`: checks are routed with
  `selectChecksForSurfaces` and evaluated per-check, streamed as
  `/ghost-conformance` (`summon.ghost-conformance/v1`).
  **Remaining:** the verdict is LLM-judged today — split into deterministic
  structural checks against the artifact (reproducible, citable) plus advisory
  prose checks, and move it out of the demo app into
  `@anarchitecture/summon-server`.

- [x] **B. Account — the trace/receipt as a first-class artifact.** *(first cut shipped)*
  `buildGhostReceipt` (`apps/server/src/ghost-adapter.ts`) emits
  `/ghost-receipt` (`summon.ghost-receipt/v1`) with fingerprint id, gathered
  nodes, validation, and the conformance verdict.
  **Remaining:** canonical serialization + artifact hashing, a published schema
  and standalone verifier, tool-call events in the receipt, and promotion into
  the public packages.

- [ ] **C. The repair-path table, made real.**
  `wrong look → fingerprint`, `wrong behavior → tool contract`, `wrong
  what-happened → trace`. Not just docs — the UX of debugging a surface. The
  system should point at *which* part of the spec failed.

## Tier 2 — Bet 3, keystone only

The Tool contract is the behavioral half of governance. Build *only* the
keystone that makes the contract exist and the trace capture behavior. **Do not
build the authorization kernel yet.**

- [ ] **D. The `SummonTool` contract as a typed object.**
  `name`, `input`/`output` schema, `effect` (`read | staged-write |
  lease-required | blocked`), `minTrust`. Just the type + the call-lifecycle
  state machine. No lease store, no approval UI.

- [ ] **E. `callTool` emits trace events and enforces `minTrust` + `effect: blocked`.**
  The minimum that makes the safety = observability collapse real: every tool
  call is both an authorization decision and an observability event. Staged-write
  / lease machinery is deferred (Tier 3).

## Tier 3 — Harden the runtime the moat depends on

The governance guarantee holds fully only for capability-isolated runtimes. `surface-document` is now the leading successor candidate; protect the owned descriptor/VM boundary.

- [ ] **F. Verify `.value=` / IDL bindings actually execute in the QuickJS sandbox.**
  We removed the validator blocks but never confirmed runtime behavior. Load one
  interactive surface and confirm it behaves, not just validates. Load-bearing
  for the "rich experiences" claim.

- [ ] **G. Decide the long-term isolation-primitive stance** (historical analysis:
  [`docs/archive/isolation-options.md`](./archive/isolation-options.md)). Do **not** vendor-snapshot
  or fork yet — premature. The open question is whether Summon should own a thin
  descriptor/render protocol over a swappable isolation engine. Track it; don't
  act until the governance core (Tier 1) is proven.

- [x] **H. Name the trust spectrum.** Resolved by collapsing it (2026-07-02):
  `surface-document` is the only runtime. There is no trust spectrum to
  document because there is no runtime choice — generated UI is a governed
  Surface Document bundle, full stop.

- [ ] **I. Expressive range, gated on F.**
  Motion, richer composition, and canvas-class media are in scope only when the
  fingerprint's design direction calls for them and the governed runtime can
  render them. This is not a rich-media free-for-all: the fingerprint calls for
  it, and the governed runtime renders it.

---

## Explicit non-goals (right now)

As important as the build list — this is the discipline that keeps the repo from
becoming sad again.

- ❌ **No new runtimes.** Decided 2026-07-02: converged on `surface-document`
  as the sole runtime. `arrow-control`, `html-static`, `html-stream`, and
  `domjs-control` were removed from the protocol, the server strategies, the
  validators, and the renderer — not deprecated, deleted. `experimentalRuntime`
  no longer exists as a request field. The surface-vm capability sandbox
  (owned QuickJS VM, descriptor renderer, `callTool` chokepoint) is the only
  execution engine. Any future runtime proposal reopens this decision
  explicitly rather than adding a flag.
- ❌ **No lease/approval kernel.** Tier 3 of Bet 3, gated on a real customer.
- ❌ **No external plugin SDK.** Premature; the near-term value of seams is
  internal discipline.
- ❌ **No deriving capability from product intent as enforcement.** Advisory
  only, much later, never the wall.

---

## First three things to build, in order

1. ✅ `docs/positioning.md` — so decisions have a north star.
2. ✅ **Fingerprint conformance verdict** (Tier 1A) — first cut shipped; harden per Tier 1A remaining work.
3. ✅ **Inspectable trace/receipt** (Tier 1B) — first cut shipped; harden per Tier 1B remaining work.

Those three turn "we have a nice generator" into "we have generative UI with a
design authority, a verdict, and a receipt" — which is the core bet.
