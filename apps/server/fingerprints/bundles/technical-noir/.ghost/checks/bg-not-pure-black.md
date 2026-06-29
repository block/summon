---
name: background-not-pure-black
description: The generated surface's canvas must be a warm near-black charcoal, never pure black — warmth carries the material, not neon-on-black nostalgia.
severity: high
surface: core
---

Technical Noir's canvas is a warm near-charcoal that is browner than pure black.
Reject the generated surface if the page background is pure black:

- a `#000` / `#000000` page canvas or panel fill;
- pure-black terminal nostalgia, especially paired with neon green text;
- cool true-black dark mode with no warm temperature.

The background must be a warm near-black (browner than pure black, in the family
of the `--color-bg` token). Darkness exists to reduce noise and make technical
evidence readable — keep the canvas warm, keep cards only slightly lifted from
it, and let off-white text and hairline borders carry emphasis instead of high-
contrast pure-black drama.
