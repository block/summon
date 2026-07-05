---
description: The hardware-selector control kit — zero-gap segmented mono tabs with a 2px mint active underline, exactly one mint-filled hazard-pill CTA per region, and mint focus rings instead of glow; pull it when a surface switches modes or drives action, never defaulting to soft buttons.
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
canvas](principle.canvas), use the [mono uppercase metadata](pattern.type-system) for their labels,
and pair with the [tiles](pattern.tiles) they sit beside. The segmented tabs are most at
home switching modes on a live stream and selecting sections on a digest; the
single hazard-pill CTA closes a briefing with one clear next action.

Related: reinforces `pattern.tiles`, `pattern.type-system`.
