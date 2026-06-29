# Prompt Architecture

> How Summon composes the model's system prompt. This is the contract that
> governs the **compose** moment of fingerprint-as-authority. The inventory of
> what exists today lives in [`prompt-map.md`](./prompt-map.md); this document
> defines the *target* architecture and the migration to it.

## The core rule: three authorities, one boundary each

Every line we send the model belongs to exactly one of three authorities. The
current sprawl exists because blocks were organized by accident of history, not
by ownership — and `fixed` in particular is stealing the Ghost layer's job.

| Layer | Authority over | Must NOT contain | Stability |
| --- | --- | --- | --- |
| **Summon** | Runtime mechanics, sandbox safety, output shape | Any design, composition, or editorial direction | Stable across all runs (cacheable) |
| **Ghost** | All design: composition, hierarchy, density, tone, motif, editorial | Runtime mechanics or host capability | Per-fingerprint (cacheable per fingerprint) |
| **Host** | Capability (what the surface may do) + optional structure | Design opinions or runtime mechanics | Per-run |

> **Naming.** The design layer is **Ghost**. (A fingerprint is just the concrete
> file a Ghost run reads; we say "Ghost" for the layer everywhere.)

The single most important consequence: **Ghost is the sole composition
authority.** Summon never tells the model what *shape* a UI should take; it only
tells it how to author a valid, safe surface. The host may *constrain* structure
(via layout) but does not *design* it.

## What each layer owns

### Summon layer — "how to author a valid, safe surface"
The runtime contract. Design-agnostic, identical for every fingerprint. Summon
is a delivery and generation mechanism; it has **no opinion about design**.

- Output shape: `summon.arrow-bundle/v1`, one entry file, optional `main.css`.
- Arrow authoring rules: imports, `reactive()`, event/attribute bindings.
- The sandbox subset / quirks (`arrow-subset.ts`): no IDL bindings, controlled-
  input rewrites, no open-tag `${}`, etc.
- Safety floor: no `window`/`document`/storage/external URLs/scripts.
- Token *policy* (not token values): "Summon owns no token names; use what the
  design source lists." This is a boundary statement, not design — it stays.
- **No composition guidance whatsoever.** No archetypes, no anti-patterns, no
  outer-shell floor, no card-grid ban, no editorial/density rules. Not one line
  about *shape*. Composition is Ghost's job, fully. If a fingerprint is silent
  on composition, the output is mechanically valid but unstructured — and that
  is correct: it is an honest signal that the fingerprint is incomplete, not a
  gap for Summon to paper over.

### Ghost layer — "what this surface should be and look like"
The design authority, resolved from the fingerprint. Speaks in two blocks:

- **Surface brief** (`ghost`) — *this run's framing*: the user request, the
  resolved surface plan, and the success criteria ("a valid but generic surface
  is a failed generation"). Per-run. Does **not** restate composition rules.
- **Ingestion contract** (`ghost:contract`) — *the fingerprint's memory*: prose
  anchors, composition anchors, inventory, checks, token vocabulary. This is the
  one and only place composition direction lives.

All structural archetypes, anti-pattern guidance, density, editorial tone, and
item-count opinions move here from `fixed`.

### Host layer — "what this surface may do, and optionally its skeleton"
- **Surface contract** (`surface-contract`) — the compiled `SurfacePolicy`:
  granted tools, plan, authority. The governance spine. Already clean.
- **Tools** (`tools`) — the behavioral contract: every interactive element wired
  to a declared tool. Bridge mechanics are Summon's; *which* tools exist is the
  host's.
- **Layout** (`layout`, optional) — host-supplied named slots. The host's only
  channel for constraining structure. Legitimate precisely because Summon no
  longer competes for it.

## Target block assembly

Same ordering, cleaned ownership. `direction` is removed; each block does one
job for one authority.

| # | Block | Layer | Job |
| --- | --- | --- | --- |
| 1 | `summon:runtime` (was `fixed`) | Summon | author valid safe Arrow; zero composition guidance |
| 2 | `ghost:contract` | Ghost | the fingerprint's design authority (composition lives here) |
| 3 | `ghost:brief` | Ghost | this run's task + success criteria |
| 4 | `layout` (optional) | Host | named structural slots |
| 5 | `surface-contract` | Host | capability boundary (policy/plan/authority) |
| 6 | `tools` (interactive) | Host + Summon | tool list (host) + bridge mechanics (Summon) |
| 7 | `summon:output` (was `output-contract`) | Summon | tight recency anchor: output shape + top "never" rules |

Removed: `direction` (dead code). Demoted: `playground` (dev-only, not part of
the governed path; gated, not in the default assembly narrative).

## Design rules for adding/changing prompt text

1. **Ownership test.** Before adding a line, name its layer. If it's design →
   Ghost. If it's "how to author/stay safe" → Summon. If it's "what's allowed" →
   Host. A line that wants to be two layers is two lines in two blocks.
2. **Zero design in Summon.** Summon is a delivery and generation mechanism with
   no opinion about design. No composition, shape, archetype, anti-pattern, or
   editorial line may live in a Summon-layer block — not even a fallback floor.
   We fully trust Ghost; the burden of excellent composition is Ghost's alone.
3. **Single source of truth.** Cross-cutting rules (e.g. the Arrow subset) live in
   one module (`arrow-subset.ts`) and are referenced, never copy-pasted, so
   prompt/repair/validation cannot drift.
4. **Recency anchors restate, they don't re-teach.** `summon:output` may repeat
   the few highest-value rules for recency; it must not duplicate whole rule
   lists.
5. **Cacheability follows stability.** Summon blocks cache long-lived; Ghost
   blocks cache per-fingerprint; host blocks are per-run. Ownership and cache
   boundaries should align.

## No fallback. Ghost just has to.

There is no composition floor in Summon. A thin or composition-silent fingerprint
produces mechanically valid but visually unstructured output, and Summon does
**not** rescue it.

This is deliberate:

- Summon is a delivery and generation mechanism. It is not opinionated about
  design, by construction.
- A floor would make Summon a secondary composition authority, contradicting the
  positioning thesis that Ghost is *the* authority for how interfaces compose.
- Unstructured output from a thin fingerprint is the correct, honest signal: the
  fingerprint is incomplete. Masking it would hide the exact thing the governance
  model exists to surface.
- Therefore the burden of excellent composition rests entirely on Ghost. The fix
  for a generic surface is always to enrich the fingerprint — never to re-grow
  Summon's design opinions.

## Migration plan (surgical, independently committable)

Each step builds + tests + commits on its own. No big-bang rewrite.

### Done

1. ✅ **Nuke `direction`.** Removed the dead legacy block, `buildDirectionBlock`,
   `directions-loader.ts`, `eval-directions.ts`, and the `direction` field.
   (`validateDirection` survived — it backs token validation.) — `71cc6ea`
2. ✅ **Strip ALL composition + editorial from `summon:runtime`.** Archetypes,
   anti-card-grid, content-quality, and the visual composition floor are gone
   from every Summon-layer block. Ghost is now the sole composition authority.
   No fallback floor. — `5916e83`

### Blocked on the Ghost rearchitecture (do NOT touch yet)

Ghost is mid-rearchitecture (now a node-graph of prose, not YAML files). The
integration plan lives in [`integration-with-ghost.md`](./integration-with-ghost.md).
These prompt-layer items are subsumed by it:

- **De-overlap `ghost:brief` vs `ghost:contract`.** Resolved by the new model:
  there is no `composition.yml` to overlap with. The brief becomes "frame the
  task + name the surface"; the contract *is* the `resolveGraphSlice` output.
- **Rehome the deleted composition wisdom into Ghost.** It becomes prose in the
  node graph (core/surface nodes), authored via the composition lens — a
  Ghost-side authoring concern, not Summon's.

> **Integration note for the Ghost rearchitecture:** the Summon layer has *fully
> vacated* composition. New Ghost cannot assume Summon supplies any structural
> scaffolding or floor — it must carry all of it. Watch this seam when Ghost
> lands.

### Active track (Summon + Host only — safe now, no Ghost dependency)

A. **Slim `summon:output`.** Convert the structured output-contract blocks from
   full rule restatement to a deliberate recency anchor (output shape + top
   "never" rules). Pure Summon layer.
B. **Route `repairPrompt`'s hardcoded open-tag reminder through the shared hint
   table** (drift fix noted in `prompt-map.md`). Pure repair/engine plumbing.
C. **Gate/flag `playground`** as non-core; keep it but out of the governed path
   narrative.
D. **Regenerate `prompt-map.md`** to match post-step-1/2 reality; mark Ghost
   sections as pending rearchitecture.

## Definition of done

- Every system block maps to exactly one layer in the table above.
- `prompt-map.md` regenerated to match.
- No composition/design language in any Summon-layer block. None. Not even a
  fallback floor.
- Full suite green; a generate-page spot check confirms no quality regression on
  the interactive prompts.
