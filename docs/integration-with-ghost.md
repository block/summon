# Integrating Summon with the new Ghost (node-graph model)

> Head-start plan. Ghost is unpublished and actively shedding fossils (the
> `fingerprint.schema.json` / palette-spacing-typography extraction was deleted
> in `chore: delete dead fingerprint.md-era fossils`). This doc is written
> against the live node-graph model so we execute — not rediscover — the moment
> Ghost publishes. Nothing here should be built until Ghost's contract settles.

## What changed in Ghost

Ghost moved from **structured YAML files** to a **graph of markdown prose nodes**
where the directory tree *is* the graph.

| Concern | Old Ghost (what Summon reads today) | New Ghost |
| --- | --- | --- |
| Design prose | `prose.yml`, `composition.yml`, `inventory.yml` | prose nodes (`<surface>/index.md`, `<node>.md`); intent/inventory/composition are authoring *lenses*, not files |
| Identity / containment | fields / bundle metadata | the file path is the id; the directory is the parent |
| Checks | `enforcement/checks.yml` (regex) | `ghost.check/v1` markdown, **agent-evaluated**, surface-routed |
| Token CSS | a `tokens` CSS file referenced by `bundle.json` | **assumption:** a markdown node detailing visual specs/tokens, optionally carrying a fenced ```css block |
| Retrieval | read all files, hand-assemble a brief | name a surface → `resolveGraphSlice` returns a composed context slice |

There is **no** structured design-token schema anymore (no palette/oklch/spacing
schema — that was the deleted fossil). The fingerprint is pure prose plus
markdown checks.

## The live contracts (verified against the Ghost source)

- **Library:** `@anarchitecture/ghost/fingerprint` →
  `resolveFingerprintPackage`, `loadFingerprintPackage` (→ `{ graph }`).
  `@anarchitecture/ghost/core` → `resolveGraphSlice`, `buildGraphMenu`,
  `selectChecksForSurfaces`, `loadGhostCheck`, node/graph/check types.
- **CLI:** `ghost gather <surface> --format json` emits a `GraphSlice`;
  `ghost checks --surface <ids>` routes checks.
- **`GraphSlice`** = `{ surface, ancestors, incarnation?, nodes[], spokes[] }`.
  `nodes[]` are full-body prose with `provenance` (`own` / `ancestor` / `edge`);
  `spokes[]` are id+description pointers (descendants + edge hubs).
- **`GhostGraphNode`** = `{ id, description?, parent?, folder, relates[],
  incarnation?, body, origin }`. Pure prose body — no structured fields.
- **`ghost.check/v1`** frontmatter = `{ name, description, severity:
  high|medium|low, tools?, turn_limit?, surface? }` + a prose instruction body.
  Ghost **selects and emits; it never runs the check** — the host agent
  evaluates. Routing: a check governs its `surface` and every touched surface
  that cascades into it (own/ancestor); unplaced ⇒ `core` (applies everywhere).

## Consumption decision: library, not CLI

Summon's server consumes Ghost as a **library** (`@anarchitecture/ghost`), not by
shelling out to the CLI:
- Typed `GraphSlice` / `GhostGraphNode` / check types — no JSON re-parsing.
- No subprocess per generation (latency, error-surface).
- Pin the Ghost version; treat slice/check types as the integration contract.

The CLI's `gather`/`checks` are the *reference behavior* we mirror via the
library calls (`loadFingerprintPackage` → `resolveGraphSlice` /
`selectChecksForSurfaces`).

## The three integration seams

### 1. Discovery + load (replaces the YAML file reads)

`ghost-adapter.ts` stops doing `readYamlIfPresent('prose.yml' | 'composition.yml'
| 'inventory.yml')` and `enforcement/checks.yml`. Instead:

```
resolveFingerprintPackage(dir) → loadFingerprintPackage(paths) → { graph }
```

`fingerprint-catalog.ts` (bundles) and `SUMMON_GHOST_ROOTS` both resolve to a
loaded graph. The catalog's per-bundle `bundle.json` may survive as Summon-side
metadata (id, display), but the *design content* comes from the graph.

### 2. Surface brief (replaces the hand-built brief)

Summon already knows the surface and the prompt. The flow becomes:
- **Name the surface** — Summon picks the node id (BYOA principle: *the agent
  names the node; Ghost does not infer it from paths*). For Summon this is the
  generation target; fall back to `core` / the menu when unknown.
- **Gather the slice** — `resolveGraphSlice(graph, surface, { incarnation? })`.
- **Render the slice into the `ghost` prompt block** — corridor spine
  (own → ancestor) then one-hop `relates` edges, provenance-labeled; spokes
  become an optional "available to pull" list (Summon likely *won't* expand
  spokes mid-generation in v1 — they're navigability, not authority).

This subsumes the parked "de-overlap brief vs contract" work: there is no
`composition.yml` to overlap with anymore. The brief is "frame the task + name
the surface"; the contract *is* the gather slice.

### 3. Token / visual vocabulary (the one real open question)

**Assumption (confirmed with owner):** the visual spec + tokens are authored as a
markdown node. Strategy:

- A visual/token node's body may carry a fenced ```css block with literal token
  values. Summon **extracts the CSS block(s) from the gathered slice** for
  deterministic injection (preserving today's `activeTokensCss` / `var()`
  fidelity), and keeps the surrounding prose as deploy guidance in the brief.
- **Merge across the corridor in provenance order** (ancestors → own), mirroring
  the CSS cascade: a surface node may override a base token. This matches
  Ghost's corridor model exactly and needs no new schema.
- `GhostTokenSource` mostly survives; `css` now comes from prose extraction
  instead of a file read. Everything downstream (sandbox injection) is unchanged.

**Fidelity note:** if a node carries *only* prose (no CSS fence), tokens become
interpretive — the model authors values from description. That is philosophically
correct for Ghost (prose authority) but loses pixel determinism; the fenced-CSS
convention is how an author opts back into determinism where it matters.

## Connecting to the moat (Tier 1)

The Ghost rearchitecture is also the unlock for the parked Tier 1 moat work:

- **Govern (Tier 1A — conformance verdict):** `ghost.check/v1` checks are
  **agent-evaluated prose**, surface-routed via `selectChecksForSurfaces`. This
  is *not* a deterministic regex runner — the verdict is an agent evaluating the
  check body against the generated artifact. Summon's conformance pass:
  route checks for the surface → for each, have a utility model evaluate the
  generated bundle against the check prose → emit a verdict (pass/`severity`
  fail) into the run metrics + trace. This is a different (and richer) design
  than the old regex `checks.yml`.
- **Account (Tier 1B — trace/receipt):** the receipt records spec-in (fingerprint
  id, gathered node ids + provenance, incarnation, routed check ids) and
  what-happened (which checks passed/failed, repairs, blocks). The graph slice's
  `provenance` and the checks' `relevance` give a precise, inspectable lineage.

## Migration / sequencing (do NOT start until Ghost publishes)

Ordered, each independently shippable:

1. **Add `@anarchitecture/ghost` as a pinned dependency**; spike
   `loadFingerprintPackage` + `resolveGraphSlice` against a sample `.ghost/`.
2. **Rewrite the discovery/load path** in `ghost-adapter.ts` + `fingerprint-catalog.ts`
   to produce a graph instead of YAML blobs. Behind a flag if both must coexist.
3. **Rewrite the surface brief** to render a `GraphSlice`.
4. **Implement token-CSS extraction** from the slice (fenced-css + corridor merge).
5. **Govern:** wire `selectChecksForSurfaces` → agent-evaluated conformance verdict
   (Tier 1A).
6. **Account:** extend the trace/receipt with gathered-node + routed-check lineage
   (Tier 1B).
7. **Delete** the old YAML adapter path, the `prose/composition/inventory` reads,
   and migrate or re-author the in-repo `apps/server/fingerprints/bundles/*` to
   the node-graph layout (or drop them for fresh node-model samples).

## Resolved decisions

- **Token node convention → CSS on any corridor node.** Summon extracts fenced
  ```css blocks from *every* node in the gathered slice and merges them in
  corridor/provenance order (ancestors → own → edge). A surface node can thus
  override a base token; no single "canonical" visual node is required.
- **Surface naming → extend the agent ward.** Summon names the node (Ghost
  does not infer it). Feed `buildGraphMenu(graph)` (each node's `id` +
  `description`) to the existing ward, which already classifies prompt intent;
  it selects the best-matching node id exactly as it selects a tool from a tool
  list. Fall back to `core` (true everywhere) when no node matches confidently.
- **Sample bundles → author fresh node-model fixtures.** Re-author the existing
  bundles' design intent as new node-graph fixtures rather than running
  `ghost migrate` on the legacy YAML. Cleaner fixtures, no migration cruft, and
  it doubles as a dogfood of authoring against the new model.
- **Incarnation → essence for v1.** Summon does not pass `--as`. It gathers
  essence (untagged) nodes plus any `any`-tagged nodes — the medium-agnostic
  intent. Medium-bound incarnations (email/voice/billboard) are out of scope for
  v1; revisit if Summon ever targets non-web surfaces.

### Background: essence vs incarnation

A node's `incarnation` frontmatter marks medium-bound prose. **Essence** =
untagged (or `any`): intent that holds in any medium. A tagged node
(`incarnation: email`) only applies to that form. At gather, `--as <x>` passes
essence always + tagged nodes matching `x`. Summon stays essence-only in v1, so
every gathered tagged node would be filtered — fixtures should author intent as
essence, not medium-bound.
