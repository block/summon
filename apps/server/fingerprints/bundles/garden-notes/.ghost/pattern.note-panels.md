---
description: The shaping container of every plan — one bounded `--garden-panel-radius` cream shell on `--garden-note-paper` (never flat white), opened by a real-context header, holding one visibly primary step; pull first when bounding any surface, and hold the stance that a plan is a notebook page, not a grid of equal cards.
---

## Composition

Note panels are the shaping material of every Garden Notes surface: large rounded
cream note areas that hold a plan the way a notebook page holds a list, soft and
bounded rather than a productivity dashboard.

**Soft note panels carry the plan.** Every panel sits on warm cream note-paper —
fill it with `--garden-note-paper`, never flat white, and dust it with
`--garden-paper-texture` at `--garden-paper-texture-size` so the surface reads like
a page that caught afternoon light. Round panels to `--garden-panel-radius` (and
`--garden-panel-radius-lg` for the larger plans) over gentle plant-toned borders so
the surface reads as a warm notebook rather than a grid of equal cards. Group
related notes into garden-bed groupings — tactile note-card layers that sit close
together because they belong together — and keep the whole plan inside one bounded
outer rounded shell so it feels airy but anchored, never empty pastel whitespace.

**Context header opens the page.** Open every panel with a short context line that
reflects the real task — the actual people, places, materials, dates, and
constraints from the prompt — never an introductory line of advice before the
first action. The context header is how the surface proves it is planning *this*
task and not reciting a generic framework; use concrete nouns and verbs, and never
template labels like Task 1 or Optimize.

**One visibly primary next small step.** Inside the panel, one note is visibly the
primary next small step, with supporting notes for prep, constraints, and reminders
arranged around it. Make the first action visible without requiring the whole plan
to be read; let it carry the `--garden-chosen-dot` marker (sized at
`--garden-chosen-marker`, haloed by `--garden-chosen-ring`) in a soft rounded
callout so the eye lands on the one chosen step to do now.

**Notes rest on the page like paper on paper.** A garden-bed grouping may let a
small note rest partly on its parent panel — a can-wait slip tucked toward a
corner, a kept note settled along an edge — the way loose paper actually sits in
a notebook. This layered-paper feeling comes from position and the shared cream
tones (`--garden-note-paper` over the panel, `--garden-kept-paper` for settled
notes), never from extra shadows or cards nested inside cards; the [gentle depth
rules](principle.gentle-depth) still hold, and the layering reads as belonging, not
stacking. A note that needs closer reading is picked up under the [kept notes
and pick-up moves](pattern.kept-notes) — held gently above the plan while the rest of
the page recedes — so a panel never has to cram every detail into its resting
view.

Every plan begins from this bound structure — one shell, one context header, one
chosen step, supporting notes flat around it:

**Bound:** the single outer shell with `--garden-panel-radius-lg` and
`--garden-note-lift`; the context header opening the page; exactly one
chosen-step note carrying the dot and sharing the same lift; supporting notes
flat with border-only separation; the unclosed later-edge closing nothing.
**Open:** how many supporting notes, garden-bed groupings within the panel,
whether kept notes gather at an edge or in a row, chip selection, and the
measure — let the task set the shape.

These panels pair with the [badge and state system](pattern.badges) for readiness, time,
and effort, lean on the [gentle depth rules](principle.gentle-depth) so layering never
becomes a card pile, and hold the [good-enough choice and can-wait notes](pattern.good-enough)
that lower pressure. Every surface — planner, staged-plan,
comparison, and routine — composes the plan from these
panels.

Related: reinforces `principle.gentle-depth`, `pattern.badges`.

## Skeleton

```html
<main style="background: var(--color-bg); font-family: var(--font-sans); color: var(--color-text); padding: var(--space-8) var(--space-5) 0;">
  <section style="background: var(--garden-note-paper), var(--garden-paper-texture); background-size: auto, var(--garden-paper-texture-size); border: 1px solid var(--color-border); border-radius: var(--garden-panel-radius-lg); box-shadow: var(--garden-note-lift); padding: var(--space-6);">
    <header>
      <h1><!-- context line: the real people/places/materials/dates from the prompt --></h1>
      <p style="color: var(--color-text-muted);"><!-- one line of grounding context, never advice --></p>
    </header>
    <div class="chosen-step" style="border-radius: var(--garden-panel-radius); box-shadow: var(--garden-note-lift);">
      <span class="dot" style="width: var(--garden-chosen-marker); height: var(--garden-chosen-marker); background: var(--garden-chosen-dot); box-shadow: var(--garden-chosen-ring);"></span>
      <!-- the one next small step + the tradeoff it accepts + quiet chips -->
    </div>
    <div class="supporting-note" style="border: 1px solid var(--color-border); border-radius: var(--radius-md);">
      <!-- prep / can-wait / reminder notes: flat on the panel, no lift, no dot -->
    </div>
    <div class="later-edge" style="color: var(--garden-quiet-note);">
      <!-- unclosed later… region fading via --garden-later-fade; no border, no prompt -->
    </div>
  </section>
</main>
```
