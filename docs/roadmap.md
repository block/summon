# Roadmap

> Build order derived from [`positioning.md`](./positioning.md). The strategy is
> narrow: make design from a fingerprint authority visible, make Surface Document
> the governed default, and preserve generation as a contract with a verdict and
> receipt.

## The organizing test

Before any work goes on this list, it must answer **yes** to one of:

1. Does it make fingerprint-driven output closer to what the brand's design team would ship?
2. Does it make the governed Surface Document path stronger?
3. Does it make a fingerprint's authority real at compose / govern / account?
4. Does it make the conformance claim inspectable and credible?

If not, it waits.

## Current Surface Document gates

- [x] End-to-end Surface Document generation and rendering.
- [x] Prompt/schema/repair mirrors for `surface-document`.
- [ ] Canonical `docs/spec/surface-document.md` accepted as the normative contract.
- [ ] Deterministic conformance v0 over `main.html` and `main.css`.
- [ ] Rendered artifact review.
- [ ] Small-model bakeoff.
- [ ] Explicit default-readiness criteria.

## Tier 0 — Clean state

- [x] Land `positioning.md`.
- [x] Land this roadmap and link both from the README.
- [x] Remove runtime-choice and old-runtime language from current docs.

## Tier 1 — Make the three moments real

### A. Govern — fingerprint conformance verdict

First cut lives in `apps/server/src/ghost-conformance.ts`: checks are routed with
`selectChecksForSurfaces` and evaluated per-check, streamed as
`/ghost-conformance` (`summon.ghost-conformance/v1`).

Remaining:

- split deterministic structural checks from advisory prose checks
- move conformance into `@anarchitecture/summon-server`
- make failures cite Surface Document files and selectors where possible

### B. Account — trace/receipt as a first-class artifact

`buildGhostReceipt` (`apps/server/src/ghost-adapter.ts`) emits
`/ghost-receipt` (`summon.ghost-receipt/v2`) with fingerprint id, gathered
nodes (pull reasons), validation, and conformance verdict.

Remaining:

- canonical serialization and artifact hashing
- published receipt schema and standalone verifier
- tool-call events in the receipt
- promotion into public packages

### C. Repair-path table, made real

`wrong look → fingerprint`, `wrong behavior → tool contract`,
`wrong what-happened → trace`. The UX should point at which part of the Surface
Document contract failed.

## Tier 2 — Tool contract keystone

The Tool contract is the behavioral half of governance. Build only the keystone
that makes the contract explicit and traceable.

- [ ] `SummonTool` typed object: `name`, schemas, `effect`, `minTrust`.
- [ ] `callTool` trace events plus enforcement for blocked effects.

## Tier 3 — Harden the runtime

Surface Document depends on the owned descriptor/VM boundary.

- [ ] Verify reflected property writes and form controls execute correctly in the VM.
- [ ] Keep the descriptor/render protocol narrow and audited.
- [ ] Add expressive range only when the fingerprint calls for it and the runtime can render it safely.

## Explicit non-goals

- ❌ No runtime selector in the product path.
- ❌ No generated authority outside host-granted tools.
- ❌ No lease/approval kernel until a real customer need appears.
- ❌ No external plugin SDK until internal seams are proven.
- ❌ No deriving enforcement from inferred product intent.
