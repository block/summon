---
description: 'The spending discipline that makes the hundredth screen match the first — every view pays against explicit budgets (`--noir-size-budget: 2` extra type sizes, one `--noir-mono-weight`, `--noir-accent-budget: 0` chromatic accents, four ink levels, one border vocabulary), refinement goes only to the primary reading path, and there is no "just this once". Pull FIRST when deciding what a view may spend, where polish is allowed, or whether the system needs a new component (it almost never does).'
---

## Composition

Technical Noir is one instrument played well, not an orchestra: every surface is
built from the same single treatment, under explicit budgets, so the hundredth
screen looks as composed as the first.

**One surface treatment everywhere.** Depth comes from the warm `--noir-hairline`
and nothing else — no shadows, no glows, no second border style, no panel that
invents its own edge. If a region needs to read as more important, distinguish it
inside the system: a wider spacing band, a step up in type weight, the
`--noir-hairline-strong` boundary, or the off-white `--noir-spine` — never a new
material. A surface with two border vocabularies has already stopped being
Technical Noir.

**Budget-driven restraint.** Every view spends against explicit limits, and the
limits are the design: at most `--noir-size-budget` type sizes beyond body per
view, one mono weight (`--noir-mono-weight`) for all evidence content, and zero
chromatic accents unless a real state demands one through the muted
`--noir-dot-*` system. There is no "just this once" — an exception granted to one
screen is a precedent granted to every screen, and the system erodes one
special case at a time. When a view seems to need a third size or a second mono
weight, the hierarchy is wrong, not the budget.

**Coarse where the style forgives it.** Secondary evidence renders plainly:
unstyled mono blocks in `--noir-mono-weight` on the bare `--color-surface-muted`
fill (`--noir-plain-block`), muted-beige text, no syntax-highlight rainbow, no
per-token coloring. Spend refinement only on the primary reading path — the
claim, the active panel, the row wearing the `--noir-spine`. Uniform polish
flattens hierarchy; a log that is deliberately plain makes the one refined panel
above it unmistakably the point. Coarseness here is editorial, not neglect.

**Quiet edge, not sterile flatness.** Restraint must not curdle into sterility.
Each surface carries exactly one subtle warmth cue — by default the warm cast of
the off-white and brown-charcoal material itself, or one understated detail like
the felt `--noir-grid`. That is the whole allowance: no mascots, no jokes in the
chrome, no "friendly" microcopy softening the transcript. Warmth in Technical
Noir is material, never verbal — the surface feels like a well-lit workbench,
not a companion.

**Constraint is the palette.** The lineage behind this language proved that a
four-shade screen or one ink on newsprint forces better work than an open
palette — density, arrangement, and threshold do what color otherwise would.
Technical Noir holds the same discipline deliberately: four ink levels
(`--noir-ink-1..4`), one mono weight, discrete steps between states. When a
value must be visualized, it becomes glyph density on the transcript grid (the
[density field](pattern.density-field)), not a chart, a gradient, or a gauge; when a
state must change, it steps through `--noir-step-levels` thresholds rather than
easing. The narrow means are not a limitation to work around — they are why the
hundredth screen still reads as one instrument.

**Repeatable patterns over showpiece moments.** Design for the hundredth screen,
not the screenshot: every choice must survive repetition across a long session
of [tiles, rows](pattern.tiles), and [evidence panels](pattern.terminal-evidence) without
fatiguing. Before extending the system, compose from existing patterns — a new
need is almost always a hairline row, a mono chip, a spine, or a dot arranged
differently, not a new component. A showpiece moment that cannot be repeated a
hundred times was never part of the language.

```css
:root {
  /* ONE INSTRUMENT — explicit spending limits; the budgets are the design. */
  --noir-size-budget: 2;               /* at most two type sizes beyond body per view — a third means the hierarchy is wrong */
  --noir-mono-weight: 400;             /* the single mono weight for all evidence content; emphasis comes from ink, not weight */
  --noir-plain-block: #302b28;         /* the bare fill for coarse secondary evidence — unstyled mono, no syntax rainbow */
  --noir-accent-budget: 0;             /* zero chromatic accents unless a real state demands a --noir-dot-* */
}
```

This discipline governs how the [tile and row system](pattern.tiles) keeps a long page
reading as one workspace, how the [terminal evidence panels](pattern.terminal-evidence)
stay plain outside the primary reading path, and how the
[control system](pattern.controls) spends its one off-white primary action — the same
instrument, every screen, played without exceptions.

Related: reinforces `pattern.tiles`, `pattern.terminal-evidence`.
