# Console Chrome 2001 Fingerprint Upgrade Plan

Date: 2026-06-22
Bundle: `console-chrome-2001`
Current location: `apps/server/fingerprints/bundles/console-chrome-2001`
Reference maturity target: BLInterface-style marketplace draft in `ghost-internal`

## 1. Bundle Snapshot

- **Bundle id:** `console-chrome-2001`
- **Current tier:** Tier 2.5 — usable and visually strong, but under-evidenced.
- **Target tier:** Tier 3 — marketplace-ready draft comparable in authoring shape to BLInterface, with a path to Tier 4 after scored evals and approved exemplars.
- **Current role:** A style/medium fingerprint for Nintendo-2001-inspired retro console web surfaces in Summon.
- **Required files present:** `bundle.json`, `tokens.css`, `fingerprint/manifest.yml`, `fingerprint/prose.yml`, `fingerprint/inventory.yml`, `fingerprint/composition.yml`, `fingerprint/enforcement/checks.yml`, and `fingerprint/sources/curation/source-study-2026-06-22.md`.
- **Validation status:** `ghost lint` and `ghost verify` passed at authoring time.
- **Current usefulness:** The package is already generation-useful: it has a strong material thesis, detailed tokens, explicit anti-goals, and actionable composition patterns for faceplate shells, command bars, hero plates, rails, lists, forms, and warm action semantics.
- **Highest-risk gap:** No approved portable exemplars. The bundle currently relies on a local design-analysis file and public historical screenshots as research evidence, not curated exemplar assets.

## 2. Upgrade Goal

Upgrade `console-chrome-2001` from a well-written aesthetic direction into a mature Ghost marketplace fingerprint that reliably teaches agents how to build **source-agnostic retro console interfaces**: compact, hardware-like, playful, dense, and useful without copying Nintendo IP.

The upgraded fingerprint should help generated work preserve:

- a single assembled console faceplate rather than loose cards;
- periwinkle molded-plastic chrome, hard bevels, and carbon command slabs;
- amber/orange action semantics;
- small uppercase Arial/pixel-era labels;
- outlined box-art hero treatment;
- dense desktop-era module composition;
- clear IP boundaries around Nintendo-owned characters, logos, product names, screenshots, ratings marks, and exact copy.

## 3. Scope Classification

- **Primary scope:** `medium` — retro Y2K console-web interface language.
- **Secondary scope:** `moment` — early-2000s game portal / hardware dashboard nostalgia.
- **Not a brand bundle:** It must not become a Nintendo brand kit.
- **Not a root bundle:** It should not set general Summon composition defaults outside retro console-inspired use cases.

Belongs here:

- generated game-portal dashboards;
- playful catalogs, directories, control panels, launch pages, and scoreboards;
- generic original mascots, hardware motifs, cartridge/controller abstractions, and dot-matrix texture;
- historical design references used as narrow evidence.

Does not belong here:

- Nintendo logos, characters, console/product names, Pokémon/Mario imagery, ESRB marks, screenshots, or exact historical copy;
- broad pixel-art retro systems without console chrome;
- modern Switch-era Nintendo brand language;
- unrelated vaporwave/cyberpunk/CRT aesthetics.

## 4. Current Strengths

Preserve these existing strengths:

- Strong bundle thesis: "webpage as console hardware."
- Detailed palette and token mapping: periwinkle chrome, carbon slabs, amber/orange wayfinding.
- Good source-agnostic/IP-safety contracts.
- 17 composition patterns with concrete generation guidance.
- Good anti-pattern language around generic SaaS, soft cards, blurred shadows, and literal Nintendo reproduction.
- `tokens.css` already encodes useful defaults, including hard bevel shadows, compact spacing, and web-safe type.
- Public Web Design Museum research is summarized in the bundle-local curation note rather than left as unportable local knowledge.

## 5. Gaps To Close

### Evidence and exemplars

- No approved exemplars under `examples/`.
- No generated examples accepted as canonical or weighted.
- Public historical screenshots are research evidence only; they cannot become generation assets.
- No counterexample set showing what *not* to learn from adjacent retro aesthetics.

### Prose

- Current prose is strong but could add more explicit exemplar weighting once examples exist.
- `memory/intent.md` is missing; the IP boundary and marketplace intent should be human-approved.
- Experience contracts should reference approved exemplar ids once available.

### Inventory

- `inventory.sources[]` still includes an absolute local source path as provenance. Keep the local path only in curation notes; portable inventory should prefer bundle-local curation notes and public URLs.
- `inventory.exemplars[]` is empty.
- Building blocks should add renderable motif notes once examples exist: chamfered chassis, halftone slab, orange arrow disc, outlined display wordmark, and compact list row.

### Composition

- Patterns are strong, but some could be linked to exemplar refs.
- Need a mobile adaptation exemplar/pattern refinement so modern generated surfaces can stack without losing the fixed-canvas metaphor.
- Need explicit advisory review criteria for "faceplate fidelity" vs. objective checks.

### Evals

- No dogfood eval prompts checked in.
- No scored review rows proving generation lift.
- No prompt set for IP-leak failure modes.

### Checks

- Checks are intentionally empty. Candidate deterministic checks can be added only for objective package/output boundaries, not taste.

## 6. Proposed Prose Upgrades

### Add or refine situations

The current four situations are good. Keep them, then optionally add one fifth situation if exemplar coverage supports it.

#### `console-homepage`

- **User intent:** Introduce a playful product, event, or game-like destination with multiple actions.
- **Product obligation:** Use full faceplate shell with mascot/header, command bars, hero, module grid, and action rail.
- **Surface type:** `landing`
- **Principles:** `assembled-console-faceplate`, `warmth-means-direction`, `density-is-control-panel-texture`
- **Contracts:** `source-agnostic-retro`, `faceplate-before-content`
- **Patterns:** `fixed-console-shell`, `dual-command-navigation`, `box-art-hero-plate`, `right-action-rail`

#### `game-directory-or-catalog`

- **User intent:** Browse or compare items in a retro game-like catalog.
- **Product obligation:** Use compact rows, thumbnail grids, search chips, and orange forward cues.
- **Surface type:** `directory`
- **Principles:** `warmth-means-direction`, `small-labels-carry-structure`
- **Contracts:** `scan-targets-stay-obvious`, `source-agnostic-retro`
- **Patterns:** `stacked-news-or-list-rows`, `thumbnail-tile-grid`, `tool-chip-search-cluster`

#### `playful-control-panel`

- **User intent:** Configure, vote, subscribe, launch, or submit through a themed utility surface.
- **Product obligation:** Use compact form panels, label bars, dotted dividers, and semantic button colors.
- **Surface type:** `workflow`
- **Principles:** `bevels-are-depth`, `small-labels-carry-structure`
- **Contracts:** `forward-actions-are-orange`, `controls-remain-compact-but-legible`
- **Patterns:** `chrome-form-panels`, `amber-tool-and-submit-buttons`, `dotted-technical-dividers`

#### `retro-brief-or-scoreboard`

- **User intent:** Summarize status, rankings, updates, or recommendations with game-console personality.
- **Product obligation:** Use scoreboard-like labels, list rows, badges, compact panels, and clear hierarchy.
- **Surface type:** `brief`
- **Principles:** `density-is-control-panel-texture`, `source-agnostic-playfulness`
- **Contracts:** `scan-targets-stay-obvious`
- **Patterns:** `side-mounted-vertical-tabs`, `stacked-news-or-list-rows`, `badge-and-rating-stamps`, `chrome-footer-slab`

#### Proposed new situation: `mobile-console-stack`

- **User intent:** Use the retro console aesthetic in a narrow/mobile Summon surface without horizontal scrolling.
- **Product obligation:** Stack command bars, hero, rows, and rail modules while preserving the single machine-shell metaphor.
- **Surface type:** `mobile-adaptation`
- **Principles:** `assembled-console-faceplate`, `density-is-control-panel-texture`
- **Contracts:** `controls-remain-compact-but-legible`, `faceplate-before-content`
- **Patterns:** `fixed-console-shell`, `dual-command-navigation`, `right-action-rail`, proposed `stacked-faceplate-adaptation`

### Anti-goals to preserve or strengthen

At least these should remain explicit:

1. No literal Nintendo IP or exact historical reproduction.
2. No generic SaaS hero plus card grid.
3. No soft pastel rounded-card nostalgia.
4. No blurred Material/glassmorphism elevation.
5. No warm colors as ambient decoration.
6. No airy modern layout that erases density.
7. No pixel-art-only retro treatment without console hardware structure.

### Add `fingerprint/memory/intent.md`

Proposed human-approved intent:

```markdown
# Console Chrome 2001 Intent

This fingerprint captures a source-agnostic Y2K console-web composition language inspired by public historical study of Nintendo.com circa 2001. It is not a Nintendo brand kit. Generated surfaces should feel like compact game-console hardware rendered as UI — periwinkle molded chrome, carbon command slabs, amber/orange wayfinding, dense modules, small uppercase labels, and outlined box-art hero type — while avoiding Nintendo-owned marks, characters, screenshots, product names, exact copy, and regulated rating marks unless explicitly supplied by the user.
```

## 7. Proposed Composition Upgrades

Existing patterns are mostly sufficient. Upgrade them by adding exemplar refs and adding one mobile adaptation pattern.

### Existing high-priority patterns to preserve

1. `fixed-console-shell`
   - **Kind:** `structure`
   - **Use:** generation + advisory review
   - **Evidence needed:** homepage exemplar, catalog exemplar, mobile stack exemplar
   - **Quality signal:** root shell reads as one assembled chassis.

2. `dual-command-navigation`
   - **Kind:** `structure`
   - **Use:** generation + advisory review
   - **Evidence needed:** homepage exemplar, catalog exemplar
   - **Quality signal:** carbon primary bar + pale secondary strip + amber utility chips.

3. `box-art-hero-plate`
   - **Kind:** `visual`
   - **Use:** generation + advisory review
   - **Evidence needed:** homepage exemplar and online historical research note
   - **Quality signal:** heavy outlined display type, textured field, orange advance control.

4. `beveled-plate-system`
   - **Kind:** `visual`
   - **Use:** generation + advisory review
   - **Evidence needed:** all examples
   - **Quality signal:** depth comes from hard bevels, not blur.

5. `stacked-news-or-list-rows`
   - **Kind:** `content`
   - **Use:** generation + advisory review
   - **Evidence needed:** directory and scoreboard exemplars
   - **Quality signal:** compact rows have icon, headline, trailing orange cue.

6. `chrome-form-panels`
   - **Kind:** `structure`
   - **Use:** generation + advisory review
   - **Evidence needed:** control panel exemplar
   - **Quality signal:** form is capped, labeled, compact, and plate-bound.

### Proposed new pattern

#### `stacked-faceplate-adaptation`

- **Kind:** `layout`
- **Applies to:** `mobile-adaptation`, `workflow`, `directory`
- **Concrete guidance:**
  - Stack dual nav into carbon command header plus collapsible/pill secondary row.
  - Move right rail modules below primary content while preserving carbon slab styling.
  - Preserve at least one bevel/chamfer shell around the full stack.
  - Keep orange forward cues and section-label bars visible.
  - Increase invisible hit area while keeping visual controls compact.
- **Evidence needed:** generated mobile exemplar.
- **Use:** generation + advisory review.
- **Candidate deterministic check:** none; too visual/subjective.

## 8. Proposed Inventory And Evidence Upgrades

### Topology updates

Add surface type:

- `mobile-adaptation`

Potential scopes:

- `historical-research` — public source refs and curation notes only.
- `generated-exemplars` — approved synthetic examples created for this bundle.
- `console-shell` — shell/navigation/hero evidence.
- `utility-modules` — forms, rows, poll, directory, rail modules.

### Online research sources to inspect / cite

These should be inspected in a later implementation pass and summarized in a bundle-local curation note. Public screenshots should be treated as **historical/supporting evidence**, not reusable canonical assets.

| Source | Planned classification | Evidence strength | Use |
| --- | --- | --- | --- |
| `https://www.webdesignmuseum.org/gallery/nintendo-2001` | historical reference | supporting | Corroborates 2001 faceplate shell, dual nav, hero, modules. |
| `https://www.webdesignmuseum.org/gallery/nintendo-in-2000` | historical reference | supporting | Adjacent-year Nintendo web evolution; helps identify which traits are era-stable vs one screenshot. |
| `https://www.webdesignmuseum.org/gallery/nintendo-2002` | historical reference | supporting | Adjacent-year comparison for Nintendo-era chrome/portal traits. |
| `https://www.webdesignmuseum.org/gallery/nintendo-in-2003` | historical reference | supporting | Boundary check: what later Nintendo web evolved toward and what not to over-promote. |
| `https://web.archive.org/web/20010611070409/http://www.nintendo.com/index.jsp` | historical reference | supporting | Original archived context when accessible; use for structure only. |
| Web searches for `Game Boy Advance website 2001`, `Y2K game console UI beveled`, `Nintendo inspired retro web design`, `Game Boy website design Behance/Dribbble` | supporting / candidate exemplar discovery | uncurated | Find modern Nintendo-inspired retro aesthetics and distinguish portable motifs from literal fan/IP reuse. |
| Neocities / web revival pages using early-2000s game portal conventions | counterexample or supporting | uncurated | Useful for density and early-web texture, but only if console chrome is present. |

### Exemplar plan

Do not copy Nintendo-owned screenshots into `examples/` as canonical exemplars. Instead, create **original generated synthetic exemplars** inspired by the research, then optionally cite historical pages as supporting evidence.

#### Exemplar 1: `console-homepage-faceplate`

- **Expected path:** `examples/generated/console-homepage-faceplate.png` or `.html`
- **Title:** Console homepage faceplate
- **Surface type:** `landing`
- **Scope:** `generated-exemplars`
- **Evidence strength:** Weighted canonical exemplar after human approval.
- **Why:** Teaches the full shell: mascot/speech bubble, carbon command nav, pale secondary strip, hero plate, dense modules, right rail, footer.
- **Refs:**
  - `composition.pattern:fixed-console-shell`
  - `composition.pattern:dual-command-navigation`
  - `composition.pattern:box-art-hero-plate`
  - `composition.pattern:right-action-rail`
  - `prose.experience_contract:faceplate-before-content`

#### Exemplar 2: `retro-catalog-directory`

- **Expected path:** `examples/generated/retro-catalog-directory.png` or `.html`
- **Title:** Retro cartridge catalog directory
- **Surface type:** `directory`
- **Scope:** `generated-exemplars`
- **Evidence strength:** Weighted canonical exemplar after human approval.
- **Why:** Teaches search cluster, compact rows, thumbnail grid, orange chevron chips, and utility chips without literal Nintendo content.
- **Refs:**
  - `composition.pattern:tool-chip-search-cluster`
  - `composition.pattern:stacked-news-or-list-rows`
  - `composition.pattern:thumbnail-tile-grid`
  - `prose.experience_contract:scan-targets-stay-obvious`

#### Exemplar 3: `playful-control-panel-form`

- **Expected path:** `examples/generated/playful-control-panel-form.png` or `.html`
- **Title:** Playful control panel form
- **Surface type:** `workflow`
- **Scope:** `generated-exemplars`
- **Evidence strength:** Weighted canonical exemplar after human approval.
- **Why:** Teaches form panels, dotted dividers, compact controls, amber tool buttons, orange submit, and carbon rail actions.
- **Refs:**
  - `composition.pattern:chrome-form-panels`
  - `composition.pattern:dotted-technical-dividers`
  - `composition.pattern:amber-tool-and-submit-buttons`
  - `prose.experience_contract:forward-actions-are-orange`
  - `prose.experience_contract:controls-remain-compact-but-legible`

#### Exemplar 4: `retro-scoreboard-brief`

- **Expected path:** `examples/generated/retro-scoreboard-brief.png` or `.html`
- **Title:** Retro scoreboard brief
- **Surface type:** `brief`
- **Scope:** `generated-exemplars`
- **Evidence strength:** Supporting or weighted canonical exemplar after review.
- **Why:** Teaches non-homepage adaptation: ranking/status modules, side tabs, rating stamps, footer slab, and dense information hierarchy.
- **Refs:**
  - `composition.pattern:side-mounted-vertical-tabs`
  - `composition.pattern:badge-and-rating-stamps`
  - `composition.pattern:chrome-footer-slab`
  - `prose.principle:density-is-control-panel-texture`

#### Exemplar 5: `mobile-stacked-faceplate`

- **Expected path:** `examples/generated/mobile-stacked-faceplate.png` or `.html`
- **Title:** Mobile stacked console faceplate
- **Surface type:** `mobile-adaptation`
- **Scope:** `generated-exemplars`
- **Evidence strength:** Experimental exemplar until approved.
- **Why:** Teaches how to preserve the shell and command semantics in a modern narrow viewport.
- **Refs:**
  - `composition.pattern:stacked-faceplate-adaptation`
  - `composition.pattern:fixed-console-shell`
  - `prose.experience_contract:controls-remain-compact-but-legible`

### Sources / curation notes to add

- `fingerprint/sources/curation/online-retro-console-research-2026-06-22.md`
- `fingerprint/sources/curation/generated-exemplars-2026-06-22.md`

## 9. Evidence And Exemplar Gaps

| Gap | Label | Later worker action |
| --- | --- | --- |
| No approved examples in `examples/` | missing | Generate 4-5 synthetic examples, copy into bundle, request human approval. |
| Attached source path is absolute/local | non-portable | Keep only in curation note provenance; remove or soften from portable `inventory.sources[]`. |
| Public Nintendo screenshots are not safe canonical assets | uncurated / historical | Cite as historical supporting research only; do not copy as exemplar unless license/approval is explicit. |
| Modern Nintendo-inspired examples are not yet curated | missing / uncurated | Search Dribbble, Behance, Figma Community, Neocities/web revival, and design galleries; summarize motifs and reject literal IP. |
| Mobile adaptation is a modern extrapolation | subjective / experimental | Generate and review a mobile exemplar; keep advisory until approved. |
| Warm-action semantics are visual | subjective | Keep as advisory review unless a generated artifact exposes parseable token names/classes. |
| IP-safety can be objectively scanned | missing check | Add candidate forbidden-string check for example files and generated review packets if feasible. |

## 10. Candidate Deterministic Checks

### Check 1: no local absolute evidence paths in portable inventory

- **Objective signal:** `inventory.sources[].ref` and exemplar paths must not start with `/Users/`, `/private/`, `/tmp/`, or `file://`.
- **Inspected files:** `fingerprint/inventory.yml`.
- **Expected failure condition:** Any portable source or exemplar ref uses a curator-machine local path.
- **False-positive risk:** Low. A local path in a curation note may be acceptable as provenance, but not in inventory refs.
- **Why check:** Portability is objective and marketplace-critical.

### Check 2: required exemplar count before Tier 3 label

- **Objective signal:** At least 3 `inventory.exemplars[]` entries with paths under `examples/`.
- **Inspected files:** `fingerprint/inventory.yml`; exemplar paths.
- **Expected failure condition:** Fewer than 3 exemplars or missing files.
- **False-positive risk:** Medium; an early bundle can be valid without exemplars. This should be active only when claiming Tier 3/reference readiness.
- **Why check:** Evidence maturity is an objective package-readiness requirement.

### Check 3: forbidden protected strings in generated exemplars

- **Objective signal:** Example source files and curation notes should not contain unapproved literal protected names such as `Nintendo`, `Mario`, `Pikachu`, `Pokémon`, `Game Boy`, `ESRB`, or exact historical slogans except in research/provenance sections.
- **Inspected files:** `examples/**`, generated exemplar source, maybe `fingerprint/inventory.yml` notes.
- **Expected failure condition:** Protected strings appear in generated exemplar content or reusable components.
- **False-positive risk:** Medium; research notes need to name sources. Scope the check to `examples/` or generated artifacts only.
- **Why check:** IP boundary is objective enough for generated assets.

### Check 4: token CSS required

- **Objective signal:** Bundle has non-empty `tokens.css` and `bundle.json.tokens` points to it.
- **Inspected files:** `bundle.json`, `tokens.css`.
- **Expected failure condition:** Missing token CSS or broken path.
- **False-positive risk:** Low.
- **Why check:** Summon generation requires token CSS for catalog fingerprints.

### Advisory-only criteria, not checks

Keep these out of deterministic checks:

- whether a surface "feels like a console faceplate";
- whether bevels are strong enough;
- whether density is balanced;
- whether outlined display type has the right box-art energy;
- whether a mascot is tasteful.

These belong in review criteria and exemplar comparison.

## 11. Dogfood Eval Prompts

### Prompt 1: `console-homepage-launch`

- **Exact prompt:** `Create a retro console-style homepage for a fictional handheld puzzle game club called Puzzle Port. Include a hero, search/finder utility, official updates, featured community links, a player poll, and a sign-up rail. Do not use Nintendo, Mario, Pokémon, Game Boy, or ESRB names or imagery.`
- **Eval axis:** generation
- **Suggested loop:** fingerprint-iteration comparing current bundle vs upgraded bundle after exemplars.
- **Claims under test:** faceplate shell, dual command nav, dense modules, right rail, IP safety.
- **Expected strong-output traits:** periwinkle chassis, carbon command bar, pale secondary strip, box-art hero, orange forward arrows, amber utility chips, compact list rows, original mascot/bubble or no mascot.
- **Likely failure modes:** generic SaaS cards, literal Nintendo leakage, pixel-art-only styling, orange used decoratively, no rail.
- **Review notes:** Score shell fidelity, module density, action semantics, IP safety, and usefulness.

### Prompt 2: `retro-cartridge-catalog`

- **Exact prompt:** `Build a searchable retro cartridge catalog for an indie game archive. Show filters, four featured cartridges, latest update rows, ratings/status stamps, and a compact details panel for the selected item.`
- **Eval axis:** generation
- **Suggested loop:** ghost-lift against generic styling or fingerprint-iteration after catalog exemplar added.
- **Claims under test:** directory situation, search cluster, thumbnail grid, list rows, badges, selected state.
- **Expected strong-output traits:** compact white inputs, amber Go/filter chips, framed thumbnails, platinum rows, trailing orange chevrons, hard bevels, section-label bars.
- **Likely failure modes:** modern marketplace cards, too much whitespace, unrelated neon/pixel palette, no clear selected/action states.
- **Review notes:** Score scan targets, row affordances, warm color semantics, and plate structure.

### Prompt 3: `playful-access-request-panel`

- **Exact prompt:** `Design a playful control panel for joining a fictional coin-op beta. Include username, favorite genre dropdown, notification options, a terms note, submit action, help rail, and compact success/error states.`
- **Eval axis:** generation
- **Suggested loop:** fingerprint-iteration after form exemplar added.
- **Claims under test:** workflow situation, chrome form panels, compact controls, dotted dividers, orange submit, accessibility.
- **Expected strong-output traits:** platinum form panel with label bar, hard-bordered inputs, native-select geometry, dotted note divider, carbon help rail, orange submit, visible focus/error treatment.
- **Likely failure modes:** generic auth card, oversized modern inputs, missing labels, inaccessible tiny controls, green/blue default CTA.
- **Review notes:** Score legibility and modern usability alongside retro fidelity.

### Prompt 4: `scoreboard-brief`

- **Exact prompt:** `Make a retro console scoreboard brief for choosing which three community tournaments to feature this weekend. Show a ranked recommendation, evidence rows, risk/status stamps, and one next action.`
- **Eval axis:** generation
- **Suggested loop:** fingerprint-iteration after brief exemplar added.
- **Claims under test:** brief situation, list rows, badge stamps, side tabs, decision clarity.
- **Expected strong-output traits:** scoreboard-like label system, compact ranking rows, hard seams, orange next action, amber/white stamps, carbon footer or side rail.
- **Likely failure modes:** modern KPI dashboard, no recommendation, generic table, decorative badges without meaning.
- **Review notes:** Score decision clarity, density, badge usefulness, and absence of SaaS dashboard patterns.

### Prompt 5: `mobile-stacked-console`

- **Exact prompt:** `Create a narrow mobile version of a retro console event hub for a fictional chiptune night. Include a compact command header, hero, schedule rows, RSVP form, and help/status module.`
- **Eval axis:** generation
- **Suggested loop:** experimental prompt after mobile pattern added.
- **Claims under test:** mobile adaptation without losing faceplate shell.
- **Expected strong-output traits:** bounded shell, stacked command bars, compact but usable controls, rail modules moved below, preserved bevels and orange action semantics.
- **Likely failure modes:** horizontal-scroll desktop clone, generic mobile cards, controls too small, loss of command hierarchy.
- **Review notes:** Treat as advisory until human approves mobile extrapolation.

## 12. Implementation Work Plan

### Phase 1 — Portable evidence cleanup

1. Add `fingerprint/memory/intent.md` with human-approved source-agnostic intent.
2. Replace absolute local source refs in `inventory.sources[]` with bundle-local curation note refs and public URLs.
3. Add `online-retro-console-research-2026-06-22.md` summarizing public research and online Nintendo-inspired retro aesthetic findings.

### Phase 2 — Exemplar discovery and generation

1. Inspect online references: Web Design Museum adjacent Nintendo years, Wayback snapshot, and modern Nintendo-inspired retro design searches.
2. Categorize references as historical, supporting, counterexample, or rejected literal-IP source.
3. Generate or hand-author 4-5 original synthetic exemplars.
4. Save exemplars under `examples/generated/`.
5. Add `inventory.exemplars[]` entries with evidence strength notes.
6. Add `generated-exemplars-2026-06-22.md` explaining what each exemplar teaches and what not to copy.

### Phase 3 — Layer refinements

1. Add `mobile-adaptation` surface type if mobile exemplar is approved.
2. Add `stacked-faceplate-adaptation` pattern if needed.
3. Add exemplar refs to existing principles, contracts, and patterns.
4. Tighten `inventory.building_blocks` around renderable motifs proven by examples.

### Phase 4 — Dogfood evals

1. Add eval prompts from this plan to a repo-appropriate eval batch.
2. Generate baseline/current/upgraded outputs.
3. Review against criteria: shell fidelity, material fidelity, action semantics, density, usefulness, accessibility, and IP safety.
4. Promote only accepted examples to weighted/canonical status.

### Phase 5 — Candidate checks

1. Add portability check for local refs.
2. Add example protected-string scan scoped to generated examples.
3. Keep visual quality as advisory review unless a future renderer exposes objective classes/tokens.

## 13. Worker Boundaries

- Do not copy historical Nintendo screenshots as canonical examples.
- Do not use protected characters, logos, product names, screenshots, ratings marks, or exact copy in generated exemplars.
- Do not treat online fan art as reusable assets without license/approval.
- Do not add subjective taste checks as deterministic gates.
- Do not claim measured lift until eval outputs have review rows.
- Do not replace the existing strong composition layer wholesale; refine and evidence it.

## 14. Target Done State

Tier 3 is reached when:

- package still passes `ghost lint` and `ghost verify`;
- `memory/intent.md` exists;
- portable inventory no longer depends on local absolute source refs;
- at least 3 approved generated exemplars are checked in and referenced;
- online research is summarized in bundle-local curation notes;
- at least 2 dogfood prompts are checked in or documented;
- candidate checks are separated from advisory visual review;
- review criteria explicitly cover IP safety, faceplate shell, bevel material, warm action semantics, density, and usability.
