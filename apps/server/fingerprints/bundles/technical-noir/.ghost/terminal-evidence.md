---
description: Terminal, code, and agent panels as evidence — minimal-chrome warm-dark panels with a single blinking `--noir-cursor`, 6px `--noir-dot` status lights, and mono gutter lines carrying plausible commands, logs, agent steps, and output tied to the task. Reach for how a surface proves state with live-feeling terminal evidence.
relates:
  - to: controls
    as: reinforces
  - to: tiles
    as: contrasts
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

**Command-action pairs.** When setup, launch, install, or handoff is the task,
place an off-white primary button beside a warm-dark command strip with
plausible, copyable-looking command text — never command snippets as decoration
or competing primary commands.

**Tab-rail evidence frame.** Product, workflow, or setup alternatives use a
compact muted selector rail with one high-contrast active option — carried by the
`--noir-spine` rather than a colored tab — and give most space to a materially
larger active evidence frame, used for comparing modes, not simple one-path tasks.

The text inside these panels must be plausible and tied to the user request: no
lorem-ipsum code, abstract decorative blocks, or colorful syntax confetti. The
[control system](controls) governs the buttons and mono labels these panels
pair with; where terminal evidence proves a claim, a [tile](tiles) carries a
repeating unit of content.
