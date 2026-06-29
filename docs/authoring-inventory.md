---
authority: ghost
status: guidance
---

# Authoring Inventory

How Ghost prefers a fingerprint author to document building blocks so an agent
can translate the fingerprint's intent into concrete materials.

This is opinionated method, not enforced schema. It is prescriptive about *how*
to document a block; it is agnostic about *what* blocks exist, which medium they
target, or how many there are. Nothing here adds a layer — inventory is already a
Ghost principle (`inventory.yml`: "source material, exemplars, tokens, libraries,
building blocks"). This is just guidance for authoring that slot well.

## Where it sits

The fingerprint declares intent in agnostic terms. Inventory — written
optionally, by the fingerprint author — grounds that intent in concrete
materials. A realizing surface (e.g. Summon, which emits Arrow) *reads* the
inventory; the fingerprint never references the surface. Strip all inventory and
the fingerprint is still valid and still portable; it just gives the model less
to draw on. The agent does the matching.

## Inventory richness is the portability dial

This trade belongs to the author:

- **Abstract inventory** (principles, arrangement, no concrete components) →
  maximally portable. The same fingerprint composes onto web, Arrow, iOS,
  Android.
- **Concrete inventory** (named building blocks, possibly medium-specific) →
  strongly grounded, less portable.

Neither is correct. A medium-specific inventory is not a leak — it is a
deliberate trade, and it does not contaminate the fingerprint, which still does
not *depend* on it.

## Tier first: not everything gets documented

- **Primitives** (button, input, badge, avatar, spinner, separator, skeleton…)
  get **no purpose doc**. They are shared vocabulary, not intent — the agent
  already knows what a button is. API reference only.
- **Everything that encodes a user moment** (confirmation, plan, task, tool,
  reasoning, sources, terminal…) gets **one short prose block**. This is the part
  the method is for.
- The **composer middle** (card, table, form, sidebar…) is a judgment call, not a
  third category. Document it if its arrangement carries intent worth matching;
  lean on "not when" to separate it from neighbors.

If a primitive ever seems to need intent guidance, that's a signal it is doing a
composer's job — promote the pattern, don't document the primitive.

## The shape of a block doc

A markdown file. Frontmatter carries only what must be addressable; the body is
prose the agent reasons over.

**Frontmatter:** `name`, and `see-also` (the nearest rivals, as links). That's it.
A block with no body is a primitive — the absence of prose is the signal; no
`tier` field is needed.

**Body:** one short paragraph in a consistent rhythm — *for / reach when / not
when (use X instead) / never*:

- **for** — the user need or moment it exists for, as the problem, not the widget.
- **reach when** — phrased as the user's *first question* ("who/what is this?"
  vs "what's happening / what do I do?"). This framing is what forces a clean
  pick between overlapping blocks; situation-framing lets both claim a match.
- **not when** — and name the block to use instead. This cross-reference makes
  the set navigable.
- **never** — what it must not be conscripted into, so the agent doesn't stretch
  it to fit, and so misleading associations (an "order" pulling toward status
  when there's no verdict) get caught.

Keep appearance, props, tokens, and code out — those are API reference. The prose
stays medium-agnostic; the implementation beneath it is swappable.

## How a match runs

The agent reads the fingerprint's intent, retrieves candidate blocks by their
prose, separates near-neighbors on *not when* and *never*, and assembles. The
realizing surface authors the chosen blocks in its medium. The fingerprint never
named a component; the surface never decided the shape; the agent bridged via
documented purpose.

## Curation rule

A block earns its place when its purpose is **distinguishable** from every
other's. Two blocks may overlap heavily and still be distinct *as long as their
"reach when" answers a different first-question*. If they answer the same
first-question, they are one block with a config, not two.

## Worked example: ghost-ui

`ghost-ui` (React, ~100 items) is the concrete, less-portable, more-grounded end
of the dial. Most of its primitives get no doc. A few of its user-moment blocks,
written in the rhythm:

```markdown
---
name: confirmation
see-also: [tool, plan]
---
Gates a tool action behind explicit user approval. Reach for it when the user's
first question is "do I allow this?" — a consequential action needs a human
decision before it runs. Not when the action is already complete (that's `tool`)
or when no decision is required. It is never a status display; with no decision
to make, it only manufactures friction.
```

```markdown
---
name: chain-of-thought
see-also: [reasoning, task]
---
Reveals an agent's intermediate reasoning as a progressive, collapsible trail.
Reach for it when the user's first question is "how did it get here?" — the
process is the content. Not when you want final explanation prose (that's
`reasoning`) or a checklist of work (that's `plan` or `task`). It is never a
to-do list or a final answer; it is process disclosure.
```

```markdown
---
name: task
see-also: [plan, chain-of-thought]
---
Tracks discrete units of work and their live status as the agent executes. Reach
for it when the user's first question is "what's happening right now?" Not when
the steps are a forward proposal not yet started (that's `plan`) or the content
is reasoning rather than work (that's `chain-of-thought`). It never reports a
proposal or a rationale — only work in flight.
```

```markdown
---
name: table
see-also: [card]
---
Presents many records across shared, comparable columns. Reach for it when the
user's first question is "how do these compare across the same attributes?" Not
when each item needs rich, non-uniform presentation (use repeated `card`s) or
there is a single subject rather than a collection. It is never a single
record's detail view.
```

```markdown
---
name: button
---
```

(A primitive: frontmatter only, no body. The agent already knows it.)

## A note on reuse vs. free-compose

A realizing surface may be a different medium than the inventory — ghost-ui is
React; Summon emits Arrow. So do not pin inventory by prop or markup shape.
Document the *purpose* and any *guarantees* a block must hold (e.g. an action
routes through a declared tool, a control is keyboard-reachable). Let the surface
author the form. Pinning prop APIs re-imports medium-specific opinion and creates
a mirror to maintain.
