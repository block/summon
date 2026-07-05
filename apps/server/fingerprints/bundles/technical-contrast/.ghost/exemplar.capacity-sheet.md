---
description: "Annotated exemplar — a white capacity data sheet crossing onto the midnight proof plane, with mono headers, aligned tabular columns, corner ticks on the recommended tier, a dimension callout, a metadata strip, and a proof card. Reach to see the whole grammar assembled in real markup before composing any comparison surface."
---

A complete two-band fragment: a white data sheet resolving a tier comparison,
then the midnight plane delivering one proof card. Every value references the
bundle's real tokens.

```html
<section style="background: var(--contrast-plane-sheet-bg); color: var(--contrast-plane-sheet-fg); padding: var(--contrast-band-pad-y) var(--contrast-band-pad-x);">
  <div style="max-width: var(--contrast-band-max); margin: 0 auto;">
    <p style="font-family: var(--contrast-eyebrow-font); text-transform: uppercase; font-size: var(--contrast-eyebrow-size); letter-spacing: var(--contrast-eyebrow-tracking); font-weight: 500; color: var(--color-text-muted); margin: 0 0 var(--space-4);">CAPACITY · SHEET 03 / 07</p>
    <h2 style="font-family: var(--font-sans); font-size: var(--text-2xl); letter-spacing: var(--tracking-tight); line-height: var(--leading-section); margin: 0 0 var(--space-3);">Three tiers, one ceiling that matters</h2>
    <p style="font-family: var(--font-sans); font-size: var(--text-md); line-height: var(--leading-reading); color: var(--color-text-alt); max-width: 60ch; margin: 0 0 var(--space-7);">Sustained throughput is the deciding row. Everything below it scales linearly with the tier you pick.</p>

    <table style="width: 100%; border-collapse: collapse; border: var(--contrast-edge-hairline);">
      <thead>
        <tr style="background: var(--color-surface-muted);">
          <th style="font-family: var(--contrast-eyebrow-font); text-transform: uppercase; font-size: var(--text-xs); letter-spacing: var(--tracking-label); text-align: left; padding: var(--space-3) var(--space-5); border-bottom: var(--contrast-edge-hairline);">CRITERION</th>
          <th style="font-family: var(--contrast-eyebrow-font); text-transform: uppercase; font-size: var(--text-xs); letter-spacing: var(--tracking-label); text-align: right; padding: var(--space-3) var(--space-5); border-bottom: var(--contrast-edge-hairline);">STARTER</th>
          <th style="font-family: var(--contrast-eyebrow-font); text-transform: uppercase; font-size: var(--text-xs); letter-spacing: var(--tracking-label); text-align: right; padding: var(--space-3) var(--space-5); border-bottom: var(--contrast-edge-hairline); border-left: var(--contrast-edge-strong); border-right: var(--contrast-edge-strong); border-top: var(--contrast-edge-strong);">SCALE · RECOMMENDED</th>
          <th style="font-family: var(--contrast-eyebrow-font); text-transform: uppercase; font-size: var(--text-xs); letter-spacing: var(--tracking-label); text-align: right; padding: var(--space-3) var(--space-5); border-bottom: var(--contrast-edge-hairline);">DEDICATED</th>
        </tr>
      </thead>
      <tbody style="font-family: var(--font-sans); font-size: var(--text-md);">
        <tr>
          <td style="padding: var(--space-3) var(--space-5); border-bottom: var(--contrast-row-divider);">Sustained throughput</td>
          <td style="font-family: var(--contrast-num-font); font-variant-numeric: var(--contrast-num-variant); text-align: var(--contrast-num-align); padding: var(--space-3) var(--space-5); border-bottom: var(--contrast-row-divider);">1,200 req/s</td>
          <td style="font-family: var(--contrast-num-font); font-variant-numeric: var(--contrast-num-variant); text-align: var(--contrast-num-align); padding: var(--space-3) var(--space-5); border-bottom: var(--contrast-row-divider); border-left: var(--contrast-edge-strong); border-right: var(--contrast-edge-strong);">9,600 req/s</td>
          <td style="font-family: var(--contrast-num-font); font-variant-numeric: var(--contrast-num-variant); text-align: var(--contrast-num-align); padding: var(--space-3) var(--space-5); border-bottom: var(--contrast-row-divider);">38,400 req/s</td>
        </tr>
        <tr>
          <td style="padding: var(--space-3) var(--space-5); border-bottom: var(--contrast-row-divider);">Context ceiling</td>
          <td style="font-family: var(--contrast-num-font); font-variant-numeric: var(--contrast-num-variant); text-align: var(--contrast-num-align); padding: var(--space-3) var(--space-5); border-bottom: var(--contrast-row-divider);">32,768</td>
          <td style="font-family: var(--contrast-num-font); font-variant-numeric: var(--contrast-num-variant); text-align: var(--contrast-num-align); padding: var(--space-3) var(--space-5); border-bottom: var(--contrast-row-divider); border-left: var(--contrast-edge-strong); border-right: var(--contrast-edge-strong);">131,072</td>
          <td style="font-family: var(--contrast-num-font); font-variant-numeric: var(--contrast-num-variant); text-align: var(--contrast-num-align); padding: var(--space-3) var(--space-5); border-bottom: var(--contrast-row-divider);">131,072</td>
        </tr>
        <tr>
          <td style="padding: var(--space-3) var(--space-5); border-bottom: var(--contrast-row-divider);">Regions</td>
          <td style="font-family: var(--contrast-num-font); font-variant-numeric: var(--contrast-num-variant); text-align: var(--contrast-num-align); padding: var(--space-3) var(--space-5); border-bottom: var(--contrast-row-divider);">1</td>
          <td style="font-family: var(--contrast-num-font); font-variant-numeric: var(--contrast-num-variant); text-align: var(--contrast-num-align); padding: var(--space-3) var(--space-5); border-bottom: var(--contrast-row-divider); border-left: var(--contrast-edge-strong); border-right: var(--contrast-edge-strong); border-bottom-color: #000;">3</td>
          <td style="font-family: var(--contrast-num-font); font-variant-numeric: var(--contrast-num-variant); text-align: var(--contrast-num-align); padding: var(--space-3) var(--space-5); border-bottom: var(--contrast-row-divider);">—</td>
        </tr>
      </tbody>
    </table>

    <!-- Dimension callout: hairline rule with terminal ticks + mono measurement label -->
    <div style="display: flex; align-items: center; gap: var(--space-3); margin-top: var(--space-4); max-width: 420px;">
      <span style="display: block; width: 1px; height: var(--contrast-tick-length); background: rgba(0,0,0,0.14);"></span>
      <span style="flex: 1; border-top: var(--contrast-dimension-rule);"></span>
      <span style="font-family: var(--contrast-dimension-font); font-size: var(--contrast-dimension-size); text-transform: uppercase; letter-spacing: var(--tracking-label); color: var(--color-text-muted);">8× THROUGHPUT SPAN</span>
      <span style="flex: 1; border-top: var(--contrast-dimension-rule);"></span>
      <span style="display: block; width: 1px; height: var(--contrast-tick-length); background: rgba(0,0,0,0.14);"></span>
    </div>

    <a href="#evaluate" style="display: inline-block; margin-top: var(--space-7); background: var(--color-accent); color: var(--color-accent-fg); font-family: var(--contrast-cta-font); text-transform: var(--contrast-cta-transform); font-size: var(--text-sm); letter-spacing: var(--tracking-label); padding: var(--contrast-cta-pad-y) var(--contrast-cta-pad-x); border-radius: var(--contrast-cta-radius); text-decoration: none;">START EVALUATION</a>
  </div>
</section>

<section style="background: var(--contrast-plane-midnight-bg); color: var(--contrast-plane-midnight-fg); padding: var(--contrast-band-pad-y) var(--contrast-band-pad-x);">
  <div style="max-width: var(--contrast-band-max); margin: 0 auto;">
    <p style="font-family: var(--contrast-eyebrow-font); text-transform: uppercase; font-size: var(--contrast-eyebrow-size); letter-spacing: var(--contrast-eyebrow-tracking); font-weight: 500; opacity: 0.6; margin: 0 0 var(--space-4);">PROOF</p>
    <h2 style="font-family: var(--font-sans); font-size: var(--text-2xl); letter-spacing: var(--tracking-tight); margin: 0 0 var(--space-7);">The ceiling holds under load</h2>
    <article style="background: var(--contrast-surface-midnight-raised); border: var(--contrast-edge-dark); border-radius: var(--radius-md); padding: var(--space-6); max-width: 360px;">
      <p style="font-family: var(--contrast-eyebrow-font); text-transform: uppercase; font-size: var(--text-xs); letter-spacing: var(--tracking-label); opacity: 0.6; margin: 0 0 var(--space-3);">BENCHMARK</p>
      <p style="font-family: var(--contrast-num-font); font-variant-numeric: var(--contrast-num-variant); font-size: var(--text-2xl); margin: 0 0 var(--space-3);">99.98%</p>
      <p style="font-family: var(--font-sans); font-size: var(--text-md); line-height: var(--leading-body); margin: 0 0 var(--space-4);">Requests completed within the latency budget at full tier throughput — capacity you can plan releases around.</p>
      <p style="font-family: var(--contrast-num-font); font-size: var(--text-xs); text-transform: uppercase; letter-spacing: var(--tracking-label); opacity: 0.6; border-top: var(--contrast-edge-midnight-soft); padding-top: var(--space-3); margin: 0;">P99 · 30-DAY WINDOW · N=1,200 RUNS</p>
    </article>
  </div>

  <!-- Metadata strip: genuine instrumentation at the sheet edge -->
  <footer style="max-width: var(--contrast-band-max); margin: var(--space-9) auto 0; display: flex; gap: var(--contrast-meta-strip-gap); border-top: var(--contrast-edge-midnight-soft); padding-top: var(--contrast-meta-strip-pad-y); font-family: var(--contrast-meta-strip-font); font-size: var(--contrast-meta-strip-size); text-transform: var(--contrast-meta-strip-transform); letter-spacing: var(--contrast-meta-strip-tracking); opacity: 0.6; font-variant-numeric: var(--contrast-num-variant);">
    <span>MERIDIAN CAPACITY</span>
    <span>V0.4.2</span>
    <span>BUILT 2026-07-05</span>
    <span>STATUS: CURRENT</span>
    <span style="margin-left: auto;">SHEET 03 / 07</span>
  </footer>
</section>
```

## What is load-bearing

- **Plane polarity with full inversion.** The white sheet band and the midnight
  band each carry their own fg/bg pair; on midnight the hairlines switch to
  `--contrast-edge-dark` / `--contrast-edge-midnight-soft` and the card fill to
  `--contrast-surface-midnight-raised`. Nothing light-plane survives the flip.
- **Claim before table.** Eyebrow → sentence-case headline → one-line lead →
  then the grid. The band is the unit of thought.
- **One all-caps mono voice.** Eyebrows, table headers, CTA label, condition
  footnote, and metadata strip all use the same uppercase mono treatment;
  narrative stays sentence-case sans. No mono paragraphs anywhere.
- **Aligned numeric columns.** `--contrast-num-font` + `tabular-nums` +
  right alignment under mono headers — comparison reads down the column.
- **Chosen-option marking by edge weight.** The recommended tier is framed by
  `--contrast-edge-strong` plus the `· RECOMMENDED` mono label — never a badge,
  fill color, or shadow.
- **Drafting marks that measure something real.** One dimension callout stating
  `8× THROUGHPUT SPAN` with terminal ticks; nothing decorative.
- **Proof with provenance.** The 99.98% pairs with an implication sentence and a
  hairline-separated condition line (`P99 · 30-DAY WINDOW · N=1,200 RUNS`).
- **Genuine instrumentation.** The metadata strip carries real document values
  and the `SHEET 03 / 07` locator in tabular figures; the product name
  (`MERIDIAN CAPACITY`) is fictional, prompt-style, never a source brand.
- **Zero box-shadow.** Every boundary is a border; `--contrast-elevation` stays
  `none`.

## What is incidental

The specific tier names, figures, and row count; the 360px proof-card width and
420px callout width; placing the metadata strip at the bottom rather than the
top; the single proof card (a grid of two or three follows the same anatomy).
Swap any of these freely — the anatomy above is what must survive.
