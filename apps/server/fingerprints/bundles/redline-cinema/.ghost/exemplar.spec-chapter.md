---
description: The reference cut — a complete spec-chapter fragment showing the numbered chapter chip, giant-numeral spec grid, hairline session rows, one voltage spend, and the single livery band, all in real --redline-* tokens. Pull it before writing any performance-proof or lineup region to see the shapes assembled correctly.
---

## The fragment

A "Powertrain" chapter from a launch surface: chapter chip, three-up spec grid on
the four-column backbone, a session-row block, one red CTA (the region's only
voltage), and the page's single livery band closing the act.

```html
<section style="background: var(--redline-canvas-warm); color: var(--color-text); padding: var(--space-8) 0;">
  <div style="max-width: 1200px; margin: 0 auto; padding: 0 var(--space-5); display: grid; grid-template-columns: repeat(var(--redline-grid-columns), 1fr); gap: var(--redline-grid-gutter);">

    <div style="grid-column: 1 / -1;">
      <span style="display: inline-block; border: var(--redline-chapter-chip-border); border-radius: var(--redline-machined-radius); padding: var(--space-1) var(--space-3); font-family: var(--font-mono); font-size: var(--redline-mono-label); letter-spacing: var(--redline-mono-tracking); text-transform: uppercase; color: var(--color-text-alt);">03 — Powertrain</span>
      <h2 style="margin: var(--space-4) 0 0; font-size: var(--text-3xl); font-weight: 600; letter-spacing: var(--tracking-display); line-height: var(--leading-section);">Proof, in numbers</h2>
    </div>

    <dl style="grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; border-top: var(--redline-hairline); border-bottom: var(--redline-hairline); margin: var(--space-6) 0 0;">
      <div style="padding: var(--space-6) var(--space-4); border-right: var(--redline-hairline);">
        <dd style="margin: 0; font-size: var(--redline-spec-numeral); font-weight: var(--redline-spec-numeral-weight); line-height: 1; letter-spacing: var(--tracking-tight);">2.9<span style="font-size: var(--text-xl); color: var(--color-text-muted);">s</span></dd>
        <dt style="margin-top: var(--space-3); font-size: var(--text-xs); letter-spacing: var(--redline-spec-unit-tracking); text-transform: uppercase; color: var(--color-text-muted);">0–100 km/h</dt>
      </div>
      <div style="padding: var(--space-6) var(--space-4); border-right: var(--redline-hairline);">
        <dd style="margin: 0; font-size: var(--redline-spec-numeral); font-weight: var(--redline-spec-numeral-weight); line-height: 1; letter-spacing: var(--tracking-tight); color: var(--redline-voltage);">830</dd>
        <dt style="margin-top: var(--space-3); font-size: var(--text-xs); letter-spacing: var(--redline-spec-unit-tracking); text-transform: uppercase; color: var(--color-text-muted);">Peak output · PS</dt>
      </div>
      <div style="padding: var(--space-6) var(--space-4);">
        <dd style="margin: 0; font-size: var(--redline-spec-numeral); font-weight: var(--redline-spec-numeral-weight); line-height: 1; letter-spacing: var(--tracking-tight);">340</dd>
        <dt style="margin-top: var(--space-3); font-size: var(--text-xs); letter-spacing: var(--redline-spec-unit-tracking); text-transform: uppercase; color: var(--color-text-muted);">Top speed · km/h</dt>
      </div>
    </dl>

    <ul style="grid-column: 1 / -1; list-style: none; margin: var(--space-7) 0 0; padding: 0;">
      <li style="display: grid; grid-template-columns: 120px 1fr auto; gap: var(--space-4); align-items: baseline; padding: var(--space-3) 0; border-bottom: var(--redline-hairline);">
        <span style="font-family: var(--font-mono); font-size: var(--redline-mono-label); letter-spacing: var(--redline-mono-tracking); color: var(--color-text-muted);">R01 · APR</span>
        <span style="font-size: var(--text-md);">Track session — dry, southern circuit</span>
        <span style="font-size: var(--text-xs); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--color-text-alt);">Completed</span>
      </li>
      <li style="display: grid; grid-template-columns: 120px 1fr auto; gap: var(--space-4); align-items: baseline; padding: var(--space-3) 0; border-bottom: var(--redline-hairline);">
        <span style="font-family: var(--font-mono); font-size: var(--redline-mono-label); letter-spacing: var(--redline-mono-tracking); color: var(--color-text-muted);">R02 · MAY</span>
        <span style="font-size: var(--text-md);">Endurance validation — 24h thermal cycle</span>
        <span style="font-size: var(--text-xs); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--color-text-alt);">Scheduled</span>
      </li>
    </ul>

    <div style="grid-column: 1 / -1; margin-top: var(--space-7);">
      <a href="#reserve" style="display: inline-block; background: var(--redline-voltage); color: var(--color-accent-fg); border-radius: var(--redline-machined-radius); padding: 14px var(--space-6); font-size: var(--text-sm); font-weight: 600; letter-spacing: var(--tracking-label); text-transform: uppercase; text-decoration: none;">Reserve</a>
      <a href="#spec" style="display: inline-block; margin-left: var(--space-4); color: var(--color-text); border: 1px solid var(--color-border-strong); border-radius: var(--redline-machined-radius); padding: 13px var(--space-6); font-size: var(--text-sm); letter-spacing: var(--tracking-label); text-transform: uppercase; text-decoration: none;">Full specification</a>
    </div>
  </div>
</section>

<div style="height: var(--redline-livery-band-h); background: var(--redline-livery-band);" role="presentation"></div>
```

## What is load-bearing

- **One voltage spend for the whole region.** Red appears on the decisive
  numeral (`830`) OR the CTA — the fragment shows the numeral spend; when this
  chapter's CTA must be the spend instead, the numeral drops back to white ink.
  In real output pick one; never ship both red as this fragment does only to
  demonstrate the two candidate roles. Everything else is white ink, grey
  `--color-text-muted` metadata, and `--redline-hairline` lines.
- **Square everywhere.** CTAs, the chip, spec cells: `--redline-machined-radius`
  (`0px`). No shadow anywhere — separation is hairlines top/bottom/right on the
  spec grid and one hairline under each session row.
- **The numeral/label pairing.** Giant `--redline-spec-numeral` figure at modest
  weight 600, unit inline in muted small type, uppercase label beneath at
  `--redline-spec-unit-tracking`. The number is real proof, never decorative.
- **Mono is instrumentation only.** The chapter chip and the `R01 · APR` indices
  use `--font-mono` at `--redline-mono-label`/`--redline-mono-tracking`; the
  sentence-length row text stays on the sans.
- **The livery band closes the act, once.** The final `4px` sweep is the page's
  single full-width red; it appears nowhere else.

## What is incidental

The specific metrics, session names, the 1200px max-width, three-up vs four-up
spec columns, the 120px row index column, and whether the CTA pair sits left or
right — all free to vary with the task. The grid could carry two or four cells;
the rows could be events, dealers, or lineup positions. Inline styles are for
demonstration; real output should use classes bound to the same tokens.
