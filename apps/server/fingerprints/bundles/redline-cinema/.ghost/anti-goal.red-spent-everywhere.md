---
description: Guard against red becoming a palette — not category colors, red borders, red icons, or a second red per viewport; instead one voltage spend per region on the highest-intent element; recognize the switch when two red things are visible at once.
---

## The refused default

Generated dark surfaces love to spread an accent: red category chips, red icon
strokes, red chart series, red borders on every card, a red playhead *and* a red
CTA in the same view. Redline Cinema refuses all of it. The moment red multiplies
it stops being voltage and becomes decoration — the surface collapses into neon
cyberpunk or generic dark SaaS with a hot accent.

**Not** red as a palette — **instead** `--redline-voltage` (`#da291c`) spent on
exactly one role per region: the primary CTA, the one decisive metric, the active
row or position, or the current chapter chip. Never two of those at once in the
same viewport.

**Not** red borders, icons, charts, or category swatches — **instead** hairlines
in `--redline-hairline` (`1px solid #303030`), white ink, and grey metadata
(`--color-text-muted: #969696`) carrying every non-focal distinction. Selection is
a `--redline-row-selected-rail` hairline rail, progress is
`--redline-player-progress` white, disabled is `--redline-disabled-fg` grey — none
of them red.

**Not** repeated red dividers or a red band per section — **instead** the
[single red livery band](pattern.livery-band) at most once per page, or the
`--redline-voltage-stripe` (3px) hairline in the same once-only role; never both.

**Not** red for semantic states — **instead** the reserved roles
`--color-danger` (`#f13a2c`), `--color-success` (`#03904a`), `--color-info`
(`#4c98b9`) for actual meaning, keeping the race-red free for voltage alone.

## Recognize the switch

You have crossed into the refused default when any of these are true:

- two elements in one viewport use `#da291c` (or `--redline-voltage` /
  `--color-accent`) simultaneously;
- red appears on a `border`, `outline`, icon `fill`/`stroke`, chart series, tag
  background, or hover state rather than a fill on the one focal element;
- more than one full-width red band exists on the page, or a band *and* the
  voltage stripe both appear;
- every chapter chip, badge, or tag in a row is red — a row of red chips is a row
  of nothing.

The correction is always the same: keep the single highest-intent spend, and
demote everything else to white ink, grey metadata, and hairlines per the
[control system](pattern.controls) and [editorial cadence](pattern.editorial-cadence).
