---
name: flat-depth-no-shadow-elevation
description: Primary hierarchy must stay flat and graphic — borders, rules, saturation, and contrast, never drop-shadow elevation.
severity: medium
surface: core
---

Signal Stream's depth is flat by design. Reject the generated surface if primary
hierarchy depends on elevation effects:

- drop shadows, card lift, or material-style elevation on editorial surfaces;
- glow rings, frosted blur, or glass panels;
- image zoom / scale / opacity hover effects.

Hierarchy must come from 1px borders, inset rules/underlines, saturated fills,
spacing, and type scale. A separation ring, if needed, is a 1px outline only.
Hover transitions text or border color, not card position. Saturated fills are
the loudest elevation tier.
