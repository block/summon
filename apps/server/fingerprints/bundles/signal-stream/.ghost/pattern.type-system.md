---
description: The shout-versus-whisper type contract — one condensed uppercase display line per surface at 0.86 leading, sans body split into skim and dwell velocities, and tracked mono metadata doing the navigating; pull it whenever type must anchor or orient — leads, verdicts, review recommendations, comparison conclusions — and refuse a calm headline in its place.
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

**Type is set for a velocity.** Every passage serves one of two reading speeds.
The skim voice — shout, chapter statements, mono pills, rail labels — is built
to be caught by a moving eye: compact leading, tracked uppercase, hazard color
doing the flagging. The dwell voice is built to be stopped at: body passages
narrow to `--signal-dwell-measure` and open to `--signal-dwell-leading`, and
the saturation falls away around them. Loudness belongs to the skim layer,
room belongs to the dwell layer — a tracked-uppercase paragraph or a saturated
dwell block mixes the velocities and muddies both. Chapter breaks take the
condensed `--signal-chapter-font` at `--signal-chapter-size`, a section-scale
statement that stays below the one shout per surface; the [stream
cadence](pattern.cadence) decides where they land.

**Source-neutral masthead placeholder.** When a publication identity is needed,
use a fictional or task-derived title (Signal Brief, Launch File, Field Notes, or
the user's product name) as a composition role — display scale and placement,
never copied letterforms or real publisher marks.

**Bound:** one `--signal-shout-*` display line per surface at `0.86` leading,
uppercase, on the `clamp()` scale — wrapping cleanly, never clipping the host
frame, ≥72px top breathing room; display scale never on buttons, tables, or
body; mono metadata tracked at ≈0.11–0.18em with a 10–12px floor (collapse
layout, never shrink); chapter statements at `--signal-chapter-size`, below the
shout; skim and dwell velocities never mixed. **Open:** the shout's copy and
whether it pairs with a kicker or deck, which pills each item carries, and the
masthead's fictional or task-derived title.

The display shout and mono metadata read against the [dark canvas](principle.canvas); the
metadata labels ride the rails and tiles of the [tile system](pattern.tiles) and the
mode pills of the [controls](pattern.controls). The shout is loudest as the lead on the
stream and digest; on a briefing it states the
recommendation before any prose.

Related: reinforces `principle.canvas`, `pattern.tiles`.
