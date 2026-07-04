---
description: The control and metadata system — tight off-white primary CTAs, ghost secondary buttons bounded only by the warm `--noir-hairline`, dark inputs, and monospace `--noir-gutter` metadata labels. Reach for how the surface offers one primary action and labels state without color shouting.
---

## Composition

**Tight CTA geometry.** Primary and secondary controls use compact almost-
rectangular geometry (3–4px button radii), an off-white fill with warm-dark text
for one primary action, transparent/canvas-matching secondary actions whose only
boundary is the warm `--noir-hairline`, and circular or pill geometry only for
icon containers, status chips, or minimum mobile touch targets. One primary
action per region; reach for border weight, underline, or position before color.
When a control marks the selected or focused option in a set, carry it with the
2px off-white `--noir-spine` rather than a colored chip — selection is a bar of
light, not a fill.

**Mono metadata labels.** Monospace marks commands, paths, model names,
statuses, permission labels, timestamps, platform names, and short technical
chips, while sans carries paragraphs, headings, navigation, and button labels.
Keep mono compact and purposeful, with muted beige for metadata unless the value
is selected or primary. Status chips report real state through the muted
`--noir-dot-*` system — idle, run, ok, fail — never an invented color scale, and
command-style labels reserve the `--noir-gutter` glyph column so they read as
transcript, not prose. Monospace is a labeling and technical-content system, not
a paragraph voice. A chip that reports a capacity or usage value may carry a
micro-meter — three to five [density-field](pattern.density-field) ramp glyphs beside
the figure (`ctx =+#·· 61%`) — so quantity reads as ink density without a bar
widget or a colored gauge.

**State steps, never fades.** Control state changes are threshold events, not
transitions: hover snaps the boundary from `--color-border` to
`--state-hover-border` in one step, focus draws the ring at once, ink moves from
one `--noir-ink-*` level to the next without a cross-fade. The surface should
change the way a terminal repaints — discretely, honestly — because smooth
easing on chrome implies a theatricality this language refuses. The one blinking
cursor already spends the entire motion budget.

These controls and labels are shared material that appears on every surface —
the [terminal evidence](pattern.terminal-evidence) command strips and the [tile](pattern.tiles)
actions across the [landing](landing), [workspace](workspace),
[comparison](comparison), and [brief](brief) surfaces.

Related: reinforces `pattern.tiles`.
