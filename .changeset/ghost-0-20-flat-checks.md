---
'@decentralized-design/summon-server': minor
'@decentralized-design/summon': patch
---

Upgrade the vendored `@design-intelligence/ghost` from 0.19.0 to 0.20.0 and
adopt Ghost's flat-checks shape: all vendored fingerprint bundles migrate from
`.ghost/haunts/checks/` + `haunt.yml` to the flat `.ghost/checks/` directory,
the fingerprint validator warns on legacy `haunts/` layouts, and the loaded
package contract follows upstream (`hasChecksDir` / `invalidChecks` replace
`haunts` / `invalidHaunts`).
