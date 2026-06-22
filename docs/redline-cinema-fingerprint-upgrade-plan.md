# Redline Cinema Fingerprint Upgrade Plan

Date: 2026-06-22
Bundle: `apps/server/fingerprints/bundles/redline-cinema`
Comparison bar: `ghost-internal/fingerprints/bundles/blinterface`

## 1. Bundle Snapshot

- **Bundle id:** `redline-cinema`
- **Current tier:** strong Tier 2 / early Tier 3 draft
- **Target tier:** Tier 3 marketplace-ready draft, with a clear path to Tier 4 after dogfood evals
- **Role:** source-agnostic luxury-performance editorial fingerprint for Summon-generated surfaces
- **Required files present:** yes
  - `bundle.json`
  - `tokens.css`
  - `fingerprint/manifest.yml`
  - `fingerprint/prose.yml`
  - `fingerprint/inventory.yml`
  - `fingerprint/composition.yml`
  - `fingerprint/enforcement/checks.yml`
  - `fingerprint/sources/curation/source-study-2026-06-22.md`
- **Validation status:** `ghost lint` and `ghost verify` pass with 0 errors / 0 warnings.
- **Current usefulness:** The package already has enough prose, inventory, composition, and token guidance to steer generation toward near-black cinematic surfaces, scarce red emphasis, sharp controls, spec numerals, image-first editorial cards, and selective white transactional sheets.
- **Highest-risk gap:** The fingerprint has no portable exemplars. Compared with BLInterface, the guidance is mostly prose-backed, not visually grounded.

## 2. Upgrade Goal

Upgrade `redline-cinema` so future generated work understands the *composition system* behind a luxury-performance automotive editorial language without copying Ferrari identity.

The upgraded fingerprint should help agents preserve:

- cinematic full-bleed image hierarchy
- warm near-black canvas discipline
- scarce race-red voltage
- restrained sans typography with uppercase tracked labels
- sharp rectangular CTA/card/listing geometry
- large specification numerals and hairline row systems
- selective white sheets for preowned/catalog/dealer/booking density
- editorial pacing between emotional launch sections and transactional clarity

The upgraded fingerprint must continue to avoid:

- Ferrari names, Cavallino/shield marks, model names, team names, slogans, proprietary photography, and licensed fonts in generated output unless supplied by the user
- copying official page layouts verbatim
- using Ferrari screenshots or assets as portable bundle assets without explicit approval
- turning race-red into a general decorative palette

## 3. Scope Classification

Classification: **brand-inspired composition + medium bundle**.

This bundle should cover:

- premium product launches
- automotive-like or performance-led landing pages
- editorial feature surfaces
- event/race/status recaps
- specification and comparison layouts
- catalog, preowned, booking, dealer, or concierge-style transactional surfaces

This bundle should not cover:

- exact Ferrari reproduction
- Formula 1 team identity or Scuderia-specific surfaces
- official Ferrari commerce, configurator, or dealer implementations
- generic motorsport dashboards with neon/cyber aesthetics
- broad luxury fashion/editorial unless the prompt also implies performance, precision, machine, motion, or specification

## 4. Current Strengths To Preserve

Preserve these current files and claims:

- `tokens.css`
  - near-black `#181818` canvas
  - red accent `#da291c` translated as generic scarce race-red voltage
  - square 0px default geometry
  - explicit 4/8px spacing ladder
  - no surface shadow tiers
- `prose.yml`
  - strong agnostic contract: `source-agnostic-performance-language`
  - useful situations: cinematic launch, performance spec story, luxury catalog/booking, editorial feature
  - strong principles: cinema is chrome, red is voltage not palette, sharp precision, specification data, white transactional relief
- `composition.yml`
  - concrete generation patterns: full-bleed hero, scarce red CTA, spec grid, event row system, white catalog sheet, image-first listing card
- `source-study-2026-06-22.md`
  - already states the non-copying boundary and primary observations

## 5. Online Research Inputs

Use official/public Ferrari web pages as **research inputs**, not as direct portable visual assets. The goal is to extract composition signals and create agnostic exemplars.

### Already reachable via text extraction

1. **Ferrari Range / Auto line-up**
   - URL: `https://www.ferrari.com/en-EN/auto`
   - Extracted title: `Ferrari Range: All the Models on Sale - Ferrari.com`
   - Observed signals:
     - line-up page with hero/video region
     - dramatic model imagery
     - uppercase/letter-spaced heading treatment
     - repeated image-led model plates
     - range/category browsing structure
   - Use for exemplar: cinematic launch and image-first model/catalog grid.

2. **Ferrari Approved / Preowned**
   - URL: `https://preowned.ferrari.com/en-US`
   - Extracted title: `Ferrari Approved: a world of Used Ferrari for sale awaits you.`
   - Observed signals:
     - editorial hero headline and deck
     - vehicle listing cards with photography
     - white/catalog-like transactional density
     - dealer and genuine-accessory CTA bands
   - Use for exemplar: white catalog sheet and listing card system.

3. **Ferrari History**
   - URL: `https://www.ferrari.com/en-EN/history`
   - Extracted title: `The Ferrari History`
   - Observed signals:
     - cinematic intro image
     - historical/editorial narrative structure
     - strong section title treatment
     - image-led heritage storytelling
   - Use for exemplar: editorial feature / heritage article surface.

4. **Dealers / Official Network**
   - URL: `https://www.ferrari.com/en-EN/auto/dealers`
   - Extracted title: `Ferrari Dealers and Official Service and Body shop - Ferrari.com`
   - Observed signals:
     - dense regional list structure
     - transactional lookup/service context
     - brand frame around utilitarian directory content
   - Use for exemplar: white dealer/booking sheet and dense row/list behavior.

5. **Ferrari News**
   - URL: `https://www.ferrari.com/en-EN/news`
   - Extracted title: `Ferrari news: all the latest plus updates`
   - Observed signals:
     - large navigation taxonomy across racing, sports cars, collections, experiences, about
     - news/editorial index posture
   - Use for exemplar: editorial index or feature-card grid.

### Needs browser/manual research

Some pages returned CloudFront 403 through CLI extraction and should be inspected with a browser or manual capture if more evidence is needed:

- homepage: `https://www.ferrari.com/en-EN`
- Formula 1 landing: `https://www.ferrari.com/en-EN/formula1`
- Formula 1 race calendar: `https://www.ferrari.com/en-EN/formula1/race-calendar`
- magazine/editorial pages if available through navigation
- individual model pages such as 12Cilindri / F80 / 296 pages

Manual research should record observations in the source study; do not copy proprietary screenshots into the portable bundle unless explicitly approved.

## 6. Exemplar Strategy

BLInterface quality depends on portable exemplars. For `redline-cinema`, lean on Ferrari research while keeping the bundle agnostic by creating **derived, source-agnostic exemplars**.

### Exemplar policy

- Do **not** include Ferrari screenshots, logos, model photos, or extracted image assets as bundle exemplars by default.
- Do **not** use Ferrari names or model names inside exemplar UI copy.
- Use online Ferrari research to write visual briefs and then produce original, agnostic exemplar images from those briefs.
- Each exemplar should live under:

```text
apps/server/fingerprints/bundles/redline-cinema/examples/core/
```

- Each exemplar should be referenced from `inventory.yml` with:
  - `id`
  - `path`
  - `title`
  - `surface_type`
  - `scope`
  - `why`
  - `refs`
  - `note` stating it is a derived agnostic exemplar informed by online research, not a copied source screenshot

### Proposed exemplar set

#### 1. `cinematic-launch-hero.png`

- **Source research:** Ferrari Range / Auto line-up, homepage/manual browser pass if available
- **Surface type:** `landing`
- **Evidence strength:** weighted derived exemplar
- **What it should show:**
  - near-black full-bleed hero
  - abstract premium vehicle/detail image placeholder or generated non-branded performance photography
  - compact top nav
  - restrained display headline
  - one red rectangular primary CTA
  - one white outline secondary CTA
  - minimal chrome
- **Refs supported:**
  - `composition.pattern:full-bleed-cinematic-hero`
  - `composition.pattern:scarce-red-cta-cluster`
  - `prose.principle:cinema-is-the-chrome`
  - `prose.experience_contract:source-agnostic-performance-language`

#### 2. `performance-spec-grid.png`

- **Source research:** model pages / Ferrari Range / Formula 1 or race-calendar manual research
- **Surface type:** `specification`
- **Evidence strength:** weighted derived exemplar
- **What it should show:**
  - dark canvas
  - 3–4 large spec numerals
  - uppercase labels and units
  - 1px hairline dividers
  - one red decisive value only
  - short editorial explanation below or beside specs
- **Refs supported:**
  - `composition.pattern:large-number-spec-grid`
  - `composition.pattern:dark-elevated-plates`
  - `prose.principle:data-reads-as-specification`
  - `prose.experience_contract:metrics-earn-their-scale`

#### 3. `white-preowned-catalog-sheet.png`

- **Source research:** Ferrari Approved / Preowned page
- **Surface type:** `catalog`
- **Evidence strength:** weighted derived exemplar
- **What it should show:**
  - transition from dark editorial header into white catalog sheet
  - image-first listing cards
  - compact metadata rows
  - price/status or availability labels
  - hairline borders, square corners
  - filter/search controls with tiny input radius and square CTAs
- **Refs supported:**
  - `composition.pattern:white-catalog-sheet`
  - `composition.pattern:image-first-listing-card`
  - `composition.pattern:rectangular-form-and-control-system`
  - `prose.principle:white-is-transactional-relief`
  - `prose.experience_contract:transactional-density-stays-editorial`

#### 4. `event-row-system.png`

- **Source research:** Formula 1 race calendar/manual browser pass; Ferrari News navigation; dealer directory list structure as fallback row evidence
- **Surface type:** `specification`
- **Evidence strength:** supporting derived exemplar
- **What it should show:**
  - dark or white row system
  - date/sequence on the left
  - event/location/context in the middle
  - result/status/action at the right
  - uppercase labels
  - one red active/decisive status
  - hairline-separated rows
- **Refs supported:**
  - `composition.pattern:race-or-event-row-system`
  - `prose.principle:data-reads-as-specification`
  - `prose.experience_contract:red-highlights-only-the-decisive-value`

#### 5. `heritage-editorial-feature.png`

- **Source research:** Ferrari History page and Ferrari News/editorial pages
- **Surface type:** `editorial`
- **Evidence strength:** supporting derived exemplar
- **What it should show:**
  - dark editorial opening
  - large cinematic image crop or image placeholder
  - restrained headline and deck
  - image-first feature cards or split editorial section
  - large section spacing
  - no ecommerce chrome
- **Refs supported:**
  - `composition.pattern:editorial-dark-to-body-pacing`
  - `composition.pattern:image-first-feature-card`
  - `prose.principle:cinema-is-the-chrome`
  - `prose.principle:restrained-sans-does-not-shout`

#### 6. `single-red-livery-band.png`

- **Source research:** racing/line-up pages and attached style analysis
- **Surface type:** `landing`
- **Evidence strength:** supporting derived exemplar
- **What it should show:**
  - long dark page with one full-width red interruption
  - large white restrained statement
  - no repeated red sections
  - surrounding dark/white sections demonstrating rarity
- **Refs supported:**
  - `composition.pattern:single-red-livery-band`
  - `prose.principle:red-is-voltage-not-palette`
  - `prose.experience_contract:red-highlights-only-the-decisive-value`

## 7. Proposed Source Study Upgrade

Expand `fingerprint/sources/curation/source-study-2026-06-22.md` to match the maturity of BLInterface’s source study.

Add sections:

1. **Sources Read**
   - attached design analysis
   - official Ferrari Range page
   - official Ferrari Approved / Preowned page
   - official Ferrari History page
   - official Ferrari Dealers page
   - official Ferrari News page
   - manually inspected pages, if browser pass succeeds

2. **Classification**
   - attached design analysis: primary token/component extraction
   - official pages: public composition corroboration
   - blocked pages: attempted but unavailable through CLI; manual browser pass optional
   - derived exemplars: original agnostic evidence created from observations

3. **Durable Signals Promoted**
   - full-bleed cinematic hero
   - image-first model/editorial cards
   - near-black base canvas
   - selective white transactional sheets
   - scarce red accent
   - uppercase tracked labels
   - large spec numerals
   - hairline row systems
   - sharp geometry

4. **Curation Cautions**
   - Ferrari identity is research-only, not generation output
   - no copied screenshots/assets by default
   - avoid model names, Scuderia/F1 team identity, Cavallino/shield motifs
   - online extraction may omit visual CSS details; browser pass should confirm claims before Tier 4

5. **Exemplar Derivation Notes**
   - map each derived exemplar to source observations and fingerprint refs

## 8. Proposed Inventory Upgrades

Add `examples/core/*.png` assets and then extend `inventory.yml`:

- Add `assets:` entries for the six proposed exemplars.
- Add `exemplars:` records with refs to the patterns/contracts they support.
- Add `sources:` entries for public research URLs if the team is comfortable with URL refs in the portable package.
- Add notes that exemplars are derived and agnostic.

Proposed topology additions:

- `cinematic-launch`
  - paths: `examples/core/cinematic-launch-hero.png`, `fingerprint/composition.yml`
  - surface types: `landing`, `editorial`
- `performance-spec`
  - paths: `examples/core/performance-spec-grid.png`, `examples/core/event-row-system.png`
  - surface types: `specification`
- `transactional-catalog`
  - paths: `examples/core/white-preowned-catalog-sheet.png`
  - surface types: `catalog`
- `editorial-heritage`
  - paths: `examples/core/heritage-editorial-feature.png`
  - surface types: `editorial`

## 9. Proposed Prose Upgrades

Current prose is strong enough; focus on precision rather than volume.

Recommended edits:

1. Add a principle or guidance note for **derived imagery**:
   - image slots may be abstract or generated, but must not invent brand-owned cars/logos.
2. Strengthen `luxury-catalog-or-booking` with dealer-directory and concierge flows from online research.
3. Add evidence refs to new exemplars once created.
4. In `source-agnostic-performance-language`, add obligation:
   - generated surfaces may say “performance marque,” “private collection,” “track session,” or prompt-derived names, but not Ferrari-specific names.
5. Consider adding a situation:
   - `premium-service-directory`
   - user intent: find a dealer, service center, concierge, location, or authorized partner
   - obligation: preserve brand frame while making dense regional information scannable
   - patterns: `white-catalog-sheet`, `race-or-event-row-system`, `rectangular-form-and-control-system`

## 10. Proposed Composition Upgrades

Current composition is good. Add or refine only where online research creates a concrete gap.

Potential new patterns:

### `premium-directory-sheet`

- **Kind:** structure
- **Applies to:** `catalog`, `specification`
- **Evidence:** Ferrari Dealers page research
- **Guidance:**
  - Use a white or dark disciplined row/list region for service locations, partners, or authorized providers.
  - Group by region or category with uppercase section labels.
  - Keep location rows compact and hairline-separated.
  - Provide search/filter action without turning the page into a generic map app.
- **Advisory vs check:** generation + advisory review.

### `lineup-category-browse`

- **Kind:** structure
- **Applies to:** `landing`, `catalog`
- **Evidence:** Ferrari Range page research
- **Guidance:**
  - Use image-led categories or model groups.
  - Keep category labels editorial and numeric/order-aware where useful.
  - Avoid dense ecommerce filtering in the first category-browse moment.
- **Advisory vs check:** generation guidance.

### `derived-image-placeholder-discipline`

- **Kind:** rule
- **Applies to:** all surface types
- **Evidence:** source-agnostic curation stance
- **Guidance:**
  - When no prompt-provided images exist, create neutral cinematic placeholders, gradients, or abstract detail crops.
  - Do not invent source-branded vehicles, logos, shields, or model photography.
- **Advisory vs check:** partly candidate check if output text/assets include forbidden source names.

## 11. Candidate Deterministic Checks

Keep taste guidance advisory, but add objective checks where safe.

### Check 1: no source brand strings in fingerprint package

- **Objective signal:** forbidden regex for Ferrari-specific terms in generation-facing files, with allowlist for source-study or docs if needed.
- **Inspect:** `fingerprint/prose.yml`, `fingerprint/inventory.yml`, `fingerprint/composition.yml`, `tokens.css`, derived exemplar metadata.
- **Failure:** source brand names, model names, mark names, or slogans appear in generation guidance.
- **False-positive risk:** online source URLs may contain brand names; either exclude `sources/curation` or allow source URLs only.
- **Why check:** source-agnostic output is an explicit contract.

### Check 2: no absolute local source paths

- **Objective signal:** forbidden regex for `/Users/`, `/tmp/`, `file://`, or curator-machine paths.
- **Inspect:** portable fingerprint files.
- **Failure:** inventory sources or exemplar paths point to local-only files.
- **False-positive risk:** low.
- **Why check:** portability is required for bundle quality.

### Check 3: no pure black background token

- **Objective signal:** forbid `--color-bg: #000000` in `tokens.css`.
- **Inspect:** `tokens.css`.
- **Failure:** base canvas becomes pure black.
- **False-positive risk:** low if scoped to `--color-bg` only.
- **Why check:** near-black canvas is objective and tokenized.

### Check 4: square CTA/card radius remains available

- **Objective signal:** require `--radius-sm: 0px` and `--radius-md: 0px` or equivalent.
- **Inspect:** `tokens.css`.
- **Failure:** canonical small/default radii become rounded.
- **False-positive risk:** medium if token vocabulary changes.
- **Why check:** sharp geometry is central and tokenized.

### Check 5: exemplars required before `published`

- **Objective signal:** if `bundle.json.status` is `published`, require at least 4 `examples/core/*.png` files and `inventory.exemplars` entries.
- **Inspect:** bundle metadata and inventory.
- **Failure:** published package lacks visual evidence.
- **False-positive risk:** low.
- **Why check:** prevents prose-only packages from presenting as mature.

## 12. Dogfood Eval Prompts

### Prompt A: premium electric motorcycle launch

- **Exact prompt:** “Generate a landing page for a premium electric motorcycle launch called Night Arrow. It should announce the product, show three performance specs, and invite users to reserve a private test ride.”
- **Eval axis:** generation
- **Claims under test:** cinematic hero, scarce red CTA, spec grid, source-agnostic language, sharp geometry
- **Strong output traits:** full-bleed dark hero, one red CTA, no Ferrari references, large meaningful spec numerals, restrained copy, no rounded SaaS cards
- **Likely failures:** generic EV SaaS page, too many red accents, invented Ferrari-like shield/horse imagery, oversized unlabelled stats

### Prompt B: private track-day booking and lineup comparison

- **Exact prompt:** “Generate a premium track-day booking surface for three anonymous performance cars. Include availability, package comparison, and a booking CTA.”
- **Eval axis:** generation
- **Claims under test:** white transactional sheet, catalog/listing cards, comparison structure, rectangular controls
- **Strong output traits:** dark editorial frame, white booking/catalog region, aligned package comparison, image-first cards, sharp buttons, one red primary action
- **Likely failures:** generic travel booking UI, pill filters, sale badges, multiple red buttons, no cinematic frame

### Prompt C: race-week results recap

- **Exact prompt:** “Generate a race-week recap surface for a fictional racing academy. Show session results, driver positions, and one editorial highlight without using any real racing brand.”
- **Eval axis:** generation
- **Claims under test:** event row system, large red decisive value, source-agnostic boundary
- **Strong output traits:** hairline-separated rows, red only for winning/active position, large number cell with label, fictional names, no Ferrari/Scuderia/F1 identifiers
- **Likely failures:** real brand leakage, sports scoreboard cliché, many team colors, dashboard table without editorial hierarchy

### Prompt D: heritage editorial feature

- **Exact prompt:** “Generate an editorial feature page for a fictional design studio’s 50-year performance archive. It should feel cinematic and premium, with a history section, two feature cards, and a closing CTA.”
- **Eval axis:** generation
- **Claims under test:** heritage editorial pacing, image-first feature cards, dark-to-body rhythm, restrained typography
- **Strong output traits:** cinematic intro, broad editorial spacing, image-first cards, muted body copy, no ecommerce density, no copied source names
- **Likely failures:** generic blog page, too much copy, card feed, no image-led hierarchy

## 13. Work Plan

### Phase 1: Research hardening

- Use browser/manual research for blocked official pages.
- Save text observations into `source-study-2026-06-22.md`.
- Record which pages were accessible, blocked, or manually inspected.
- Extract composition observations only; do not copy official assets.

### Phase 2: Derived exemplar production

- Create `examples/core/`.
- Generate or design six agnostic exemplar PNGs listed above.
- Ensure exemplars contain no Ferrari names, logos, model names, or recognizable proprietary vehicle imagery.
- Add a short `examples/core/README.md` explaining derivation and non-copying boundary.

### Phase 3: Inventory wiring

- Add `assets` and `exemplars` entries to `inventory.yml`.
- Add evidence refs from prose/composition to exemplar paths where relevant.
- Add source URLs in `inventory.sources[]` only if acceptable for portability; otherwise keep them in source-study.

### Phase 4: Prose/composition refinement

- Add `premium-service-directory` situation if dealer/directory flow is important.
- Add `premium-directory-sheet`, `lineup-category-browse`, and `derived-image-placeholder-discipline` only if exemplars support them.
- Avoid expanding prose without evidence.

### Phase 5: Checks and status

- Add objective checks only after deciding whether source-study files are allowed to mention research brand names.
- Consider setting `bundle.json.status` to `review` until exemplars and dogfood runs land.
- Promote back to `published` only after exemplar wiring and at least one dogfood pass.

### Phase 6: Dogfood evals

- Run the four prompts above through Summon with the fingerprint selected.
- Save generated artifacts/screenshots under an eval folder or bundle examples if accepted.
- Review against failure modes:
  - brand leakage
  - generic SaaS drift
  - red overuse
  - rounded/pill controls
  - missing cinematic image hierarchy
  - unstructured specs/listings/events

## 14. Acceptance Criteria For BLInterface-Level Quality

`redline-cinema` should be considered BLInterface-comparable when:

- It has at least 5 portable exemplars, all source-agnostic and wired through `inventory.yml`.
- `source-study-2026-06-22.md` lists sources read, classifications, durable signals, curation cautions, and exemplar derivation notes.
- Prose and composition evidence refs include both source-study and exemplars.
- At least 3 dogfood prompts have accepted outputs or review notes.
- Objective checks cover portability and brand-leakage risks where feasible.
- `ghost lint` and `ghost verify` remain clean.
- Generated outputs consistently avoid Ferrari identity while preserving cinematic luxury-performance composition.
