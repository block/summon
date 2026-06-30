---
description: The pill-corner stream tile and rail system — rounded dark or saturated tiles on a 1px rail, lead-image headline slabs, compact supporting grids, and static hairline image frames. Reach for the repeating units that carry a stream of content.
relates:
  - to: canvas
    as: reinforces
  - to: type-system
    as: reinforces
  - to: controls
    as: reinforces
---

## Composition

Tiles and rails are the repeating unit of content that make a Signal Stream
surface feel intentional.

**Pill-corner stream tiles.** Dark or saturated rectangles built from
`--signal-tile-radius` (20px standard, stepping to 24px for feature tiles), with
`--signal-tile-border` 1px hairline containment and 24–32px interior padding
(40–48px for feature leads). Saturated leads take `--signal-tile-fill-mint` or
`--signal-tile-fill-violet`; quiet tiles sit on `--signal-tile-fill-flat`. Every
tile carries `--signal-tile-shadow: none` — that flatness is a rule, color and
the 1px border do the work of elevation. No square cards, and no note-card radii
above 40px.

**Signal rail feed.** Ordered updates stack on a visible `--signal-rail-*` spine
(`--signal-rail-width` on `--signal-rail-color`) with mono timestamps/ranks/state
on the rail and rounded tile bodies beside it, separated by `--signal-rail-gap`.
The rail drops `--signal-rail-tick-size` markers down its length —
`--signal-rail-tick-color` (mint) for the stream and `--signal-rail-tick-recent`
(violet) for the most recent — at `--signal-rail-tick-spacing`, so tight 12–16px
gaps read as one continuous stream. An occasional saturated tile interrupts the
rhythm for a lead or urgent item.

**Lead-image headline slab / compact supporting grid.** A feature lead owns the
first read — an image-first block with an attached or overlapping headline slab —
then compact two-column supporting rows with thumbnails, hairline separators, and
demoted metadata.

**Static image frames.** Images are framed by a 1px hairline, clipped to the
tile, and static — never hover zoom, scale, or opacity.

The tiles sit on the [dark canvas](canvas) and borrow its saturated hazard fills
for leads; their labels and timestamps are the [mono metadata](type-system) and
their actions are the [hazard-pill controls](controls). The rail feed is the
spine of the [stream](stream); the lead slab and supporting grid drive the
[digest](digest); the [briefing](briefing) reuses hairline rows for its evidence
and timeline.
