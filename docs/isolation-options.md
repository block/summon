# Isolation Primitive: Options and Stance

> Why this exists: Summon's governance guarantee for the fully-governed runtime
> rides on a JS-isolation primitive. This doc records the options, the boundary
> audit, and the decided stance — so the "should we fork / vendor / build our
> own" question is answered once instead of re-litigated whenever dependency
> anxiety resurfaces.

## What the dependency actually is

`@arrow-js/sandbox` is **two things bundled**, and conflating them is the trap:

1. **The isolation engine** — `quickjs-emscripten` (a WASM build of Fabrice
   Bellard's QuickJS). ~4M downloads/month, independently maintained. arrow-js
   does **not** implement this; it depends on it. Forking arrow would not mean
   owning a JS engine.
2. **The glue (~4k LOC)** — a descriptor protocol (VM emits plain-data UI
   trees), a reactive shim, a host DOM renderer, and the capability bridge. This
   is the arrow-specific part.

So "build our own" almost never means "build an isolation engine." It means
"keep the engine, own the glue."

## The options (OSS realm)

| Option | What it is | Fit | Verdict |
| --- | --- | --- | --- |
| **quickjs-emscripten (raw)** | The engine under arrow, used directly | We write descriptor/render/bridge ourselves | The real "build our own" path — same engine, our glue |
| **SES / Hardened JS** (Agoric) | `lockdown()` + Compartments; freeze the realm, deny-by-default, same-realm | Mature (MetaMask Snaps, Salesforce). No WASM, fast. But same-realm — DOM reachable unless membraned | Strongest *alternative*; different isolation philosophy |
| **ShadowRealm** (TC39) | Native separate-realm with a callable boundary | Exactly the arrow model, but native | The future — not in stable browsers yet |
| **near-membrane / LWS** (Salesforce) | Membrane-based DOM virtualization | Untrusted code touches a *virtual* DOM safely | Powerful, heavy; opposite of "no DOM" simplicity |
| **Web Worker** | Untrusted code in a worker | Free isolation; async-only postMessage, clunky for reactive UI | Viable substrate, awkward ergonomics |
| **iframe sandbox** | Real DOM, escape surface | Already rejected | Out |

Genuine contenders: **quickjs-raw** (our glue, same engine) and **SES** (lighter,
different model). ShadowRealm is the drop-in successor when browsers ship it.

## Boundary audit (2026-06-26)

**Finding: the coupling is exceptionally clean — best case.**

The entire runtime dependency surface is **one function call in one file**, plus
a **17-line type shim Summon authors itself**.

- 1 dynamic import, in 1 file: `packages/host/src/inline-surface.ts`.
- 1 function: `sandbox(options, events, hostBridge) → (root) => teardown`.
- The type surface is defined by Summon's own `arrow-sandbox-shim.d.ts`, not
  imported from the package — Summon already controls the interface definition.

The full contract Summon depends on:

| Passed / expected | Detail |
| --- | --- |
| `source` | `Record<string, string>` virtual files (`main.ts`, `main.css`) |
| `shadowDOM: true` | mount into a shadow root |
| `onError(err)` | runtime error callback |
| `events.output(payload)` | VM→host emit channel (carries tool calls) |
| `hostBridge['host-bridge:summon']` | **3 functions:** `getState`, `onState`, `callTool` |
| return | `view(root) → teardown` |

That is the whole thing. Everything else in `inline-surface.ts` (preview state,
network policy, teardown, CSS scoping) is Summon's own code that survives an
engine swap unchanged. The other `@arrow-js/core` references in the repo are in
**prompts, tests, and demo tools** (teaching the model to write Arrow) — they
travel with the *format*, not the *engine*.

## Stance (decided)

1. **We are not trapped.** Swapping the isolation engine later is a ~50-line,
   single-file change behind an interface Summon already authors. The structural
   risk that motivates forking/vendoring is small.

2. **Do not build our own now.** Not for coupling reasons (the seam is clean) but
   for roadmap discipline: the descriptor-to-DOM reconciler is *not the moat*.
   Governance (compose/govern/account) is. Rebuilding arrow's renderer under an
   unproven thesis is runtime-soup in disguise.

3. **Do not vendor-snapshot now.** Premature. It is insurance against a risk that
   has not materialized, and the clean seam already bounds that risk.

4. **The cheap correct move (Tier 3, later):** formalize the existing shim into a
   named `SandboxRuntime` contract and have `loadSandboxFactory()` return it from
   a provider. arrow becomes `createArrowRuntime()`; a future quickjs-raw or SES
   impl is the same signature. One hour of work converts an *accidental* clean
   seam into an *intentional* swappable one — the honest expression of "own the
   protocol, swap the engine."

**One-line stance:** own the protocol, keep the engine swappable, and don't act
until the governance core is proven.
