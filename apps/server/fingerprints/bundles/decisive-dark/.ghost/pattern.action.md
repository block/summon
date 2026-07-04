---
description: The pill action stack — 1–3 verb-first follow-ups as neutral `--dd-pill` pills at `--dd-pill-height`, left-aligned and stacked at `--dd-stack-gap`, accent only on the one primary action. Reach for how the surface guides the next move without competing CTAs.
---

## Composition

The action block guides the next step and closes the surface. It carries one to three
follow-up actions, never a wall of choices, and never two equal-weight buttons
fighting to be primary. Actions are verb-first and declarative — *Pay*, *Send*, *Move
$100 to savings*, *Set a weekly limit* — the verb does the work and the noun is
implied by context. There is no terminating period.

**Neutral pill stack.** Render each action as a `--dd-pill` pill on
`--color-surface-muted`, at `--dd-pill-height` with `--dd-pill-pad` padding and
`--radius-pill` corners, hovering to `--dd-pill-hover`. Stack multiple actions
vertically, left-aligned at content width with `--dd-stack-gap` between them; a single
action may run full-width. The default is always a neutral pill — not accent.
Optionally frame the stack with a small `--color-text-subtle` prompt label above it
(*"What's your next move?"*) to soften the prompt, or omit it for a tighter
composition.

**Accent only when primary.** The accent appears on a primary CTA only when the action
*is* the surface's single [accent moment](pattern.accent-moment) — a *Send* on a screen where
the accent is already earned. Most surfaces use neutral pills and spend their one
accent elsewhere or not at all; an accent action and an accent trend on the same
surface is two accents, which is never allowed.

**State changes confirm, never perform.** A pill's response to the hand is a
tier shift, not a show: hover lifts to `--dd-pill-hover`, press sinks to
`--dd-pill-active`, and the change is instant or near-instant — the smallest
legible acknowledgment that the input registered. There is no ripple, no bounce,
no easing flourish; a transition that draws attention to itself is decoration in
time, and it fails the same test decoration fails in space. When an action
completes, the confirmation is a state the reader can verify — the figure
updates, the row appears — not a celebratory animation standing in for the
result. Restraint here is what makes the one settle-in on the [answer](pattern.answer)
read as meaningful rather than as one effect among many.

The action stack follows the [one-sentence meaning](pattern.meaning) and resolves the
[answer](pattern.answer) into a move the reader can make — it is where the surface's momentum
lands, and where the single [accent moment](pattern.accent-moment) may be spent if the action
itself is the primary one.

Related: reinforces `pattern.meaning`; contrasts with `pattern.accent-moment`.
