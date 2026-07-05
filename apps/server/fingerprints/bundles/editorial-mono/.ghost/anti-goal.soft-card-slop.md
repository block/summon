---
description: Not shadowed rounded card grids, pastel washes, or mood-color decoration; instead hairline-ruled bands on cream paper with inverse ink for the one emphasis — recognize the switch by box-shadow, border-radius, and chroma creeping onto broad panels.
---

**Not X:** the generic generated default — rounded SaaS cards with soft
shadows, pastel or gradient washes, colorful badges, glass effects, pill-shaped
panels, cozy lifestyle beige, and semantic color used as ordinary hierarchy.
Also its structural twin: facts scattered into differently shaped metric tiles,
orphaned stats with no interpretation, and comparisons whose options carry
different criteria or internal structures.

**Instead Y:** the printed-page material. Structure is **drawn, not
contained** — sections and rows are cut by `--editorial-hairline` (1px solid
`#11100e`) and `--editorial-rule-heavy` (2px), never boxed or filled. Evidence
sits in ruled bands sharing one measure, split into parallel columns by
`--editorial-column-rule`, each fact paired with its so-what. Emphasis comes
from ink, border weight, type scale, spacing, alignment, and the single inverse
slab (`--editorial-verdict-bg` / `--editorial-verdict-fg`, square corners, no
shadow). Semantic colors (`--color-danger`, `--color-success`, `--color-info`,
`--color-warning`) are reserved for true states, never mood or hierarchy.

**Recognize the switch by:**

- `border-radius` above `--radius-lg` (4px) on anything wider than a compact
  mono label or control — pill radius belongs to chips only, never panels;
- any visible `box-shadow` — every shadow token in this vocabulary is
  deliberately `none`; separation reads from hairlines and paper tiers;
- `linear-gradient`/`radial-gradient` used for decoration rather than the two
  signature ruled-paper backgrounds;
- background hues outside the cream/ink paper tiers (`#f2efe7`, `#fffdf6`,
  `#e5e0d4`) and the one inverse slab (`#11100e`);
- a second inverse or accent-tinted panel — the page inverts exactly once;
- evidence rendered as a grid of self-contained cards instead of full-width
  ruled rows on a shared column measure.

The moment any of these appear, the printed page collapses into a generic
dashboard panel. Replace the container with a rule, the tint with paper, the
shadow with a hairline, and the card grid with aligned bands.
