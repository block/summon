# Plan: `surface-vm` — fluent HTML/JS in a capability sandbox

Status: implementation plan (2026-06-29).

## Intention (do not lose this)

> The model authors the dialect it is fluent in (imperative HTML/JS), it runs
> under capability-absence (QuickJS, no `window`/`document`), and it ships as one
> embeddable artifact any WebView host can run through a single bridge.
> **The protocol is the product. The runtime is a detail.**

Everything below serves that sentence. If a step doesn't, cut it.

## Design shape (the whole thing on one page)

```
[VM realm]   model's HTML/JS  →  domjs facade  →  emits SerializedNode + VmPatch
─────────────── protocol (tag/attrs/children/patch + plain event snapshot) ──────────
[host realm] renderer: data → real shadow DOM ;  bridge: callTool/getState/onState
```

Three pieces, that's it:
1. **protocol** — the wire types. We own them. ~1 small file.
2. **host** — `runner` (boot QuickJS, pump messages) + `renderer` (data → DOM).
3. **engine** — `domjs` facade inside the VM (the only genuinely new code).

No reactivity framework. No compiler. No new artifact format. No abstraction
layer "in case we add more engines later." One engine, one protocol, done.

## Anti-over-engineering rules

- **6 patch ops, no more.** Reuse Arrow's exact `VmPatch` set. Lists use
  `replace-region`. Do NOT add `insert-node`/`remove-node` until a real prompt
  proves it's needed.
- **Facade = the subset that maps to those 6 ops.** `createElement`,
  `textContent`, `setAttribute`/`className`, `append`, `addEventListener`,
  `remove`. That's the v0 DOM. Anything else throws a clear error (→ repair loop).
- **No premature engine plugin system.** Arrow already exists as its own package;
  we are not re-hosting it. `surface-vm` ships ONE engine (`domjs`). If Arrow
  ever needs to share this runner, refactor then, not now.
- **State is a plain object + an explicit `render()`.** No proxies, no tracking,
  no `reactive()`. Imperative is the model's strength; lean into it.
- **Port, don't invent.** renderer + runner are line-for-line ports of the
  Arrow source we already read. Resist "improving" them.

## Milestones (each is independently valuable and stops cleanly)

### M0 — Boundary skeleton  *(the gate; nothing proceeds until green)*
Goal: prove the capability boundary holds with a hand-written node tree, no
engine, no model.

- `packages/surface-vm/src/protocol.ts` — vendor `SerializedNode`, `VmPatch`,
  `HostToVmMessage`, `VmToHostMessage`, `SandboxedEventPayload`. (Copy from the
  source we read; this is *our* contract now.)
- `src/host/runner.ts` — port QuickJS boot: inject `__hostSend`, module loader,
  `__dispatch`, null the globals after boot. Pump `VmToHostMessage`.
- `src/host/renderer.ts` — port the 335-line renderer: instantiate tree,
  apply patches, event delegation + plain-data `sanitizeEvent`.
- A trivial VM entry that just `__hostSend({type:'render', tree})` for a static
  tree, to drive the renderer end to end.

**Exit gate (hard):** port `tests/safety-smoke.spec.ts` against `surface-vm` and
prove: no `window`/`document`/storage in VM, events arrive as plain snapshots,
no live node escapes via `event.target.parentNode`, host never evals VM code.
**If this can't be re-proven, stop the whole project here.** This is the only
step that can sink it.

### M1 — `domjs` facade
Goal: model-authored imperative HTML/JS renders.

- `src/engine/domjs/facade.ts` — in-VM `document` facade. Builds an in-memory
  `SerializedNode` tree; mutations emit `VmPatch`. `addEventListener` allocs a
  `handlerId`, stores the callback, emits `set-event-binding` (mirror Arrow's
  `allocHandlerId`).
- `src/engine/domjs/bootstrap.ts` — inject the facade as VM globals
  (`document`, the entry's default export = root node).
- Wire incoming `{type:'event'}` → handler lookup → invoke with snapshot.

**Exit gate:** a hand-written HTML/JS sample (button + click + textContent
update + a list via `replace-region`) renders and reacts. No safety regression.

### M2 — Bridge + Summon integration
Goal: it's a real Summon surface, not a toy.

- `src/host/bridge.ts` — expose `host-bridge:summon` (`callTool`, `getState`,
  `onState`) to the facade, identical contract to `inline-surface.ts` today.
- New output runtime: add `'domjs-control'` (or similar) to
  `output-runtime.ts` — `format:'html'`, `trust:'sandboxed'`, `experimental:true`.
- A bundle runtime strategy + a small validator (facade-subset check) that feeds
  the existing repair loop. Reuse `html-artifact.ts` allowlists where they fit.
- A prompt block teaching the facade's supported DOM subset (short — it's the
  model's strength; this is the inverse of `arrow-subset.ts`).

**Exit gate:** generate a surface from a prompt, it renders, a granted tool call
round-trips through the bridge.

### M3 — Measure
Goal: decide if this beats Arrow / Strategy A on yield.

- Add `domjs-control` to `scripts/runtime-bakeoff.mjs`.
- Compare first-pass acceptance vs `arrow-control` (and Strategy A if built).

**Decision point:** if `domjs` materially out-yields Arrow on real prompts, it
becomes a first-class runtime. If not, we learned it cheaply and stop.

## What we are explicitly NOT building (yet)

- Not a multi-engine plugin framework.
- Not re-hosting Arrow inside `surface-vm`.
- Not a reactivity system.
- Not new `VmPatch` ops.
- Not native renderers (artifact stays a WebView-running VM bundle).
- Not the Strategy A compiler (separate, parallel probe if desired).

## Risks, honestly

- **M0 safety port is the real cost and the real risk.** Budget for it; it's the
  gate. Everything after M0 is ordinary engineering.
- **Facade scope creep** is the over-engineering trap. Hold the 6-op line. Let
  the repair loop + rejected prompts tell us what to add, with evidence.
- **Upstream divergence** from `@arrow-js/sandbox` VM-escape fixes. Keep
  `host/*` a thin, documented port with a sync checklist.

## First commit

M0 only: `protocol.ts` + skeleton `runner.ts`/`renderer.ts` + one static-tree
mount + the ported safety smoke test. Prove the boundary, then earn the rest.
