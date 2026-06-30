# domjs reactivity — ported from arrow-js (2026-06-30)

Adopted arrow-js's best idea — **fine-grained reactive state + function bindings**
— into the domjs runtime, without adopting arrow's `html` template dialect. The
model keeps writing fluent imperative DOM code; it just no longer manages updates
by hand.

## What changed

In `packages/surface-vm/src/engine/domjs/runtime-source.ts`:

- **`reactive(obj)` / `state(obj)`** now return a tracking Proxy. Reading a key
  inside a binding subscribes that binding; writing the key re-runs subscribers.
  (`state` is kept as the familiar alias; both are the same.)
- **`bind(fn)`** runs a function as a tracked effect (arrow's dependency model:
  active-effect stack + WeakMap of target→key→effects).
- **Function-valued bindings:**
  - `textNode.textContent = () => 'count: ' + s.count` — re-runs on change, emits
    one `set-text`. Fine-grained: only that text node updates.
  - `el.setAttribute(name, () => ...)`, `el.className = () => ...` — reactive
    attributes, emit one `set-attribute` per change.
  - `region(() => s.items.map(...))` — **auto-tracks**; re-renders (one
    `replace-region`) when the state it reads changes. No manual `.update()`.
- **`region.update()`** retained as a manual escape hatch for non-reactive data.

### The redundant-patch fix (the subtle part)

Nodes only emit patches once **live** (serialized / handed to the host). A node
created *during* a region re-render carries its value in the `replace-region`
payload, so it must not also emit a `set-text`/`set-attribute`. Gated all patch
emission on `__live` (text) / `__frozen` (elements), set in `serialize()`.

## What we deliberately did NOT port

- Arrow's `html` tagged-template dialect — that is the niche syntax the model is
  worse at and the reason domjs exists. We ported the *reactivity engine*, not
  the *authoring syntax*.
- Keyed list reconciliation — still a `replace-region` (whole-list) update.
  Deferred; it would need new protocol ops (`insert-node`/`move-node`).

## Prompt

`SUMMON_FIXED_DOMJS_INSTRUCTIONS` now teaches the reactive model: bind with
`() => ...`, mutate state in handlers, reassign arrays (`s.items =
s.items.concat(...)`) so edits track, and avoid manual update calls.

## Verified

- surface-vm 27/27 (incl. new reactive-region, reactive-text, manual-update
  tests); engine 66, server 46, host 51 — 190 total, 0 fail.
- **Live, end to end:** generated a counter — the model produced
  `pc.textContent = () => String(s.count)` with **zero `.update()` calls** — and
  clicking increment drove 0→2 in the browser. Screenshot:
  `screenshots/09-domjs-reactive-counter.png`.

## Exemplars (few-shot)

`SUMMON_FIXED_DOMJS_INSTRUCTIONS` now carries two compact **worked examples** — a
reactive counter (function text + reactive `disabled` attribute) and a reactive
add/remove list (region auto-render + array reassignment). Both were **executed
in the surface-vm and verified to render and react** before embedding (not
transcribed from arrow docs — arrow's examples use the `html` template dialect
domjs rejects, so concepts were ported, code was VM-verified).

Effect, measured on a live todo-list generation: 3 reactive `textContent = () =>`
bindings, **0 manual `.update()` calls**, 4 array-reassign ops, clean (0 blocks /
0 repairs). The model imitates the verified shape rather than improvising.

The same reactive guidance is mirrored across all three model-facing channels —
system prompt, the `main.js` JSON-schema description (`domjs-bundle.ts`), and the
`domjs-unsupported-api` repair hints (`contracts.ts`) — so generation and repair
never contradict each other. Arrow's pipeline is fully separate and untouched.

## Honest note

This is an ergonomics + cleanliness win (less code, no manual-update bug class).
Whether it measurably lowers crash/repair rate vs the manual-region model is
unproven — that would need the repeat-based A/B described in
`surface-vm-bakeoff-findings.md` (manual-region domjs vs reactive domjs).
