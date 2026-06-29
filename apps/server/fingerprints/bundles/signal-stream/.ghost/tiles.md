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

**Pill-corner stream tiles.** Dark or saturated rectangles, 20px radius for
standard tiles and 24px for feature tiles, with 1px hairline containment and
24–32px interior padding (40–48px for feature leads). No square cards, and no
note-card radii above 40px.

**Signal rail feed.** Ordered updates stack on a visible 1px rail (violet, mint,
white, or muted gray) with mono timestamps/ranks/state on the rail and rounded
tile bodies beside it, tight 12–16px gaps so it reads as one stream. An
occasional saturated tile interrupts the rhythm for a lead or urgent item.

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
