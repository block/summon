# Dissolve pattern — reference for authoring a fingerprint's composition grammar

This is the proven pattern (applied first to `editorial-mono`) for shifting a
fingerprint's composition authority from **named page templates** to a
**compositional grammar**. Apply it faithfully but in each fingerprint's OWN
voice — never copy editorial-mono's words, motifs, or tokens.

## The model

A fingerprint's `.ghost/` directory has three tiers:

1. **Principles + grammar** — `index.md`'s `## Composition` section (the `core`
   node). Rules true on EVERY surface.
2. **Building blocks (primitives)** — top-level `*.md` nodes (e.g. `masthead.md`,
   `evidence.md`, `tiles.md`, `controls.md`). The composable parts. These already
   gather into the `core` slice and reach the model — keep them as the vocabulary.
3. **Assemblies (page templates)** — subfolders each containing `index.md` (e.g.
   `brief/`, `comparison/`, `stream/`, `landing/`). These are finished page
   recipes. **We dissolve these.**

## What "dissolve" means (the task)

For the assigned fingerprint:

1. **Read** `index.md` fully (Intent, Signature look & feel, Inventory,
   Composition), every top-level building-block `*.md`, and every assembly
   folder's `index.md`.

2. **Fold the genuine, reusable grammar** from the assembly bodies UP into the
   `## Composition` section of `index.md`, authored as **task-agnostic rules**,
   not task templates. Add a new subsection (after the existing numbered
   principles, before `**Surface obligations**` if present) titled in this
   fingerprint's own voice — editorial-mono used **"Composing a surface from the
   parts."** It must:
   - State that the fingerprint has NO fixed page types; every surface is
     composed for its task from the same building blocks.
   - Name the building-block nodes as the kit, linking them by node id, e.g.
     `[the ticked rail](rail)`, in the natural reading/composition order for this
     language.
   - Preserve the *real design insight* the assemblies carried, but reframed as
     "let the task set the shape" rules. Example from editorial-mono: "when it
     resolves a field of metrics, the verdict is one governing number… never four
     equal KPI cards; when it weighs options, align shared criteria into parallel
     ruled columns…". Salvage the equivalent hard-won specifics from THIS
     fingerprint's assemblies (its anti-patterns, its winner-marking rule, its
     density rules, whatever they encoded) as rules.
   - End with: never collapse to an unframed/generic layout because no familiar
     shape fit — compose a new surface from the same parts under the same rules.

3. **Delete the assembly folders** (the subfolders with `index.md`). Do NOT
   delete a `checks/` folder — that holds `ghost.check` validation nodes
   (frontmatter has `name:` + `severity:`), not assemblies. Leave `checks/`
   untouched. Leave all top-level `*.md` building-block nodes untouched.

## Hard rules

- **Voice fidelity.** Write in this fingerprint's established register (read its
  Intent + Signature). Do not import editorial-mono's vocabulary (no "verdict",
  "ruled paper", "folio", "inverse slab" unless this fingerprint genuinely uses
  them). Reuse the fingerprint's OWN token names and motif language.
- **No new tokens.** Reference only CSS custom properties already defined in this
  fingerprint's Inventory css block.
- **Grammar, not templates.** The folded-up rules must read as composable rules
  ("compose X from Y under rule Z"), never as "here is the page for task T".
- **Keep it tight.** The new subsection should be roughly 8–16 lines of prose,
  comparable to editorial-mono's. Don't bloat `core`.
- Do not touch `index.md`'s other sections (Intent, Signature, Inventory) except
  the `## Composition` addition. Do not touch `manifest.yml` or `bundle.json`.

## Definition of done for your fingerprint

- `index.md` `## Composition` gained a grammar subsection in the fingerprint's own
  voice that names its building blocks and folds in the assemblies' real insight
  as task-agnostic rules.
- All assembly subfolders deleted; `checks/` (if present) and all top-level
  building-block `*.md` files preserved.
- Report back: which assembly folders you deleted, which building blocks you
  referenced, and the exact text of the subsection you added.
