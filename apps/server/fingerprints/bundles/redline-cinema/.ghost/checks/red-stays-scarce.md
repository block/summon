---
name: red-stays-scarce
description: Race-red is voltage spent once — reject a second red in the viewport, red on non-focal chrome, or more than one full-width red band per page.
severity: high
references:
  - anti-goal.red-spent-everywhere
  - pattern.controls
  - pattern.livery-band
  - pattern.editorial-cadence
  - index
---

Red is voltage, not palette: `--redline-voltage` (`#da291c`) is spent on exactly
one role — the primary CTA, the one decisive metric, the active row or position,
or the current chapter chip — one spend per region, and never two red elements
visible in the same viewport. Reject the generated surface if red multiplies:

- two elements in one viewport use `#da291c` (or `--redline-voltage` /
  `--color-accent`) simultaneously;
- red appears on a `border`, `outline`, icon `fill`/`stroke`, chart series, tag
  background, or hover state rather than a fill on the one focal element;
- more than one full-width red band exists on the page, or a band *and* the
  `--redline-voltage-stripe` both appear — the band and the stripe share the same
  once-only budget;
- every chapter chip, badge, or tag in a row is red — a row of red chips is a row
  of nothing.

The correction is always the same: keep the single highest-intent spend, and
demote everything else to white ink, grey `--color-text-muted` metadata, and
`--redline-hairline` lines. Selection is a `--redline-row-selected-rail` hairline
rail, progress is white, and semantic states use the reserved `--color-danger` /
`--color-success` / `--color-info` roles — none of them the race-red.
