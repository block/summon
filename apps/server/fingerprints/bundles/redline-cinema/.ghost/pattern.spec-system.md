---
description: The giant-numeral spec system — oversized spec figures with uppercase labels and units, hairline comparison grids, and race-or-event rows where the scarce race-red marks only the decisive value. Reach for it when raw numbers must prove capability and invite side-by-side comparison, or when a surface lists sessions, dealers, results, or lineup positions as hairline rows — on the dark stage or a white transactional relief sheet.
---

## Composition

Data reads as specification. Performance, racing, event, or product data becomes
oversized numerals paired with labels and units, compact uppercase labels,
aligned hairline rows and grids for comparison, and red on only the decisive
value or active position.

**Large-number spec grid.** Oversized numerals set at `--redline-spec-numeral`
(up to 132px) in modest `--redline-spec-numeral-weight` — dramatic in size, never
bombastic in weight — each paired with a compact uppercase label and unit tracked
at `--redline-spec-unit-tracking`, aligned in a grid or row with hairline
dividers, `--redline-voltage` on only one decisive value. Numerals must carry real
performance, ranking, availability, or comparison information — each with a label
and unit and aligned with comparable metrics — never decorative big type.

**Race-or-event row system.** Hairline-separated rows with date or sequence at
left, name and context in the middle, status, result, or action at right,
uppercase labels and muted metadata, and `--redline-voltage` only for the active
position or the primary row action. This is the rhythm for lineups, schedules,
results, and sessions.

**Exact values.** Numerals: `--redline-spec-numeral` = `clamp(56px, 9vw, 132px)`,
weight `--redline-spec-numeral-weight` = `600`, `line-height: 1`, tracking
`--tracking-tight` (`-0.01em`). Units ride inline at `--text-xl` (26px) in
`--color-text-muted` (`#969696`). Labels sit beneath at `--text-xs` (11px),
uppercase, tracked `--redline-spec-unit-tracking` (`0.10em`). Cells divide with
`--redline-hairline` (`1px solid #303030`) only — no cell backgrounds, no shadow.
Rows pace at `--space-3`/`--space-4` (16/24px) vertical padding; row indices use
the mono voice at `--redline-mono-label` (11px, `0.14em` tracking). On a white
relief sheet the hairline flips to `--redline-hairline-on-light`
(`1px solid #d2d2d2`) and hover to `--redline-row-hover-on-light` (`#f2f2f2`).
Red budget: `--redline-voltage` on at most one value or one active row per grid,
never on units, labels, or dividers — the local application of the page-wide
viewport law: never two red elements visible at once.

**Bound:** the numeral/unit/label anatomy, hairline-only separation, the
left-index/middle-name/right-status row order, and the one-red-per-grid budget.
**Open:** cell count (2–4 up), which metric is decisive, whether rows carry a
squared action or a plain status, and whether the block sits on the dark stage or
a white relief sheet.

The numerals and rows lean on [hairline and brightness depth](principle.depth) for
separation rather than shadow, and pair with the [control system](pattern.controls) for
their labels and any row actions. When these values headline a dedicated
performance story they lead the surface as its proof act; when they sit inside a
dense transactional listing, a white relief sheet carries them with the same
anatomy intact. See the assembled reference in
[the spec-chapter exemplar](exemplar.spec-chapter).

Related: reinforces `pattern.controls`, `principle.depth`.

## Skeleton

```html
<section class="spec-block" style="border-top: var(--redline-hairline); border-bottom: var(--redline-hairline);">
  <dl class="spec-grid" style="display: grid; grid-template-columns: repeat(3, 1fr);">
    <div class="spec-cell" style="padding: var(--space-6) var(--space-4); border-right: var(--redline-hairline);">
      <dd style="font-size: var(--redline-spec-numeral); font-weight: var(--redline-spec-numeral-weight); line-height: 1;">
        2.9<span class="spec-unit" style="font-size: var(--text-xl); color: var(--color-text-muted);">s</span>
      </dd>
      <dt style="font-size: var(--text-xs); text-transform: uppercase; letter-spacing: var(--redline-spec-unit-tracking); color: var(--color-text-muted);">0–100 km/h</dt>
    </div>
    <!-- repeat cell; at most ONE dd may take color: var(--redline-voltage) -->
  </dl>

  <ul class="session-rows" style="list-style: none; margin: 0; padding: 0;">
    <li style="display: grid; grid-template-columns: 120px 1fr auto; padding: var(--space-3) 0; border-bottom: var(--redline-hairline);">
      <span class="row-index"><!-- mono date/sequence --></span>
      <span class="row-name"><!-- name + context, sans --></span>
      <span class="row-status"><!-- uppercase status/result/action --></span>
    </li>
  </ul>
</section>
```
