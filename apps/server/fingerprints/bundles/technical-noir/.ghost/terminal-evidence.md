---
description: Terminal, code, and agent panels as evidence — minimal-chrome warm-dark panels carrying plausible commands, logs, agent steps, and output tied to the task.
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
fill (`--color-surface`) with a 1px warm hairline and 3–6px radius, monospace
commands/logs/agent steps/outputs, restrained status color only when it clarifies
real state, and a small muted or mono metadata label so the user knows what the
evidence represents. Prefer two strong evidence panels over many decorative
screenshots.

**Command-action pairs.** When setup, launch, install, or handoff is the task,
place an off-white primary button beside a warm-dark command strip with
plausible, copyable-looking command text — never command snippets as decoration
or competing primary commands.

**Tab-rail evidence frame.** Product, workflow, or setup alternatives use a
compact muted selector rail with one high-contrast active option and give most
space to a materially larger active evidence frame — used for comparing modes,
not simple one-path tasks.

The text inside these panels must be plausible and tied to the user request: no
lorem-ipsum code, abstract decorative blocks, or colorful syntax confetti. The
[control system](controls) governs the buttons and mono labels these panels
pair with; where terminal evidence proves a claim, a [tile](tiles) carries a
repeating unit of content.
