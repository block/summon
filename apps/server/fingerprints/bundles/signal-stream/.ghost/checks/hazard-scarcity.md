---
name: hazard-accent-scarcity
description: Hazard voltages must stay rationed and jobbed — mint and violet as scarce markers with legible roles, one shout and at most one RGB-split per surface, never a saturated wash.
severity: medium
references:
  - principle.canvas
  - pattern.transmission-grammar
  - pattern.cadence
  - exemplar.stream-fragment
---

Signal Stream's accents are hazard markers, not a theme color. Reject the
generated surface if the voltages lose their scarcity or their job:

- more than 3 saturated fills per viewport, more than 1 mint CTA per region, or a viewport that reads as
  a saturated wash / poster wall rather than a dark field with interruptions;
- a hazard color used without a legible job (priority, action, state, section,
  or interruption) — accent as decoration;
- accent hexes outside the token palette, pastel-tinted hazards, or a hazard
  fill missing its paired `-fg` text color;
- more than one primary mint CTA per region, or mint and violet used
  interchangeably instead of mint = primary/live, violet = secondary/rail/recent;
- more than one `--signal-shout-*` display line per surface, or a second
  static RGB-split (`--signal-rgb-split`) instance — one per surface, at most,
  and only on display-scale lines, never body, metadata, or controls;
- saturation riding the dwell register — a saturated fill inside a narrow
  reading passage — instead of staying on the skim layer.

The pass state: a warm near-black field where saturated moments are countable,
each one names its job, and the alternation of dense dark runs and rare bright
interruptions is visible in every viewport.
