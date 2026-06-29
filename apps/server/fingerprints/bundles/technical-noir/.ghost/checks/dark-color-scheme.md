---
name: warm-dark-color-scheme
description: The generated surface must render in the warm-dark color scheme — off-white material on a brown-warmed dark canvas, never a light-mode skin.
severity: high
surface: core
---

Technical Noir is a warm-dark material system: a brown-warmed near-charcoal
canvas with off-white text and controls. Reject the generated surface if it
abandons the dark scheme:

- a light-mode page (white or beige page background with dark text);
- a re-skin of a researched source site's light-page expression;
- cool-gray dark mode that drops the warm temperature;
- pages that opt out of `color-scheme: dark` or invert the material to a bright
  canvas.

The surface must keep the off-white-on-warm-dark relationship: the page canvas
is dark, primary text and primary action fill are off-white, and warmth (not a
chromatic accent) replaces brand color. Inject the token vocabulary and reference
`--color-bg`, `--color-surface`, and `--color-text` rather than inventing a
light palette.
