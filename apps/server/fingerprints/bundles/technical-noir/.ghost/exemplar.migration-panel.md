---
description: Annotated reference fragment — a terminal evidence panel running a schema migration, with gutter glyphs, dot-labeled steps, a density-field readout row, and the one blinking cursor, built entirely from the `--noir-*` and `--color-*` tokens. Pull to see the panel + readout composition done right before writing new markup.
---

## Exemplar

A workspace fragment: one terminal evidence panel reporting a live schema
migration, followed by its density-field readout. Every value references the
injected token contract; nothing is invented.

```html
<section class="panel" style="
  background: var(--color-surface);
  border: var(--noir-hairline);
  border-radius: var(--radius-lg);
">
  <header style="
    display: flex; align-items: center; gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    border-bottom: var(--noir-hairline);
  ">
    <span style="
      width: 6px; height: 6px; border-radius: var(--radius-pill);
      background: var(--noir-dot-run);
    " aria-hidden="true"></span>
    <span style="
      font: 400 var(--text-xs)/1 var(--font-mono);
      letter-spacing: var(--tracking-label);
      color: var(--color-text-muted);
    ">migrate · db/schema · running</span>
  </header>

  <div role="log" aria-label="Migration output" style="
    padding: var(--space-5);
    background-image: var(--noir-grid);
    font: var(--noir-mono-weight, 400) var(--text-sm)/24px var(--font-mono);
    color: var(--color-text-alt);
  ">
    <div><span style="display:inline-block; width:var(--noir-gutter); color:var(--color-text-muted);">$</span>summon migrate --env staging</div>
    <div><span style="display:inline-block; width:var(--noir-gutter); color:var(--color-text-muted);">›</span>applying 0041_add_run_index.sql <span style="color:var(--color-success);">ok</span></div>
    <div><span style="display:inline-block; width:var(--noir-gutter); color:var(--color-text-muted);">›</span>applying 0042_backfill_runs.sql</div>

    <!-- Density-field readout row: label · glyph strip · exact value -->
    <div aria-label="Backfill progress: 412 of 1024 rows">
      <span style="display:inline-block; width:var(--noir-gutter); color:var(--color-text-muted);">›</span><span style="color:var(--color-text-muted);">rows </span><span aria-hidden="true"><span style="color:var(--noir-ink-4);">####==</span><span style="color:var(--noir-ink-2);">++::</span><span style="color:var(--noir-ink-1);">--....&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></span><span style="color:var(--color-text-muted);"> 412/1024</span>
    </div>

    <div>
      <span style="display:inline-block; width:var(--noir-gutter); color:var(--color-text-muted);">$</span><span class="cursor" style="
        display: inline-block;
        width: var(--noir-density-cell-w); height: 1em;
        background: var(--noir-cursor);
        animation: blink var(--noir-cursor-blink);
      "></span>
    </div>
  </div>

  <footer style="
    display: flex; justify-content: space-between; align-items: center;
    padding: var(--space-4) var(--space-5);
    border-top: var(--noir-hairline);
  ">
    <span style="font: 400 var(--text-xs)/1 var(--font-mono); color: var(--color-text-muted);">elapsed 00:03:42</span>
    <button style="
      font: 500 var(--text-sm)/1 var(--font-sans);
      background: var(--color-accent); color: var(--color-accent-fg);
      border: none; border-radius: var(--radius-md);
      padding: var(--space-4) var(--space-5);
    ">Pause migration</button>
  </footer>
</section>

<style>
  @keyframes blink { 50% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .cursor { animation: none; } }
</style>
```

**Load-bearing** (remove any of these and it stops being Technical Noir):

- The panel edge is `--noir-hairline` on a `--color-surface` lift — no shadow,
  no glow, no second border style anywhere in the fragment.
- Every transcript line reserves the `--noir-gutter` mono column for its
  `$`/`›` glyph, so command, log, readout, and cursor lines align
  character-for-character on the same lattice.
- The readout row is the density field in canon form: ordered ramp glyphs
  (`#` densest → space emptiest) stepped through `--noir-ink-4/2/1`, with the
  exact figure `412/1024` beside the texture — neither appears without the
  other, and the strip is text set like text, not a bar widget.
- State is the 6px `--noir-dot-run` dot plus a mono text label
  (`running`) — never a colored chip; success whispers as inline
  `--color-success` text, not a banner.
- Exactly one blinking `--noir-cursor` block marks the live edge, animated by
  `--noir-cursor-blink`, resting solid under reduced motion — the panel's
  entire motion budget.
- One off-white primary action (`--color-accent` fill, `--color-accent-fg`
  text) on the 10px `--space-4` control step.

**Incidental** (vary freely): the migration subject matter, filenames, and
figures; the footer layout; whether the header label reads left or right;
line count of the log body; the `aria-label` phrasing. Swap in whatever live
work the task actually has — the lattice, budgets, and token references are
what carry the language.
