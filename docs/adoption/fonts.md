# Safe font inclusion (design exploration)

> **Status: exploration.** Nothing here is implemented. This note records the
> constraints and the recommended shape for giving fingerprints real typefaces
> without weakening the Surface Document boundary.

## Why this exists

Fingerprints increasingly name a typeface as part of their identity (upstream
`vessel-light` ships HK Grotesk woff2 files as `.ghost/materials/fonts/`).
Today Summon cannot render them: `main.css` bans `@import`, external URLs, and
`data:` URLs, so every surface falls back to the system stack behind
`var(--font-sans, system-ui, sans-serif)`. That is a real fidelity loss — the
artifact renders, but it is not the fingerprint.

## Constraints that shape the design

1. **The artifact can never carry fonts.** Generated `main.css` is untrusted
   model output. Allowing `url()` fetches (even `data:`) from it reopens the
   exfiltration/injection channel the validator exists to close
   (`surface-document-css-external-url`). This ban stays.
2. **`@font-face` does not work inside shadow roots.** Surface documents
   render into an open shadow root via `<style>` elements
   (`renderSurfaceDocumentArtifact` in `packages/host/src/summon-surface.ts`).
   Per CSSWG resolution and all major engines, `@font-face` rules are
   document-scoped: declared inside a shadow root they load nothing. Font
   *declarations* must land in the host document; font *usage*
   (`font-family:`) works fine inside the shadow root.
3. **The host already owns a styling channel.** `tokensSource` flows
   host → `SummonSurface` and is installed by the host, never authored by the
   model. Fonts are the same trust class: host-owned design material.

## Recommended shape: host-provided font faces, token-referenced families

Add one option alongside `tokensSource`:

```ts
interface SummonSurfaceOptions {
  tokensSource?: string;
  /** Host-owned @font-face CSS. Installed in the document, not the shadow root. */
  fontFacesSource?: string;
}
```

- The host supplies `@font-face` rules whose `src: url(...)` points at assets
  the **host** serves (same-origin or its own CDN). The model never sees or
  authors these rules.
- `SummonSurface` installs `fontFacesSource` into `document.head` (not the
  shadow root, per constraint 2), deduplicated per surface id / content hash,
  and removes it on dispose only if no other live surface installed the same
  hash.
- The fingerprint's token CSS binds the family:
  `--font-sans: "HK Grotesk", system-ui, sans-serif;`. Generated `main.css`
  keeps using `var(--font-sans)` — no validator change, no new authority for
  the model.
- Transport from a fingerprint bundle: font files ride as bundle assets
  (mirroring Ghost's `materials/fonts/`), the serving host exposes them at
  URLs it controls, and the catalog entry carries the generated `@font-face`
  block. The engine/prompt layer is untouched — fonts are render-time host
  material, not generation context.

### Failure posture

- Font fetch fails → the stack after the first family renders. Fingerprint
  token stacks must always carry a system fallback (this is already the
  convention in vendored bundles).
- Host provides nothing → exactly today's behavior.

## Rejected alternatives

- **Allow `url()`/`data:` in `main.css` for fonts.** Reopens the validated
  boundary for a styling concern the host can own. Rejected.
- **Inline fonts as `data:` URIs in `tokensSource`.** Works (document-scoped
  install would still be required) but bloats every envelope by hundreds of KB
  per weight and defeats caching. Acceptable only for fully offline hosts.
- **`document.fonts.add(new FontFace(...))`.** Equivalent power to the
  `<style>` install with more code and the same document-scoping; no safety
  gain. Not worth the divergence from the existing style-install path.

## Open questions

- Should `fontFacesSource` ride the surface envelope (like `tokenCss`) so
  remote hosts get it without wiring a prop? Probably yes, as a sibling field.
- CSP interaction: hosts with strict `font-src` must allowlist their own font
  origin; Summon should document this, not manage it.
- Subsetting/licensing is host responsibility; vendored demo bundles should
  only ship fonts with licenses that permit redistribution.
