# Step 2 plan: rewrite Ghost discovery/load onto the node-graph model

> Migration step 2 from `integration-with-ghost.md`. Replaces the old
> relay-based load with `loadFingerprintPackage` → `resolveGraphSlice`. Scoped
> against the actual code after linking local Ghost 0.18.0.

> **Superseded note (2026-06-29):** the `baseDirectionId` field referenced below
> was carried through this migration as a vestigial no-op and has since been
> fully removed from the engine, server adapter, fingerprint catalog, and both
> clients. Mentions of it here are historical; the live contract has no
> `baseDirectionId` / `defaultBaseDirectionId` / `defaultTokenFallback`.

## The breakage is deeper than two imports

Linking 0.18.0 broke two imports in `ghost-adapter.ts`, but the *model* change
ripples through three layers. The old code is built around the **relay**:

- `ghost-adapter.ts` (747 lines) — calls `gatherRelayContext`, threads
  `RelayGatherResult` everywhere, reads token CSS from layer `config.yml` via
  `readOptionalPackageConfig`, and reads `prose.yml`/`composition.yml`/
  `inventory.yml`/`checks.yml` off disk (`readFingerprintBundle`).
- `packages/server/src/ghost/{compile,signals,types}.ts` — `compileGhostIngestionContract`
  expects `entrypoint.selected.{prose,composition,checks,exemplars}` (relay node
  groups) + a `RawGhostFingerprintBundle` (the four YAML blobs). It derives
  `GhostIngestionContract` (`summon.ghost-ingestion/v1`) from them.
- `main.ts` consumes: `resolve*GhostGenerationContext`, `prepareGhostSurfacePrompt`,
  `ghostContextMeta`, `ghostTokenSourceMeta`, `ghostIngestionContractMeta`,
  `buildGhostReviewPacket`, and reads `ctx.tokenSource.css`, `ctx.ingestion`,
  `ctx.prompt`.

The new Ghost has **none** of that shape: no relay, no `entrypoint.selected.*`
groups, no YAML files, no layer `config.yml`. It has `loadFingerprintPackage →
{ graph }` and `resolveGraphSlice(graph, surface) → GraphSlice` (prose nodes with
provenance + spokes), plus `selectChecksForSurfaces`.

## Strategy: shrink the contract, don't port it

The old relay/ingestion model is far richer than the new graph model — it tried
to structure prose into prose/composition/inventory/checks groups with refs,
omissions, suggested reads, action contracts. The new model is deliberately flat:
**prose nodes + provenance + checks.** So step 2 is not a 1:1 port; it is a
*reduction* to the new model's smaller surface.

Decision: **keep the public adapter function names and the `main.ts` contract
stable where cheap, but rebuild their internals on the graph.** Specifically the
`GhostIngestionContract` (`summon.ghost-ingestion/v1`) — a relay-era artifact —
is **retired**; `main.ts`'s ingestion emission becomes a graph-slice emission.

## Scope of step 2 (this PR)

Step 2 is **discovery + load only** — get a loaded graph and a resolved context
object into `main.ts`, typechecking again. Brief rendering (step 3), token
extraction (step 4), checks/verdict (step 5) are separate. To keep step 2
shippable, step 2 produces a context that *carries the graph + a gathered slice*
and stubs the brief/token/ingestion outputs minimally, with steps 3-5 filling them.

### 2a. New load path (replaces `gatherRelayContext`)

- **Root request** (`SUMMON_GHOST_ROOTS`): `resolveFingerprintPackage(rootDir)` →
  `loadFingerprintPackage(paths)` → `{ graph }`.
- **Catalog request** (bundles): the catalog entry's `.ghost/` dir →
  `resolveFingerprintPackage(entry.ghostDir)` → `loadFingerprintPackage`. (The
  fixtures we authored live at `bundles/<id>/.ghost/`, so `fingerprint-catalog.ts`
  must expose that path — see 2c.)
- Both yield a `GhostGraph`. Drop all `RelayGatherResult`, `RelayStackSource`,
  `RelayStackLayer`, `relay.*` plumbing.

### 2b. Name the surface + gather (the new "context")

- Surface naming for step 2: default to `core` (the root node, always present).
  The ward-driven node selection (decision #2) is a step-3 refinement; step 2
  hardcodes `core` so we have a working slice.
- `resolveGraphSlice(graph, surfaceId)` → `GraphSlice`. Store it on the context.
- New `ResolvedGhostSteer` shape (rough): `{ source, request, root, graph, slice,
  surface, prompt, product, tokenSource, baseDirectionId }`. Drop `relay`,
  `ingestion` (retired), and the relay-derived helpers.

### 2c. Catalog wiring (`fingerprint-catalog.ts`)

- Each catalog entry currently exposes `fingerprintDir` (legacy `fingerprint/`)
  and `tokenCssPath` (legacy `tokens.css`). Add a `ghostDir` pointing at
  `bundles/<id>/.ghost`. Keep `bundle.json` for id/name/tags metadata.
- Token CSS now comes from the graph (step 4), not `tokenCssPath` — but leave
  `tokenCssPath` until step 4 deletes it, so step 2 stays focused.

### 2d. Retire relay-era engine code (the ripple)

`packages/server/src/ghost/{compile,signals,types}.ts` and the
`GhostIngestionContract` type are relay-shaped. Step 2 stops *calling*
`compileGhostIngestionContract` (the `ingestion` field goes away). The dead
modules themselves are deleted in step 7 (cleanup) to keep step 2's diff bounded,
but their exports must be removed from the public barrels if they no longer
typecheck. **Open risk:** these are re-exported from `packages/server` and
`packages/summon-server` public indexes (`RawGhostFingerprintBundle`,
`GhostGenerationContext`). Removing/retyping them touches the public API snapshot.

### 2e. `main.ts` consumer updates

- `resolve*GhostGenerationContext` keep their names + signatures; return the new
  context. `ghostContextMeta` returns graph/slice metadata instead of relay meta.
- `ghostTokenSourceMeta(ctx.tokenSource)` — survives; token source still exists
  (populated properly in step 4; step 2 can pass an empty/placeholder css).
- `ghostIngestionContractMeta` + the `ingestion` emission — **removed** (replaced
  by a slice-meta emission in step 3).
- `buildGhostReviewPacket` — relay-derived; reduce to graph/slice provenance or
  defer its emission to step 5/6. Step 2 may stub it.

## What stays stable (the seams we preserve)

- `main.ts`'s top-level flow (resolve context → prepare prompt → emit meta →
  generate) is unchanged in shape.
- `GhostTokenSource` interface survives (css populated in step 4).
- `parseGhostRequest` / `parseGhostRoots` / request types — unchanged (they parse
  the HTTP request, not Ghost internals).

## Definition of done (step 2)

- `apps/server` typechecks again with local Ghost 0.18.0 linked.
- A root or catalog request loads a `GhostGraph` and resolves a `core` slice.
- `main.ts` emits *something* coherent for ghost meta (slice-based), no
  `ingestion`/relay references remain.
- Full suite green (tests that asserted relay/ingestion shapes get updated).
- Public API snapshot regenerated if `ghost/*` exports changed.
- Build clean.

## Sequenced sub-steps

1. Add `ghostDir` to `fingerprint-catalog.ts` entries (point at `.ghost/`).
2. Rewrite the two `resolve*GhostGenerationContext` fns onto
   `loadFingerprintPackage` + `resolveGraphSlice('core')`; new context shape.
3. Strip relay types/helpers (`relayTargetPath`, `relayFingerprintDir`,
   `relayLayerNames`, `fingerprintProvenance`, `readFingerprintBundle`,
   `readYamlIfPresent`, `resolveGhostTokenSource`'s layer walk).
4. Update `main.ts`: drop `ingestion` emission, point token/brief at placeholders
   that steps 3-4 fill, keep meta coherent.
5. Remove/retype the relay-era `ghost/*` exports; regenerate public-API snapshot.
6. Fix tests (`ghost-adapter.test.ts`, `generate-route.test.ts`) to the new shape.
7. typecheck + test + build + check:public-api → green.

## Resolved decisions

- **`GhostIngestionContract` → RETIRED.** Confirmed. The rich relay ingestion
  artifact (`summon.ghost-ingestion/v1`) is gone, replaced by the flatter
  `GraphSlice`. Public-API change — fine, we're beta. The `packages/server/src/ghost/`
  relay modules (`compile.ts`, `signals.ts`, relay-shaped `types.ts`) and the
  `RawGhostFingerprintBundle`/`GhostIngestionContract` exports are deleted.

- **`GhostReviewPacket` → REDUCED, not deleted.** It is relay-era and ~12 of its
  ~16 fields are pure relay structure (`fingerprintProvenance.layers`,
  `taskContract`, `suggestedReads`, `match`, `memoryDir`) that the UI ignores and
  that cannot survive the model change. BUT the demo UI's `useSurfaceStream`
  *does* read 4 fields off `/ghost-review-packet` for a diagnostic log line:
  `baseDirectionId`, `styleSource`, `artifactFiles`, `validation.{blocked,warnings}`.
  So: keep the `/ghost-review-packet` meta path, slim `GhostReviewPacket` to the
  fields the UI uses plus graph/slice provenance (surface, gathered node ids),
  drop every relay-derived field. Net: a small, honest packet, not a deletion.

- **Token source in step 2:** placeholder empty css is acceptable *only* because
  step 4 immediately follows. Steps 2-4 land close together.
