---
name: one-instrument-budget
description: The generated surface must hold the one-instrument spending budgets — one border vocabulary (hairlines, inert shadows), at most two type sizes beyond body per view, one mono weight, zero chromatic accents beyond the muted state dots, and quantities rendered as glyph-density fields rather than charts, gauges, or colored bars.
severity: high
references:
  - principle.one-instrument
  - pattern.density-field
  - anti-goal.dashboard-slop
---

Technical Noir is one instrument played well: every view spends against
explicit limits and the limits are the design. Grade the generated surface
against each budget and reject if any is exceeded:

- **Border vocabulary.** Depth must come from the warm 1px hairline
  (`--noir-hairline` family) and surface contrast only. Reject any drop shadow,
  glow, blur, second border style, or panel inventing its own edge — the shadow
  tokens are intentionally inert.
- **Type budget.** At most `--noir-size-budget` (2) type sizes beyond body per
  view; display type stays light (weight 400–500). Reject a third extra size or
  heavy promotional weights.
- **Mono budget.** One mono weight (`--noir-mono-weight`, 400) for all evidence
  content; emphasis comes from ink level, not weight. Reject bold mono or
  syntax-highlight rainbow — secondary evidence renders plain on the bare
  `--color-surface-muted` fill.
- **Accent budget.** Zero chromatic accents (`--noir-accent-budget: 0`) unless
  a real state demands a muted 6px `--noir-dot-*` dot paired with a mono text
  label. Reject colored chips, badges, filled banners, or color used to rank
  rather than report state. One off-white primary action per region.
- **Measurement budget.** Any live quantity must render as a density field —
  mono glyphs from the ordered `--noir-density-ramp` on the ch/24px transcript
  grid, quantized to the `--noir-ink-1..4` levels, with its exact value beside
  the texture. Reject chart libraries, SVG/canvas charts, radial gauges,
  rounded progress tracks, gradient fills, smoothly easing bars, or glyph
  texture with no real value behind it.

An exception granted to one screen is a precedent granted to every screen: if
any region breaks a budget "just this once", the surface fails this check.
