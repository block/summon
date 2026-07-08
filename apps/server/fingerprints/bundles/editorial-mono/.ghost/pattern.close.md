---
description: The editorial close — a short, decisive closing region landed above the `--editorial-rule-heavy` footer seam and tagged with an `--editorial-folio-font` folio beside the `--editorial-registration-mark`, framed as a recommendation, accepted tradeoff, risk, or next action rather than a passive recap or competing CTAs. Reach for how the page commits and registers its final line.
---

## Composition

The closing region of an Editorial Mono surface is short, decisive, and framed as a
recommendation, accepted tradeoff, risk, or next action — kept shorter and stronger
than the evidence that precedes it. It is the editorial implication of the page, not
a passive recap or a row of competing CTA buttons.

**Editorial close.** Make the close visible through border weight, rule placement, or
a small inverse label rather than a loud button cluster. Land the region above a
`--editorial-rule-heavy` footer rule so its 2px ink weight reads as the page's final
seam, and tag it with a folio set in `--editorial-folio-font` beside the
`--editorial-registration-mark` so the close reads as the registered foot of a
printed sheet. State the decision, the accepted tradeoff, the residual risk, or the
single next action in one calm, committed line. Use a [mono metadata](pattern.metadata)
label — Recommendation, Accepted tradeoff, What to watch, Risk — to mark it, and
reach for the [single inverse-ink panel](pattern.inverse-panel) — `--editorial-verdict-bg`
on `--editorial-verdict-fg` — only if the close itself carries the verdict. Avoid
passive summaries, competing CTAs, or a recap that restates the masthead without
adding judgment.

**Exact values.** The footer seam is `--editorial-rule-heavy` — 2px solid
`#11100e`, never the 1px hairline. The label sits in `--editorial-folio-font`
at `--editorial-folio-size` (10px) with `--editorial-folio-tracking` (0.18em),
uppercase, using the exact copy atoms: Recommendation, Accepted tradeoff, What
to watch, Risk. The close's body stays at `--text-md` (15px) or larger on a
max measure around 60ch. Spacing: `--space-7` above the seam, `--space-4`
between the seam and the label. The registration tick is the literal
`--editorial-registration-mark` glyph `✚` set beside the folio.

**Bound:** the heavy 2px seam above, one mono copy-atom label, one committed
line kept shorter than the evidence, and the registered folio foot. **Open:**
which copy atom labels it, whether the line rides the inverse slab (only when
the close itself carries the verdict), and whether a single quiet action link
accompanies the line — never a CTA cluster.

A ruled footer and editorial close land the page: the close echoes the
[masthead](pattern.masthead) verdict it opened with, now resolved into an action.

Related: reinforces `pattern.inverse-panel`, `pattern.metadata`.

## Skeleton

```html
<footer class="close" style="margin-top: var(--space-7); border-top: var(--editorial-rule-heavy); padding-top: var(--space-4);">
  <p class="close-label" style="font-family: var(--editorial-folio-font); font-size: var(--editorial-folio-size); letter-spacing: var(--editorial-folio-tracking); text-transform: uppercase; color: var(--color-text-muted);">
    Recommendation <!-- or: Accepted tradeoff / What to watch / Risk --></p>
  <p class="close-line" style="font-size: var(--text-md); line-height: var(--leading-reading); max-width: 60ch;">
    <!-- one calm, committed line: the decision, the tradeoff, or the next action --></p>
  <p class="close-folio" style="font-family: var(--editorial-folio-font); font-size: var(--editorial-folio-size); letter-spacing: var(--editorial-folio-tracking); text-transform: uppercase; color: var(--color-text-muted);">
    ✚ <!-- folio · set date --></p>
</footer>
```
