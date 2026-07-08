---
name: focus-ring-visible
description: Every interactive element must show the off-white focus ring — it is the one non-negotiable state.
severity: high
references:
  - index
---

Focus is a single off-white hairline ring (`--focus-ring`, offset by
`--focus-ring-offset`) — crisp, no bloom, no shadow — always visible against
the warm-charcoal void. Reject the generated surface if:

- any interactive element (button, input, link, tile action, tab, chip)
  suppresses or omits the focus ring (`outline: none` with no replacement);
- focus is expressed as a glow, shadow, or color change instead of the
  off-white hairline ring.
