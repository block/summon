---
description: The segmented stream tabs and hazard-pill CTA system — uppercase mono mode pills in a muted segmented rail, one mint-filled primary pill per region, dark inputs, and contrast-safe focus rings. Reach for how the surface switches modes and drives action.
relates:
  - to: tiles
    as: reinforces
  - to: type-system
    as: reinforces
---

## Composition

Controls switch modes and drive action without breaking the flat, high-voltage
signal. Buttons are uppercase mono hazard pills (mint fill, black text, no
shadow); inputs sit on the dark field with a 1px muted border.

**Segmented stream tabs.** A `--signal-tab-*` segmented control — zero
`--signal-tab-gap`, hairline `--signal-tab-border`, uppercase
`--signal-tab-font`/`--signal-tab-transform` labels at `--signal-tab-tracking`
(Top Stories, Latest, Live…) — where the active segment is marked by the 2px
`--signal-tab-active-underline` in mint, not a fill swap, so modes feel toggled
like a hardware selector. The rail is full-width and tappable on mobile, and the
active mode stays the only saturated element in the control. Mode controls are
preserved on mobile even when the layout collapses.

**Hazard pill CTA.** A compact mint-filled `--signal-pill-*` chip
(`--signal-pill-radius`, `--signal-pill-padding`, `--signal-pill-border`, mono
`--signal-pill-font` at `--signal-pill-tracking`, black text) for the primary
action; outline pills for secondary; explicit contrast-safe focus rings, no glow.
One primary mint button per region — reach for border weight, position, or the
active rail before adding more color.

These controls borrow the mint and violet hazard accents of the [dark
canvas](canvas), use the [mono uppercase metadata](type-system) for their labels,
and pair with the [tiles](tiles) they sit beside. The segmented tabs are most at
home switching modes on the [stream](stream) and selecting sections on the
[digest](digest); the single hazard-pill CTA closes the [briefing](briefing) with
one clear next action.
