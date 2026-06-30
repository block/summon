---
description: The technical-plane landing surface — a claim-first opener on the pale plane with uppercase mono eyebrows, a rectangular primary CTA, and a muted proof rail with contained signal artwork. Reach when the first question is "what is this platform and why trust it?"
relates:
  - to: contrast-planes
    as: reinforces
  - to: cta-system
    as: reinforces
---

## Composition

A landing states a technical platform value and proves it. Reach for this surface
when the user's first question is "what is this and why should I trust it?" — a
platform landing, a capability announcement, a product overview — not when the
job is to compare tiers and capacity (that is [pricing](../pricing)), to argue
proof or research at gravity (that is [proof](../proof)), or to operate a form or
workflow (that is [workflow](../workflow)).

**Technical plane landing.** Open as a full-bleed contrast band
(`--contrast-band-inset: 0`, `--contrast-band-pad-y`, `--contrast-band-max`) — a
pale canvas (`--contrast-plane-pale-bg`) or a midnight canvas
(`--contrast-plane-midnight-bg`, flipping the page via `--contrast-plane-invert`),
sentence-case claim, mono eyebrow in `--contrast-eyebrow-font`, a compact
rectangular CTA cluster at `--contrast-cta-radius`, muted proof rail, and optional
large signal artwork. Pale when the surface should feel open and product-led;
midnight when it should feel research-led or proof-led. On narrow screens, crop the
large artwork below the CTAs or omit it.

**Signal artwork is optional and large-scale.** Contrast, table structure, and
type carry the language when decoration is unnecessary. Use one large abstract
signal object only when it clarifies energy, capability, or proof; keep its
warm-to-cool trio (`--contrast-signal-warm`, `--contrast-signal-mid`,
`--contrast-signal-cool`, bound in `--contrast-signal-gradient`) contained in the
artwork rather than spreading them across controls. Never reduce it to small icons, badges,
underlines, category swatches, or CTA fills, and omit it entirely when the data
should carry the page.

The opening plane follows the [contrast-plane system](../contrast-planes); the
eyebrow and headline follow the [mono labels](../mono-labels); the CTA cluster
follows the [rectangular CTA system](../cta-system). After the hero, the page
moves through banded narrative — supporting [data sheets](../data-sheets) and
[proof cards](../proof-cards) — so it reads edited, never an empty marketing
posture.
