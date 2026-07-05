---
description: The slop guard — not equal-weight card decks, colored charts, gauges, badges, or accent systems; measurement is glyph-density ink and state is a 6px dot. Pull when repeating content starts collapsing into generic dark-mode dashboard SaaS.
---

## Guard

The failure mode that erases Technical Noir fastest is not a wrong color — it
is generic dark-dashboard slop: a grid of equal rounded cards, each with its own
colored chart, badge, and glow. Every ingredient of that surface has a named
replacement here.

**Not a deck of equal-weight cards.** No grid where every panel carries the
same visual weight, no oversized rounded cards, no drop shadows or glows
inventing elevation. **Instead:** rows and tiles share one alignment grid
divided by the warm 1px `--noir-hairline`; zones emerge from spacing and
alignment so the page reads as one workspace; the active item alone wears the
2px off-white `--noir-spine`. **Recognize the switch by:** more than one border
vocabulary, radii above 6px on content panels, or any non-inert shadow.

**Not charts, gauges, or colored progress bars.** No chart library, no rounded
progress track, no radial gauge, no sparkline widget, no gradient fill mapping
a value to hue. **Instead:** the [density field](pattern.density-field) — a mono
glyph run from the ordered `--noir-density-ramp` (` .:-=+#`) whose ink density
maps monotonically to a real live quantity, always beside its exact value
(`412/512`), stepped through the four `--noir-ink-1..4` levels, set on the same
`ch`/24px transcript lattice as the log lines around it. **Recognize the switch
by:** any `<canvas>`/SVG chart, a fractional-width colored bar, or a value
rendered with smooth easing instead of discrete steps.

**Not a colorful accent and badge system.** No colored status chips, winner
badges, score pills, syntax-highlight rainbow, or per-severity filled banners.
**Instead:** state rides 6px `--noir-dot-*` dots (idle gray, running amber, ok
sage, failed clay) always paired with a mono text label; emphasis is spent from
the one-instrument budget — border weight, ink level, spine, position — with
`--noir-accent-budget: 0` chromatic accents unless a real state demands a dot.
**Recognize the switch by:** any filled color chip, more than the muted
semantic hues, or color used to rank rather than to report state.

If a view seems to need a chart, a badge, or a third card style, the hierarchy
is wrong, not the budget — recompose from hairline rows, dots, spines, and
density fields before extending the system.
