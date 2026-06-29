---
name: base-canvas-stays-warm-near-black
description: The generated cinematic canvas must be a warm near-black, never pure #000 — pure black flattens the photographic depth.
severity: high
surface: core
---

Redline Cinema's drama comes from a warm near-black canvas that lets full-bleed
photography, 1px hairlines, and dark-grey brightness steps create depth. Reject the
generated surface if the base canvas collapses to pure black:

- the page/body background, hero underlay, or primary dark sections set to
  `#000`, `#000000`, `black`, or `rgb(0,0,0)`;
- dark elevated plates that sit on pure black so brightness steps disappear;
- gradients or overlays that bottom out at pure black across whole sections.

Use the warm near-black canvas token (`--color-bg: #181818`) for the hero, feature,
proof, and footer frames, and keep elevated plates one brightness step above it
(`--color-surface-muted: #303030`). Pure black removes the cinematic warmth and the
hairline/brightness depth that this language depends on — reach for the near-black
canvas token rather than absolute black.
