---
description: The briefing surface — a lead→evidence→action report that states current state or a recommendation, proves it with compact rows, and routes to one next action. Reach when the first question is "what happened, and what do I do?"
relates:
  - to: tiles
    as: reinforces
  - to: controls
    as: reinforces
---

## Composition

A briefing reports and routes. Reach for this surface when the user's first
question is "what happened, and what do I do?" — a technology briefing, a review
verdict, an incident or launch write-up, a single-recommendation summary — not
when the job is to show live ordered updates (that is the [stream](../stream)) or
to curate an editorial front page of ranked stories (that is the
[digest](../digest)).

**Lead state, then evidence, then action.** Open with the current state or the
recommendation in the `--signal-shout-*` [display shout with a whisper
kicker](../type-system) — condensed Impact at `--signal-shout-leading: 0.86` — a
reader should grasp the lead, current state, and next action before body detail.
Place the proof immediately after as compact flat [hairline rows](../tiles) on
`--signal-tile-fill-flat` with `--signal-tile-shadow: none`: findings, timeline
steps, status lines, each scan-friendly with `--signal-pill-*` mono metadata
carrying time, order, confidence, or state. End with one calm [hazard-pill
CTA](../controls) — a single mint `--signal-pill-*` primary action per region.
State the claim first; do not bury it under prose, and do not open with a
marketing posture.

**Muted saturation.** A briefing is a calm report, not a loud feed: keep
saturation muted unless severity truly demands a stronger hazard accent — reach
for one restrained `--signal-hazard-violet` or `--signal-hazard-mint` accent on
the lead or verdict. Lean on the [canvas](../canvas) hairlines and inset rules
rather than a viewport of saturated tiles.

The evidence rows and timeline follow the [tile system](../tiles); the lead shout
and mono metadata follow the [type system](../type-system); the closing action
follows the [controls](../controls). On mobile, collapse the layout while
preserving the lead hierarchy, metadata, and the single next action.
