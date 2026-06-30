---
description: The stream surface — a live, paced feed of ordered updates on a signal rail with mode tabs and saturated interruptions. Reach when the first question is "what is happening right now, in order?"
relates:
  - to: tiles
    as: reinforces
  - to: controls
    as: reinforces
---

## Composition

A stream shows live, ordered signal. Reach for this surface when the user's first
question is "what is happening right now, and in what order?" — a live feed, a
launch ticker, a high-volume news rail, a status stream — not when the job is to
curate a paced editorial front page (that is the [digest](../digest)) or to write
up a single state or recommendation as a report (that is the
[briefing](../briefing)).

**Signal rail feed.** Stack ordered updates on the visible `--signal-rail-*`
spine (`--signal-rail-width` on `--signal-rail-color`) with mono timestamps,
ranks, or state on the rail and rounded [tile](../tiles) bodies beside it,
separated by `--signal-rail-gap`. Drop `--signal-rail-tick-size` markers down its
length — `--signal-rail-tick-color` mint ticks for the stream and a
`--signal-rail-tick-recent` violet tick for the freshest update — so recency is a
physical column before a word is read. Tight 12–16px gaps keep it reading as one
continuous stream. An occasional saturated tile interrupts the rhythm for a lead
or urgent item — never let every row carry equal weight. Make
order/recency/sequence visible without paragraph reading: the ticked rail, a
repeated timestamp, a numbered sequence, or a compact status line.

**Segmented stream tabs.** Switch modes through the `--signal-tab-*` [segmented
tabs](../controls) — zero `--signal-tab-gap`, hairline-bordered, uppercase mono
labels (Top Stories, Latest, Live…) with the active segment marked by the
`--signal-tab-active-underline` mint underline, full-width and tappable on
mobile. The active underline is the only saturated element in the control.

The rail and tiles follow the [tile system](../tiles); the mode pills and any
primary action follow the [controls](../controls); the loud lead borrows the
[canvas](../canvas) saturated hazard fill. On mobile, collapse the layout while
preserving the mode controls, lead hierarchy, metadata, and saturation — never
desaturate or drop metadata to fit.
