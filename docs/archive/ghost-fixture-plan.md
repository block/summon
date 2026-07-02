# Plan: re-author Summon's fingerprint bundles as Ghost node-graph fixtures

> Head-start work item (decision #3 in `integration-with-ghost.md`): re-author
> the existing 7 bundles' design intent as fresh node-graph fixtures, rather than
> running `ghost migrate` on the legacy YAML. Pure markdown authoring — no Summon
> code changes, no published Ghost package required. Validated against the local
> Ghost CLI (`/Users/nahiyan/Development/ghost`).

## Why this first

The adapter rewrite, brief rendering, and token extraction all need a real
`.ghost/` node graph to run against. Fixtures are the foundation; nothing
downstream is testable without them. Authoring also dogfoods the node model, which
sharpens the adapter design. And the on-disk `.ghost/` format is more stable than
Ghost's JS exports, so this work survives API churn.

## The target shape (verified against Ghost source)

From the Ghost `init` template + skill bundle (`ghost.fingerprint-package/v1`):

```text
.ghost/
  manifest.yml          # schema: ghost.fingerprint-package/v1 + id
  index.md              # the implicit `core` node — true everywhere
  <surface>/index.md    # a surface's own prose (directory = surface)
  <surface>/<node>.md   # a node placed under that surface
  checks/*.md           # optional ghost.check/v1 checks
```

- **Node** = markdown: frontmatter (`description`, `relates?`, `incarnation?`) +
  a prose body written through the **intent / inventory / composition** lenses
  (lenses, not fields).
- **Identity is the path**, **parent is the directory**. No id/parent fields.
- **`description`** is the retrieval payload (the menu line `gather` matches on).
- **`relates`** = lateral links (`reinforces` / `contrasts` / `variant`, or untyped).
- **essence** = untagged (cascades to all incarnations). Summon is essence-only
  for v1 → **author all fixture nodes as essence; no `incarnation` tags.**

## What maps from the old bundle → new node graph

Each legacy bundle has: `bundle.json`, `fingerprint/{prose,inventory,composition}.yml`,
`fingerprint/enforcement/checks.yml`, `fingerprint/memory/intent.md`, `tokens.css`,
`examples/`, `sources/curation/`. The new mapping:

| Legacy source | New node-graph home |
| --- | --- |
| `prose.yml` (intent, principles, anti-goals, contracts) | prose in `index.md` body (intent + composition lenses) |
| `composition.yml` (patterns, anti-patterns) | prose in `index.md` (composition lens); split per-surface nodes if a pattern is surface-specific |
| `inventory.yml` (materials, sources) | prose in `index.md` (inventory lens) |
| `tokens.css` | a **fenced ```css block** inside the relevant node body (see token strategy below) |
| `enforcement/checks.yml` (regex checks) | `checks/*.md` — `ghost.check/v1` markdown, agent-evaluated |
| `memory/intent.md` | folds into `index.md` intent prose |
| `examples/`, `sources/curation/` | **dropped** — provenance/PNGs are not part of the node model; Summon never consumed them at runtime |

Most bundles are single-surface (target path `.`), so the first cut is often just
a rich `core` `index.md` + a `checks/` dir. Multi-pattern bundles can split into
surface nodes if a pattern is genuinely surface-scoped (e.g. a feed bundle with a
distinct `digest` surface).

## Token strategy in fixtures (decision #1: CSS on any corridor node)

The legacy `tokens.css` becomes a fenced ```css block inside a node body. Summon
will extract fenced css from **every** node in the gathered slice and merge in
corridor/provenance order. For a single-surface bundle, put the css block in
`index.md` (the `core` node). Author the prose around it as the visual-intent
lens, with the literal token values in the fence for deterministic injection.

Example node body:

````markdown
---
description: The product-wide root; true everywhere.
---

Calm, high-contrast editorial voice... (intent prose)

Composition: one dominant lead, dense latest-rail, flat graphic depth... (composition prose)

```css
:root {
  --color-bg: #0a0a0a;
  --color-accent: #e10600;
  --space: 8px;
}
```
````

## Checks strategy (ghost.check/v1)

The legacy regex `checks.yml` (e.g. `forbidden-source-brand`, flat-shadow checks)
becomes `checks/*.md`, one file per check:

```markdown
---
name: no-source-brand-leakage
description: Generated surfaces must not reuse any real publisher brand identity.
severity: high
surface: core
---

Reject any real publisher brand name, wordmark, masthead, real author byline, or
verbatim source headline. The fingerprint informs composition only; identity must
be fictional or user-supplied.
```

Severity vocabulary is `high | medium | low`. `surface:` routes the check (absent
⇒ `core`, applies everywhere). These are **agent-evaluated prose**, not regex —
they become the input to Summon's Tier 1A conformance verdict.

## Where the fixtures live

`apps/server/fingerprints/bundles/<id>/.ghost/` — i.e. each bundle gains a
canonical `.ghost/` package alongside (eventually replacing) its legacy
`fingerprint/` dir. Keeping them under the existing bundle dirs means
`catalog.json` + `fingerprint-catalog.ts` can point at the `.ghost/` package once
the adapter is rewired, and the legacy `fingerprint/` + `tokens.css` get deleted
in migration step 7.

## Execution sequence

1. **Proving exercise — author `signal-stream/.ghost/`** end to end:
   `manifest.yml`, `index.md` (intent+inventory+composition prose + fenced css
   from `tokens.css`), and `checks/` from `enforcement/checks.yml`.
2. **Validate against the local Ghost CLI** — from the bundle dir:
   `ghost validate` (graph shape, links resolve, acyclic),
   `ghost gather` (menu lists the nodes),
   `ghost gather core` (the slice composes; css + prose present),
   `ghost checks --surface core` (checks route).
   Iterate until clean. This locks the authoring shape.
3. **Template the other six** (`console-chrome-2001`, `editorial-mono`,
   `garden-notes`, `technical-contrast`, `technical-noir`, `redline-cinema`)
   from the proven pattern, validating each.
4. **Decide multi-surface splits** per bundle — most stay single `core`; split
   only where a legacy `composition.yml` pattern is genuinely surface-scoped.

## Out of scope (deliberately)

- No Summon code changes. Fixtures only. The adapter rewrite is migration steps
  2-7, gated on Ghost publishing.
- No `examples/` PNGs or `sources/curation/` notes — not part of the node model.
- No `incarnation` tags — essence-only for v1.
- Not deleting the legacy `fingerprint/` dirs yet — that is migration step 7,
  after the adapter consumes `.ghost/`. Fixtures sit alongside until then.

## Open authoring questions

- **One `core` node vs. split surfaces:** start single-`core` per bundle; revisit
  if a bundle's patterns are clearly multi-surface. (Keeps the first cut simple.)
- **Check granularity:** one `.md` per legacy check rule, or consolidate? Lean
  one-per-rule for clean routing + verdict attribution.
- **Does the local Ghost CLI build run cleanly?** Confirm `pnpm build` in the
  Ghost repo so `ghost` is runnable for validation before we start authoring.
