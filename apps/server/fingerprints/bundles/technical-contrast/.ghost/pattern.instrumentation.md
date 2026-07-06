---
description: The instrumentation system — plane changes as narrative beats, a thin uppercase-mono `--contrast-meta-strip` metadata row with version, build date, status, and a `SHEET 03 / 07` locator, one deliberate `--contrast-grid-guide` grid exposure behind a table, a constant `--contrast-anchor` wordmark lockup across all three planes, index/overview dual projections of the same items, and stated subtractive sheet scope. Reach for how a surface proves it is an engineered document rather than a decorated page.
---

## Composition

Instrumentation is how a Technical Contrast surface proves it was engineered:
the page carries genuine metadata, exposes its own construction exactly once,
and keeps one constant anchor across every plane change. None of it is
decoration — every instrument on the sheet must be true.

**Plane change as narrative beat.** The midnight proof plane arrives exactly
where the argument pivots from claim to evidence — the
[contrast-plane](principle.contrast-planes) flip via `--contrast-plane-invert` is the
structural beat that says "now we prove it." Never alternate planes rhythmically
for visual variety: a pale/white/midnight/white stripe pattern with no
argumentative pivot reads as theming, not register. One surface may cross onto
midnight more than once only if the argument genuinely pivots more than once.

**Instrument-panel metadata strip.** A thin utility row runs at a sheet edge —
top or bottom — set in `--contrast-meta-strip-font` uppercase at
`--contrast-meta-strip-size` with `--contrast-meta-strip-gap` between entries and
`--contrast-edge-hairline` (or `--contrast-edge-midnight-soft` on midnight)
separating it from the content: version, build date, status, and a
`SHEET 03 / 07` locator in `--contrast-num-variant` tabular figures. The strip is
static, genuine instrumentation — real values from the generated document, in the
one all-caps [mono label](pattern.mono-labels) voice — never a decorative ticker, fake
telemetry, or animated chrome.

**Exposed grid as credibility device.** In exactly one deliberate location per
surface — typically behind the primary [data sheet](pattern.data-sheets) — render the
construction: `--contrast-grid-guide` 1px guide lines or faint column rules
(`--contrast-grid-guide-dark` on midnight) laid behind the table so the aligned
`--contrast-num-align` columns are visibly sitting on a measured grid. One
exposure proves precision; a second exposure, or guides running the length of the
page, reads as background texture and forfeits the proof. Everywhere else the
grid stays implicit in the alignment itself.

**Constant anchor across planes.** One wordmark or mono lockup — set at
`--contrast-anchor-size` with `--contrast-anchor-tracking`, named from the user's
prompt per the no-source-brand rule — persists in the same position across pale,
white, and midnight planes, with only its ink adapting to each plane's fg/bg
pair. The anchor is what makes the plane flips read as one document changing
register rather than three stitched pages; individual planes must not restate
their own header styling, logo treatment, or navigation around it.

**Index/overview duality.** When a surface presents comparable items, offer the
same entities as two projections: a dense mono index list — one item per row at
`--contrast-index-row-gap`, mono label, key figure, hairline divider — and a
table overview in the [data-sheet](pattern.data-sheets) anatomy. Same entities, same
order, identical row anatomy in each projection; no per-item variance, feature
cards for some items, or entries that exist in one projection but not the other.
The duality is two lenses on one dataset, not two datasets.

**Measured annotation discipline.** Instrumentation extends to how facts are
annotated: when a figure needs context, annotate it the way an engineer
dimensions a drawing — a mono callout stating the measurement and its unit,
aligned to the fact it measures, at hairline weight. The finest of these
conventions (corner ticks, register marks at plane seams, dimension-line
callouts) live in the [drafting-mark system](pattern.drafting-marks) and follow the same
law as every instrument here: each mark must be true, sparse, and attached to
something measured. Annotation that gestures at precision without stating a
value — decorative crosshairs, empty reticles, coordinate noise — is costume,
not instrumentation, and is rejected outright.

**Subtractive scope.** Every sheet states what it covers — in the metadata strip,
the lead, or a mono scope label — and omits adjacent content rather than gesturing
at it. No "see also" sprawl, related-links rails, or trailing teasers for material
the sheet does not contain; the `SHEET 03 / 07` locator already tells the reader
there are other sheets. Scope is a promise: everything stated is on the sheet,
and nothing on the sheet is out of scope.

New tokens in the contrast namespace (extending the core vocabulary):

```css
:root {
  /* Instrument-panel metadata strip — thin uppercase mono utility row at sheet edges. */
  --contrast-meta-strip-font: var(--font-mono);
  --contrast-meta-strip-size: var(--text-xs);
  --contrast-meta-strip-transform: uppercase;
  --contrast-meta-strip-tracking: var(--tracking-label);
  --contrast-meta-strip-gap: var(--space-6);
  --contrast-meta-strip-pad-y: var(--space-3);

  /* Exposed grid — 1px guide lines rendered behind a table in ONE deliberate location. */
  --contrast-grid-guide: 1px solid rgba(0, 0, 0, 0.05);
  --contrast-grid-guide-dark: 1px solid rgba(255, 255, 255, 0.07);

  /* Constant anchor — the one wordmark/mono lockup persistent across all three planes. */
  --contrast-anchor-font: var(--font-mono);
  --contrast-anchor-size: var(--text-sm);
  --contrast-anchor-tracking: var(--tracking-label);
  --contrast-anchor-transform: uppercase;

  /* Dense mono index list — the second projection of the same entities as the table overview. */
  --contrast-index-row-gap: var(--space-3);
  --contrast-index-divider: var(--contrast-edge-hairline);
}
```

The metadata strip and anchor speak in the [mono label](pattern.mono-labels) voice; the
grid exposure and index/overview duality serve the [data sheets](pattern.data-sheets);
and the narrative-beat rule governs when the [contrast planes](principle.contrast-planes)
are allowed to flip. All identity content in the strip and anchor stays
source-agnostic, named from the prompt.

Begin an instrumented surface from this structure — anchor constant across
planes, metadata strip at the sheet edge, one grid exposure behind the primary
table, and dual index/overview projections of the same items:

**Bound:** the anchor's constancy across planes; one grid exposure per surface;
the strip's mono-uppercase voice, tabular figures, and hairline separation;
identical row anatomy across both projections; all identity values
prompt-derived. **Open:** strip at top vs bottom, which plane hosts the
exposure, how many planes the argument needs, whether the index list precedes
or follows the overview table.

Related: reinforces `principle.contrast-planes`, `pattern.mono-labels`, `pattern.data-sheets`.

## Skeleton

```html
<body>
  <!-- Constant anchor: same position on every plane, ink adapts per plane -->
  <header class="anchor" style="font-family: var(--contrast-anchor-font); font-size: var(--contrast-anchor-size); letter-spacing: var(--contrast-anchor-tracking); text-transform: var(--contrast-anchor-transform);">
    PRODUCT-NAME-FROM-PROMPT
  </header>

  <section class="plane plane--pale" style="background: var(--contrast-plane-pale-bg); color: var(--contrast-plane-pale-fg);">
    <!-- claim band: eyebrow + sentence-case headline + lead, before any grid -->
  </section>

  <section class="plane plane--sheet" style="background: var(--contrast-plane-sheet-bg); color: var(--contrast-plane-sheet-fg);">
    <!-- ONE grid exposure: guide lines behind the primary data sheet only -->
    <div class="grid-exposure" style="background-image: repeating-linear-gradient(to right, transparent, transparent calc(100%/12 - 1px), rgba(0,0,0,0.05) calc(100%/12 - 1px), rgba(0,0,0,0.05) calc(100%/12));">
      <table class="data-sheet"><!-- pattern.data-sheets anatomy --></table>
    </div>
    <!-- Second projection of the SAME entities, same order -->
    <ul class="index-list" style="row-gap: var(--contrast-index-row-gap);">
      <li style="border-bottom: var(--contrast-index-divider);"><span class="mono-label">ITEM-01</span> <span class="key-figure">…</span></li>
    </ul>
  </section>

  <section class="plane plane--midnight" style="background: var(--contrast-plane-midnight-bg); color: var(--contrast-plane-midnight-fg);">
    <!-- proof: the plane flip lands where the argument pivots to evidence -->
  </section>

  <!-- Metadata strip: genuine values, tabular figures, SHEET locator -->
  <footer class="meta-strip" style="font-family: var(--contrast-meta-strip-font); font-size: var(--contrast-meta-strip-size); text-transform: var(--contrast-meta-strip-transform); letter-spacing: var(--contrast-meta-strip-tracking); display: flex; gap: var(--contrast-meta-strip-gap); padding-block: var(--contrast-meta-strip-pad-y); border-top: var(--contrast-edge-hairline); font-variant-numeric: var(--contrast-num-variant);">
    <span>V0.4.2</span><span>BUILT 2026-07-05</span><span>STATUS: CURRENT</span>
    <span style="margin-left: auto;">SHEET 03 / 07</span>
  </footer>
</body>
```
