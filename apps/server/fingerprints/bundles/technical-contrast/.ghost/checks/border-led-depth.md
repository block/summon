---
name: border-led-depth-no-card-shadows
description: Card and section depth must stay border-led — hairlines, fills, surface polarity, and spacing, never floating card shadows.
severity: medium
surface: core
---

Technical Contrast's depth is border-led by design. Reject the generated surface
if persistent card or section hierarchy depends on floating shadows:

- drop shadows, card lift, or material-style elevation on cards, sheets, tables,
  proof cards, or form groups;
- glassmorphism, glow rings, neon AI halos, or blurred panels as the main depth
  language;
- soft elevated SaaS card grids standing in for hairline structure.

Hierarchy must come from 1px hairline borders and dividers on white sheets,
dark-soft borders on midnight sections, surface-contrast plane changes, fill
polarity, and spacing. Card corners stay lightly rounded and flat. Use border
weight, fill polarity, or placement to emphasize the chosen option. Subtle shadow
is reserved only for truly floating host controls or transient overlays (popovers,
modals) — never the resting elevation of persistent cards. The `--shadow-card` and
`--shadow-elevated` tokens are intentionally `none`; keep persistent depth
border-led.
