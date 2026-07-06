---
description: The single inverse-ink panel — at most one black verdict slab per surface, the `--editorial-verdict-bg` carrying `--editorial-verdict-fg` cream ink with square `--editorial-verdict-radius` corners, reserved for the recommendation, verdict, or strongest claim. Reach for the page's one decisive emphasis when a moment must commit.
---

## Composition

Editorial Mono allows at most one inverse black panel per surface, reserved for the
recommendation, verdict, or strongest contrast moment. The rest of the surface stays
on paper neutrals with ruled structure and crisp square corners, so the single
inverse panel reads as the page's one decisive emphasis rather than a styling motif.

**Single inverse ink panel.** Render the panel with the signature verdict slab —
`--editorial-verdict-bg` black paper carrying `--editorial-verdict-fg` cream ink —
set its breathing room with `--editorial-verdict-pad`, and keep its corners square
with `--editorial-verdict-radius` (0px, no rounding, no shadow). Place it where the
page most needs to commit — the verdict headline moment, the recommended option, or
the strongest claim. This is the one place the page inverts, and nothing else is
allowed to. Never spend the inverse panel on decoration, a second panel, or a
competing region; if two moments compete for it, the verdict wins and the other
demotes to a [ruled evidence band](pattern.evidence). Emphasis is made from this inverse
ink, rules, type, spacing, and alignment before any color.

**Exact values.** The slab is `--editorial-verdict-bg` `#11100e` carrying
`--editorial-verdict-fg` `#fffdf6` — the same two inks as the page, swapped.
Padding is `--editorial-verdict-pad` (`--space-7` `--space-6`, i.e. 44px 34px);
corners are `--editorial-verdict-radius` (0px — never rounded); shadow is none,
always. Its label, if any, is tracked mono in `--editorial-folio-font`; its
claim sits at `--text-lg` (22px) or larger with `--leading-section`. Inside a
dossier the slab may be framed once by `--editorial-verdict-frame-rule`
hairline pairs; the frame and the inversion together are still the one
emphasis, never repeated elsewhere.

**Bound:** black-on-cream inversion, square corners, no shadow, at most one per
surface, mono copy-atom label. **Open:** where on the page it lands (masthead
moment, promoted evidence, or the close), whether it carries a claim or a
governing number, and whether the dossier frame surrounds it.

The inverse panel is the loudest the surface gets; it pairs with the
[editorial close](pattern.close) when the close itself carries the recommendation, and it
contrasts with the paper-neutral [evidence bands](pattern.evidence) that justify it.

Related: contrasts with `pattern.evidence`; reinforces `pattern.close`.

## Skeleton

```html
<section class="verdict-slab" style="background: var(--editorial-verdict-bg); color: var(--editorial-verdict-fg); padding: var(--editorial-verdict-pad); border-radius: var(--editorial-verdict-radius);">
  <p class="verdict-label" style="font-family: var(--editorial-folio-font); font-size: var(--editorial-folio-size); letter-spacing: var(--editorial-folio-tracking); text-transform: uppercase;">
    Verdict <!-- or: Recommendation / Rank --></p>
  <p class="verdict-claim" style="font-size: var(--text-lg); line-height: var(--leading-section);">
    <!-- the one decisive claim, number, rank, or delta --></p>
</section>
```
