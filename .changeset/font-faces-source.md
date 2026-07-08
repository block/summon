---
'@decentralized-design/summon': minor
'@decentralized-design/summon-react': minor
---

Add safe host-owned font inclusion. `mountSummonSurface` and the
`SummonSurface` React component accept `fontFacesSource` — host-authored
`@font-face` CSS installed into `document.head` (font faces are
document-scoped and never load inside shadow roots), sanitized to
`@font-face` blocks only, deduplicated by content hash, and refcounted
across live surfaces. `SurfaceEnvelope` gains an optional `fontFacesCss`
field beside `tokenCss` so replay hosts receive fonts without extra wiring.
Generated `main.css` still cannot carry fonts — the artifact boundary is
unchanged; token stacks reference the family and fall back to system fonts.
