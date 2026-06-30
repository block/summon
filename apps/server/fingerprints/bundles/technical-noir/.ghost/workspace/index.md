---
description: The workspace surface — a single-canvas operational overview of active technical work tracked by 6px `--noir-dot` status lights, hairline rows, and an off-white selection spine marking the active task, its evidence, and its next action. Reach for this when the first question is "what is happening right now and what do I do next?"
relates:
  - to: terminal-evidence
    as: reinforces
  - to: tiles
    as: reinforces
---

## Composition

A workspace shows running technical work. Reach for this surface when the user's
first question is "what is happening right now, and what do I do next?" — an
agent workspace, a parallel-tasks overview, a session dashboard — not when the
job is to argue a product value (the [landing](../landing)) or to write up a
single investigation as a report (the [brief](../brief)).

**Warm-dark reading-mode shell.** Use a single continuous warm near-charcoal
canvas with clear zones for summary, active work, evidence, and next action,
framed inside a bounded shell or wide content band on a shared width and compact
spacing rhythm. Sections stay on one canvas, separated by spacing (64–96px major
desktop padding), typography, rows, and the `--noir-hairline` — never background
changes and never a generic equal-weight dashboard grid. Dense evidence zones may
carry the faint `--noir-grid` for felt texture; canvas-soft fills appear only for
contained tiles, mockups, or forms.

**Active work, made scannable.** Carry parallel tasks, sessions, or jobs as
[hairline information rows or compact tiles](../tiles): label, short title, muted
detail, live status as a 6px `--noir-dot-*` (idle, run, ok, fail), optional
compact action. Mark the active item with the off-white `--noir-spine`, not
saturated color. Give the running work its
[terminal evidence](../terminal-evidence) — logs, agent steps, command output,
the one blinking `--noir-cursor` (`--noir-cursor-blink`) marking the live edge —
and close each zone with one calm next action from the [control system](../controls).

The whole page must read as one workspace, not a pile of equal cards: let zones
emerge from spacing, hairlines, and alignment.
