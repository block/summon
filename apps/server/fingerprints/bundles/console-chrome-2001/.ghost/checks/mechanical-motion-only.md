---
name: mechanical-motion-only
description: Motion is mechanical and stepped — state changes snap or step at --chrome-motion-click / --chrome-motion-instant; nothing eases, glides, or scroll-animates.
severity: high
references:
  - pattern.screen-logic
  - pattern.controls
---

Console Chrome 2001 motion is call-and-response hardware feedback: input in,
bevel/LED out, always within `--chrome-motion-click` or `--chrome-motion-instant`,
never eased. Reject the generated surface if it introduces smooth modern motion:

- eased CSS transitions or animations on controls, plates, or state changes
  (anything other than the stepped `--chrome-motion-click` /
  `--chrome-motion-instant` / `--chrome-screen-swap` timings);
- parallax, scroll-linked animation, ease-glide carousels, or infinite scroll —
  modern SaaS motion that never appears here;
- smooth-scroll anchor navigation where the grammar demands a discrete screen
  swap or numbered scene boundary;
- a cursor or focus state that glides between targets instead of snapping with
  `--chrome-motion-instant`.

Screen swaps cut in steps via `--chrome-screen-swap`; presses invert the bevel
instantly; the cursor snaps. If any element fades, slides, or eases, the
machine has stopped being mechanical.
