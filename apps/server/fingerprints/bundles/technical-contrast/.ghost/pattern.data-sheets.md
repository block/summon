---
description: The pricing-table and data-sheet system — crisp white sheets with uppercase mono headers, aligned tabular numeric columns, hairline border separators, and contained signal-tinted stat tiles for cost, model, capacity, and capability comparison. Reach for how dense quantitative data is structured.
---

## Composition

Technical data stays structured: data earns trust through aligned rows, tabs,
headers, side navigation, and compact labels. Use tabular or matrix structures
for cost, model, capacity, latency, limits, and feature comparisons; keep shared
criteria visible rather than buried in separate cards; use mono headers and short
parallel row labels. Let dense tables scroll, stack with preserved row labels, or
collapse into category accordions instead of being replaced by unrelated cards.

**Pricing table sheet.** Pricing, model, capacity, and capability comparisons read
as crisp white sheets with uppercase-mono muted headers on a pale rail
(`--color-surface-muted`), geometric-sans body cells, and `--contrast-edge-hairline`
separators — no shadows, winner badges, or decorative artwork inside the sheet.
Numbers stack in `--contrast-num-font` tabular figures, set
`--contrast-num-align` right-aligned with `--contrast-num-variant` so digits line
up decimal-for-decimal under the mono headers, separated by
`--contrast-num-col-gap` — comparison reads down a column, not across scattered
cards.

**Staged density — claim first, drill-down on demand.** Complexity is clarified
by layering, not by deletion. A sheet leads with the decision-grade row — the
few criteria that actually separate the options — and stages the rest behind
explicit reveals: category accordions that expand full criterion groups, a
"full specification" tier of the same table, or a footnoted cell that opens its
derivation. Every deeper layer keeps the same anatomy as the surface layer —
same mono headers, same `--contrast-num-align` columns, same hairline rules —
so drilling down feels like focusing the same instrument, never entering a
different page. What is staged must remain honest: collapsed groups are named
with mono labels and row counts so the reader knows what is folded away, and
nothing decision-relevant hides below the first layer. Progressive disclosure
here serves comparison, not marketing — it is the difference between a sheet
that summarizes and a sheet that conceals.

**Tinted stat tiles.** Pastel tiles give rare relief on white planes — large
number in display type, label in mono caps, a restrained mint or periwinkle fill
(`--color-tint-mint`/`--color-tint-periwinkle`), small corners, no shadow. Used
sparingly, never a rainbow metric grid.

The sheet headers and cell labels follow the [mono label system](pattern.mono-labels);
where a card pairs a proof point with an operational implication rather than
parallel comparable cells, that is the [proof-card system](pattern.proof-cards) job, not a
data sheet. These sheets are the spine of the [pricing](pricing) surface and
support comparison anywhere on the [landing](landing) or [workflow](workflow)
surfaces.

Begin every comparison sheet from this structure — claim above the table, mono
headers on the muted rail, tabular numerics down the columns, chosen option
marked by edge weight:

**Bound:** claim before table; mono uppercase headers on `--color-surface-muted`;
`--contrast-num-align` right-aligned `tabular-nums` columns; hairline row
dividers; chosen column framed by `--contrast-edge-strong` (never a badge or
shadow); collapsed groups named with row counts; identical anatomy at every
disclosure depth. **Open:** row/column count, accordion vs full-spec tier vs
footnote for staged depth, whether tinted tiles appear at all, scroll vs stack
on mobile (row labels always preserved).

Related: reinforces `pattern.mono-labels`; contrasts with `pattern.proof-cards`.

## Skeleton

```html
<section class="plane plane--sheet" style="background: var(--contrast-plane-sheet-bg); color: var(--contrast-plane-sheet-fg); padding: var(--contrast-band-pad-y) var(--contrast-band-pad-x);">
  <div style="max-width: var(--contrast-band-max); margin: 0 auto;">
    <p class="eyebrow" style="font-family: var(--contrast-eyebrow-font); text-transform: uppercase; font-size: var(--contrast-eyebrow-size); letter-spacing: var(--contrast-eyebrow-tracking);">COMPARISON</p>
    <h2 style="font-family: var(--font-sans); letter-spacing: var(--tracking-tight);"><!-- sentence-case claim: what the deciding row is --></h2>

    <table style="border-collapse: collapse; border: var(--contrast-edge-hairline); width: 100%;">
      <thead>
        <tr style="background: var(--color-surface-muted);">
          <th class="mono-header" style="font-family: var(--contrast-eyebrow-font); text-transform: uppercase; font-size: var(--text-xs); letter-spacing: var(--tracking-label); text-align: left;">CRITERION</th>
          <th class="mono-header">OPTION-A</th>
          <th class="mono-header mono-header--chosen" style="border: var(--contrast-edge-strong);">OPTION-B · RECOMMENDED</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom: var(--contrast-row-divider);">
          <td><!-- short parallel row label, sans --></td>
          <td class="num" style="font-family: var(--contrast-num-font); text-align: var(--contrast-num-align); font-variant-numeric: var(--contrast-num-variant);"><!-- figure --></td>
          <td class="num" style="border-left: var(--contrast-edge-strong); border-right: var(--contrast-edge-strong);"><!-- figure --></td>
        </tr>
        <!-- staged density: collapsed groups named with mono labels + row counts -->
        <tr class="group-toggle"><td colspan="3"><button class="mono-label">LIMITS · 12 ROWS +</button></td></tr>
      </tbody>
    </table>

    <!-- optional: one or two tinted stat tiles, never a rainbow grid -->
    <aside class="stat-tile" style="background: var(--color-tint-mint); border-radius: var(--radius-md);">
      <span class="stat-number" style="font-size: var(--text-2xl);"></span>
      <span class="mono-label"></span>
    </aside>
  </div>
</section>
```
