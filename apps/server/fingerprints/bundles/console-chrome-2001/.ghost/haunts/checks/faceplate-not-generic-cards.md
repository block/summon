---
name: console-faceplate-not-generic-cards
description: Every Console Chrome surface must read as one assembled console faceplate, not a neutral page with floating card modules.
severity: high
references:
  - index
  - pattern.plates
  - pattern.command-nav
  - pattern.hardware-dressing
---

Console Chrome 2001 depends on a molded chassis: periwinkle/pale-sky/platinum plates,
hard indigo bevel edges, carbon command slabs, section labels, and dense modules bolted
into one fixed-canvas shell. Reject the generated surface if it collapses to generic web
layout:

- a neutral header followed by independent white cards on a flat or gradient background;
- soft shadow card elevation replacing hard `--chrome-bevel` plate depth;
- large luxury whitespace that removes the compact control-panel texture;
- unlabeled modules with no command layer, section-label bars, dotted dividers, or hardware motif.

The first impression must be a composed faceplate: outer chassis, command/nav layer,
beveled plates, and at least one signature hardware cue such as halftone carbon, a
chamfered panel, outlined box-art title, side rail, or orange arrow control.
