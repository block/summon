---
name: monochrome-material-no-mood-color
description: Editorial Mono's material is ink, paper, rules, spacing, and type; color and gradients must not carry the voice.
severity: medium
references:
  - index
  - anti-goal.soft-card-slop
  - pattern.metadata
  - pattern.inverse-panel
---

Editorial Mono should feel printed and disciplined, not mood-boarded. Reject the
generated surface if its personality depends on chromatic decoration:

- gradients, pastel washes, colorful badges, or soft lifestyle beige backgrounds;
- broad shadows or glass effects replacing rules and contrast;
- pill-shaped panels or rounded SaaS cards where square editorial geometry belongs;
- semantic colors used for ordinary hierarchy rather than true danger, success, info, or warning;
- a second region wearing `--editorial-verdict-bg`/`--editorial-verdict-fg` inversion — the page inverts exactly once, and only for the verdict.

Use cream paper, black ink, mono metadata, serif display type, hairline rules, border
weight, inverse ink, spacing, and alignment before reaching for color.
