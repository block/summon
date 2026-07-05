---
description: An annotated on-brand dossier fragment — folio corner, masthead verdict headline, framed inverse verdict slab, and three ruled evidence bands built from the real --editorial-* tokens; pull this as the quality bar for what a composed Editorial Mono surface looks like in code.
---

A complete fragment in the bundle's real vocabulary — a decision brief that
opens with the masthead, commits in the framed inverse slab, and justifies
itself in ruled bands. Everything references the injected custom properties;
nothing invents a value.

```html
<article style="background: var(--editorial-paper-page); background-image: var(--editorial-ruled-paper); color: var(--color-text); font-family: var(--font-serif); padding: var(--space-9) var(--space-7) var(--space-7); max-width: 880px; margin: 0 auto;">

  <!-- Instrument corner: folio + registration tick, tracked mono, inert -->
  <p style="font-family: var(--editorial-folio-font); font-size: var(--editorial-folio-size); letter-spacing: var(--editorial-folio-tracking); text-transform: uppercase; color: var(--color-text-muted); margin: 0 0 var(--space-8);">
    ✚ Brief 07 · Set 2026-07-05 · Vendor selection
  </p>

  <!-- Masthead: the verdict is the first visual event -->
  <header style="border-bottom: var(--editorial-rule-heavy); padding-bottom: var(--space-6);">
    <h1 style="font-size: var(--text-2xl); line-height: var(--leading-display); letter-spacing: var(--tracking-display); margin: 0 0 var(--space-5); max-width: 18ch;">
      Move the archive to Meridian; the migration cost is real but bounded.
    </h1>
    <p style="font-size: var(--text-md); line-height: var(--leading-reading); color: var(--color-text-alt); max-width: 60ch; margin: 0;">
      Of the three vendors surveyed, only Meridian clears the retention
      requirement without a custom contract. The price premium buys the audit
      trail we currently fake by hand.
    </p>
  </header>

  <!-- Framed inverse verdict slab: the one place the page inverts -->
  <section style="margin: var(--space-7) 0; border-top: var(--editorial-verdict-frame-rule); border-bottom: var(--editorial-verdict-frame-rule); padding: var(--space-4) 0;">
    <div style="background: var(--editorial-verdict-bg); color: var(--editorial-verdict-fg); padding: var(--editorial-verdict-pad); border-radius: var(--editorial-verdict-radius);">
      <p style="font-family: var(--editorial-folio-font); font-size: var(--editorial-folio-size); letter-spacing: var(--editorial-folio-tracking); text-transform: uppercase; margin: 0 0 var(--space-3);">
        Recommendation
      </p>
      <p style="font-size: var(--text-lg); line-height: var(--leading-section); margin: 0;">
        Sign Meridian for 24 months. Accept the 12% premium; decline the
        analytics add-on.
      </p>
    </div>
  </section>

  <!-- Ruled evidence bands: label · fact · so-what, drawn by hairlines -->
  <section>
    <div style="display: grid; grid-template-columns: 12ch 1fr 1.4fr; column-gap: var(--editorial-column-gap); border-top: var(--editorial-hairline); padding: var(--space-4) 0;">
      <p style="font-family: var(--editorial-folio-font); font-size: var(--editorial-folio-size); letter-spacing: var(--editorial-folio-tracking); text-transform: uppercase; color: var(--color-text-muted); margin: 0;">Retention</p>
      <p style="margin: 0;">11-year immutable storage, certified.</p>
      <p style="margin: 0; color: var(--color-text-alt);">The only vendor that meets the mandate off the shelf — this fact decides.</p>
    </div>
    <div style="display: grid; grid-template-columns: 12ch 1fr 1.4fr; column-gap: var(--editorial-column-gap); border-top: var(--editorial-hairline); padding: var(--space-4) 0;">
      <p style="font-family: var(--editorial-folio-font); font-size: var(--editorial-folio-size); letter-spacing: var(--editorial-folio-tracking); text-transform: uppercase; color: var(--color-text-muted); margin: 0;">Cost</p>
      <p style="margin: 0;">$41k/yr — 12% over the incumbent.</p>
      <p style="margin: 0; color: var(--color-text-alt);">Premium is offset by retiring the manual audit process within two quarters.</p>
    </div>
    <div style="display: grid; grid-template-columns: 12ch 1fr 1.4fr; column-gap: var(--editorial-column-gap); border-top: var(--editorial-hairline); border-bottom: var(--editorial-hairline); padding: var(--space-4) 0;">
      <p style="font-family: var(--editorial-folio-font); font-size: var(--editorial-folio-size); letter-spacing: var(--editorial-folio-tracking); text-transform: uppercase; color: var(--color-danger); margin: 0;">Risk</p>
      <p style="margin: 0;">Migration window is 6 weeks, single-threaded.</p>
      <p style="margin: 0; color: var(--color-text-alt);">Blocked if the export runs long — schedule it ahead of the fiscal close.</p>
    </div>
  </section>

  <!-- Editorial close: the verdict resolved into action, above the heavy seam -->
  <footer style="margin-top: var(--space-7); border-top: var(--editorial-rule-heavy); padding-top: var(--space-4);">
    <p style="font-family: var(--editorial-folio-font); font-size: var(--editorial-folio-size); letter-spacing: var(--editorial-folio-tracking); text-transform: uppercase; color: var(--color-text-muted); margin: 0 0 var(--space-2);">
      What to watch
    </p>
    <p style="margin: 0; max-width: 60ch;">
      Approve by July 18 to hold the migration window. The accepted tradeoff:
      we pay for audit certainty we could not build ourselves this year.
    </p>
  </footer>
</article>
```

**Load-bearing:**

- The **reading order** — folio corner → verdict headline → framed inverse slab
  → ruled evidence → close. The verdict is legible before any detail; this is
  the whole architecture, not a layout choice.
- **One inversion.** Exactly one region uses `--editorial-verdict-bg` /
  `--editorial-verdict-fg`, square-cornered (`--editorial-verdict-radius`),
  unshadowed, framed once by `--editorial-verdict-frame-rule` pairs.
- **Rules draw everything.** Bands are separated by `--editorial-hairline` and
  the masthead/footer seams by `--editorial-rule-heavy`; there is not one
  `box-shadow`, rounded card, or fill container anywhere.
- **Shared measure.** All three evidence bands use the identical
  `12ch / 1fr / 1.4fr` column grid with `--editorial-column-gap`, so trust
  comes from alignment. Every fact carries its so-what in the third column.
- **Mono furniture.** Every label routes through `--editorial-folio-font` with
  `--editorial-folio-tracking`, uppercase, using the exact copy atoms
  (Recommendation, Risk, What to watch). The `✚` registration mark and the
  `--space-9` breath above the masthead are part of the register.
- **Semantic ink used once, truthfully.** `--color-danger` marks only the Risk
  label — a real state, not decoration.

**Incidental:** the vendor-selection content, the `880px` max-width and `18ch`/
`60ch` measures (any disciplined measure works), the three-band count, and the
specific column ratio — a surface may use `--editorial-column-rule` borders
instead of gap-only columns. What must not vary: the order, the single
inversion, the hairline material, and the label discipline.
