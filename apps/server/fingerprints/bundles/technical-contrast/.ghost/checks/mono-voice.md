---
name: mono-voice
description: Monospace is a label system, never a paragraph voice — uppercase mono for labels only, kept legible at or above --text-sm.
severity: medium
references:
  - pattern.mono-labels
  - index
---

The one all-caps mono voice carries eyebrows, buttons, tabs, table headers,
badges, and compact metadata — the narrative stays sentence-case geometric sans.

Reject the generated surface if:

- paragraphs or narrative copy are set in `--font-mono` — mono is never a
  paragraph, and console-like mono body text forfeits the register;
- buttons are set in casual body text instead of the uppercase mono label voice;
- mono labels drop below `--text-sm`, breaking the uppercase label system's
  legibility (the `--text-xs` size is reserved for the metadata-strip and
  dimension-callout conventions, not general labels);
- display headlines go all-caps — all-caps is reserved for the mono system.

Pass when sentence-case geometric sans carries all narrative and uppercase mono
carries only labels, short and parallel, at legible sizes.
