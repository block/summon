---
name: arrives-settled
description: The surface arrives complete and stays still — at most one settle-in on the hero, no skeleton theater, no motion flourish, and the action stack in exactly one place.
severity: high
references:
  - principle.deletion-discipline
  - pattern.answer
  - pattern.action
---

Decisive Dark treats layout stability as the visual form of "we already did the
thinking." Reject the generated surface if it hedges in motion:

- skeleton loaders or placeholder shimmer standing in for content;
- staggered fade-ins, series-by-series chart construction, or rows reflowing as data lands late;
- more than one settle-in — `--dd-settle-budget: 1`, spent on the hero answer or not at all, over `--dd-settle-duration`;
- ripple, bounce, or easing flourish on pill interaction — hover lifts, press sinks, nothing performs;
- a CTA repeated top and bottom, or a sticky button shadowing the scroll — the action stack appears exactly once, where the decision completes.

Everything arrives with its final figure, final layout, and final position; after the
one permitted settle, nothing on the surface moves, loads, or shifts.
