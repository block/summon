---
description: The display-shout and mono-metadata type system — one oversized condensed headline as a shout, a sans workhorse for body, and mono uppercase metadata that does the navigating. Reach for how type anchors and orients the page.
relates:
  - to: canvas
    as: reinforces
  - to: tiles
    as: reinforces
---

## Composition

Three type roles carry the language: a condensed **display shout**, a sans
workhorse for body, and **mono metadata**. Body is the sans workhorse; controls
and metadata are mono; `strong` emphasis takes the mint accent.

**Display shout anchors the page.** One oversized condensed display headline,
tight line-height, contrasted with compact metadata — a shout-versus-whisper.
The shout is rendered with the `--signal-shout-*` set: `--signal-shout-font`
(condensed Impact), `--signal-shout-size` (the `clamp()` display scale),
`--signal-shout-leading` at a near-solid `0.86`, `--signal-shout-transform:
uppercase`, `--signal-shout-tracking`, and `--signal-shout-weight`. Display scale
belongs only to a masthead, lead headline, or major section statement; never to
buttons, tables, or body. The `--signal-shout-size` clamp lets it wrap cleanly
and never clip the host frame — leave ≥72px top breathing room for host chrome.

**Display shout with whisper kicker.** A large condensed `--signal-shout-*`
headline pairs with a thin or mono tracked kicker; the deck carries the
implication. The shout states the signal, the whisper orients it — the
near-solid `--signal-shout-leading` is what makes the contrast read as a shout
and not a calm headline.

**Metadata is navigation.** Mono uppercase labels (≈0.11–0.18em tracking) carry
time, order, category, confidence, state, or action — not decoration. They render
as `--signal-pill-*` chips (`--signal-pill-font`, `--signal-pill-transform`,
`--signal-pill-tracking`). Keep them short, tracked, and placed near what they
orient. 10–12px minimum; do not shrink on mobile, collapse layout instead. Mono
uppercase metadata appears everywhere sequence, state, or category matters.

**Source-neutral masthead placeholder.** When a publication identity is needed,
use a fictional or task-derived title (Signal Brief, Launch File, Field Notes, or
the user's product name) as a composition role — display scale and placement,
never copied letterforms or real publisher marks.

The display shout and mono metadata read against the [dark canvas](canvas); the
metadata labels ride the rails and tiles of the [tile system](tiles) and the
mode pills of the [controls](controls). The shout is loudest as the lead on the
[stream](stream) and [digest](digest); on the [briefing](briefing) it states the
recommendation before any prose.
