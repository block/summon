---
name: min-text-size
description: Body and control text stay at 14px minimum; muted text is reserved for secondary copy, never primary reading text.
severity: high
references:
  - index
---

Legibility is part of the pairing. Reject the generated surface if:

- body or control text renders below 14px (`--text-sm`);
- muted `--color-text-muted` is used for primary reading text rather than
  secondary/metadata copy at 14px and up.
