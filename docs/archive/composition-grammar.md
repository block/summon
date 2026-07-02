# Composition as grammar, not a template menu

> The single reframe that de-genericizes generation: a fingerprint's composition
> authority is a **grammar** — principles, primitives, and constraints the model
> *composes from* for the task at hand — not a **catalog of finished page types**
> the model *picks from*. This document argues the reframe, shows it is already
> latent in the Ghost graph, and specifies the adapter change that realizes it.

## The problem

Generated surfaces look structurally generic — a header plus a card grid dressed
in the fingerprint's colors — irrespective of the prompt. The visual identity
(ink, hairlines, cream paper, token vocabulary) lands; the *composition* does
not. Because the genericity is invariant across prompts, it is structural, not a
content gap.

### Root cause: composition is encoded as a closed catalog of finished layouts

The only place a fingerprint states *how to lay out a surface* is inside its
**archetype nodes** (`brief`, `comparison`, `report` for editorial-mono;
`stream`, `digest`, `briefing` for signal-stream; …). These are not composition
*guidance* — they are finished templates for pre-imagined page types, written in
the imperative:

> "Lead with the masthead frame — set the verdict headline in serif display at
> the largest scale, give it tight `--leading-display`, open with an
> `--editorial-dropcap` initial, close the masthead with the
> `--editorial-rule-heavy` rule, the body sits on a faint ruled paper grid…"

That is a recipe for one specific surface. So `buildCompositionRepertoireBlock`
in `ghost-adapter.ts` reduces "help the model compose" to **"pick the closest
pre-baked template and reproduce it."** This has two failure modes, both
generic-feeling:

1. **Request maps cleanly to an archetype** → the model faithfully reproduces
   someone's imagined "decision brief" layout whether or not the task wanted it.
   Feels canned.
2. **Request does not map** (the common case) → semantic selection falls back to
   the `core` anchor, whose slice contains **no archetype body at all** (verified
   across all in-repo fingerprints) → the model is left with abstract principles
   and defaults to its prior: header + card grid. Feels generic.

Either way structure comes from a closed menu, not from the task.

### Why it ended up this way

Two upstream decisions compose into template-matching:

1. **Summon deliberately vacated composition authority.**
   `docs/prompt-architecture.md`: *"Ghost is the sole composition authority… no
   composition floor in Summon, not even a fallback."* So 100% of compositional
   burden rides on whatever the anchored fingerprint node happens to say.
2. **Ghost represents design knowledge as a directory of named surface nodes**
   (`docs/integration-with-ghost.md`: "the directory tree *is* the graph"). A
   design author naturally documents *"here are the page types we support."* So
   the unit of design knowledge handed to Summon is *a named page template*, and
   the adapter's only lever is *which* one to paste.

Chained together, "composition" *necessarily* becomes template selection. There
is no representation of **primitives + constraints + principles → derive layout
for this task** — which is what design competence actually is.

## The reframe

Encode composition the way a capable designer actually holds it:

- **Primitives** — the reusable parts the language is built from (a masthead, an
  evidence band, a metadata folio, an inverse verdict slab). Composable, not a
  page.
- **Principles** — the rules true on *every* surface (verdict leads; criteria
  align; monochrome restraint; density before decoration) and the hard
  anti-patterns (no second accent, no rounded card, no drop shadow).
- **Assemblies** — worked examples showing the primitives composed for a known
  task, explicitly labeled *illustrative*, not a menu to choose from.

The model then **composes the surface for the actual task** from primitives under
principles, using assemblies as reference for *how this language tends to combine
parts* — never as a template to reproduce. Genericity dies because structure is
now derived from the task, not selected from a bin.

## This is already latent in the graph

The three tiers map one-to-one onto structure the fingerprints *already* carry —
no re-authoring of design intent required, only a change in how the adapter
frames and orders it:

| Grammar tier | Ghost node signature | editorial-mono | signal-stream |
| --- | --- | --- | --- |
| **Principles** | `id === 'core'` | `core` (`## Composition`: 4 principles + surface obligations) | `core` |
| **Primitives** | `folder === ''` (part node, not a surface folder) | `masthead`, `evidence`, `metadata`, `inverse-panel`, `close` | `canvas`, `controls`, `tiles`, `type-system` |
| **Assemblies** | `folder === id` (a surface folder) | `brief`, `comparison`, `report` | `briefing`, `digest`, `stream` |

The primitives are **already in the `core` slice** (they gather as `own` nodes);
the adapter simply presents them as flat prose rather than as a *parts kit*. The
`core` `## Composition` prose is **already** solid general guidance; the adapter
buries it beneath "here's the menu, lead with this one." So the reframe is
largely a **framing + ordering** change in one function, not a data migration.

## Target brief assembly (composition section)

Replace the "composition repertoire = pick a template" block with a
grammar-ordered block:

1. **Principles first (authority).** Lead the composition guidance with the
   `core` `## Composition` prose and its anti-pattern lines, framed as the
   binding rules for *every* surface. This is the general guidance that must
   dominate.
2. **Primitives as a parts kit (composable vocabulary).** List the primitive
   nodes with their composition bodies as *reusable parts* — "these are the parts
   this language is built from; compose the surface the task needs from them,"
   not "here is a page."
3. **Assemblies as illustrative examples (explicitly not a menu).** Offer the
   archetype nodes as worked examples — "here is how this language has combined
   those parts before, for reference" — with language that forbids treating them
   as a fixed template set and forbids collapsing to a generic layout when none
   matches.
4. **Task-derivation instruction (the anti-generic scaffold).** One design-*
   neutral* line: *derive the surface structure from the user's task and the
   fingerprint's primitives; do not default to a header + card grid.* This is not
   a design opinion — it is a reasoning scaffold that breaks the landing-page
   prior. (See the caveat to `prompt-architecture.md`'s "no floor" below.)

The semantic `selectGhostSurface` step stops being *"which template do we
reproduce"* and becomes *"which assembly is the most relevant reference"* — a
soft hint, never a gate. Falling back to `core` is then no longer a
composition-loss event, because principles + primitives (both in the `core`
slice) already carry the grammar.

## Consequences for `prompt-architecture.md`

The "no composition floor in Summon — not even a fallback" rule was written
against *design opinion* leaking into Summon, and that ban should stand: Summon
must not carry archetypes, density rules, or motif language. But a **task-\
derivation scaffold** ("derive structure from the task and the fingerprint's
primitives; don't default to a card grid") is *design-neutral*: it carries no
opinion about how any surface should look, only about *reasoning from the
fingerprint instead of from a prior*. That is a Summon-layer reasoning boundary,
not a Ghost-layer design floor. Recommend amending the doc to distinguish
"design floor" (still banned) from "composition-reasoning scaffold" (allowed,
design-neutral).

## Consequences for Ghost authoring

The reframe rewards fingerprints authored as **grammar**:

- Primitives should read as *parts* ("an evidence band is…", "compose several
  into the body grid") rather than as *page fragments*.
- Assemblies should be explicitly framed as *examples of the grammar*, not the
  authoritative surface set — ideally with a one-line "reach when" plus a pointer
  to the primitives they combine, rather than a full imperative recipe.
- A fingerprint with strong principles + primitives and few/no assemblies should
  now generate *better*, not worse — the opposite of today, where a fingerprint
  without a matching archetype collapses to generic.

This is a stronger positioning claim than "Ghost is the composition authority":
**Ghost is the compositional grammar, and generation is composition, not
template retrieval.**

## Migration (small, independently shippable)

1. **Reframe `buildCompositionRepertoireBlock`** into a grammar block: principles
   → primitives-as-parts → assemblies-as-examples → task-derivation line. Stop
   truncating primitives; stop presenting assemblies as a selectable menu. Keep
   the semantic anchor only as "most relevant reference example."
2. **Amend `prompt-architecture.md`** to split "design floor" (banned) from
   "composition-reasoning scaffold" (allowed).
3. **Eval:** generate the same prompt across fingerprints and across
   task-shapes; confirm structure now varies with task and stays distinct across
   fingerprints (the two things template-matching currently fails).
4. **(Ghost side, later)** re-author assemblies as grammar examples that point at
   primitives, once the reframe proves out.
