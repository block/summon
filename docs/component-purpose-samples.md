# Component Purpose Docs — Samples against ghost-ui

> Drafting purpose docs against the real `ghost-ui` library (~100 items, split
> into `ui/` primitives and `ai-elements/`) to pressure-test the standard from
> [`component-purpose-docs.md`](./component-purpose-docs.md) at scale.

## First finding: it's three tiers, not one set

Writing purposes across the real library surfaces an immediate truth — **not
every item wants a purpose doc, and forcing one on the wrong tier produces
garbage.**

| Tier | Examples | Matchable by *intent*? |
| --- | --- | --- |
| **Primitives** | `button`, `input`, `badge`, `separator`, `skeleton`, `avatar`, `spinner`, `label` | ❌ No — they're vocabulary, not intent. "Use a button" isn't a composition decision. |
| **Composers / patterns** | `card`, `table`, `form`, `sidebar`, `dialog`, `tabs`, `accordion`, `pagination` | ⚠️ Partial — matchable by *arrangement intent*, weakly. |
| **AI-native blocks** | `chain-of-thought`, `plan`, `task`, `tool`, `confirmation`, `reasoning`, `sources`, `terminal`, `web-preview`, `test-results` | ✅ Strongly — each encodes a *specific user moment*. This is where purpose docs earn their keep. |

**Implication for the "is 100 too much?" question:** 100 is too much *to
purpose-doc uniformly*, but it's not the real number. Strip the primitives (they
need API reference, not purpose docs — the agent knows what a button is) and you
have maybe ~40 composers + AI blocks that actually carry intent. The AI-native
set (~30) is the matchable core. **Purpose docs are an AI-elements concern first,
composers second, primitives never.**

---

## Tier 3 — AI-native blocks (the matchable core)

These are where the standard shines: each answers a distinct first-question.

```yaml
# chain-of-thought.purpose.yml
purpose: >
  Reveals an agent's intermediate reasoning steps as a progressive, collapsible
  trail so the user can follow how a conclusion was reached.
roles: [reasoning-trail, step-disclosure]
reach-for-when: >
  The user's first question is "how did it get here?" — the *process* is the
  content, shown as discrete thinking steps that accrue over time.
not-when: >
  You want the final rendered explanation prose, not the steps. Use `reasoning`.
  You want a fixed checklist of work to do. Use `plan` or `task`.
composes-within: conversation (inline within a message)
composes-with: [task, tool, sources]
intent-signals:
  - "show the model's thinking as it works"
  - "step-by-step reasoning trail"
anti-purpose: >
  Not a to-do list and not final-answer prose. It is process disclosure; using it
  for either misrepresents what the user is looking at.
```

```yaml
# reasoning.purpose.yml
purpose: >
  Renders an agent's reasoning as streamed markdown prose, collapsible once the
  answer arrives.
roles: [reasoning-prose, stream-disclosure]
reach-for-when: >
  The user's first question is "what is its reasoning?" delivered as readable
  prose (with code/math/mermaid), not as discrete steps.
not-when: >
  Reasoning is better shown as accruing discrete steps. Use `chain-of-thought`.
composes-within: conversation (inline within a message)
composes-with: [message, sources]
anti-purpose: >
  Not a step tracker or checklist. It is continuous explanatory prose.
```

```yaml
# plan.purpose.yml
purpose: >
  Presents the agent's intended approach as a structured, reviewable set of
  steps before or during execution.
roles: [intended-approach, step-list, primary-action]
reach-for-when: >
  The user's first question is "what is it going to do?" — a forward-looking
  proposal the user may want to review or approve.
not-when: >
  Work is already happening and you're reporting live progress per step. Use
  `task`. You're disclosing reasoning, not a plan. Use `chain-of-thought`.
composes-with: [task, confirmation]
anti-purpose: >
  Not a live execution log and not a reasoning trail. It is a proposed approach.
```

```yaml
# task.purpose.yml
purpose: >
  Tracks discrete units of work and their live status (searching, running, done)
  as the agent executes.
roles: [work-status, progress-disclosure]
reach-for-when: >
  The user's first question is "what's happening right now?" — live progress on
  concrete units of work.
not-when: >
  The steps are a forward proposal not yet started. Use `plan`. The content is
  reasoning rather than work. Use `chain-of-thought`.
composes-with: [plan, tool, terminal]
anti-purpose: >
  Not a proposal and not reasoning. It reports work in flight.
```

```yaml
# tool.purpose.yml
purpose: >
  Shows a single tool/function invocation — its input, status, and output — as a
  legible, inspectable unit.
roles: [tool-invocation, io-disclosure]
reach-for-when: >
  The user's first question is "what did this specific call do?" — one
  invocation's parameters and result.
not-when: >
  You're tracking many units of work as progress. Use `task`. You need explicit
  user approval before a destructive call. Use `confirmation`.
composes-within: conversation OR task
anti-purpose: >
  Not an approval gate and not a multi-step tracker. It is one call's record.
```

```yaml
# confirmation.purpose.yml
purpose: >
  Gates a tool action behind explicit user approval, showing what will happen and
  capturing approve/deny with an optional reason.
roles: [approval-gate, primary-action, decline-action]
reach-for-when: >
  The user's first question is "do I allow this?" — a consequential action needs
  a human decision before it proceeds.
not-when: >
  The action is already complete and you're reporting it. Use `tool`. No decision
  is required. Don't gate.
composes-within: conversation (inline before a tool runs)
anti-purpose: >
  Not a status display. Its reason for existing is the decision; if there is no
  decision to make, it manufactures friction.
```

```yaml
# sources.purpose.yml
purpose: >
  Lists the references an answer drew on so the user can verify provenance.
roles: [provenance, reference-list]
reach-for-when: >
  The user's first question is "where did this come from?" — attribution for a
  generated answer.
not-when: >
  You want citations woven inline into the prose itself. Use `inline-citation`.
composes-within: conversation (beneath a message)
anti-purpose: >
  Not inline attribution and not a generic link list — it is answer provenance.
```

```yaml
# terminal.purpose.yml
purpose: >
  Renders command-line activity — commands, output, exit state — as plausible,
  task-relevant evidence.
roles: [command-evidence, output-disclosure]
reach-for-when: >
  The user's first question is "what ran and what did it print?" — shell/command
  evidence is the proof.
not-when: >
  The evidence is a single typed tool call. Use `tool`. It's a static code sample
  to read, not executed output. Use `code-block`.
composes-with: [task, tool]
anti-purpose: >
  Not decorative chrome and not a code snippet to read — it is execution evidence
  and must contain plausible, relevant content.
```

---

## Tier 2 — Composers (matchable by arrangement, weakly)

These get *lighter* purpose docs. Their `reach-for-when` is about arrangement
intent, and they overlap more, so `not-when` does heavy lifting.

```yaml
# table.purpose.yml
purpose: >
  Presents many records across shared, comparable columns for scanning and
  comparison.
roles: [collection, comparable-fields]
reach-for-when: >
  The user's first question is "how do these many items compare across the same
  attributes?" — homogeneous rows, shared columns.
not-when: >
  Each item needs rich, non-uniform presentation. Use repeated `card`s. There's a
  single subject, not a collection. Use a detail layout.
anti-purpose: >
  Not for a single record's detail view and not for heterogeneous content.
```

```yaml
# card.purpose.yml
purpose: >
  Groups related content and optional actions into one bounded, self-contained
  unit.
roles: [content-group, optional-action]
reach-for-when: >
  The user's first question is "what is this one cohesive thing?" — a bounded unit
  that may repeat in a collection or stand alone.
not-when: >
  Items are homogeneous and better compared in columns. Use `table`. The grouping
  is a full-surface section, not a unit. Use layout regions.
anti-purpose: >
  Not a layout shell for a whole surface and not a row in a comparison set.
```

```yaml
# form.purpose.yml
purpose: >
  Collects structured input from the user with validation and a submit action.
roles: [input-collection, validation, submit-action]
reach-for-when: >
  The user's first question is "what do I need to fill in?" — multiple related
  inputs gathered toward one submission.
not-when: >
  A single input or toggle. Use the primitive directly. A decision gate on an
  agent action. Use `confirmation`.
anti-purpose: >
  Not a settings list of independent toggles and not an approval gate.
```

---

## Tier 1 — Primitives (NO purpose doc)

`button`, `input`, `badge`, `avatar`, `separator`, `skeleton`, `spinner`,
`label`, `checkbox`, `switch`, `slider`, `progress`, `tooltip`, `aspect-ratio`…

These get **API reference only**. Rationale, written once for the whole tier:

> A primitive is shared vocabulary, not an intent. The agent already knows what a
> button is; documenting "reach for a button when the user wants to click
> something" is noise that dilutes the matchable set. Primitives are *used by*
> composers and AI blocks; they are not *selected against* Ghost intent.

If a primitive ever needs intent guidance, that's a signal it's being asked to do
a composer's job — promote the pattern, don't document the primitive.

---

## What the scale test changed in the standard

1. **Purpose docs are tiered, not universal.** Add a precondition: *only blocks
   that encode a user moment or arrangement intent get a purpose doc. Primitives
   get API reference.* This roughly halves the ~100 to a ~40 matchable set, with
   the ~30 AI-native blocks as the core.
2. **The AI-native set is the highest-value, cleanest fit.** Each answers a
   genuinely distinct first-question (`how did it reason` / `what will it do` /
   `what's happening now` / `do I allow this` / `where's this from`). This is the
   strongest evidence the first-question discriminator scales.
3. **Composers need aggressive `not-when` cross-refs.** `card`↔`table`,
   `plan`↔`task`, `chain-of-thought`↔`reasoning`, `tool`↔`confirmation` are all
   nearest-neighbor pairs that only separate on `not-when` + `anti-purpose`.
4. **`roles` are emerging as a small reusable set** across the AI tier
   (`*-disclosure`, `*-action`, `progress`, `provenance`). Worth watching whether
   a natural role lexicon falls out of curation — but as an *observed* property of
   the blocks, not a vocabulary imposed up front.
