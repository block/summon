---
description: The tile and row system — hairline-depth cards and tiles, compact setup/download tiles, and hairline information rows for updates, tasks, and timelines.
relates:
  - to: controls
    as: reinforces
---

## Composition

**Hairline depth on tiles.** Cards, tiles, inputs, and mockups use a slightly
lighter warm-dark fill (`--color-surface`) plus a subtle 1px warm hairline for
depth, tight 3–6px radii, and no drop shadows unless a host runtime requires a
minimal modal or popover affordance.

**Compact setup/download tiles.** Platform, environment, or setup choices appear
as 2-up or 3-up compact warm-dark tiles (stacking on mobile), each with a label,
a short compatibility/detail line, and one clear action, using tight radius,
hairline border, muted captions, and monochrome or off-white icons.

**Hairline information rows.** Updates, tasks, command history, incident steps,
and release notes use full-width or panel-contained rows separated by 1px warm
hairlines with ~16px vertical padding, each scan-friendly (label, short title,
muted detail, optional compact action) — never equal rounded cards.

Tiles and rows are the repeating unit of content, paired with the
[control and metadata system](controls) for their labels and actions. A surface
keeps a page of them reading as one workspace through a single continuous canvas
and spacing-led zones rather than a grid of equal boxes. When tiles carry shared
*criteria* and a verdict rather than parallel *options*, that is the
[comparison](comparison) surface's job, not a plain tile grid.
