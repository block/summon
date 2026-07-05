---
description: "Guard against soft-shadow SaaS depth — not floating cards, glassmorphism, or glow rings; instead hairline edges and plane polarity; recognize the switch by any box-shadow on a persistent card. Reach before styling any card, sheet, or section boundary."
---

**Not** shadow-led depth. Technical Contrast refuses the generic SaaS elevation
language wholesale: drop shadows, card lift, or material-style elevation on
cards, sheets, tables, proof cards, or form groups; glassmorphism, blurred
panels, glow rings, or neon AI halos as the main depth device; soft elevated
card grids standing in for hairline structure; full-pill CTAs and bubbly
rounded chrome that ride along with that idiom.

**Instead** borders ARE the elevation. Hierarchy comes from:

- `--contrast-edge-hairline` (1px rgba(0,0,0,0.08)) on white and pale sheets;
- `--contrast-edge-dark` (1px #313641) and `--contrast-edge-midnight-soft`
  (1px rgba(255,255,255,0.14)) on the midnight plane;
- `--contrast-edge-strong` (1px #000000), fill polarity, or placement to mark
  the chosen option — never a winner badge or lifted card;
- plane changes themselves (`--contrast-plane-pale-bg` → sheet → midnight) to
  separate major ideas before any border is even drawn;
- flat, lightly rounded corners (`--radius-sm`/`--radius-md`), with
  `--contrast-elevation: none` and `--shadow-card`/`--shadow-elevated`
  intentionally `none`.

**Recognize the switch by** a `box-shadow` declaration on any resting card,
sheet, table, or section; a `backdrop-filter: blur(...)`; a glow-colored
outline; or a pill-radius primary button. Any one of these means the surface
has drifted out of the language.

**The one legitimate exception:** truly floating host controls and transient
overlays — popovers (`--shadow-popover`) and modals (`--shadow-modal`) — may
carry subtle shadow because they genuinely float above the document. Persistent
layout never does.
