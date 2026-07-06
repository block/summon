---
description: The square-ish rectangular CTA system — small-radius buttons never pills, uppercase mono labels, black-fill primary on light planes and white/mint/dark-soft on midnight, one primary action per region. Reach for how the surface drives action.
---

## Composition

**Rectangular CTA system + small-radius rectangles.** Actions are square-ish
rectangles at `--contrast-cta-radius` (barely rounded, never a pill) with
uppercase mono labels — `--contrast-cta-font` set in `--contrast-cta-transform`
uppercase — and compact `--contrast-cta-pad-y`/`--contrast-cta-pad-x` padding.
Black fill (`--color-accent`) is primary on light surfaces; white, mint, or
dark-soft on midnight planes; outline for secondary. Circular geometry is reserved
for isolated icon controls. One primary action per region.

**Actions placed at the argument's stages.** Because the planes read as an
argument's stages, the CTA's register follows the plane it sits on. On the pale
landing the primary rectangle sits beside the claim as the direct route for
readers already convinced; on the white sheet a quieter outline action sits at
the point of resolved comparison — after the deciding row, never interrupting
the columns; on the midnight plane the high-gravity action closes the proof,
white or dark-soft against near-black. The label states the mechanical next
step in the mono voice (`START EVALUATION`, `VIEW LIMITS`), never an emotional
appeal — precision in the verb is what makes the small rectangle feel
trustworthy. One primary per region still governs: a surface that repeats its
primary CTA on every band is shouting, not staging.

Primary actions stay small-radius rectangular with uppercase mono labels and
clear contrast, never full pills. Borders ARE the elevation here — there is no
floating shadow (`--contrast-elevation` is `none`): bound secondary and outline
CTAs with `--contrast-edge-hairline` on white sheets and `--contrast-edge-dark` on
midnight panels, and reach for `--contrast-edge-strong` or fill polarity to mark
the chosen option before color. The mono labels on these
buttons follow the [mono label system](pattern.mono-labels); the buttons anchor the
claim-first regions on the landing, the conversion rows on
pricing, the high-gravity actions on the midnight proof plane,
and the single primary submit on the workflow form sheet.

Related: reinforces `pattern.mono-labels`.
