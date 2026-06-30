---
description: The three-plane polarity system — pale landings, white data sheets, and near-black midnight bands that invert the page, banded full-width with border-led depth and no shadows. Reach for how planes set a surface's macro rhythm through contrast rather than decoration.
relates:
  - to: proof-cards
    as: reinforces
  - to: data-sheets
    as: reinforces
---

## Composition

Contrast planes are the primary material of Technical Contrast — distinct planes
create rhythm through polarity, not ornament. Pale and white canvases serve
approachability, product detail, pricing, forms, testimonials, and tables;
near-black midnight serves proof, research, or high-gravity claims. Avoid broad
middle-grey backgrounds; if a softer rail is needed, keep it hairline-light and
functional. Let plane changes separate major ideas before reaching for borders or
shadows.

**Banded technical narrative.** Long surfaces move between pale landing planes
(`--contrast-plane-pale-bg`/`--contrast-plane-pale-fg`), white technical sheets
(`--contrast-plane-sheet-bg`/`--contrast-plane-sheet-fg`), and midnight proof
planes (`--contrast-plane-midnight-bg`/`--contrast-plane-midnight-fg`) so each
band has a clear job. Each plane is a full-bleed band with no side gutters
(`--contrast-band-inset: 0`), generous vertical air (`--contrast-band-pad-y`),
horizontal breathing room (`--contrast-band-pad-x`), and a contained reading
measure (`--contrast-band-max`) so the headline and claim land at the top before
any grid or table — the band is the unit of thought. Crossing onto the midnight
plane must flip the page via `--contrast-plane-invert`, so black ink becomes white
and hairlines turn dark-soft as a deliberate change of register, not a theme
toggle. Keep section padding generous at plane boundaries and tighter inside rows;
do not introduce many tinted bands or stack grey on grey with no polarity change.
The white `--color-bg`/`--color-surface` carries sheets, forms, and tables;
`--color-surface-muted` is the hairline-light rail, table-header fill, and subtle
footer stencil; `--color-surface-dark` is the midnight proof plane with
`--color-surface-dark-soft` for dark cards and badges inside it.

**Code editor breakout.** A compact dark code or configuration mockup can break
up a white plane — midnight panel, mono-caption code, small radius, no elaborate
window chrome, limited syntax accents — paired with a nearby claim as a proof or
implementation break, never the landing's main decoration.

**Low-contrast terminal sign-off.** Long surfaces may close with an oversized,
low-contrast terminal phrase tinted close to the hairline surface color as a
quiet stencil sign-off — derived from the user's prompt, never a source wordmark,
domain, or slogan; omit it on short or task-like surfaces.

The plane changes set the stage that the [data sheets](data-sheets) and
[proof cards](proof-cards) sit inside, that the [mono labels](mono-labels) orient,
and that the [CTA system](cta-system) drives — across the [landing](landing),
[pricing](pricing), [proof](proof), and [workflow](workflow) surfaces. Depth
stays hairline-led: keep card corners lightly rounded and flat and reserve subtle
shadow only for truly floating host controls or transient overlays.
