# Integrating Summon with Ghost (flat-corpus model)

> **Status: implemented.** This is the record of how Summon consumes Ghost and
> why. The live code is `apps/server/src/ghost-adapter.ts`,
> `apps/server/src/fingerprint-catalog.ts`,
> `apps/server/src/ghost-conformance.ts`, and the receipt in
> `buildGhostReceipt`. Pinned upstream: `@anarchitecture/ghost-fingerprint`
> 0.19.x (the flat-corpus + haunts model).

## What changed in Ghost

Ghost collapsed its **node graph** (corridors, ancestors, `relates` edges,
provenance-labeled slices) into a **flat corpus**: a `.ghost/` directory of
markdown prose nodes with no edges, no cascade, no traversal. Retrieval is a
two-step agent contract — `gather` emits a menu (id + kind + description),
the *agent* selects, `pull` returns the chosen bodies. Ghost does no NLP and
no selection.

| Concern | Graph-era Ghost (what Summon consumed before) | Flat-corpus Ghost (now) |
| --- | --- | --- |
| Structure | directory tree *is* the graph; corridors + `relates` edges | flat set of nodes; folders are browsing convenience only; `relates` is a **rejected** key |
| Retrieval | name a surface → `resolveGraphSlice` composes own/ancestor/edge nodes | `buildCatalogMenu` → agent selects → read bodies; no slice, no provenance |
| Front door | `core` root node (`GHOST_GRAPH_ROOT_ID`) | `index` node — a curated-entrypoint *convention*, not a graph position |
| Checks | `.ghost/checks/*.md`, `surface:`-routed via `selectChecksForSurfaces` | `.ghost/haunts/checks/*.md` under a `haunt.yml` anchor; routed by diff-material matching in `ghost review`; `surface:` is gone; ≥1 `references` entry required |
| Haunts | — | opt-in capabilities under `.ghost/haunts/`; **never emitted by gather/pull**, so they cannot leak into generation context |
| Incarnation / `--as` | essence vs medium-tagged nodes | removed |
| Materials | — | `materials:` frontmatter — locators (repo globs / https URLs) for the concrete assets a truth is about |

The fingerprint is still pure prose plus markdown checks. There is still no
structured design-token schema; the fenced ```css convention (below) is how an
author opts into pixel determinism.

## The live contracts (verified against the Ghost source)

- **Library:** `@anarchitecture/ghost-fingerprint/fingerprint` →
  `resolveFingerprintPackage`, `loadFingerprintPackage` → `{ manifest,
  catalog, haunts, checks, invalid, invalidHaunts }`.
  `@anarchitecture/ghost-fingerprint/core` → `buildCatalogMenu`,
  `assembleCatalog`, catalog/check types.
- **`GhostCatalog`** = `{ nodes: Map<id, GhostCatalogNode> }` — a flat map.
  **`GhostCatalogNode`** = `{ id, kind?, slug, description?, materials?,
  body }`. Pure prose body; identity is filesystem-derived (path minus `.md`,
  kind from the filename's first dotted segment).
- **Checks** (`ghost.check/v1`): frontmatter `{ name, description, severity:
  high|medium|low, references: string[] }` + a prose instruction body. The
  loader **requires at least one `references` entry** (stricter than the
  single-file lint). Ghost selects and emits; it never runs the check — the
  host agent evaluates.
- **`LoadedCheck`** (the map value on the loaded package) = `{ id, doc:
  GhostCheckDocument, references }`. Ghost does not export this type from a
  public subpath; Summon derives it from `LoadedFingerprintPackage['checks']`
  (`GhostLoadedCheck` in `ghost-adapter.ts`).
- **CLI reference behavior:** `ghost gather --format json` emits the menu;
  `ghost pull <ids> --format json` emits bodies; `ghost review` assembles the
  diff-routed advisory packet. Summon mirrors gather/pull via the library and
  does **not** use `ghost review` (see conformance below).

## Consumption decision: library, not CLI

Unchanged from the graph era, and now cheaper: Summon consumes Ghost as a
library — typed catalog/check values, no subprocess per generation, version
pinned via a packed tarball (`vendor/anarchitecture-ghost-fingerprint-*.tgz`).
The CLI's `gather`/`pull` are the reference behavior the adapter mirrors.

One BYOA note: `gather`/`pull` through the CLI append to the fingerprint's
local `.ghost/.events` observability tape. The library path does not, which is
correct for Summon — vendored bundles are content fixtures and must stay
read-only at serve time.

## The three integration seams

### 1. Discovery + load

```
resolveFingerprintPackage(dir) → loadFingerprintPackage(paths) → { catalog, checks }
```

Both entry points resolve the same way: `SUMMON_GHOST_ROOTS` (root mode) and
`fingerprint-catalog.ts` (vendored bundles at
`apps/server/fingerprints/bundles/<id>/.ghost`). The per-bundle `bundle.json`
survives as Summon-side metadata (id, display, preview); all design content
comes from the loaded catalog. `pnpm ghost:validate:fingerprints` runs
`ghost validate <path> --format json` over every vendored package and is the
authoring gate for bundle content.

### 2. Surface brief — pull-everything, anchor as emphasis

The graph slice is gone, so "what does the generator see" needed a new answer.
Summon's answer (`pullCorpus` in `ghost-adapter.ts`): **pull the whole flat
corpus**, ordered front door → anchor → rest-by-id.

- **Why pull everything:** Ghost's contract is agent-side selection over the
  menu, but Summon's generator is single-shot — it cannot call back mid-run to
  pull a node it turned out to need. Vendored corpora are small (7–10 nodes),
  so full pull is the fidelity-preserving choice and matches what the old core
  slice effectively carried.
- **The anchor is emphasis, never inclusion.** `selectGhostSurface` runs the
  same optional semantic model call as before, now over `buildCatalogMenu`:
  the chosen node is *hoisted* to second position and labeled "lead
  composition" in the prompt. Fallback anchor is `index` (the front door
  convention replacing `core`). All the old safety properties hold: no model →
  `index`; timeout/error/off-menu answer → `index`; single-node corpus → no
  model call at all.
- **Prompt rendering** (`renderCorpusPrompt`): `# Ghost Fingerprint`, the
  anchor line, then each node body verbatim under `## <id> — <label>`
  (front door / lead composition / kind). Node bodies keep their fenced
  ```css blocks — the prose is the only place the model sees token *names*.
- The Summon surface brief (task frame, surface plan, signature-moves block
  extracted from the front door's `## Signature look & feel` section, output
  rules) is appended after the corpus, exactly as before.

## Conjuror — context compilation

Summon still consumes Ghost through the library APIs, never by shelling out to
`ghost gather` or `ghost pull`; the CLI path appends to `.ghost/.events`, which
would make served fingerprints mutable. For small corpora Summon keeps the
historical full-corpus pull. Above `SUMMON_CONJUROR_FULL_PULL_NODE_LIMIT`
(default `12`), Conjuror compiles a selected packet instead: `index` and every
fenced-CSS token node are mandatory, selector-chosen lead/support nodes fill the
remaining budget, all ids are host-validated, and missing/model-invalid choices
fall back safely. Checks and haunts are loaded for governance only and never
enter generation context.

The stream emits `/conjuror` with schema `summon.conjuror-packet/v1` so hosts can
inspect the strategy, selected/excluded nodes, authority stack, and warnings.

| Env flag | Effect |
| --- | --- |
| `SUMMON_CONJUROR=0` | Disable compilation and force full-corpus behavior. |
| `SUMMON_CONJUROR_STRATEGY` | `auto` (default), `full-corpus`, or `compiled`. |
| `SUMMON_CONJUROR_FULL_PULL_NODE_LIMIT` | Node-count threshold for `auto` full-corpus mode; default `12`. |
| `SUMMON_CONJUROR_MAX_NODES` | Maximum selected nodes in a compiled packet, after mandatory inclusions. |
| `SUMMON_CONJUROR_MAX_CHARS` | Character budget for the rendered compiled Ghost prompt. |

### 3. Token / visual vocabulary

The fenced-```css convention survives verbatim: a node body may carry a
```css block with literal token values, and Summon extracts these for
deterministic injection (`activeTokensCss`). What changed is merge order —
there is no corridor to mirror anymore:

- **Extraction order is front door → id order, never anchor-hoisted**
  (`extractSliceCss` → `extractCorpusCss`). This makes the merged CSS — and
  therefore last-write-wins token resolution — **stable regardless of which
  anchor was selected** for a run. Anchor choice can change emphasis, never
  pixels.
- `GhostTokenSource` is unchanged downstream (validation, sandbox injection);
  `source` is now `fingerprint:index`.
- Fidelity note (unchanged): a fingerprint with prose-only visual guidance
  loses pixel determinism by design; the fenced-CSS convention is the opt-in.

## Govern + Account (the moat tiers)

- **Govern (conformance verdict):** Ghost's own review routing is
  diff-material matching — a check is offered when a repo diff touches a
  referenced node's `materials`. Summon evaluates **generated artifacts**, not
  repo diffs, so no material locator can ever match. Per Ghost's docs, checks
  bound to no touched material are **"always offered"** — the sanctioned shape
  for cross-cutting assertions. So Summon's conformance
  (`evaluateConformance`) offers *every* check on the loaded package and has
  no routing logic at all: `checks` map in → utility-model evaluation against
  the artifact → `summon.ghost-conformance/v2` verdict
  (`offered: 'always'` replaced the graph-era `relevance: own|ancestor`).
  Severity is advisory in Ghost's semantics; Summon's fidelity-repair gate
  (failed HIGH check → bounded repair pass, `SUMMON_GHOST_FIDELITY_REPAIR`)
  is a **Summon policy layered on top**, not a Ghost rule.
- **Account (receipt):** `summon.ghost-receipt/v2`. The graph-era `cascade`
  and per-node `provenance` are gone; the receipt now records the pull:
  `gatheredNodes: [{ id, reason: front-door|anchor|corpus }]` and
  `offeredChecks` (was `routedChecks`). This mirrors Ghost's own `.events`
  tape vocabulary (gather menu + pulled ids) more closely than the slice ever
  did.

## Migration record (graph → flat corpus)

Ordered, each independently verifiable:

1. ✅ **Bundle content migration** — `scripts/migrate-ghost-bundles.mjs`:
   strips `relates:` (rejected key) into a trailing `Related: …` prose line,
   moves `.ghost/checks/` → `.ghost/haunts/checks/` + `haunt.yml`, rewrites
   `surface: core` → `references: [index]` (the loader requires ≥1 reference;
   `index` is the faithful home for a fingerprint-wide check). Gated on
   `ghost validate` — all 8 bundles pass with 0 errors. Also surfaced one
   latent YAML bug (unquoted `description` with a nested-mapping colon in
   `technical-contrast/drafting-marks.md`).
2. ✅ **Dependency repointed** — `@anarchitecture/ghost` (graph-era `next`
   snapshot) → `@anarchitecture/ghost-fingerprint` 0.19.0 packed tarball.
3. ✅ **Adapter rewritten** — `pullCorpus`/`renderCorpusPrompt` replace
   `resolveGraphSlice`/`renderSlicePrompt`; anchor selection over
   `buildCatalogMenu`; `GHOST_FRONT_DOOR_ID = 'index'` replaces
   `GHOST_GRAPH_ROOT_ID = 'core'`.
4. ✅ **Conformance rewritten** — routing deleted (`loadChecksDir` /
   `selectChecksForSurfaces` imports removed); all-checks offering;
   verdict schema v2.
5. ✅ **Receipts + consumers** — receipt schema v2; demo stream log and
   surface-gallery host messages updated (`cascade` → `anchor`,
   `provenance` → `reason`, `routed` → `offered`).

### Known upstream issues (reported)

- The published `imports["#ghost-core"].types` condition points at
  `./src/...`, which the tarball does not ship — and via a worktree link it
  leaks Ghost's source into the consumer's `tsc` under the consumer's stricter
  flags. Fix: point the types condition at `./dist/.../index.d.ts`.
- The checks loader requires ≥1 `references` entry per check; the docs and
  single-file lint imply references are optional. Either is fine — the
  migration writes `references: [index]` — but the contract should be stated.

### Fingerprint hygiene pass

Vendored bundles now carry `glossary.md`, `.ghost/.gitignore`, and checks under
`haunts/checks/`. Existing checks were retargeted toward specific node ids where
obvious, and previously unchecked bundles have high-signal conformance checks.
The next content-quality pass is the larger typed-node migration
(`principle.*`, `pattern.*`, `asset.*`, `anti-goal.*`) so descriptions, glossary
semantics, checks, and receipts all use stronger Ghost retrieval handles.
