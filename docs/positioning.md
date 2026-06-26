# Positioning

> The north star. Every build decision is adjudicated against this document.
> If a change does not serve one of the three moments below, or does not make
> the governed path the default path, it is out of scope until the core is
> proven.

## What Summon is

Summon is **governable generative UI**: an interface-composition system where a
**Ghost fingerprint is the authority** for how a surface is composed, why it is
composed that way, and whether it conformed.

Most generative-UI systems treat generation as a black box — prompt in, HTML
out, ship it. Summon treats it as a contract with a verdict. A declarative spec
goes in, generation is traced, and the output is checked against the spec that
requested it. The result is a surface you can *inspect* instead of one you have
to *trust blindly*.

## The thing that is actually novel

In Summon, **safety and observability are the same mechanism.**

Because a Summon surface can only act through typed `callTool` invocations — no
ambient DOM, no `fetch`, no `eval`, no escape — every action it takes is
simultaneously (a) an authorization decision and (b) an observability event.
The chokepoint that makes a surface *safe* is the same one that makes it
*legible*. You cannot do one without the other.

Nothing else in the generative-UI space can say this:

- Black-box generators act through ambient DOM/network. Nothing meaningful about
  intent can be recorded; the UI just does things.
- Egress-proxy systems can observe network packets, but they run arbitrary JS in
  an iframe, so they cannot observe whether a surface behaved within its declared
  purpose. They see packets, not intent.
- Summon's only verbs are declared tools, so the trace is not "network logs" — it
  is a record of *semantic actions against a declared capability spec.*

Observability is a free byproduct of the security model, not a bolted-on logging
layer. That collapse is the moat.

## The fingerprint is authority at three moments

This is the full story. "Generate from a fingerprint" is one-third of it, and the
commodity third. The defensible claim is all three:

| Moment | Claim | Status |
| --- | --- | --- |
| **Compose** | The surface is composed *from* the fingerprint's product direction. | ✅ Working, tested |
| **Govern** | The output is verified *against* the fingerprint — a conformance verdict, not just generation. | ⏳ To build |
| **Account** | What happened is traced *back to* the fingerprint — a portable, inspectable receipt. | ⏳ To build |

> Summon operationalizes the claim that a fingerprint can be the *authority* for
> an interface — composing it, governing it, and accounting for it — so rich
> generative experiences become inspectable instead of magical.

## Why open source is a requirement, not generosity

The moat is the receipt. **A receipt from a closed black box is worth nothing.**
Governability's entire value is *verifiability*: "you can trust this surface
conforms because you can inspect how." A proprietary governance layer is a
contradiction — "trust our closed system that says it is trustworthy." The
governed/regulated/brand-strict market will not accept that.

So open source is the only configuration in which the thesis is coherent. The
fingerprint contract, the validator, and the trace format have to be inspectable
for the conformance claim to mean anything.

This reframes where defensibility lives. With the code open, the position is not
the code — it is:

- being the **reference implementation** of the stance (the one others compare
  against),
- owning the **contract and format** (if the fingerprint + trace schema become
  how people *describe* governed UI, the vocabulary is won),
- and **ecosystem gravity** — Summon being the surface where intelligence-native
  cascades actually render.

The code is the gift. The standard is the position.

## The governed path must be the default path

Open-sourcing the mechanism does not propagate the stance. People will install
Summon for "free generative UI sandbox" and ignore the governance story —
exactly the way Linux gets used without the philosophy.

Therefore the stance must be the path of least resistance. Summon must be
*easiest* to use when given a fingerprint and *awkward* without one. If adoption
of the tool is adoption of the stance, OSS spreads the stance. If it is equally
easy to use Summon as a dumb sandbox, OSS spreads a commodity.

**Design rule:** when a choice exists between making the governed path the
default or an opt-in, the governed path is the default.

## The trust spectrum is a feature, not a liability

The governance guarantee holds fully only for the capability-isolated runtime.
That is a feature once it is named honestly:

| Runtime | Posture | Governance |
| --- | --- | --- |
| `arrow-control` | Capability-isolated (QuickJS/WASM, no DOM) | **Fully governed** — behavior flows through `callTool` |
| `html-static` | Inert HTML/CSS, scripts blocked | Inert-safe, partially governed (no behavior to govern) |
| _(future)_ scripted/iframe | Real DOM, real JS | **Outside** the behavioral guarantee, explicit opt-in |

A powerful but less-isolated runtime is safe to offer *later* because
money-moving tools declare a `minTrust` that simply cannot be satisfied from it.
The trust spectrum becomes "how much of the governance guarantee applies," which
is a clean way to frame it — not a pile of half-wired experiments.

## Where Summon sits in the larger ecosystem

Summon is a citizen of the intelligence-native operating model (see
`block-as-intelligence`) — the `media/` + `guardrails/` terminus where the
cascade finally hits a screen and the loop closes. It is also a complete,
standalone artifact: it can be adopted against a fingerprint authored entirely
outside that ecosystem.

The fingerprint contract is what makes Summon both at once — the citizenship
papers *and* the independence guarantee.

## Non-goals

Summon should not:

- become "yet another generative UI tool" judged on output prettiness alone;
- ship more runtimes before the governance core (Govern + Account) is proven;
- build a lease/approval kernel before a real governed customer needs one;
- build an external plugin SDK before the internal seams are stable;
- derive the capability boundary from product intent as an *enforcement*
  mechanism (advisory only, much later);
- make Ghost the thesis instead of the proof mechanism. Ghost is *how* we prove
  governability. The product is the governability.

## The repair path is architectural

When a surface is wrong, the answer is a source location, not taste language:

| Symptom | Inspect |
| --- | --- |
| Wrong look / off-brand | the fingerprint (compose) |
| Wrong or disallowed behavior | the tool contract + `effect`/`minTrust` (govern) |
| "Why did it do that?" | the trace / receipt (account) |

That table is the governability promise made debuggable. It is the bridge that
lets Summon slot into the larger ecosystem's `media/` cell without friction.
