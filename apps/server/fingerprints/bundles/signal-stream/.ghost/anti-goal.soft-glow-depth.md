---
description: Guard against soft-glow elevation — not shadows, glass, blur, or lift; instead flat saturated planes and 1px hairlines; recognize the drift by box-shadow, backdrop-filter, or hover transforms.
---

## Not this

The generic dark-mode default this fingerprint refuses: lifted cards on soft
drop shadows, glow rings around focus and CTAs, frosted-glass panels over the
field, gradient scrims under text, and images that zoom or fade on hover. On
Signal Stream's warm near-black field these moves read as a SaaS dashboard
wearing a dark theme — the signal goes atmospheric and the hierarchy goes soft.
The same failure family includes pastel accent washes and chromatic background
tints: light leaking into a field that must stay `#131313` and matte.

## Instead

Depth is flat by design and the tokens say so: `--signal-tile-shadow: none`,
`--shadow-card: none`, `--shadow-elevated: none` are rules, not omissions.
Hierarchy comes from exactly four flat instruments:

- **1px hairline borders** — `--signal-tile-border` (white) for containment,
  `--color-border-input` (#949494) for quiet edges;
- **saturated fills** — `--signal-tile-fill-mint` / `--signal-tile-fill-violet`
  as the loudest elevation tier, printed on the field, never faded;
- **inset rules and underlines** — the 2px `--signal-tab-active-underline`,
  the `--signal-chapter-rule` hairline;
- **contrast and scale** — white on near-black, shout against whisper.

Hover brightens a border to `--signal-hover-border` or shifts text to
`--signal-hover-text`; press drops to `--signal-active-border`. Color and
saturation move; nothing lifts. If separation is truly needed, it is a 1px
outline ring only (`--shadow-popover` is exactly that). Text over imagery sits
on the solid opaque `--signal-opening-plate`, never a translucent scrim.

## Recognize the switch by

- any `box-shadow` with blur or offset beyond a 1px `0 0 0 1px` ring;
- `backdrop-filter`, `filter: blur()`, or `rgba()` panel fills posing as glass;
- gradient backgrounds or scrims (the only permitted gradients are the hard
  striped `--signal-tear-rule` / `--signal-tear-hazard` bands — solid color
  against solid color, zero feathering);
- `transform: scale()` / `translateY()` on hover, or image zoom/opacity fades;
- accent hexes outside the token palette, or hazard colors tinted toward pastel.

When any of these appear, the surface has left the language: strip the effect
and restate the hierarchy with a border, a fill, a rule, or scale.
