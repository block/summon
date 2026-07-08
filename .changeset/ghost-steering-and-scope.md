---
'@decentralized-design/summon-server': minor
---

Track Ghost's `@design-intelligence` scope rename and adopt the 0.19 steering model. The vendored Ghost tarball, dependency scope, and imports move from `@decentralized-design/ghost` to `@design-intelligence/ghost`. `pullCorpus` now orders the corpus by steering bucket (front door → anchor → concrete → steady/wild → guard) mirroring `ghost pull --order steering`; `renderCorpusPrompt` strips `## Skeleton` sections from node bodies and re-emits their fences as the final prompt block so authored structure seeds the artifact; and the compiled Conjuror selector menu advertises `concrete`, `skeleton`, and `posture` flags with matching selection guidance. `validate-ghost-fingerprints` prefers the vendored Ghost binary over a globally installed one.
