# Ghost Fingerprint Direction Packages

Summon treats a Ghost fingerprint as a portable product design direction
package. It is not a Summon visual direction, not a registry of Ghost UI
components, and not an agent-broker policy source.

## Boundary

The fingerprint owns product direction:

- `prose.yml`: situations, principles, obligations, tone, refusal lines.
- `inventory.yml`: source material, exemplars, tokens, libraries, building blocks.
- `composition.yml`: layout, flow, state, content, and visual patterns.
- `enforcement/checks.yml`: validation constraints.

Summon owns surface authority:

- SurfacePolicy, derived SurfacePlan diagnostics, and sandbox enforcement.
- Host tools and resource grants.
- Runtime validation and StreamGraph diagnostics.
- Active token/style CSS used by the sandbox, treated as an opaque design-source vocabulary rather than a Summon-owned token contract.

Ghost UI can be inventory evidence if a fingerprint explicitly references it.
It should not be bundled into Summon as a default visual direction.

## Runtime Flow

1. The server receives a trusted root from `SUMMON_GHOST_ROOTS` and a relative
   target path, or a bundled fingerprint catalog selection.
2. Summon asks Ghost 0.12 relay for the stack-aware handoff with
   `gatherRelayContext({ cwd: root, target, memoryDir })` when a request
   supplies `memoryDir`, or with no `memoryDir` when the host should use
   Ghost's `GHOST_MEMORY_DIR` default.
3. Summon compiles a `GhostIngestionContract` from the relay entrypoint and the
   package files it can read: prose, inventory, composition, checks, and
   token/style CSS. The relay remains the run entrypoint; the compiled contract
   makes the selected fingerprint material explicit for prompting and
   diagnostics.
4. Summon resolves token/style CSS from `.ghost/config.yml` or the fingerprint
   catalog bundle. Token names are design-source-owned CSS custom properties;
   Summon does not require `--color-bg`, `--space-*`, or any other Summon-named
   vocabulary.
5. After the server resolves SurfacePlan, mode, and tools, it appends a small
   Summon Surface Brief to the Ghost handoff. That brief explains the concrete
   generation run without recompiling or reranking the fingerprint, and names
   the selected Ghost composition refs instead of a generic response shape.
6. The engine passes the Ghost relay brief and ingestion prompt blocks to the
   model, then passes fingerprint token/style CSS as `activeTokensCss` for the
   Arrow sandbox.
7. The hot path validates the generated Arrow bundle for runtime/sandbox safety.
   It does not run an extra Ghost-fidelity gate, visual judge, screenshot diff,
   or model-based design review during generation.
8. The stream emits `/ghost-context`, `/ghost-token-source`,
   `/ghost-ingestion-contract`, and `/ghost-review-packet`. `/ghost-context` and
   the review packet include the structured Relay Task Contract (`preserve`,
   `inspect`, `avoid`, and `validate`) from Ghost 0.12. The review packet uses
   `summon.ghost-fingerprint-generation/v1`.

Validate fingerprint packages with `ghost lint`, `ghost verify`, and
`ghost relay gather <target>` before relying on them for generation. Because
Summon does not run heavyweight Ghost-fidelity validation in the generation hot
path, package validation, review packets, and offline visual checks are the
right places to catch product/design drift.

## Agent Broker

The agent broker is not the owner of the fingerprint. It may use fingerprint
context as a signal in the future, but its job is still to decide what host
authority is allowed. The fingerprint answers a different question: what should
this surface feel, prioritize, compose, and avoid for this product context?

That separation keeps generated UI from collapsing into a default dashboard
style while still preserving Summon's host-owned safety model.
