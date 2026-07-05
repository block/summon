---
description: The single livery band — at most one full-width race-red band per page, a dramatic voltage interruption for a major statement, event status, or transition. Reach for it when one moment must seize the entire width and stop the reader cold.
---

## Composition

Red is voltage, not palette — and the livery band is the one place red is allowed
to fill a whole region. At most one full-width red accent band appears per page,
as a dramatic interruption for a major statement, event status, or transition.

**One band, restrained type.** A single `--redline-livery-band-h` sweep of
`--redline-livery-band` cuts full-width across the surface, carrying white, large,
restrained text and no extra colors — a single editorial statement, a launch
moment, an event status, or a transition between acts. Where a thinner accent is
wanted instead, the `--redline-voltage-stripe` hairline stands in for the same
once-only role; never both. It is omitted on compact task surfaces where its drama
would feel like noise; a directory sheet or a dense catalog listing rarely earns
one.

**Exact values.** The band is `--redline-livery-band-h` (`4px`) tall when it acts
as a pure cut between acts, filled with `--redline-livery-band`
(`linear-gradient(90deg, #da291c, #b01e0a)`). When it carries a statement it grows
to a full region — `var(--space-7)` to `var(--space-8)` (64–96px) of vertical
padding on the same red sweep — with white `--color-accent-fg` text only, large,
restrained weight, uppercase tracked at `--tracking-label` (`0.10em`) for the
eyebrow, and no secondary colors, icons, or buttons other than at most one white
outline action. Corners stay `--redline-machined-radius` (`0px`); the band runs
truly full-width, ignoring the four-column backbone the way a full-bleed image
does. The thin alternative, `--redline-voltage-stripe`, is `3px` and follows the
identical once-per-page budget.

## Skeleton

```html
<!-- Variant A: the cut — a pure 4px sweep between acts, no content -->
<div class="livery-cut" role="presentation"
     style="height: var(--redline-livery-band-h); background: var(--redline-livery-band);"></div>

<!-- Variant B: the statement — the one region red is allowed to fill -->
<section class="livery-band" style="background: var(--redline-livery-band); color: var(--color-accent-fg); padding: var(--space-8) 0; border-radius: var(--redline-machined-radius);">
  <p class="livery-eyebrow" style="font-size: var(--text-xs); text-transform: uppercase; letter-spacing: var(--tracking-label);"><!-- event status / launch label --></p>
  <h2 class="livery-statement" style="font-size: var(--text-2xl); font-weight: 600;"><!-- one editorial statement, white only --></h2>
</section>
```

**Bound:** the red sweep, full width, white-only content, square corners, and the
once-per-page budget shared with `--redline-voltage-stripe`. **Open:** cut vs.
statement variant, where in the act sequence it lands, and whether a single white
outline action accompanies the statement.

This band contrasts deliberately with the scarce red of the [control
system](pattern.controls) — where controls use red as a single high-voltage CTA fill, the
livery band uses red as the surface itself — and it is the one intentional break
in the [hairline and brightness depth](principle.depth) calm. Use it once or not at all.

Related: contrasts with `pattern.controls`, `principle.depth`.
