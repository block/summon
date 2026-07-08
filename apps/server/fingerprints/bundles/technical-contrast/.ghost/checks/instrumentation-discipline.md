---
name: instrumentation-discipline
description: Instruments stay sparse and true — two-or-three drafting marks per surface, at most one emphasized element per band, exactly one grid exposure per surface.
severity: medium
references:
  - pattern.drafting-marks
  - pattern.instrumentation
---

Instrumentation proves engineering only while it stays sparse; accumulated
marks read as diagram costume and forfeit the register.

Reject the generated surface if:

- more than two or three drafting marks (dimension callouts, register marks,
  corner-tick sets) appear on the surface — a page laced with leader lines
  reads as a diagram costume;
- corner ticks frame more than one emphasized element per band, or carry
  selection alone without `--contrast-edge-strong` or a mono label;
- the exposed grid (`--contrast-grid-guide` / `--contrast-grid-guide-dark`)
  appears in more than one location, or guides run the length of the page as
  background texture — one exposure per surface proves precision;
- any mark annotates nothing measured: decorative crosshairs, empty reticles,
  or coordinate noise without a stated value;
- a surface crossing more than one plane renders no constant anchor.

Pass when every instrument is true, sparse, and attached to something measured,
with one grid exposure at most and one emphasized element per band.
