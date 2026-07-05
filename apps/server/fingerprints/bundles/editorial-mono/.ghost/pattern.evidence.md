---
description: The ruled evidence bands — tight horizontal rows of label, fact, interpretation, and implication drawn by `--editorial-hairline` rules on the faint `--editorial-ruled-paper` grid, split into columns by `--editorial-column-rule`, a so-what beside every fact and no orphaned stats. Reach for how facts justify the verdict through alignment rather than cards or color.
---

## Composition

Evidence in Editorial Mono reads as tight horizontal bands rather than scattered
stats or equal-weight cards. Each band carries a label, a fact, its interpretation,
and its implication, separated by hairline rules, with mono uppercase or compact
labels and a so-what beside every fact. No orphaned stats: a number without a claim
does not earn a place.

**Ruled evidence bands.** Build evidence as full-width or panel-contained bands
separated by `--editorial-hairline` rules — one ink weight that draws each row,
never a box or fill — each scan-friendly: label, fact, interpretation,
implication, using the [mono metadata](pattern.metadata) labels for the short uppercase
headers. Let the bands sit on the faint `--editorial-ruled-paper` baseline grid so
the type rests on ledger ruling like stock you could write on. Where a band carries
parallel facts across options, split them with `--editorial-column-rule` hairlines
at `--editorial-column-gap` so the criteria justify into aligned columns and trust
comes from alignment rather than color. Where a separation must read softer than a
row divide but firmer than the paper grid, reach for `--editorial-hairline-faint`.
Keep the rhythm tight (`--space-3`/`--space-4` internal, larger decisive breaks
between zones) so the bands feel edited rather than busy. Demote caveats, risks, and
tradeoffs into these bands so they support the decision rather than competing with
it. Weak or empty cells stay visible; gaps are part of the evidence.

**Specimen figures.** Where one fact in a band is the fact — the delta that
decides, the number the verdict rests on — it may take the type-specimen
treatment: the serif at `--editorial-specimen-size` and
`--editorial-specimen-leading`, sitting inside its band with a mono caption
beneath naming exactly what it measures. The specimen sheet's logic applies —
show the material large, label it small — and its budget is strict: one specimen
figure per evidence region, or the page becomes a KPI wall wearing serif. The
oversized figure is still evidence, not decoration; it keeps its row, its label,
and its so-what.

**The measure made visible.** Where a comparison's credibility rests on its
alignment, the evidence region may reveal its own construction: faint
`--editorial-guide-rule` lines extended a `--editorial-guide-gap` beyond the
column edges, like the drawn guides on a compositor's paste-up board. Everything
inside must actually sit on those guides — a revealed measure that the content
then violates is worse than no guides at all. Use once per surface at most; the
guides frame the region that carries the comparison, never the whole page.

**Risk and caveat rows.** Failure, warning, blocked, or caveat states ride the same
ruled-band rhythm. Keep severity exact and austere without becoming hostile — reach
for ink, border weight, and an uppercase Risk or Caveat label before semantic color,
and reserve true danger, success, info, and warning tokens for real state.

## Skeleton

```html
<section class="evidence" style="background-image: var(--editorial-ruled-paper);">
  <div class="band" style="display: grid; grid-template-columns: 12ch 1fr 1.4fr; column-gap: var(--editorial-column-gap); border-top: var(--editorial-hairline); padding: var(--space-4) 0;">
    <p class="band-label" style="font-family: var(--editorial-folio-font); font-size: var(--editorial-folio-size); letter-spacing: var(--editorial-folio-tracking); text-transform: uppercase; color: var(--color-text-muted);">
      <!-- Evidence / Risk / Caveat / Criteria --></p>
    <p class="band-fact"><!-- the fact, exact --></p>
    <p class="band-sowhat" style="color: var(--color-text-alt);"><!-- interpretation and implication — the so-what --></p>
  </div>
  <div class="band" style="display: grid; grid-template-columns: 12ch 1fr 1.4fr; column-gap: var(--editorial-column-gap); border-top: var(--editorial-hairline); border-bottom: var(--editorial-hairline); padding: var(--space-4) 0;">
    <p class="band-label">RISK</p>
    <p class="band-fact"><!-- weak or empty cells stay visible --></p>
    <p class="band-sowhat"><!-- gaps are part of the evidence --></p>
  </div>
</section>
```

**Bound:** hairline rules between bands (never boxes or fills), the identical
column measure repeated on every band, a tracked mono uppercase label opening
each row, and a so-what beside every fact. **Open:** the column ratio and
count, whether parallel options split with `--editorial-column-rule` borders,
whether one figure takes the specimen treatment, and whether the region reveals
its measure with guide rules.

Evidence justifies the claim rather than postponing it. Where evidence carries the
strongest contrast moment or the recommendation itself, it is promoted into the
[single inverse-ink panel](pattern.inverse-panel); the bands otherwise stay on paper
neutrals beneath the [masthead](pattern.masthead) and ahead of the [editorial close](pattern.close).

Related: reinforces `pattern.metadata`; contrasts with `pattern.inverse-panel`.
