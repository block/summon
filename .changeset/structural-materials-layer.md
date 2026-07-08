---
'@decentralized-design/summon-server': patch
---

Hook vessel-light up as the shared structural materials layer for all catalog
fingerprints. The demo server vendors upstream vessel-light's `primitives.css`
(surface/stack/button/input/text grammar, pure custom-property driven) plus a
`bridge.css` that maps Vessel's token vocabulary onto the shared dialect every
vendored fingerprint defines, appends the layer to the host token source,
extends the corpus prompt with a structural brief, serves HK Grotesk faces
from `/api/fingerprint-materials/`, and streams them to the host through the
new `/ghost-font-faces` meta line into the `fontFacesSource` channel.
Fingerprint prose remains the design authority; disable with
`SUMMON_STRUCTURAL_MATERIALS=0`.
