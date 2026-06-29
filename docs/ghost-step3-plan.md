# Step 3 plan: surface selection + slice-faithful brief

> Migration step 3 from `integration-with-ghost.md`. After step 2, Summon loads
> the graph and gathers the `core` slice, but two things are placeholder-grade:
> (a) the surface is **hardcoded to `core`**, and (b) the brief renders slice
> node bodies but does not yet use provenance, spokes, or honor the corridor
> model. Step 3 makes the fingerprint's surface selection real and the brief
> faithful to the gathered slice.

## What step 2 left (current state)

- `resolve*GhostGenerationContext` call `resolveGraphSlice(graph, GHOST_GRAPH_ROOT_ID)` — always `core`.
- `renderSlicePrompt(slice)` concatenates node bodies under `# Ghost Fingerprint` (flat, no provenance ordering).
- `buildSummonFingerprintSurfaceBrief` is solid prose but lists `gatheredNodes` as a flat id list; it does not explain provenance (own/ancestor/edge) or expose spokes.
- The CSS block lives verbatim inside the node bodies in `prompt`, AND is also extracted into `tokenSource.css` / `activeTokensCss`. **Possible duplication** — the model sees the token CSS twice (once in the fingerprint prose, once as the injected stylesheet). Confirm and decide.

## Two sub-problems

### 3A. Surface selection (stop hardcoding `core`)

Ghost's principle: *the agent names the node; Ghost does not infer it from paths.*
For our single-`core` fixtures this is moot today — but the integration must not
bake in `core`, because real multi-surface fingerprints (and the root
`SUMMON_GHOST_ROOTS` case) will have many nodes.

**Decision needed: where does surface selection happen?**

Timing in `main.ts`: ghost context resolves at ~L357 (early, before the prompt
is classified), the broker plans at ~L461, and `prepareGhostSurfacePrompt` runs
at ~L488 (both prompt + graph available). So selection can happen at prepare-time.

Options:
- **(A) Selection at prepare-time, broker-driven.** The broker already classifies
  the prompt into a `SurfaceGoal`. Extend it (or add a small sibling) to also pick
  a node id from `buildGraphMenu(graph)` (id + description — the retrieval payload
  Ghost designed for exactly this). Re-gather the slice for the chosen surface
  inside `prepareGhostSurfacePrompt` (it has `context.graph`).
- **(B) Selection at resolve-time.** Pass the prompt into
  `resolve*GhostGenerationContext` and select there. Cleaner data flow but the
  resolve fns currently don't take the prompt, and the broker hasn't run yet.

**Recommendation: (A) but minimal for now.** Since every current fixture is
single-`core`, implement the *seam* (a `selectSurface(graph, prompt)` that returns
a node id, defaulting to `core`) and wire it at prepare-time, but keep the actual
selection logic trivial (return `core` when the menu has one real node; use the
broker/menu match only when there are multiple). This avoids over-building against
fixtures that can't exercise multi-surface, while removing the hardcode and
leaving a real extension point. **Do NOT build a heavyweight LLM surface
classifier now** — wrong cost/benefit until multi-surface fingerprints exist.

Mechanics:
- Add `selectGhostSurface(graph, prompt): string` — returns `core` unless the
  graph has multiple top-level surfaces, in which case match the prompt against
  `buildGraphMenu` descriptions (cheap: keyword/description overlap, or reuse the
  broker's existing goal text if it already ran). Keep it deterministic for v1.
- `prepareGhostSurfacePrompt` re-resolves the slice for the chosen surface when it
  differs from `core`, updates `context.slice`/`context.surface`/`prompt`/`tokenSource`.
- Widen the context `surface` type from the literal `'core'` to `string`.

### 3B. Slice-faithful brief + prompt rendering

Make the brief and the rendered fingerprint reflect the corridor model Ghost
composed, not a flat dump:

- **Provenance ordering** in `renderSlicePrompt`: order nodes own → ancestor →
  edge (matching `gather`'s own markdown formatter), and label each with its
  provenance so the model knows what is the surface's own prose vs inherited vs a
  related-edge contribution. Mirror Ghost's CLI `formatSliceMarkdown` shape.
- **Spokes**: the slice carries `spokes` (id + description pointers the agent may
  pull). For Summon v1 the model can't call back to expand them, so either (a)
  omit spokes entirely, or (b) list them as "related context that exists but is
  not included." Recommendation: **omit for v1** — they are navigability the model
  can't act on in a single generation, and listing them invites hallucinated
  references. Revisit if Summon ever does multi-pass generation.
- **Brief** updates: replace the flat `Gathered fingerprint nodes: a, b, c` line
  with provenance-aware framing ("surface `core`; cascade: core") and keep the
  strong success/composition rules (they're good and survived step 2).

### 3C. CSS duplication (confirm + resolve)

The token CSS currently appears twice in what the model sees: inline in the
fingerprint prose (`renderSlicePrompt` includes the node body verbatim, fenced
css and all) and as the injected `activeTokensCss` stylesheet. Decide:
- **Strip the fenced ```css block from node bodies in `renderSlicePrompt`** (it's
  already extracted to `tokenSource.css`), so the prose carries the *intent* and
  the stylesheet carries the *values* — no duplication, clean separation. The
  prose around the block (the "inject as the visual source of truth" sentence and
  the token roles description) stays.
- This is the cleaner model and saves tokens. Confirm `activeTokensCss` is in fact
  injected as a stylesheet the generated UI references (it was, in step-2 smoke:
  the artifact referenced `--color-bg`).

## Scope boundary (what step 3 is NOT)

- Not the conformance verdict (checks → that's step 5).
- Not deleting legacy `fingerprint/` dirs (step 7).
- Not a heavyweight LLM surface classifier — just the seam + a deterministic default.

## Definition of done

- `surface` is no longer hardcoded `core` in the type or the resolve path; a
  `selectGhostSurface` seam exists and is wired at prepare-time (defaulting to
  `core` for single-surface fixtures).
- `renderSlicePrompt` orders by provenance and labels nodes; the fenced css block
  is stripped from the prose (no duplication with `activeTokensCss`).
- Spokes decision implemented (omit for v1).
- `pnpm typecheck` / `pnpm test` / `pnpm build` / `pnpm check:public-api` green.
- Live smoke: signal-stream still generates clean, artifact references tokens,
  and the system prompt no longer contains the css block twice (grep the captured
  request or add a quick assertion).
- Tests updated for the new brief/prompt shape.

## Open questions to confirm before executing

1. **Surface selection depth:** agree to the minimal deterministic seam (default
   `core`, match-by-menu only when multi-surface), deferring an LLM classifier?
2. **Spokes:** agree to omit from the v1 brief?
3. **CSS duplication:** agree to strip the fenced css from the prose and rely on
   `activeTokensCss` for values + prose for intent?
