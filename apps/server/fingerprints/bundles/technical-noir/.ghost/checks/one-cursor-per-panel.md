---
name: one-cursor-per-panel
description: Every terminal/evidence panel carries exactly one blinking cursor at its live edge — never zero, never two — and the cursor rests solid under reduced motion.
severity: high
references:
  - pattern.terminal-evidence
  - index
---

Liveness is rationed: exactly one blinking off-white block cursor
(`--noir-cursor` animated by `--noir-cursor-blink`) marks the live edge of
activity per evidence panel — the only thing on the surface that moves. Reject
the generated surface if:

- an evidence panel has zero cursors (a dead transcript posing as live), or
  more than one blinking cursor;
- the cursor keeps animating under `prefers-reduced-motion: reduce` — the
  single blinking cursor is the only motion and must rest solid when animation
  is suppressed.
