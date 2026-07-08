---
description: Terminal, code, and agent panels as evidence — minimal-chrome warm-dark panels with a single blinking `--noir-cursor`, 6px `--noir-dot` status lights, and mono gutter lines carrying plausible commands, logs, agent steps, and output tied to the task. Reach for how a surface proves state with live-feeling terminal evidence, including landing/launch hero claims proven by evidence panels.
---

## Composition

Terminal, code, and agent panels are evidence surfaces that explain state,
commands, output, or workflow — never decoration.

**Terminal panels anchor evidence.** Render panels on a slightly lifted warm-dark
fill (`--color-surface`) bounded by the `--noir-hairline` at a 3–6px radius, with
the faint `--noir-grid` scan texture felt behind dense log or output bodies.
Prefix every command line, log row, and agent step with a `$`/`›`/hash glyph held
in the `--noir-gutter` mono column, mark the live edge of activity with exactly
one blinking off-white block cursor (`--noir-cursor` animated by
`--noir-cursor-blink`) per panel, and report step state through 6px `--noir-dot-*`
dots — idle, run, ok, fail — never a colored status bar. Add a small muted or mono
metadata label so the user knows what the evidence represents, and prefer two
strong evidence panels over many decorative screenshots.

**Live readouts are visual material.** The most credible panel is one that
appears to be measuring something. When the task has a quantity — progress,
throughput, elapsed time, items processed — give it a labeled readout row inside
the panel: a mono label in the gutter column, a [density field](pattern.density-field)
strip whose glyph ink maps to the value, and the exact figure beside it
(`sync ▏ ==+##..... ▏ 412/1024`). Readouts advance in discrete steps, cell by
cell, the way a terminal repaints — never a smoothly easing bar. A panel may
carry several readout rows, but they obey the transcript grid: same `ch` cells,
same 24px row rhythm as the log lines around them, no second typeface, no
rounded track. And the number must be plausible and task-tied — a readout with
an invented quantity is decoration wearing an instrument's clothes.

**Command-action pairs.** When setup, launch, install, or handoff is the task,
place an off-white primary button beside a warm-dark command strip with
plausible, copyable-looking command text — never command snippets as decoration
or competing primary commands.

**Tab-rail evidence frame.** Product, workflow, or setup alternatives use a
compact muted selector rail with one high-contrast active option — carried by the
`--noir-spine` rather than a colored tab — and give most space to a materially
larger active evidence frame, used for comparing modes, not simple one-path tasks.

**Bound:** the `--color-surface` lift bounded by `--noir-hairline` at 3–6px
radius; the `--noir-gutter` mono column on every line; the 24px line rhythm
sharing the `--noir-grid` lattice; exactly one `--noir-cursor` per panel; state
on a 6px `--noir-dot-*` plus a mono metadata label. **Open:** header/footer
layout, line count, whether a footer carries a command-action pair, readout
rows present or absent, the actual command and log content — which must always
be plausible and task-tied.

The text inside these panels must be plausible and tied to the user request: no
lorem-ipsum code, abstract decorative blocks, or colorful syntax confetti. The
[control system](pattern.controls) governs the buttons and mono labels these panels
pair with; where terminal evidence proves a claim, a [tile](pattern.tiles) carries a
repeating unit of content.

Related: reinforces `pattern.controls`, `pattern.density-field`; contrasts with `pattern.tiles`.

## Skeleton

```html
<section class="evidence-panel" style="background:var(--color-surface); border:var(--noir-hairline); border-radius:var(--radius-lg);">
  <header style="display:flex; align-items:center; gap:var(--space-3); padding:var(--space-4) var(--space-5); border-bottom:var(--noir-hairline);">
    <span class="dot" style="width:6px; height:6px; border-radius:var(--radius-pill); background:var(--noir-dot-run);"></span>
    <span style="font:400 var(--text-xs)/1 var(--font-mono); color:var(--color-text-muted);"><!-- what this evidence represents --></span>
  </header>
  <div role="log" style="padding:var(--space-5); background-image:var(--noir-grid); font:400 var(--text-sm)/24px var(--font-mono); color:var(--color-text-alt);">
    <div><span class="gutter" style="display:inline-block; width:var(--noir-gutter); color:var(--color-text-muted);">$</span><!-- command --></div>
    <div><span class="gutter" style="display:inline-block; width:var(--noir-gutter); color:var(--color-text-muted);">›</span><!-- output / agent step --></div>
    <div><span class="gutter" style="display:inline-block; width:var(--noir-gutter); color:var(--color-text-muted);">›</span><!-- readout row: mono label + density strip + exact value --></div>
    <div><span class="gutter" style="display:inline-block; width:var(--noir-gutter); color:var(--color-text-muted);">$</span><span class="cursor" style="display:inline-block; width:1ch; height:1em; background:var(--noir-cursor); animation:blink var(--noir-cursor-blink);"></span></div>
  </div>
</section>
```
