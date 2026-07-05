---
description: Guard against soft-luxury drift — not rounded CTAs, 16–24px commerce cards, pill buttons, shadow stacks, or a pure-#000 canvas; instead square machined geometry at 0px radius, hairline-and-brightness depth, and the warm #181818 stage; recognize the switch by any visible corner radius on default furniture.
---

## The refused default

The generic "premium dark" output rounds everything, stacks drop shadows for
elevation, and floors the page on dead `#000`. That is soft lifestyle commerce
wearing a dark skin — the opposite of Redline Cinema's machined, cinematic
precision. This guard names both halves of the drift: soft geometry and dead
depth.

**Not** rounded CTAs, soft 16–24px commerce cards, or pill-shaped primary
buttons — **instead** `--redline-machined-radius` (`0px`) on every CTA, card,
image plate, spec cell, and major band. `--radius-sm` and `--radius-md` are `0px`
by contract. The only permitted rounding: a tiny 4px `--radius-xl` on inputs,
modals, and utility controls where usability genuinely requires it, and
`--radius-pill` on compact badges or tags only — never the primary CTA shape.

**Not** image corners that disagree with their plate — **instead** the image and
its containing frame both hold `--redline-frame-radius` (`0px`); the plate is
never softened.

**Not** drop-shadow elevation systems — **instead** depth from
[hairlines and brightness](principle.depth): a plate rises exactly one
`--redline-brightness-step` (`#303030`) above the canvas behind a
`--redline-hairline`. `--shadow-mini`, `--shadow-card`, and `--shadow-elevated`
are `none` by contract; shadow exists only on transient popovers and modals.

**Not** a pure-black stage — **instead** the warm near-black
`--redline-canvas-warm` (`#181818`). Never `#000`, `#000000`, `black`, or
`rgb(0,0,0)` as the page background, hero underlay, or the bottom stop of a
section-wide gradient. Pure black kills the brightness steps and the photographic
glow that the whole depth system depends on; the legibility scrim bottoms out at
`rgba(24, 24, 24, 0.82)`, not black.

## Recognize the switch

You have drifted into the refused default when:

- any primary CTA, card, image plate, spec cell, or band shows a visible corner
  radius, or a button reads as a pill;
- a resting card or plate carries a `box-shadow` instead of a hairline plus one
  brightness step;
- `#000` appears as a background, underlay, or gradient stop across a whole
  section, or elevated plates sit on pure black so the `#181818 → #303030` step
  disappears.

The correction: square the furniture back to `0px`, replace the shadow with
`--redline-hairline` + `--redline-brightness-step`, and re-floor the stage on
`#181818`. Sharp precision signals luxury; softness and dead black both read as
someone else's language.
