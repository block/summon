---
description: The player chrome system — custom, quiet media-player dress for motion footage; square machined transport controls, a hairline scrub rail with a white progress fill, mono timecode, a grow-from-the-frame full-screen recipe, and zero third-party player branding. Reach for it when footage must play inside the surface without breaking the near-black stage.
relates:
  - to: cinematic-image
    as: reinforces
  - to: controls
    as: reinforces
  - to: editorial-cadence
    as: reinforces
---

## Composition

Cinema is the chrome — so the player must have almost none. When motion footage
plays on a Redline Cinema surface, the playback chrome is drawn from the same
machined vocabulary as everything else: hairlines, brightness steps, mono data
labels, and square geometry. A default embed frame, with its foreign logo, rounded
buttons, and colored progress bar, is a source brand smuggled onto the stage;
this language never shows one.

**Quiet transport, machined shapes.** Play, pause, and mute are sharp rectangular
controls squared at `--redline-machined-radius`, drawn in white ink over the
footage or its `--redline-frame-overlay` scrim — no filled circles, no glowing
buttons, no shadow lift. At rest the transport fades to near-invisible and the
footage is the event; controls return on intent at `--redline-duration-state`,
never with a bounce.

**Hairline scrub rail, white progress.** The scrub bar is a single
`--redline-player-rail` hairline running the width of the frame, its elapsed
portion filled in `--redline-player-progress` white. Progress is brightness, not
color: red is never spent on a playhead unless the playing footage is genuinely
the region's one voltage moment — and then it is spent nowhere else in view.

**Mono timecode.** Elapsed and total time are set in the mono-technical voice at
`--redline-timecode-size` with `--redline-timecode-tracking` — `00:42 / 02:17` —
sitting small at the rail's edge like a production readout. Timecode belongs to
the same mono data layer as spec callouts and chapter indices; it is an
instrument reading, never decoration.

**Grow from the frame.** Footage opens full-screen by expanding from the exact
still frame the reader chose — the thumbnail's rectangle becomes the player's
rectangle, the square corners never rounding in flight — and closes by returning
to that same frame. Composed this way, playback reads as a cut within one
continuous film rather than a modal interrupting a page. The transition rides
`--redline-ease-cinematic` once; the resting state on either side is fully
composed without it.

**Poster discipline.** Before play and after close, the frame holds a real still
from the footage under the standard legibility scrim — never a spinner card, never
a branded placeholder. If no still exists, the [cinematic image
placeholder discipline](cinematic-image) applies unchanged.

The player dresses footage inside the [cinematic image](cinematic-image) frame,
borrows its mono data voice and reveal restraint from the [editorial
cadence](editorial-cadence), and holds the same red scarcity as the [control
system](controls): the one voltage spend per viewport is never duplicated by
player chrome.
