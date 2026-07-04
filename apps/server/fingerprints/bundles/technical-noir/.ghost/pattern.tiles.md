---
description: The tile and row system — warm-hairline-depth cards and tiles (elevation by `--noir-hairline` contrast, never glow), compact setup/download tiles, and hairline information rows for updates, tasks, and timelines. Reach for how the surface racks discrete items and rows into a calm, shadowless grid.
---

## Composition

**Hairline depth on tiles.** Cards, tiles, inputs, and mockups use a slightly
lighter warm-dark fill (`--color-surface`) plus the single warm `--noir-hairline`
for depth, tight 3–6px radii, and no drop shadows unless a host runtime requires a
minimal modal or popover affordance — elevation is hairline contrast, never glow.

**Compact setup/download tiles.** Platform, environment, or setup choices appear
as 2-up or 3-up compact warm-dark tiles (stacking on mobile), each with a label,
a short compatibility/detail line, and one clear action, using tight radius,
hairline border, muted captions, and monochrome or off-white icons.

**Hairline information rows.** Updates, tasks, command saved, incident steps,
and release notes use full-width or panel-contained rows separated by the warm
`--noir-hairline` with ~16px vertical padding, each scan-friendly (label, short
title, muted detail, optional compact action) — never equal rounded cards. Mark
the active or selected row with the 2px off-white `--noir-spine` on its left edge
(the only emphatic fill, never a colored chip), and let any per-row state ride a
6px `--noir-dot-*` rather than saturated text.

**Per-row density strips.** When rows carry a live quantity — task progress,
load, items remaining — append a compact mono [density field](pattern.density-field)
strip at the row's trailing edge: a short run of ramp glyphs at muted ink,
paired with its exact figure. Because every row's strip sits on the same `ch`
grid at the same width, a rack of rows becomes a scannable field of textures —
the eye reads relative load down the column before reading a single number.
Strips render at `--noir-ink-1`/`--noir-ink-2` by default; only the row wearing
the spine may fill at `--noir-ink-4`. This is the language's substitute for
sparklines and mini bar charts — glyph density, stepped, in one ink.

Tiles and rows are the repeating unit of content, paired with the
[control and metadata system](pattern.controls) for their labels and actions. A surface
keeps a page of them reading as one workspace through a single continuous canvas
and spacing-led zones rather than a grid of equal boxes. When tiles carry shared
*criteria* and a verdict rather than parallel *options*, that is the
[comparison](comparison) surface's job, not a plain tile grid.

Related: reinforces `pattern.controls`, `pattern.density-field`.
