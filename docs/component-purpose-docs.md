# Component Purpose Docs

> The standard for how Summon documents a curated building block so an **agent
> can match Ghost's declared intent to the right block** — without Ghost ever
> naming a component, and without Summon adding any composition opinion.

## Why this exists

Summon curates a small set of building blocks. Ghost authors composition *rules*
(roles and arrangement) that are agnostic of any specific component. The agent
bridges the two: it reads Ghost's intent, reasons over Summon's blocks, and picks
or composes the ones that *express* that intent.

That bridge is only as good as the documentation it reasons over. A purpose doc
exists to answer exactly one question:

> **Does this block express the intent Ghost just declared?**

Every field serves that question. A purpose doc describes the **user situation a
block resolves**, never the thing the block *is*. Appearance, props, tokens, and
Arrow code live in the component's implementation + API reference — a separate
artifact. The purpose doc is the *matchable* asset and is medium-agnostic: the
same doc could front an Arrow block today and a SwiftUI view later.

## Layer boundaries this preserves

| Question | Owner | Medium |
| --- | --- | --- |
| *Which* pattern, *when*, *why* — composition rules as roles + arrangement | **Ghost** | agnostic |
| *What blocks exist and what user purpose each serves* | **Summon** | curated set |
| *How* to realize a named role in this runtime (Arrow) | **Summon** (implementation) | Arrow-specific |
| Matching declared intent to blocks | **Agent** | — |

Summon stores and documents blocks; it never decides the shape of a surface.
Ghost supplies intent; the agent selects. This keeps the prompt-architecture rule
intact: **Summon adds no composition guidance.** It offers capability ("here are
building blocks and what they're for"); Ghost owns intent; the agent reasons.

The blocks meet Ghost's composition rules through the agent's **reasoning over
documented purpose** — not through a shared registry, enum, or fixed vocabulary.

## The fields

### `purpose` (required)
One sentence. The user need or moment this block exists for, framed as the
problem — not the widget.

- ✅ "Anchors a surface to a single subject so everything below reads as being
  about that subject."
- ❌ "A card with an avatar, name, and metadata rows." (appearance)

Primary match target.

### `reach-for-when` (required) — phrase as the user's first question
The discriminator that actually does the work. Frame it as **the user's first
question**, not the situation — situation framing lets overlapping blocks both
claim a match; question framing forces the split.

- ✅ "The user's first question is *who/what is this?* Identity is the
  organizing fact."
- ⚠️ Weaker: "The surface is about one subject." (two blocks can both claim this)

### `not-when` (required) — name your nearest rival
When *not* to use it, pointing at the block to use instead **by name**. This
cross-reference is what makes a curated set navigable: each block knows its
nearest neighbor and hands off.

- "The user's first question is *what's happening / what do I do?* — then the
  subject is context, not the anchor. Use `status-brief`."

### `roles` (required) — medium-agnostic slots it fills
The named slots the block provides, named abstractly so Ghost's role-language
intent can map on without naming the component. Declared *by* Summon as a
property of the block; Ghost independently describes intent in role-language;
they meet through the agent, not a shared list.

- `roles: [identity-anchor, supporting-metadata, primary-action]`

Necessary but **not sufficient**: overlapping blocks share roles. Roles nominate
candidates; they do not pick.

### `composes-within` / `composes-with` (recommended)
How the block sits relative to others, so the agent can assemble rather than pick
singletons.

- `composes-within: detail-surface (leading region)`
- `composes-with: [metadata-group, action-bar, evidence-panel]`

### `intent-signals` (recommended) — the discovery handle
A few example request framings or Ghost-intent phrasings the block answers. The
agent's retrieval surface for "discover as needed." These are *signals* for fuzzy
matching, never keys for lookup.

```yaml
intent-signals:
  - "header for a detail view of one record"
  - "lead with who/what this is about"
```

### `variants-of-intent` (optional) — never variants of appearance
If the same block serves meaningfully different *intents* by configuration,
document the intent difference, not the prop.

- ✅ "with-action: reads as an actionable subject / read-only: a static identity
  statement."
- ❌ "set `showActions={true}`."

### `anti-purpose` (required) — the misuse net
What the block must not be conscripted into. Stops the agent stretching a block to
fit because nothing better was found, and catches the hard case where surface
association misleads (e.g. "order → status").

- "Not for representing a moment in time or a decision. It frames an entity, not
  an event or a recommendation."

## What is deliberately absent

No props, no styling, no token references, no Arrow code. Those are the
implementation + API reference. The purpose doc stays medium-agnostic at the
matching layer; the implementation beneath it is swappable.

## How a match runs

1. Ghost declares composition intent in role/arrangement language (agnostic).
2. Agent retrieves candidates by `intent-signals` + `purpose`.
3. Agent discriminates with `reach-for-when` (first-question) / `not-when` /
   `anti-purpose`.
4. Agent assembles using `roles` + `composes-with`.
5. Agent picks the implementation (Arrow) and authors it.

Ghost never named a component. Summon never decided the shape. The agent bridged
via documented purpose.

## Curation rules

These were validated by running two deliberately overlapping blocks against
ambiguous intents:

1. **`roles`, `composes-with`, and `intent-signals` nominate; they do not pick.**
   On overlapping blocks they match both candidates. Expect this.
2. **`reach-for-when` framed as the user's first question is the real
   discriminator.** "Who/what is this?" vs "what's happening / what do I do?" is a
   clean axis that survives adversarial intents.
3. **`anti-purpose` is the safety net for the hard case.** When surface
   association misleads ("order" pulling toward status when no verdict exists),
   `anti-purpose` forces the correct call.
4. **`not-when` must name its nearest rival.** The cross-reference makes the
   curated set navigable and gives each block a hand-off.
5. **Distinctness lives in the first-question.** Two blocks may share every
   `role` and `composes-with` entry and still be distinct — *as long as their
   `reach-for-when` answers a different first-question.* If they answer the same
   first-question, they are one block with a config, not two components.

> A component earns its place when its purpose is **distinguishable** from every
> other block's, and the doc proves that distinction through `reach-for-when` /
> `not-when` / `anti-purpose`.

## Example

```yaml
# subject-anchor.purpose.yml  (name describes intent, not appearance)
purpose: >
  Anchors a surface to a single subject (person, entity, record) so everything
  below reads as being about that subject.
roles: [identity-anchor, supporting-metadata, primary-action]

reach-for-when: >
  The user's first question is "who/what is this?" Identity is the organizing
  fact; state is secondary.
not-when: >
  The user's first question is "what's happening / what do I do?" — then the
  subject is context, not the anchor. Use status-brief.

composes-within: detail-surface (leading region)
composes-with: [metadata-group, action-bar, evidence-panel]

intent-signals:
  - "header for a detail view of one record"
  - "lead with who/what this is about"
  - "identity summary at the top"

variants-of-intent:
  - with-action: reads as an actionable subject
  - read-only: a static identity statement

anti-purpose: >
  Not for representing a moment in time or a decision. It frames an entity, not
  an event or a recommendation.
```

(`subject-anchor` is a stand-in to show the *shape* of the doc, not a prescribed
block.)
