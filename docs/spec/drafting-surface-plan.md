# Plan: fingerprint-derived drafting surface

> **Status:** implementation plan. Normative contract lives in
> [`surface-document.md` → Generation-time presentation](./surface-document.md#generation-time-presentation).

## Problem

Since the runtime axis was retired (`3086723`), the only live-rendering path
(`html-stream` / `onHtmlPatch`) is gone. Generation is all-or-nothing: for the
entire drafting window the user sees a generic pulsing loader with heartbeat
text, identical for every fingerprint. Time-to-first-artifact is typically
10–30s. The highest-salience window of a surface's lifetime is off-brand.

## Approach

Layered choreography, shipped bottom-up. This plan covers **layer 1 only**;
layer 2 is a scoped spike, not a commitment.

```txt
t=0        layer 1: fingerprint-derived drafting surface (host-owned)   <- this plan
t≈stream   layer 2: sanitized progressive structure preview             <- future spike
t=accept   final render: main.css + main.js apply atomically            <- exists
t=blocked  retract to drafting surface during repair                    <- this plan
```

Layer 1 requires zero trust-boundary work: it consumes only host-owned inputs
(`tokensSource`, validated `surface.status` events, `/surface-policy`,
`/agent-goal` meta). No partial model output is parsed or painted.

## Non-goals

- No parsing of partial bundle JSON or partial `main.html`.
- No new protocol operations or event types. Existing `surface.status`
  statuses (`planning | contract | drafting | validating | rendering |
  finalizing`) are sufficient.
- No reduction of time-to-final-artifact. This fixes the *quality* of
  waiting, not the amount.

## Design requirements

1. **Fingerprint-derived, not templated.** The drafting surface is styled
   exclusively from `tokensSource` custom properties (`--color-bg`,
   `--color-text`, `--font-sans`, spacing/motion tokens) with the same
   fallbacks as `surfaceDocumentShadowBaseCss()`. Two different fingerprints
   must produce visibly different drafting surfaces. The current
   `defaultPreviewCss` gray treatment is replaced, not augmented.
2. **Same container, owned transition.** Drafting renders into the same
   root the artifact mounts into. The `drafting → rendered` handoff is a
   deliberate host-owned transition (opacity/transform choreography from
   fingerprint motion tokens where present), not a `replaceChildren()` pop.
3. **Re-enterable.** On a blocked bundle + repair pass, the host returns to
   the drafting state. `renderState` gains a legal `rendering → preview`
   edge (currently absent) driven by repair-phase status events.
4. **Honest progress.** Status text from `surface.status` events and the
   advisory `/agent-goal` render inside the drafting surface. No fake
   skeleton rows pretending to know the layout — layer 2 earns that.
5. **Accessible.** Preserve `role="status"` / `aria-live="polite"`; the
   drafting→rendered transition must respect `prefers-reduced-motion`.

## Work items

### 1. Host: drafting surface (`packages/host/src/summon-surface.ts`) — done

- Replace `renderPreview` / `defaultPreviewCss` with a token-driven drafting
  renderer. Inputs: `tokensSource`, latest `SurfacePreviewSnapshot`
  (status + text), optional goal text.
- Formalize the render lifecycle: `preview ↔ rendering → rendered | failed`,
  with the repair re-entry edge. Late/duplicate status events must not
  redraw drafting over a rendered surface (the existing `renderState` guard
  generalizes).
- Transition choreography between drafting and mounted artifact, gated on
  `prefers-reduced-motion`.
- Tests in `packages/host/test/`: token-derivation (two fingerprints → two
  distinct computed drafting styles), lifecycle edges including repair
  re-entry, no-redraw-after-render guard.

### 2. Server: repair visibility (`packages/server/src/runtime/bundle.ts`)

- Verify repair passes emit `surface.status` events the host can key
  re-entry on (repair heartbeats exist; confirm they carry a status the
  host distinguishes from first-pass drafting). Add `text` clarifying a
  repair is in progress. No new status values unless a gap is proven.

### 3. React binding (`packages/react/src`, `packages/summon-react`)

- Ensure the drafting lifecycle is observable (`renderState` or snapshot) so
  hosts can coordinate outer chrome. No new required props.

### 4. Demo + gallery — demo done

- `apps/demo`: the sandbox frame is visible for the whole generation
  lifecycle and the host drafting surface **is** the loading state. The
  app-level `SurfaceLoadingOverlay`, its `generationPreview` model, and the
  parallel snapshot-reducer pipeline are deleted (main stage and child
  surfaces). Verified visually against two divergent fingerprints via a
  slow-streaming mock server.
- Playwright coverage (`tests/safety-smoke.spec.ts`): drafting surface paints
  at mount, no app overlay occludes it during generation, drafting departs
  after the artifact renders.
- `apps/surface-gallery`: still uses its own progressive-placeholder flow;
  align in a follow-up.

### 5. Docs

- [x] `surface-document.md` — Generation-time presentation contract.
- Update `docs/adoption/integration.md` with the drafting lifecycle and
  what hosts may customize (container chrome yes, drafting internals no).

## Acceptance criteria

- With generation artificially slowed, two different fingerprints show
  visibly distinct, on-brand drafting surfaces from t=0.
- A blocked bundle followed by a successful repair shows
  drafting → drafting(repair) → rendered with no blank frame and no frozen
  loader.
- A rendered surface never regresses to drafting from late status events.
- All safety smoke tests pass unchanged — this layer touches no validated
  content path.

## Layer 2 spike (separate, follow-up)

Progressive sanitized structure preview. Scope of the spike, before any
implementation commitment:

1. Incremental JSON scanner extracting the growing `source["main.html"]`
   string from all three provider adapters' structured-output streams;
   measure how often `main.html` actually arrives first per provider.
2. Incremental mode for the existing html-parser/sanitizer
   (`packages/surface-vm/src/engine/domjs/html-parser.ts`) — same rejection
   rules, prefix-safe.
3. Prototype the two hard transitions: partial-paint → accept (CSS applies
   atomically) and partial-paint → blocked (retraction to drafting).
   Judge by watching, not reasoning.

Exit question: does the streamed preview *feel* better than the layer-1
drafting surface, per fingerprint, enough to pay for a new pre-validation
component? If no, layer 1 stands alone.
