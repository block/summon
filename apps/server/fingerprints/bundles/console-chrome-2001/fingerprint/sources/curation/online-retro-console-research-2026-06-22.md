# Online Retro Console Research Curation Note

Date: 2026-06-22
Bundle: console-chrome-2001
Curator: Goose
Status: provisional

## Sources Read

- `https://www.webdesignmuseum.org/gallery/nintendo-2001`
- `https://www.webdesignmuseum.org/uploaded/timeline/nintendo/nintendo-2001.png`
- `https://www.webdesignmuseum.org/gallery/nintendo-in-2000`
- `https://www.webdesignmuseum.org/uploaded/timeline/nintendo/nintendo-2000.png`
- `https://www.webdesignmuseum.org/gallery/nintendo-2002`
- `https://www.webdesignmuseum.org/uploaded/timeline/nintendo/nintendo-2002.png`
- `https://www.webdesignmuseum.org/gallery/nintendo-in-2003`
- `https://www.webdesignmuseum.org/uploaded/timeline/nintendo/nintendo-2003.png`
- `https://web.archive.org/web/20010611070409/http://www.nintendo.com/index.jsp`
- Web searches for Nintendo-inspired retro web/UI design, Game Boy Advance-era web design, Y2K game-console UI, and modern retro game portal aesthetics.

## Source Classification

| Source | Classification | Evidence Strength | Scope | Notes |
| --- | --- | --- | --- | --- |
| Web Design Museum Nintendo 2001 page and screenshot | historical reference | supporting | historical-research | Confirms the fixed 830px-ish periwinkle faceplate, mascot masthead, dual command nav, hero, lists, poll, right rail, left tabs, and footer. |
| Web Design Museum Nintendo 2002/2003 pages and screenshots | historical reference | supporting | historical-research | Confirms that the 2001 chrome shell persisted across adjacent years with varied hero campaigns and rail content. |
| Web Design Museum Nintendo 2000 page and screenshot | historical reference / contrast | supporting | historical-research | Shows a looser pre-faceplate portal with playful blobs and right link stacks; useful as boundary context, not the target grammar. |
| Wayback 2001 Nintendo archive | provenance only | supporting | historical-research | Useful as original context when accessible; not a reusable artwork source. |
| Modern search results for Nintendo-inspired retro aesthetics | candidate discovery | uncurated | generated-exemplars | Search results skew heavily toward official/product pages or fan/IP work. Use only to identify recurring safe motifs; do not copy assets. |

## Durable Signals Promoted

- The 2001-2003 screenshots consistently support a **fixed desktop-era chassis** around 830px wide with a grey browser field outside the main surface.
- The strongest reusable grammar is **console hardware**, not generic nostalgia: periwinkle molded body, hard clipped/chamfered edges, raised/inset plates, and visible bevel seams.
- The **carbon command layer** is stable across 2001-2003: top nav, right rail, vertical tabs, and footer use near-black slabs with dot-matrix/grille texture.
- The **dual navigation stack** is signature: a carbon primary command row with warm gold labels over a pale secondary utility strip.
- **Warm color is directional or utilitarian**: amber for utility chips/badges/tool tabs; orange for arrows, submit, and forward movement.
- Hero panels use **campaign-specific pictorial fields** with heavy outlined display wordmarks and hard shadow; this can be translated into original abstract hero plates.
- Dense module arrangement is intentional: official updates, featured tiles, polls/forms, right-rail actions, and footer all appear in one packed machine face.
- Adjacent-year pages show that content can change substantially while the shell remains stable; the fingerprint should encode the shell and material grammar rather than one exact homepage.

## Signals Not Promoted

- Nintendo, Mario, Pokémon, Game Boy, Kirby, Metroid, ESRB, official screenshots, exact copyright copy, exact navigation labels, and campaign images are not promoted as reusable assets.
- The 2000 page's looser white background, giant playful blobs, and official character imagery are not the target; they are useful only as historical contrast.
- Modern fan-art or portfolio work found through search is uncurated unless license and source-agnostic value are reviewed.
- Pixel-art alone is not sufficient. The target requires console chrome, command bars, bevels, and dense modules.
- CRT scanline, cyberpunk neon, vaporwave gradients, and glassmorphism are adjacent retro tropes but not part of this fingerprint.

## Layer Uses

| Layer | Planned Use |
| --- | --- |
| `prose.yml` | Support source-agnostic intent, IP boundary, situations, and contracts around faceplate, action semantics, and mobile adaptation. |
| `inventory.yml` | Cite this research note, public URLs, and original synthetic exemplars; avoid direct historical screenshot exemplars. |
| `composition.yml` | Ground faceplate shell, dual nav, carbon command texture, hero plate, right rail, list rows, and mobile stack patterns. |
| `checks.yml` | Only objective portability/IP-string checks are candidates; visual fidelity stays advisory. |

## Portability Actions

- Public screenshot URLs are retained as source references, not copied into `examples/`.
- Original synthetic exemplars were created under `examples/generated/` to teach the visual language without source-owned assets.
- The local attached analysis file remains provenance in the source-study note; portable inventory points to bundle-local notes rather than local absolute paths.

## Advisory Boundaries

- Whether a generated surface has enough "box-art energy" is advisory review, not a deterministic check.
- Whether a bevel feels period-correct is advisory review unless the renderer exposes parseable design tokens/classes.
- Whether the mobile adaptation still feels like one machine is advisory until more generated examples are reviewed.

## Open Decisions

- Human curator should approve which synthetic exemplars are canonical vs supporting vs experimental.
- Decide whether to add generated HTML sources alongside PNG exemplars for richer inspectable evidence.
- Decide whether protected-name scans should be implemented in Ghost checks or in Summon-specific test tooling.
