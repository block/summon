---
'@decentralized-design/summon-server': minor
---

Add a deterministic median-tells pre-pass to the Ghost conformance pipeline.
`scoreMedianTells` scores generated artifacts against the measured convergence
patterns of unsteered model generation (upstream Ghost's antimedian corpus:
hover-lift, indigo default accents, gradient backgrounds, glassmorphism, stock
copy, and friends) with pure regexes — no model call, no timeout, no variance.
`deriveSanctionedTells` excludes tells a fingerprint deliberately shares (dark
bundles sanction the unprompted-dark tell from their own token CSS). The
report rides the ghost receipt as an optional `medianTells` field
(`summon.median-tells/v1`) and can be disabled with
`SUMMON_GHOST_MEDIAN_TELLS=0`.
