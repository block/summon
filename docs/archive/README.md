# Archive

Historical plans, investigations, and one-off authoring tasks. Everything here
**landed in code or was superseded** — none of it describes the current system.
Audited against the codebase on 2026-07-01. For current truth, see the live
docs in `docs/` and the source itself.

| Doc | What it was | Outcome |
| --- | --- | --- |
| `ghost-fixture-plan.md` | Plan to author Ghost node-graph fixtures | Done — all bundles have `.ghost/` graphs |
| `ghost-step2-plan.md` … `ghost-step7-plan.md` | Ghost node-graph migration steps | All landed (`5b5970e` … `bc0a9f5`); legacy YAML layout retired |
| `surface-vm-plan.md`, `surface-vm-m2..m4-plan.md`, `surface-vm-next-steps.md` | surface-vm / domjs runtime build plans | Landed — `packages/surface-vm`, `domjs-control` runtime |
| `surface-vm-bakeoff-findings.md` | One-time arrow vs domjs measurement (2026-06-29) | Historical record |
| `surface-vm-package-investigation.md` | Investigation preceding `packages/surface-vm` | Recommendation executed |
| `ward-refactor-plan.md` | Broker → agent ward refactor | Landed (`52572ef`, `ea26f2a`) |
| `arrow-mount-investigation.md` | Arrow mount misdiagnosis (self-flagged WRONG) | Superseded by the comparison doc |
| `arrow-vs-domjs-comparison.md` | Dated A/B record | Historical evidence |
| `html-control-runtime-sketch.md` | Precursor sketch to surface-vm | Idea shipped as `domjs-control` |
| `dissolve-pattern.md`, `flourish-inventory-pattern.md` | One-off fingerprint authoring passes | Applied to all bundles (`b5309ff`, `5908b65`) |
| `composition-grammar.md` | Proposal to dissolve composition assemblies | Implemented; see `docs/prompt-architecture.md` |
| `ghost-fingerprint-architecture.md` | Pre-node-graph (YAML/relay) architecture | Retired world; see `docs/integration-with-ghost.md` |
