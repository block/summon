# Positioning

> The north star. Every build decision is adjudicated against this document.
> If a change does not strengthen design from a fingerprint authority, make the safe drop-in path more observable, or preserve generation as a contract with a verdict, it is out of scope until the core is proven.

## What Summon is

> **Summon — generative UI with a design authority.**
> Ghost fingerprints carry the brand; Summon composes surfaces that answer to them, inside a sandbox where every action is observable, under a contract that yields a verdict.

Summon exists to close the gap between *generated* UI and *designed* UI. Most model-generated interfaces default to the model's taste. Summon puts a Ghost fingerprint in the loop as the design authority: adaptable, modular, portable, and explicit enough for generated output to answer to it.

The identity is three claims, in this order:

1. **Design from a design authority.** Ghost-steered design is the identity. The fingerprint carries product direction, brand constraints, component intent, and interaction posture; Summon composes surfaces from it instead of treating design as whatever the generator emits.
2. **A methodically safe, drop-in home for model-generated code.** Generated surfaces run in a constrained home where every meaningful action passes through declared capabilities. Safety and observability are the same mechanism.
3. **Generation is a contract.** A declarative spec goes in, generation is traced, and the output is checked against the authority that requested it. The result is a surface you can inspect instead of one you trust blindly.

The technical category is **governable generative UI**: generated interfaces composed from a design authority, constrained by explicit capabilities, and returned with a conformance verdict and receipt.

## The thing that is actually novel

Claim 2 holds because, in Summon, **safety and observability are the same mechanism.**

Because a Summon surface can only act through typed `callTool` invocations — no ambient DOM, no `fetch`, no `eval`, no escape — every action it takes is simultaneously (a) an authorization decision and (b) an observability event. The chokepoint that makes a surface *safe* is the same one that makes it *legible*. You cannot do one without the other.

Nothing else in the generative-UI space can say this:

- Black-box generators act through ambient DOM/network. Nothing meaningful about intent can be recorded; the UI just does things.
- Egress-proxy systems can observe network packets, but they run arbitrary JS in an iframe, so they cannot observe whether a surface behaved within its declared purpose. They see packets, not intent.
- Summon's only verbs are declared tools, so the trace is not "network logs" — it is a record of *semantic actions against a declared capability spec.*

Observability is a free byproduct of the security model, not a bolted-on logging layer. That collapse is why Summon can be a safe drop-in home for generated surfaces rather than another place arbitrary code happens to run.

## Generation is a contract

The fingerprint is authority at three moments. "Generate from a fingerprint" is only the opening move; the claim is complete when the result is governed against the fingerprint and accounted back to it.

| Moment | Claim | Status |
| --- | --- | --- |
| **Compose** | The surface is composed *from* the fingerprint's product direction. | ✅ Working, tested |
| **Govern** | The output is verified *against* the fingerprint — a conformance verdict, not just generation. | ✅ First cut shipped (`apps/server/src/ghost-conformance.ts`, streamed as `/ghost-conformance`) — LLM-judged today, deterministic checks still to come; lives in the demo server, not yet in the public packages |
| **Account** | What happened is traced *back to* the fingerprint — a portable, inspectable receipt. | ✅ First cut shipped (`buildGhostReceipt`, streamed as `/ghost-receipt`) — not yet signed/hashed, and lives in the demo server, not yet in the public packages |

> Summon operationalizes the claim that a fingerprint can be the *authority* for an interface — composing it, governing it, and accounting for it — so generated experiences become inspectable instead of magical.

Governability is what makes the design claim verifiable. Ghost-steered design is not asserted as a taste judgment; the fingerprint, verdict, and receipt make the claim inspectable.

## Why open source is a requirement, not generosity

The moat is the receipt. **A receipt from a closed black box is worth nothing.** The value of a design authority depends on verifiability: "this surface answers to the fingerprint because you can inspect how." A proprietary governance layer is a contradiction — "trust our closed system that says it is trustworthy." The governed/regulated/brand-strict market will not accept that.

So open source is the only configuration in which the thesis is coherent. The fingerprint contract, the validator, and the trace format have to be inspectable for the conformance claim to mean anything.

This reframes where defensibility lives. With the code open, the position is not the code — it is:

- being the **reference implementation** of the stance (the one others compare against),
- owning the **contract and format** (if the fingerprint + trace schema become how people *describe* governed UI, the vocabulary is won),
- and **ecosystem gravity** — Summon being the surface where fingerprint-driven generation actually renders.

The code is the gift. The standard is the position.

## The governed path must be the default path

Open-sourcing the mechanism does not propagate the stance. People will install Summon for "free generative UI sandbox" and ignore the fingerprint/governance story — exactly the way Linux gets used without the philosophy.

Therefore the stance must be the path of least resistance. Summon must be *easiest* to use when given a fingerprint and *awkward* without one. If adoption of the tool is adoption of the stance, OSS spreads the stance. If it is equally easy to use Summon as a dumb sandbox, OSS spreads a commodity.

**Design rule:** when a choice exists between making the fingerprint-first, governed path the default or an opt-in, the fingerprint-first governed path is the default.

## The trust spectrum is a feature, not a liability

The governance guarantee holds fully only for the capability-isolated runtime. That is a feature once it is named honestly:

| Runtime | Posture | Governance |
| --- | --- | --- |
| `arrow-control` | Capability-isolated (QuickJS/WASM, no DOM) | **Fully governed** — behavior flows through `callTool` |
| `domjs-control` | Capability-isolated (QuickJS/WASM via `packages/surface-vm`, descriptor renderer, no real DOM) | **Fully governed** — same `callTool` chokepoint, Summon-owned glue |
| `html-static` | Inert HTML/CSS, scripts blocked | Inert-safe, partially governed (no behavior to govern) |
| `html-stream` | Inert streamed preview (`script-src 'none'`), validated patch commits | Inert-safe, partially governed |
| _(future)_ scripted/iframe | Real DOM, real JS | **Outside** the behavioral guarantee, explicit opt-in |

A powerful but less-isolated runtime is safe to offer *later* because money-moving tools declare a `minTrust` that simply cannot be satisfied from it. The trust spectrum becomes "how much of the governance guarantee applies," and where fingerprint conformance is fully enforceable or only partially inspectable.

## Standalone, and composable

Summon is a complete, standalone artifact: point it at a Ghost fingerprint and it composes, governs, and accounts for a surface — no surrounding system required.

It is also composable. Because the fingerprint is the design authority Summon needs, any larger system that produces fingerprints can use Summon as its rendering terminus — the place where declared product direction finally hits a screen and the loop closes. The fingerprint contract is what makes Summon both at once: usable on its own, and pluggable into something bigger.

## Non-goals

Summon should not:

- chase generic output prettiness without a fingerprint authority; design quality against a fingerprint is the product;
- ship more runtimes before the governance core (Govern + Account) is proven;
- build a lease/approval kernel before a real governed customer needs one;
- build an external plugin SDK before the internal seams are stable;
- derive the capability boundary from product intent as an *enforcement* mechanism (advisory only, much later);
- reduce Ghost to a proof mechanism. Ghost-steered design is the identity; governability is how that claim becomes verifiable rather than asserted.

## The repair path is architectural

When a surface is wrong, the primary repair loop is to inspect the authority that shaped it. The answer should be a source location, not taste language:

| Symptom | Inspect |
| --- | --- |
| Wrong look / off-brand | the fingerprint (compose) — the most common repair starts at the design authority |
| Wrong or disallowed behavior | the tool contract + `effect`/`minTrust` (govern) |
| "Why did it do that?" | the trace / receipt (account) |

Govern and Account are the supporting instrumentation around that loop: the contract shows whether the surface stayed inside its declared capability bounds, and the receipt shows what actually happened. That table is the governability promise made debuggable. It is the bridge that lets Summon slot into the larger ecosystem's `media/` cell without friction.
