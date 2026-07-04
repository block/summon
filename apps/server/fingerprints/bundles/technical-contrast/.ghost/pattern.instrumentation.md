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

Related: reinforces `principle.contrast-planes`, `pattern.mono-labels`, `pattern.data-sheets`.
