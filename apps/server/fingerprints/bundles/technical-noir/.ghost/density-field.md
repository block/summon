---
description: The density field — character-grid density as measurement (mono glyph ramps whose ink density maps to real progress, load, or activity), the mono cell as a literal spatial coordinate system, and threshold-stepped rendering that quantizes every state change to discrete ink levels instead of smooth gradients. Reach for how a surface turns a live number into quiet texture without a chart library or a colored bar.
relates:
  - to: terminal-evidence
    as: reinforces
  - to: one-instrument
    as: reinforces
  - to: tiles
    as: contrasts
---

## Composition

Technical Noir inherits an old print-room truth: when you only have one ink,
you show quantity with density. A field of sparse dots reads as low; a field of
dense marks reads as high; the eye integrates the texture into a value. The
density field turns that principle into this language's only "chart" — mono
glyphs on the mono grid, standing in for real measurement, in the same off-white
ink as everything else.

**Density is measurement, never decoration.** A run of glyphs drawn from the
ordered `--noir-density-ramp` (` .:-=+#`, sparse to dense) may render any live
scalar the task actually produces — progress through a migration, queue depth,
worker load, tokens consumed against a budget, test-suite completion. The ramp
is ordered like a luminance scale: emptiness means zero, full ink means full,
and the mapping is monotonic so the reading is unambiguous at a glance. Every
density strip sits beside its exact mono value (`67%`, `412/512`) — the texture
is the fast read, the number is the truth, and neither appears without the
other. A glyph field with no live value behind it is decoration, and decoration
detached from task evidence is outside this language: no ASCII portraits, no
dithered hero imagery, no character-rain backdrops, no retro-monitor effects.

**The mono cell is the coordinate system.** Density strips, meters, and
activity fields are laid out on the literal monospace grid: cells are
`--noir-density-cell-w` × `--noir-density-cell-h` (one `ch` wide, one 24px
scan-grid row tall), so a
40-cell progress field is exactly `40ch` wide and aligns character-for-character
with the command lines and `--noir-gutter` glyphs above and below it. The felt
`--noir-grid` and the density field share the same 24px row rhythm — the texture
is not an overlay floating on the panel, it is content occupying the same
transcript lattice as everything else. Never draw a density field in a second
typeface, a fractional-width bar, or a rounded track; it is text, set like text.

**Threshold rendering — state steps, it never fades.** Where other systems ease
a value through a smooth gradient, Technical Noir quantizes. Ink moves through
exactly `--noir-step-levels` discrete steps (`--noir-ink-1` through
`--noir-ink-4`, derived from the border, muted, alt, and primary text values) —
a cell is at one level or the next, never between. The same discipline governs
change over time: a filling progress field advances cell by cell in hard steps;
an activity column brightens one threshold at a time; emphasis on hover steps
from one ink level to the next rather than cross-fading. Stepped rendering is
the motion-restraint stance made visible — the surface changes the way a
terminal repaints, in discrete honest increments, not the way an ad animates.

**Where the field appears.** Inside [terminal evidence panels](terminal-evidence)
as a labeled readout row among the log lines; alongside a [tile or row](tiles)
as a compact per-item activity strip; beside a mono chip in the
[control system](controls) as a micro-meter for capacity or usage. It is always
subordinate to the transcript around it: muted ink levels by default, the full
off-white `--noir-ink-4` reserved for the filled portion of the one field on the
primary reading path. Under the [one-instrument budgets](one-instrument), a
density field costs nothing chromatic — it is the way this system visualizes
load without spending an accent.
