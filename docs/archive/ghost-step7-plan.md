# Step 7 plan: retire the legacy fingerprint layout (close the migration)

> Final migration step from `integration-with-ghost.md`. Now that `.ghost/` is
> the sole fingerprint source (steps 2-6), delete the legacy `fingerprint/` YAML
> dirs + `tokens.css` from the 7 bundles and cut every code path that read them.
> Splits into **do-now** (the deletion + rewiring, all local) and **blocked**
> (repin Ghost off the local `link:` — gated on Ghost's npm publish).

## What still depends on the legacy layout (the entanglement)

Deleting files naively breaks two things, so step 7 is rewiring + deletion, not
just `rm`:

1. **Catalog validation REQUIRES legacy files.** `loadBundle` in
   `fingerprint-catalog.ts` throws unless `fingerprint/{manifest,prose,inventory,
   composition}.yml` all exist. After deletion these are gone → every bundle
   fails to load. Must flip the requirement to `.ghost/manifest.yml`.
2. **`previewColors` comes from `tokens.css`.** `loadBundle` reads `tokens.css`
   and `extractPreviewColors(...)` → `entry.previewColors`, consumed by the demo
   fingerprint picker swatches (`fingerprintDisplay.ts`) and surface-gallery
   presets. After deleting `tokens.css`, swatches break unless preview colors are
   sourced from the `.ghost` graph CSS instead.
3. **`resolveCatalogTokenSource` fallback** (`ghost-adapter.ts` L327) reads
   `entry.tokenCssPath` when the slice has no CSS. Once `tokens.css` is gone this
   fallback can only return empty — but every `.ghost/index.md` fixture HAS a
   fenced css block, so `extractSliceCss` always wins. The fallback becomes dead
   and should be removed (along with `resolveCatalogTokenSource`, `tokenCssPath`,
   `fingerprintDir`).

## Do-now work (local, no Ghost publish needed)

### 7a. Catalog: require `.ghost/`, drop legacy fields
`fingerprint-catalog.ts` `loadBundle`:
- Replace the `fingerprint/{...}.yml` existence check with a `.ghost/manifest.yml`
  existence check (the canonical package anchor). Keep reading `bundle.json` for
  id/name/summary/status/tags/version metadata (that stays — it's Summon catalog
  metadata, not Ghost).
- Remove `fingerprintDir` and `tokenCssPath` from `FingerprintCatalogEntry` and
  everywhere they're set/read. Keep `ghostDir` (added in step 5).
- `meta.fingerprint` / `meta.tokens` refs in `bundle.json` become irrelevant —
  stop reading them (and drop `tokens`/`fingerprint` from the bundle.json files
  themselves in 7c).

### 7b. previewColors from the graph
- `previewColors` must survive (UI swatches). Source it from the `.ghost` graph's
  token CSS instead of `tokens.css`: in `loadBundle`, load the package + slice
  (or just read `.ghost/index.md` and extract the fenced css), run the existing
  `extractPreviewColors` on that css.
- Cost: `loadBundle` becomes async or does a synchronous read of `.ghost/index.md`
  + regex-extract the css block (cheaper, no graph load needed just for swatches).
  Prefer the synchronous index.md read + reuse the css-block regex — catalog load
  stays sync and fast. Decision: **read `.ghost/index.md`, extract fenced css,
  extractPreviewColors** — no full graph load in the catalog.

### 7c. Delete the legacy files
For all 7 bundles: `git rm -r fingerprint/ tokens.css`. Also drop the now-dead
`"fingerprint"` and `"tokens"` keys from each `bundle.json` (and confirm nothing
else in bundle.json is legacy-only). Keep `examples/` only if still referenced —
they are NOT (step-2/3 dropped exemplar consumption), so `git rm -r examples/`
too. Confirm `sources/curation/` (provenance notes) go as well — not consumed.

### 7d. Remove dead adapter code
- Delete `resolveCatalogTokenSource` import + call in `ghost-adapter.ts`; the
  catalog token source is always the slice css now (a `.ghost` fixture with no css
  block is a fixture bug, not a runtime fallback — fail loudly or return empty
  with a warning, not silently read a deleted file).
- Drop `resolveCatalogTokenSource`, `extractPreviewColors`-from-tokens.css path,
  `tokenCssPath`, `fingerprintDir` from `fingerprint-catalog.ts`.

### 7e. Tests + fixtures
- Update `fingerprint-catalog` tests + any test fixture bundles that built a
  legacy `fingerprint/` layout — point them at `.ghost/`.
- `generate-route.test.ts` / `ghost-adapter.test.ts` fixtures already use `.ghost/`
  (steps 2-6) — confirm none still scaffold `fingerprint/` or `tokens.css`.

## Blocked-on-Ghost-publish work (do NOT do now)

### 7f. Repin Ghost off the local link
`apps/server/package.json` currently has
`"@anarchitecture/ghost": "link:../../../ghost/packages/ghost"`. This CANNOT be
published. When Ghost publishes to npm:
- Repin to the published version (e.g. `"^0.18.0"` or whatever ships).
- `pnpm install`, re-run the full suite + a live smoke against the published pkg.
- This is the true close of the migration. Until then the repo is dev-only
  (already noted in the link commit `aa1d38c`).

Record 7f as a tracked, explicitly-blocked item — it gates any release.

## Definition of done (do-now)

- All 7 bundles have ONLY `.ghost/` + `bundle.json` (legacy `fingerprint/`,
  `tokens.css`, `examples/`, `sources/` removed); bundle.json drops `fingerprint`/
  `tokens` keys.
- `fingerprint-catalog.ts` requires `.ghost/manifest.yml`, sources previewColors
  from `.ghost/index.md` css, no `tokenCssPath`/`fingerprintDir`/
  `resolveCatalogTokenSource`.
- `ghost-adapter.ts` has no `resolveCatalogTokenSource` reference.
- `pnpm typecheck`/`test`/`build`/`check:public-api` green; tests/fixtures updated.
- Live smoke: all 7 fingerprints still load (catalog), `/api/fingerprints` returns
  them with previewColors, signal-stream generates clean with tokens + the full
  receipt. A grep confirms no source references `tokens.css` or `fingerprint/`.
- The repo tree under `bundles/<id>/` is clean (just `.ghost/` + `bundle.json`).

## Risks / confirms

1. **previewColors source:** confirm sourcing swatches from the `.ghost/index.md`
   fenced css (sync read + extractPreviewColors) rather than a full graph load —
   keeps catalog load cheap. Agree?
2. **Drop `examples/` + `sources/curation/`:** confirm these are fully unconsumed
   and safe to delete (they were design provenance; nothing reads them at runtime).
   Agree, or keep them as authoring provenance even if unused?
3. **No silent token fallback:** confirm that a `.ghost` fixture lacking a css
   block should produce an empty/warned token source, NOT silently read a file
   (which no longer exists). Agree?
4. **7f repin stays parked** until Ghost publishes — do-now ends at the deletion +
   rewire; the repo remains on the local link. Agree?
