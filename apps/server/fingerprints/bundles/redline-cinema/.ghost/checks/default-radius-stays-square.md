---
name: default-furniture-stays-square
description: Default furniture stays square and sharp-cornered — rounded CTAs, cards, and image plates break Redline Cinema's machined-precision luxury read.
severity: high
surface: core
---

Sharp, rectangular, sharp-edged furniture gives Redline Cinema its machined
precision and luxury read. Reject the generated surface if default furniture is
rounded:

- primary CTAs, cards, image plates, spec cells, or major bands with visible
  corner radius (rounded or pill-shaped buttons, soft 16–24px commerce cards);
- image corners that disagree with their containing plate;
- pill geometry used for a primary CTA rather than a compact badge or tag.

Keep CTAs, cards, image plates, spec cells, and bands square (`--radius-sm` and
`--radius-md` at `0px`). A tiny 4px radius (`--radius-xl`) is allowed for inputs,
modals, and utility controls only when usability requires it, and pill geometry
(`--radius-pill`) is reserved for compact badges or tags — never for the primary
CTA shape. Square corners are the default; rounding is the rare, justified
exception.
