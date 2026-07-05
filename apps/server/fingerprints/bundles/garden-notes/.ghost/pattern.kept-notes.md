---
description: Completion and close inspection — done work settles onto `--garden-kept-paper` as a quiet keepsake (never struck through, greyed out, or counted), and exactly one note may be picked up on `--garden-pickup-lift` while the plan recedes; pull whenever a surface shows finished steps or needs detail-on-demand without navigation.
---

## Composition

A notebook does not delete its finished pages, and a person sorting their week
sometimes wants to hold one note closer. These two moves — keeping and picking
up — give Garden Notes its memory and its focus without adding a single new
metaphor to the paper.

**Done work becomes a kept note, not a crossed-off row.** When a step completes,
it does not strike through, grey out, or vanish into an archive count. It
settles: the note eases onto `--garden-kept-paper` — the warm base the
note-paper gradient already falls toward — takes `--garden-kept-ink` for its
text, and may shrink a step in the type scale, like a note that has been
smoothed flat and slipped back into the book. A small quiet "Kept" chip (the
standard pill recipe, no success-green fill) names the state in words. Kept
notes gather at the panel's edge or in a small kept-notes row, close together
because they belong together — a modest personal collection that says *this got
done and it mattered*, never a completion percentage, streak, or trophy shelf.
The reward for finishing is that the plan visibly holds what you did; the
warmth is structural, not congratulatory — no praise copy, no confetti, no
cheering.

**Any note can be picked up.** When a person wants to look closely at one step —
its materials, its timing, the tradeoff it accepts — the note lifts toward them:
it scales gently to `--garden-pickup-scale`, takes the deeper
`--garden-pickup-lift` (the one sanctioned exception to the single resting
lift), and everything else on the page recedes behind the
`--garden-recede-veil` wash of the field color — dimmed but still legibly
there, the way the rest of a desk softens when you hold one page up to read
it. The picked-up note shows its fuller self — the whole context line, every
chip, the can-wait reasoning — without navigating away; setting it down (click
away, Escape) returns it to the plan with the same `--garden-ease-soft`, no
bounce, no zoom theatrics. Picking up is inspection, not selection: it changes
nothing about the plan, asks for no decision, and works identically from the
keyboard, with focus held on the lifted note and returned where it was on
release.

**One note held at a time.** Only one note is ever picked up, just as only one
step wears the green dot — holding two pages at once is how a desk becomes
clutter. While a note is held, the surface goes quieter, not busier: no
toolbars appear, no related-actions menu slides in. The veil, the lift, and the
unhurried ease are the whole event.

## Skeleton

A kept note and a picked-up note begin from this structure:

```html
<!-- Kept note: settled onto the paper's own base, named in words, never struck -->
<div class="kept-note" style="background: var(--garden-kept-paper); color: var(--garden-kept-ink); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-3) var(--space-4); font-size: var(--text-sm);">
  <!-- the finished step's text, tradeoff sentence intact — no strikethrough, no praise copy -->
  <span class="chip" style="border-radius: var(--garden-chip-radius); background: var(--garden-chip-face); color: var(--garden-chip-ink); border: var(--garden-chip-edge); padding: var(--garden-chip-pad);">Kept</span>
</div>

<!-- Picked-up note: the one sanctioned deeper lift, everything else receding -->
<div class="pickup-veil" style="position: fixed; inset: 0; background: var(--garden-recede-veil);"></div>
<div class="picked-up" style="transform: scale(var(--garden-pickup-scale)); box-shadow: var(--garden-pickup-lift); transition: transform 0.2s var(--garden-ease-soft), box-shadow 0.2s var(--garden-ease-soft);">
  <!-- the note's fuller self: whole context line, every chip, the can-wait reasoning -->
</div>
```

**Bound:** `--garden-kept-paper` + `--garden-kept-ink` for done work with the
plain quiet "Kept" chip; at most one picked-up note at `--garden-pickup-scale`
on `--garden-pickup-lift` with the veil behind it; `--garden-ease-soft` for the
lift and the set-down, focus held and returned. **Open:** whether kept notes sit
at a panel edge or gather in a row, whether they shrink a type step, and what
detail the picked-up view reveals.

These moves live inside the [note panels](pattern.note-panels), obey the [gentle depth
rules](principle.gentle-depth) — the pickup lift is depth with a reason, not a card
pile — and extend the [good-enough choice](pattern.good-enough) logic to completion:
finishing a good-enough step earns a kept note, quietly, and the plan moves its
green dot to the next one.

Related: reinforces `pattern.note-panels`, `principle.gentle-depth`, `pattern.good-enough`.
