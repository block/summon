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

- SurfacePolicy, SurfacePlan, and script policy.
- Host capabilities and resource grants.
- Runtime validation and StreamGraph diagnostics.
- Active token CSS used by the sandbox.

Ghost UI can be inventory evidence if a fingerprint explicitly references it.
It should not be bundled into Summon as a default visual direction.

## Runtime Flow

1. The server receives a trusted root from `SUMMON_GHOST_ROOTS` and a relative
   target path.
2. Summon asks Ghost 0.9 relay for the stack-aware handoff with
   `gatherRelayContext({ cwd: root, target, memoryDir })`. The resulting
   `# Ghost Relay Brief` is the only Ghost generation prompt source.
3. Summon resolves tokens from `.ghost/config.yml`, an optional token fallback
   direction, or Summon defaults.
4. After the server resolves SurfacePlan, mode, capabilities, and components,
   it appends a small Summon Surface Brief to the Ghost handoff. That brief
   explains the concrete generation run without recompiling or reranking the
   fingerprint.
5. The engine passes the fingerprint handoff as a generation prompt block and
   passes fingerprint token CSS as `activeTokensCss`.
6. The stream emits `/ghost-context`, `/ghost-token-source`, and
   `/ghost-review-packet`. The review packet uses
   `summon.ghost-fingerprint-generation/v1`.

Validate fingerprint packages with `ghost lint`, `ghost verify`, and
`ghost relay gather <target>` before relying on them for generation.

## Agent Broker

The agent broker is not the owner of the fingerprint. It may use fingerprint
context as a signal in the future, but its job is still to decide what host
authority is allowed. The fingerprint answers a different question: what should
this surface feel, prioritize, compose, and avoid for this product context?

That separation keeps generated UI from collapsing into a default dashboard
style while still preserving Summon's host-owned safety model.
