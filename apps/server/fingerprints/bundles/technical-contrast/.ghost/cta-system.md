---
description: The square-ish rectangular CTA system — small-radius buttons never pills, uppercase mono labels, black-fill primary on light planes and white/mint/dark-soft on midnight, one primary action per region. Reach for how the surface drives action.
relates:
  - to: mono-labels
    as: reinforces
---

## Composition

**Rectangular CTA system + small-radius rectangles.** Actions are square-ish
rectangles at `--contrast-cta-radius` (barely rounded, never a pill) with
uppercase mono labels — `--contrast-cta-font` set in `--contrast-cta-transform`
uppercase — and compact `--contrast-cta-pad-y`/`--contrast-cta-pad-x` padding.
Black fill (`--color-accent`) is primary on light surfaces; white, mint, or
dark-soft on midnight planes; outline for secondary. Circular geometry is reserved
for isolated icon controls. One primary action per region.

Primary actions stay small-radius rectangular with uppercase mono labels and
clear contrast, never full pills. Borders ARE the elevation here — there is no
floating shadow (`--contrast-elevation` is `none`): bound secondary and outline
CTAs with `--contrast-edge-hairline` on white sheets and `--contrast-edge-dark` on
midnight panels, and reach for `--contrast-edge-strong` or fill polarity to mark
the chosen option before color. The mono labels on these
buttons follow the [mono label system](mono-labels); the buttons anchor the
claim-first regions on the [landing](landing), the conversion rows on
[pricing](pricing), the high-gravity actions on the midnight [proof](proof) plane,
and the single primary submit on the [workflow](workflow) form sheet.
