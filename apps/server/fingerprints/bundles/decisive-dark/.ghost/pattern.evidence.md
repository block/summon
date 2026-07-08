---
description: The bold evidence block — supporting data shown as discrete `--dd-bar` bars and candlesticks at full real estate with `--dd-axis` labels, or as tight uniform rows on near-black tiers — including option comparisons, where shared criteria align into parallel rows and the chosen path is marked by tier, never staggered cards — never soft smoothed curves. Reach for how the surface proves the answer with data that reads in one glance.
---

## Composition

Evidence in Decisive Dark provides supporting data and is optional — at most one
evidence region per surface, suppressed entirely when the [answer](pattern.answer) already
embeds the same visualization. When it appears, the visualization *is* the answer: big
enough to read in one glance, ordered by clear hierarchy, never a field of
equal-weight widgets the reader has to edit themselves.

**Bold, discrete data viz.** When evidence is a trend or distribution, render it
boldly — `--dd-bar` bars and candlesticks at `--dd-bar-gap` spacing, given the most
real estate on the surface, with `--dd-axis` axis labels and category keys so the
legend needs no interpretation. Use discrete bars over smoothed lines and varying
heights the eye can read instantly; a market chart reads technical and precise, like
real candlestick data, never a friendly curve that hides how the data moves. Reserve
`--dd-bar` accent for a positive trend only, and only if it is the surface's single
[accent moment](pattern.accent-moment); otherwise bars stay `--dd-bar-neutral`.

**Itemized rows and timelines.** When evidence is a list, timeline, or breakdown,
build uniform rows on near-black tiers (`--color-surface` / `--color-surface-muted`)
with consistent rhythm — a leading icon or gradient avatar, a title and sub line, and
a tabular-numeral amount tracked with `--dd-tnum`. Inset the content by
`--dd-content-inset` so the eye reads it as content, not chrome, and keep every row
the same height so the rhythm reads as edited. A number without a claim does not earn
a place — pair facts with their meaning rather than scattering orphaned stats.

**Option comparisons — parallel rows, never staggered cards.** When the evidence
weighs options against each other, align the shared criteria into uniform parallel
rows on the near-black tiers so the reader compares like against like. Keep weak or
empty cells visible — the gap is part of the comparison, and hiding it edits the
tradeoff out of the evidence. Mark the chosen path by position, weight, tier
(`--dd-surface-selected`), or the one [accent moment](pattern.accent-moment) — never a
colored badge, and never staggered per-option cards that break the parallel read
and hide the tradeoff.

**Evidence arrives whole and stays still.** A chart draws complete — final bars,
final heights, final axis — never growing in from zero or animating series by
series; a chart that performs its own construction spends the reader's time
re-proving what the surface already knows. Bars need no frame, no panel fill,
no plot-area background: the open canvas around them is the chart's frame, and
the `--dd-bar-gap` rhythm plus the dark behind the bars carry the structure
that gridlines would otherwise clutter in. Label only what the eye cannot infer
— endpoints, the peak, the axis anchors — and withhold the rest; a chart
legible without its labels is the proof that the data viz, not the annotation,
is doing the work.

Evidence justifies the [answer](pattern.answer) rather than postponing it, sits beneath the
hero on near-black tiers, and hands off to the [one-sentence meaning](pattern.meaning) that
names the so-what before the [action stack](pattern.action) guides the next move.

**Bound vs open.** Bound: at most one evidence region, sitting directly under
the hero; discrete bars/candles at `--dd-bar-gap`, series in
`--dd-bar-neutral`, axis labels in `--dd-axis` with tabular figures; no frame,
no plot-area fill, no smoothing, no construction animation. Open: bars vs
candlesticks vs uniform rows (rows swap the flex chart for tiered
`--color-surface` rows inset by `--dd-content-inset`), chart height, how many
labels the eye actually needs, and whether the accent lands here or elsewhere.

Related: reinforces `pattern.answer`; contrasts with `pattern.meaning`.

## Skeleton

```html
<section class="dd-evidence" aria-label="{what the chart shows}"
         style="margin-bottom: var(--dd-block-gap);">
  <!-- frameless bars on the open canvas: no panel fill, no gridlines -->
  <div style="display: flex; align-items: flex-end; gap: var(--dd-bar-gap);
              height: {chart height};">
    <div style="flex: 1; height: {n}%; background: var(--dd-bar-neutral);"></div>
    <div style="flex: 1; height: {n}%; background: var(--dd-bar-neutral);"></div>
    <!-- at most one bar in var(--dd-bar) accent, and only if this is the
         surface's single accent moment -->
  </div>
  <div style="display: flex; gap: var(--dd-bar-gap); margin-top: var(--space-2);
              font-size: var(--text-xs); color: var(--dd-axis);
              font-feature-settings: var(--dd-tnum);">
    <span style="flex: 1;">{axis label}</span>
  </div>
</section>
```
