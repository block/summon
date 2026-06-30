---
description: The brief surface — a summary→evidence→action report that states current state or a recommendation, proves it with mono-gutter terminal evidence and 6px status dots, and routes to one off-white primary action. Reach for this when the first question is "what happened, and what do I do?"
relates:
  - to: terminal-evidence
    as: reinforces
---

## Composition

A brief reports and routes. Reach for this surface when the user's first question
is "what happened, and what do I do?" — an alert investigation, an incident
write-up, a status report, a single-recommendation summary — not when the job is
to argue a product value (the [landing](../landing)), operate ongoing work (the
[workspace](../workspace)), or weigh several options against shared criteria (the
[comparison](../comparison)).

**Summary→evidence→action.** Open with current state or the recommendation in
quiet sans. Place the proof immediately after —
[terminal evidence](../terminal-evidence): logs, agent steps, diffs, findings.
End with one calm off-white next action from the [control system](../controls).
State the claim first; do not bury it under prose, and do not open with a
marketing posture.

**Muted severity.** Failure, warning, or blocked states stay muted — carried by
the 6px `--noir-dot-*` dots (idle, run, ok, fail) rather than filled banners —
unless severity truly demands stronger semantic color; a brief is a calm report,
not a red alarm dashboard. Carry the investigation timeline as
[hairline rows](../tiles) divided by the `--noir-hairline`, each scan-friendly,
and mark the step under review with the off-white `--noir-spine` so the eye lands
on it without color.
