# Technical Contrast Fingerprint Upgrade Plan

Date: 2026-06-22
Bundle: `technical-contrast`
Current location: `apps/server/fingerprints/bundles/technical-contrast`
Reference maturity bar: BLInterface in `/Users/nahiyan/Development/ghost-internal/fingerprints/bundles/blinterface`
Primary online research target for visual exemplars: `together.ai`

## 1. Bundle Snapshot

- **Bundle id:** `technical-contrast`
- **Current tier:** High Tier 3 / early Tier 4 draft — valid, portable, generation-useful, and visually coherent, but not yet reference-quality by BLInterface standards.
- **Target tier:** Tier 4 reference-quality candidate after evidence weighting, Together AI research curation, dogfood evals, and candidate source-safety checks are added.
- **Current role:** An agnostic technical-platform surface language for AI infrastructure, model operations, pricing/capacity comparison, research/proof planes, and technical workflows.
- **Required files present:** `bundle.json`, `tokens.css`, `fingerprint/manifest.yml`, `fingerprint/prose.yml`, `fingerprint/inventory.yml`, `fingerprint/composition.yml`, `fingerprint/enforcement/checks.yml`, `fingerprint/memory/intent.md`, `fingerprint/sources/curation/source-study-2026-06-22.md`, and five portable derived exemplars under `examples/core/`.
- **Validation status:** `ghost lint apps/server/fingerprints/bundles/technical-contrast` passed. `ghost verify apps/server/fingerprints/bundles/technical-contrast --root apps/server/fingerprints/bundles/technical-contrast` passed.
- **Current usefulness:** The fingerprint already gives agents a distinct, actionable grammar: pale technical landings, white data sheets, midnight research/proof planes, uppercase mono labels, tight geometric sans, hairline structure, small-radius rectangular controls, and optional large abstract signal artwork.
- **Highest-risk gap:** The current evidence chain is too self-contained. It has derived neutral exemplars and a curation note, but it needs clearer online-source provenance, explicit evidence weighting, dogfood prompts, and candidate objective checks to hold up to BLInterface as a durable reference package.

## 2. Upgrade Goal

Upgrade Technical Contrast from a strong published generation bundle into a reference-quality technical-platform fingerprint that future agents can use, review, and evaluate without relying on curator memory.

The upgraded fingerprint should help generated work understand:

- the audience relationship: technical evaluators need confidence, comparison, and proof, not decorative AI theater;
- the product posture: infrastructure-aware, production-ready, source-agnostic, and precise;
- the experience quality: claim first, shared criteria visible, proof tied to capability, next action clear;
- the surface grammar: contrast planes, tabular white sheets, midnight proof regions, mono orientation labels, hairline depth, small-radius controls, and optional large-scale signal artwork;
- the brand boundary: Together AI is research evidence for composition only, not a brand kit to copy.

The upgraded fingerprint should prevent:

- literal Together AI imitation;
- source names, logos, domains, slogans, proprietary copy, customer logos, model/pricing values copied from the site, and exact hero art;
- generic AI SaaS glows, glassmorphism, rainbow dashboards, soft pill CTAs, and over-rounded cards;
- table data replaced by loosely comparable cards;
- proof stats that do not explain why the primary claim is credible;
- mono labels becoming console-like body copy.

## 3. Scope Classification

- **Primary classification:** `medium` + `style` for technical-platform web and generated technical surfaces.
- **Secondary classification:** `moment` for pricing/capacity evaluation, research proof, model workflow, and production infrastructure decision points.
- **Not a brand bundle:** Technical Contrast must not become a Together AI brand kit.
- **Not a root bundle:** It should not set default Summon composition for all surfaces.
- **Not a product schema bundle:** Unlike BLInterface, it should not define a universal response schema or closed production asset catalog.

Belongs here:

- AI infrastructure landing surfaces;
- inference, compute, model-shaping, evaluation, and developer workflow pages;
- model/capacity/pricing comparison tables;
- research credibility sections;
- technical blog/proof cards when they support product claims;
- source-agnostic generated surfaces inspired by Together AI-like technical-platform composition.

Belongs elsewhere:

- Together AI brand identity, logos, wordmark, exact site art, exact product naming, exact pricing, customer logos, or exact blog copy;
- general SaaS landing pages without technical comparison/proof obligations;
- internal dashboards that need operational density rather than technical marketing clarity;
- terminal/CLI product aesthetics where monospace body copy is actually core;
- BLInterface-style Block product substrate or Gen UI response schema.

## 4. Current Strengths To Preserve

### Prose strengths

- Clear source-agnostic stance in `source-agnostic-output`.
- Strong anti-goals against literal brand reuse, generic SaaS cards, neon AI glow, rainbow accents, and mono paragraphs.
- Useful situations already cover landing, pricing/capacity comparison, research/proof, and technical workflow.
- Contracts are concrete and user-centered: claim before detail, criteria visible, proof supports claim, actions clear.
- The intent note is unusually clear about what “Technical Contrast” means and what it must not become.

### Composition strengths

- `technical-plane-landing` gives a strong hero/entry pattern.
- `pricing-table-sheet` and `left-sidebar-pricing-navigation` are excellent for dense comparison surfaces.
- `midnight-proof-plane` and `dark-proof-card-grid` capture the high-gravity research mode.
- `technical-form-sheet` and `code-editor-breakout` cover workflow and implementation proof.
- `small-radius-rectangles`, `rectangular-cta-system`, and `hairlines-not-shadows` translate taste into observable behaviors.

### Inventory strengths

- Topology has four useful scopes: `generated-surface`, `technical-marketing`, `technical-data`, and `technical-workflow`.
- Five portable exemplars exist and are properly neutralized.
- Tokens are concrete and Summon-friendly.
- Notes already say examples are derived neutral artifacts, not source screenshots.

### Evidence strengths

- The current curation note captures durable signals and rejected source-specific material.
- Current examples are portable and visually consistent.
- The bundle already avoids absolute local paths in portable inventory.

## 5. Gaps To Close

1. **Evidence weighting is missing.** Existing exemplars should be labeled `weighted` or `supporting`, not implicitly canonical.
2. **Together AI source research should be explicit.** The current curation note says public AI-infrastructure research, but the upgraded package should name the researched public site and classify what was observed.
3. **Current exemplars need source-to-neutral traceability.** Each exemplar should say which Together AI-observed region it abstracts without copying it.
4. **No dogfood eval prompts are checked in.** The bundle has no direct evaluation loop comparable to the maturity bar in Ghost internal.
5. **Checks are empty.** This is acceptable for taste, but source-safety and package-integrity checks are objective enough to plan.
6. **No review rubric.** Advisory review criteria should separate strong Technical Contrast output from merely clean SaaS output.
7. **Mobile behavior is under-specified.** The current examples are 1280 × 800 desktop-style artifacts. Together AI mobile observations show important collapse behavior for hero, nav, and pricing categories.
8. **Blog/proof-card use is under-covered.** The bundle covers proof planes and data sheets, but Together AI research/blog cards suggest a distinct technical article/proof module worth adding or documenting.
9. **`tokens.css` is not fully tied into inventory/exemplar evidence.** Token rules exist, but the plan should make them part of candidate checks and review criteria.

## 6. Online Source Exemplar Recon: Together AI

I inspected public Together AI web surfaces on 2026-06-22 for visual exemplar planning. Observed pages included:

- Home: `https://www.together.ai/`
- Pricing: `https://www.together.ai/pricing`
- Research: `https://www.together.ai/research`
- Serverless inference/product page: `https://www.together.ai/serverless-inference`
- GPU clusters/product page: `https://www.together.ai/gpu-clusters`
- Fine-tuning/product page: `https://www.together.ai/fine-tuning`
- Blog: `https://www.together.ai/blog`
- Mobile home and pricing breakpoints

These observations are source evidence only. Do not commit raw Together AI screenshots unless licensing/approval is explicitly resolved. Portable exemplars should be redrawn or generated as neutral artifacts with generic product names and copy.

### A. Home landing plane

Observed source region:

- Pale blue-white page canvas.
- Thin black announcement strip above navigation.
- White rounded navigation capsule and separate right action capsule.
- Large sentence-case hero claim with grey secondary phrase.
- Compact black primary CTA and pale secondary CTA with mono labels.
- Large 3D/abstract signal object on the right.
- Tiny mono labels attached to the signal object.
- Muted trusted-by logo rail at the bottom of the hero.

Promote:

- pale technical canvas as a valid opening plane;
- sentence-case headline with muted phrase contrast;
- compact rectangular CTAs;
- source-neutral abstract signal object as optional hero support;
- technical callout labels around the signal object;
- muted proof rail as subordinate credibility support.

Do not promote:

- Together AI logo/wordmark;
- exact headline, announcement copy, navigation labels, customer logos, or hero geometry;
- the exact warm/cool color arrangement as a brand asset;
- customer logo rail content as portable proof.

### B. Pricing and capacity comparison sheet

Observed source region:

- Pricing page with left category sidebar grouped by technical domain.
- Mono `PRICING` badge.
- Large page title and short explanatory sentence.
- Compact segmented tabs for model category: chat, vision, image, audio, video, transcribe, embeddings, rerank, moderation.
- Toggle/control row above the table.
- White table sheet with pale header row, sortable column labels, dense model rows, icons, aligned input/output price columns, cached-price subcopy, and hairline separators.
- Mobile pricing collapses category groups into large accordion rows rather than attempting a cramped full table in the first viewport.

Promote:

- visible shared criteria through table columns;
- left category rail on desktop for large comparison pages;
- compact segmented tabs for technical modes;
- pale table header and hairline rows;
- aligned numeric columns;
- mobile category collapse when comparison density exceeds the viewport.

Do not promote:

- exact model names or prices;
- Together-specific product taxonomy as universal;
- provider logos or exact icon marks;
- source-specific microcopy or pricing semantics.

### C. Research credibility plane

Observed source region:

- Midnight/navy page background.
- Dark navigation shell instead of white nav.
- Centered mono badge.
- Large white headline with one periwinkle emphasized phrase.
- Muted recognition rail with conference/institution marks.
- Research-area cards beginning below the fold with dark surfaces and abstract cropped signal art.
- Recognized research carousel/list below the intro.

Promote:

- midnight proof plane for high-gravity research claims;
- centered claim with one emphasized phrase;
- muted recognition rail as proof support, not primary content;
- dark-on-dark proof cards;
- proof content connected to research, benchmarks, or technical credibility.

Do not promote:

- exact conference logos;
- exact paper titles/authors;
- source badge text;
- Together-specific research taxonomy as a required structure.

### D. Product capability workflow pages

Observed source regions:

- Serverless inference, GPU clusters, and fine-tuning pages.
- White hero plane with mono product badge.
- Centered sentence-case claim and concise technical explanation.
- Black primary CTA plus pale secondary CTA.
- Large product UI screenshot/mockup sitting inside a pastel signal-art panel below the hero.
- Product UI mockups show configuration pages, model pages, deployment controls, summary panels, and dashboard navigation.

Promote:

- product badge + claim + concise technical obligation;
- action pair near the claim;
- one large product/proof mockup below, not scattered small screenshots;
- pastel signal panel as support for product UI evidence;
- configuration/workflow controls as proof, not decoration.

Do not promote:

- exact dashboard chrome, product labels, model names, screenshots, account/avatar details, or CTA copy;
- Together AI mark inside generated UI mockups;
- source-specific orange action color as a general Technical Contrast requirement.

### E. Blog and proof-card modules

Observed source region:

- Blog page uses a pale canvas with a large simple `Blog` heading.
- Horizontal carousel/card row with large pastel image cards.
- Image cards often include the Together AI logo and big black article-title typography over soft gradient planes.
- Category badges are small mono pills.
- Article title and excerpt sit below each image in black text on white/pale background.
- Carousel arrows are small square controls.

Promote:

- technical article/proof card as a support pattern when generated surfaces need updates, benchmark reports, or research proof;
- small mono category badges;
- large typographic card art can be translated into neutral proof artwork;
- square carousel controls and flat card structure.

Do not promote:

- logo-in-card treatment;
- exact blog headlines;
- source gradient art as a reusable brand background;
- carousel as required for every article/proof surface.

### F. Mobile home behavior

Observed source region:

- Header collapses to logo, black sign-in button, and small square hamburger button.
- Hero headline centers and stacks.
- CTAs remain compact rectangular buttons.
- Signal artwork crops dramatically below the CTAs rather than shrinking into a tiny icon.
- Trusted-by rail remains muted and horizontally clipped/scrolled.
- The platform section follows with centered hierarchy and card previews.

Promote:

- mobile hero can center when constrained;
- CTAs remain rectangular and compact;
- large signal art crops instead of becoming a small repeated motif;
- proof rails may become clipped/scrolling muted rows;
- mobile still preserves claim-first hierarchy.

Do not promote:

- exact mobile nav labels/icons;
- source logo and sign-in treatment;
- cropped source artwork geometry.

## 7. Proposed Prose Upgrades

The current prose layer is strong. Implement these refinements rather than a rewrite.

### Add or refine situations

#### Existing `platform-landing`

- **Keep:** Strong claim-first landing obligation.
- **Refine:** Add mobile guidance from Together AI: signal artwork may crop below the hero on narrow screens; CTAs remain compact rectangles; trusted-by/proof rail stays muted.
- **Evidence to add:** Together AI home recon; neutral `technical-plane-landing` exemplar.

#### Existing `pricing-or-capacity-comparison`

- **Keep:** Table-first comparison obligation.
- **Refine:** Add explicit desktop/mobile split: left rail + table sheet on desktop; category accordions or preserved table labels on mobile when density is too high.
- **Evidence to add:** Together AI pricing recon; neutral `white-technical-pricing-sheet` exemplar.

#### Existing `research-or-proof-plane`

- **Keep:** Midnight proof plane obligation.
- **Refine:** Require recognition/research rails to support a claim; do not let logos or awards become the main hierarchy.
- **Evidence to add:** Together AI research recon; neutral `midnight-research-proof-plane` exemplar.

#### Existing `technical-form-or-workflow`

- **Keep:** White controls, one black primary action, tight labels, clear state.
- **Refine:** Tie workflow proof to a product claim; product UI mockups should show constraints, selected options, deployment choices, or summaries.
- **Evidence to add:** Together AI serverless/GPU/fine-tuning product-page recon; neutral `technical-config-workflow` and `code-breakout-capability-panel` exemplars.

#### Proposed new situation: `technical-update-or-benchmark-card`

- **User intent:** Present a technical update, benchmark result, certification, model launch, or research announcement as proof inside a larger generated surface.
- **Product obligation:** Use a compact article/proof card with mono category badge, bold technical headline, short implication, and optional neutral gradient/type artwork; connect the update to a capability or decision.
- **Surface type:** `proof-card`
- **Principles:** `technical-data-stays-structured`, `signal-artwork-is-optional`, `type-contrast-is-technical-voice`
- **Experience contracts:** `proof-supports-claim`, `source-agnostic-output`
- **Patterns:** proposed `technical-update-card`, existing `tinted-stat-tiles`, existing `mono-eyebrow-system`
- **Refuses:** logo-in-card mimicry, source blog title reuse, decorative blog cards with no implication.

### Anti-goals to preserve or strengthen

At least these should remain explicit:

1. No Together AI names, domains, logos, wordmarks, slogans, customer logos, exact hero art, exact screenshots, exact product copy, exact model names, or exact pricing values unless the user explicitly supplies them.
2. No generic AI SaaS glow, glassmorphism, neon dashboards, or soft shadow card grids.
3. No treating signal artwork as a required motif on every surface.
4. No rainbow accents or category-color systems.
5. No hiding technical comparison, cost, capacity, latency, or proof behind decorative marketing.
6. No monospace body paragraphs.
7. No over-rounded pill-first control systems.
8. No mobile collapse that destroys shared comparison criteria.

### Experience contract refinements

Add obligations rather than replacing current contracts:

- `source-agnostic-output`: explicitly include Together AI and Together-owned marks/copy in the denylist.
- `comparison-criteria-stay-visible`: add mobile accordion/table-label obligations.
- `proof-supports-claim`: add article/benchmark/certification cards as proof inputs only when they explain a capability or decision.
- `actions-remain-rectangular-and-clear`: specify compact CTAs survive mobile.

## 8. Proposed Composition Upgrades

Current composition is strong. Add evidence refs, mobile details, and one or two narrowly scoped patterns.

### Existing high-priority patterns to preserve and refine

#### `technical-plane-landing`

- **Kind:** `structure`
- **Use:** generation + advisory review
- **Together AI evidence:** home desktop and mobile hero.
- **Refinement:** Add guidance for mobile cropping of signal art and muted proof rail behavior.
- **Strong output signal:** claim is dominant before art; CTAs are compact rectangles; signal object is one large support element.

#### `pricing-table-sheet`

- **Kind:** `structure`
- **Use:** generation + advisory review; candidate check only if generated code exposes table/header structure.
- **Together AI evidence:** pricing page table and tabs.
- **Refinement:** Add sortable/table header style guidance only as advisory; do not copy exact model/pricing names.
- **Strong output signal:** shared criteria remain visible across rows and columns.

#### `left-sidebar-pricing-navigation`

- **Kind:** `structure`
- **Use:** generation + advisory review
- **Together AI evidence:** pricing page left grouped category rail.
- **Refinement:** Add guidance for switching to category accordions on mobile.
- **Strong output signal:** category navigation orients, but does not compete with the data sheet.

#### `midnight-proof-plane`

- **Kind:** `structure`
- **Use:** generation + advisory review
- **Together AI evidence:** research page.
- **Refinement:** Add recognition rail guidance: muted, claim-supporting, genericized.
- **Strong output signal:** recognition/proof rail is subordinate to the headline and proof cards.

#### `technical-form-sheet`

- **Kind:** `structure`
- **Use:** generation + advisory review
- **Together AI evidence:** product UI mockups in serverless/GPU/fine-tuning pages.
- **Refinement:** Require selected options, constraints, or summary state near relevant controls.
- **Strong output signal:** workflow reads as production configuration, not friendly onboarding.

#### `code-editor-breakout`

- **Kind:** `structure`
- **Use:** generation + advisory review
- **Together AI evidence:** product pages and implementation/proof areas.
- **Refinement:** Code/config mockups should be tied to capability claims and avoid decorative terminal chrome.

### Proposed new pattern: `mobile-technical-collapse`

- **Kind:** `behavior`
- **Applies to:** `landing`, `comparison`, `workflow`, `proof`
- **Concrete guidance:**
  - On landing surfaces, center or stack the claim only when width demands it; keep CTAs rectangular and visible.
  - Crop large signal art rather than shrinking it into repeated badges.
  - Convert dense left rails into accordions or stacked category rows.
  - Preserve table criteria through sticky labels, row labels, horizontal scroll, or categorized accordions.
  - Keep mono labels short and high-contrast at small sizes.
- **Evidence needed:** Together AI mobile home and pricing recon; new neutral mobile exemplar.
- **Use:** generation + advisory review.
- **Candidate deterministic check:** possible only if generated code exposes responsive CSS/table structure; otherwise advisory.

### Proposed new pattern: `technical-update-card`

- **Kind:** `content`
- **Applies to:** `proof-card`, `landing`, `proof`
- **Concrete guidance:**
  - Use a small mono category badge above or near the article/update title.
  - Use a bold sentence-case technical headline.
  - Include a short implication sentence explaining why the update matters.
  - Optional image/art area may use neutral gradient/type artwork; no logos or source marks.
  - Use flat cards, small square controls, and no heavy shadows.
- **Evidence needed:** Together AI blog recon; neutral benchmark/update card exemplar.
- **Use:** generation + advisory review.
- **Candidate deterministic check:** source-string denylist, not visual quality.

## 9. Proposed Inventory And Evidence Upgrades

### Topology updates

Add or refine scopes:

- `technical-marketing`: keep landing and product pages.
- `technical-data`: keep pricing/capacity/model comparison.
- `technical-workflow`: keep configuration and deployment flows.
- New optional `technical-proof-card`: blog, benchmark, certification, and update modules used as evidence inside a generated surface.
- New optional `mobile-adaptation`: responsive behavior for landing, pricing/category, and proof surfaces.

### Building blocks to add

Tokens and components already exist. Add these notes to inventory or curation:

- `component: technical-update-card`
- `component: mobile-category-accordion`
- `component: muted-recognition-rail`
- `component: product-ui-proof-mockup`
- `micro-pattern: benchmark card with category badge, technical headline, and implication sentence`
- `micro-pattern: mobile cropped signal artwork below stacked hero CTAs`
- `state variant: mobile category collapsed, mobile category expanded, table row overflow, empty comparison table`

### Source records to add or refine

Update `inventory.sources[]` and curation notes with a source entry like:

- **id:** `together-ai-online-research-2026-06-22`
- **kind:** `public-web-research-note`
- **ref:** `sources/curation/together-ai-online-research-2026-06-22.md`
- **note:** Public Together AI pages studied for composition evidence; source marks/copy/assets are not portable generation assets.

### Proposed exemplar records

The current five exemplars can be preserved, but should be explicitly tied to Together AI research and weighted as neutral derived evidence.

#### `technical-plane-landing`

- **Expected portable path:** `examples/core/technical-plane-landing.png`
- **Title:** Technical plane landing
- **Surface type:** `landing`
- **Scope:** `technical-marketing`
- **Evidence strength:** `weighted`
- **Together AI source relation:** Abstracts the public Together AI home hero: pale canvas, compact CTAs, large signal art, technical labels, muted proof rail.
- **Why it matters:** Anchors the main landing grammar without copying source brand assets.
- **Refs:** `composition.pattern:technical-plane-landing`, `composition.pattern:mono-eyebrow-system`, `composition.pattern:rectangular-cta-system`, `prose.principle:contrast-planes-carry-drama`.

#### `white-technical-pricing-sheet`

- **Expected portable path:** `examples/core/white-technical-pricing-sheet.png`
- **Title:** White technical pricing sheet
- **Surface type:** `comparison`
- **Scope:** `technical-data`
- **Evidence strength:** `weighted`
- **Together AI source relation:** Abstracts Together AI pricing: left category rail, segmented tabs, pale table header, dense rows, aligned numeric columns.
- **Why it matters:** Proves Technical Contrast is not just a hero style; it can carry dense comparison.
- **Refs:** `composition.pattern:left-sidebar-pricing-navigation`, `composition.pattern:pricing-table-sheet`, `composition.pattern:segmented-technical-tabs`, `prose.experience_contract:comparison-criteria-stay-visible`.

#### `midnight-research-proof-plane`

- **Expected portable path:** `examples/core/midnight-research-proof-plane.png`
- **Title:** Midnight research proof plane
- **Surface type:** `proof`
- **Scope:** `technical-marketing`
- **Evidence strength:** `weighted`
- **Together AI source relation:** Abstracts Together AI research page: midnight canvas, centered research claim, periwinkle emphasis, muted recognition rail, dark proof cards.
- **Why it matters:** Anchors high-gravity proof mode and prevents over-dark generic SaaS treatment.
- **Refs:** `composition.pattern:midnight-proof-plane`, `composition.pattern:dark-proof-card-grid`, `prose.experience_contract:proof-supports-claim`.

#### `technical-config-workflow`

- **Expected portable path:** `examples/core/technical-config-workflow.png`
- **Title:** Technical configuration workflow
- **Surface type:** `workflow`
- **Scope:** `technical-workflow`
- **Evidence strength:** `weighted`
- **Together AI source relation:** Abstracts product page UI mockups showing model/deployment/configuration flows.
- **Why it matters:** Proves the language can support forms and controls without becoming friendly SaaS onboarding.
- **Refs:** `composition.pattern:technical-form-sheet`, `composition.pattern:rectangular-cta-system`, `prose.experience_contract:actions-remain-rectangular-and-clear`.

#### `code-breakout-capability-panel`

- **Expected portable path:** `examples/core/code-breakout-capability-panel.png`
- **Title:** Code breakout capability panel
- **Surface type:** `proof`
- **Scope:** `technical-data`
- **Evidence strength:** `supporting`
- **Together AI source relation:** Abstracts implementation and product proof areas where code/configuration detail supports capability claims.
- **Why it matters:** Gives agents a way to show technical proof without terminal cosplay.
- **Refs:** `composition.pattern:code-editor-breakout`, `composition.pattern:tinted-stat-tiles`, `prose.experience_contract:proof-supports-claim`.

#### Proposed new `mobile-technical-landing-stack`

- **Expected portable path:** `examples/core/mobile-technical-landing-stack.png`
- **Title:** Mobile technical landing stack
- **Surface type:** `landing`
- **Scope:** `mobile-adaptation`
- **Evidence strength:** `supporting`
- **Together AI source relation:** Abstracts Together AI mobile home behavior: stacked/centered claim, rectangular CTAs, large cropped signal art, muted proof rail.
- **Why it matters:** Closes the current desktop-only exemplar gap.
- **Refs:** proposed `composition.pattern:mobile-technical-collapse`, `composition.pattern:technical-plane-landing`, `prose.experience_contract:primary-claim-before-detail`.

#### Proposed new `technical-benchmark-update-card`

- **Expected portable path:** `examples/core/technical-benchmark-update-card.png`
- **Title:** Technical benchmark update card
- **Surface type:** `proof-card`
- **Scope:** `technical-proof-card`
- **Evidence strength:** `supporting`
- **Together AI source relation:** Abstracts Together AI blog cards: mono category badge, bold technical headline, flat card, neutral graphic plane, concise implication.
- **Why it matters:** Adds proof/update module coverage beyond full proof planes and pricing tables.
- **Refs:** proposed `composition.pattern:technical-update-card`, `prose.experience_contract:proof-supports-claim`, `prose.principle:type-contrast-is-technical-voice`.

## 10. Evidence And Exemplar Gaps

- **Gap:** Existing source study is not specific enough about Together AI.
  - **Label:** `uncurated`
  - **Worker action:** Add `fingerprint/sources/curation/together-ai-online-research-2026-06-22.md` or expand the existing source study with the observations above.

- **Gap:** Current exemplars have no evidence strength labels.
  - **Label:** `uncurated`
  - **Worker action:** Add `evidence_strength` or equivalent notes to inventory exemplar entries.

- **Gap:** Current exemplars are derived and should not be treated as canonical source truth.
  - **Label:** `subjective`
  - **Worker action:** Mark them `weighted` or `supporting`; keep advisory review language honest.

- **Gap:** No mobile exemplar.
  - **Label:** `missing`
  - **Worker action:** Create a neutral derived `mobile-technical-landing-stack.png` and add refs.

- **Gap:** No technical update/benchmark card exemplar.
  - **Label:** `missing`
  - **Worker action:** Create a neutral derived `technical-benchmark-update-card.png` and add refs.

- **Gap:** Raw Together AI screenshots captured during planning are not portable evidence.
  - **Label:** `non-portable`
  - **Worker action:** Do not commit raw screenshots unless explicitly approved; summarize observations in curation notes and produce neutral derived exemplars.

- **Gap:** Together AI customer logos, conference logos, model names, pricing values, and product screenshots are source-specific.
  - **Label:** `non-portable`
  - **Worker action:** Replace with generic placeholders in exemplars and guidance; add denylist check candidates.

- **Gap:** Dogfood evals and review scores do not exist.
  - **Label:** `missing`
  - **Worker action:** Add prompt records and run `fingerprint-iteration` or equivalent review workflow after implementation.

- **Gap:** Candidate checks are not documented.
  - **Label:** `missing`
  - **Worker action:** Add check rationale or comments, even if `checks: []` remains until tooling exists.

## 11. Candidate Deterministic Checks

Deterministic checks should cover objective source-safety and package-integrity signals only. Do not turn taste into a blocking gate.

### Check candidate: forbidden Together AI source strings

- **Objective signal:** Generated portable fingerprint files or exemplar metadata contain forbidden source strings.
- **Inspect files:** `fingerprint/**/*.yml`, `fingerprint/**/*.md`, `examples/core/README.md`, future exemplar metadata.
- **Expected failure condition:** Source-specific strings appear outside a curation note context, such as `together.ai`, `Together AI`, exact source slogans, customer names copied from proof rails, exact product names when used as generated copy, or source domains.
- **False-positive risk:** Curation notes must be allowed to name the researched source. The check needs path/context allowlisting.
- **Why check rather than advisory:** String presence is objective and source-safety critical.

### Check candidate: no raw source screenshot paths in inventory exemplars

- **Objective signal:** `inventory.exemplars[].path` points outside `examples/` or references source screenshot filenames/URLs.
- **Inspect files:** `fingerprint/inventory.yml`.
- **Expected failure condition:** Exemplar path is absolute, remote, outside bundle root, or not under approved portable example directories.
- **False-positive risk:** Low.
- **Why check rather than advisory:** Portable evidence path validity is objective.

### Check candidate: required exemplar refs resolve

- **Objective signal:** Every exemplar path and evidence path exists under the bundle root.
- **Inspect files:** `fingerprint/prose.yml`, `fingerprint/composition.yml`, `fingerprint/inventory.yml`.
- **Expected failure condition:** Missing file path or broken ref.
- **False-positive risk:** Low; `ghost verify` already covers parts of this.
- **Why check rather than advisory:** Broken evidence paths make the package less portable.

### Check candidate: allowed Technical Contrast token hexes in `tokens.css`

- **Objective signal:** `tokens.css` uses known color tokens for the fingerprint.
- **Inspect files:** `tokens.css` and optionally generated CSS outputs.
- **Expected failure condition:** Unreviewed new hex values are introduced in token definitions.
- **False-positive risk:** Medium; future refinement may need new colors. Keep as warning unless token freeze is approved.
- **Why check rather than advisory:** Token drift is objectively detectable, but should be non-blocking until the palette is declared stable.

### Check candidate: status gating

- **Objective signal:** `bundle.json` status remains `published` while required reference-quality evidence fields are missing.
- **Inspect files:** `bundle.json`, `fingerprint/inventory.yml`.
- **Expected failure condition:** If the project decides Tier 4 requires evidence strength and dogfood prompts, published status without those records should warn.
- **False-positive risk:** Medium; project status semantics may differ.
- **Why check rather than advisory:** Only use if marketplace status semantics are formalized.

### Advisory-only criteria

Keep these out of deterministic checks:

- whether a surface “feels technical”;
- whether hierarchy is strong enough;
- whether signal artwork is tasteful;
- whether proof is persuasive;
- whether a table is dense but humane;
- whether mobile crop feels intentional.

These belong in composition guidance, review rubrics, and dogfood scoring.

## 12. Dogfood Eval Prompts

Each prompt should produce one generation per fingerprint version and be reviewed against the named claims.

### Prompt 1: `tc-pricing-model-comparison`

- **Exact prompt:** “Create a technical pricing and capacity comparison page for an AI inference platform with serverless, dedicated, and batch options. Include model category tabs, input/output cost columns, cached-token notes, latency/capacity limits, and a recommendation for teams moving from prototype to production.”
- **Eval axis:** `generation`
- **Suggested loop:** `fingerprint-iteration` comparing current Technical Contrast to upgraded Technical Contrast.
- **Claims under test:** comparison criteria stay visible; pricing-table sheet; left sidebar/category navigation; segmented technical tabs; source-agnostic output.
- **Expected strong-output traits:** white data sheet, aligned columns, mono headers, compact tabs, no source names, clear recommendation, black primary action, no decorative signal art inside the table.
- **Likely failure modes:** generic pricing cards, inconsistent criteria per tier, copied Together model names/prices, rainbow category colors, full-pill CTAs.
- **Review notes:** Score whether shared criteria are visible at desktop and preserved on mobile.

### Prompt 2: `tc-research-proof-plane`

- **Exact prompt:** “Create a research credibility section for a model-serving platform announcing a new throughput benchmark. It should explain why the benchmark matters, show three proof cards, include a muted recognition rail, and offer a next step for infrastructure teams.”
- **Eval axis:** `generation`
- **Suggested loop:** `fingerprint-iteration`.
- **Claims under test:** midnight-proof-plane; dark-proof-card-grid; proof-supports-claim; type contrast; source-agnostic output.
- **Expected strong-output traits:** midnight plane, one strong claim, muted recognition rail with generic placeholders, dark-on-dark proof cards, metrics paired with operational implications, rectangular CTA.
- **Likely failure modes:** neon/glow AI treatment, bright white cards floating on dark, orphaned stats, copied conference/customer names, decorative research thumbnails.
- **Review notes:** Proof cards should answer “so what?” not merely list numbers.

### Prompt 3: `tc-technical-workflow-config`

- **Exact prompt:** “Create a configuration workflow for launching a dedicated GPU cluster. Include deployment mode selection, hardware choice, region, estimated cost, capacity warning, and a final create action.”
- **Eval axis:** `generation`
- **Suggested loop:** `fingerprint-iteration`.
- **Claims under test:** technical-form-sheet; actions-remain-rectangular-and-clear; hairlines-not-shadows; technical-data-stays-structured.
- **Expected strong-output traits:** white form sheet, mono labels, grouped controls, visible constraints, summary panel, one black primary action, small-radius inputs, no friendly onboarding illustration.
- **Likely failure modes:** bubbly setup wizard, hidden constraints, multiple equal primary actions, heavy shadows, generic cloud dashboard UI.
- **Review notes:** State and constraints should sit near the affected controls.

### Prompt 4: `tc-mobile-landing-stack`

- **Exact prompt:** “Create a mobile landing screen for a production AI platform that introduces low-latency inference, shows two calls to action, includes one abstract signal artwork element, and preserves a muted trusted-by proof rail.”
- **Eval axis:** `generation`
- **Suggested loop:** `fingerprint-iteration` after adding mobile exemplar.
- **Claims under test:** mobile-technical-collapse; technical-plane-landing; signal-artwork-is-optional; primary-claim-before-detail.
- **Expected strong-output traits:** stacked/centered or clearly ordered claim, compact rectangular CTAs, large cropped signal art, muted proof rail, no tiny repeated signal icons, no source logo.
- **Likely failure modes:** desktop hero squeezed onto mobile, signal artwork reduced to badges, full-pill CTAs, customer logo copying, weak claim hierarchy.
- **Review notes:** Mobile should preserve the main composition contract, not merely scale down desktop.

### Prompt 5: `tc-benchmark-update-card`

- **Exact prompt:** “Create a row of three technical update cards for an AI infrastructure site: one benchmark report, one security certification, and one new model-serving capability. Each card should include a category badge, headline, short implication, and a read-more action.”
- **Eval axis:** `generation`
- **Suggested loop:** `fingerprint-iteration` after adding `technical-update-card`.
- **Claims under test:** technical-update-card; proof-supports-claim; type-contrast-is-technical-voice; source-agnostic-output.
- **Expected strong-output traits:** mono badges, bold technical headlines, short implication copy, flat cards, optional neutral graphic panels, no logos in card art.
- **Likely failure modes:** copied Together blog headlines, logo-in-card mimicry, generic blog cards, decorative gradients with no technical meaning.
- **Review notes:** Cards must connect updates to product value or technical decision-making.

## 13. Implementation Sequence

1. **Preserve contract and validation.** Do not change the bundle shape. Run `ghost lint` and `ghost verify` before and after implementation.
2. **Add Together AI curation.** Create or expand a bundle-local curation note summarizing the public online research above. Keep raw screenshots out of the repo unless explicitly approved.
3. **Refine prose.** Add the new `technical-update-or-benchmark-card` situation if accepted; add Together-specific source-safety cautions; refine mobile obligations under existing situations/contracts.
4. **Refine composition.** Add `mobile-technical-collapse` and `technical-update-card` if accepted; update existing patterns with Together AI curation refs.
5. **Update inventory.** Add evidence strength labels, new topology scopes, new building blocks, new source record, and new exemplar records.
6. **Create or refresh neutral exemplars.** Preserve the current five, but add mobile landing and benchmark/update card exemplars if the visual scope is approved. All exemplars must be source-agnostic.
7. **Document candidate checks.** Keep active checks empty unless objective rules are implemented. At minimum, document source-string and portable-path check candidates.
8. **Add dogfood prompt records.** Store prompts in the repo’s expected eval task format if a local convention exists; otherwise include them in the curation/eval plan.
9. **Run verification.** Run `ghost lint apps/server/fingerprints/bundles/technical-contrast` and `ghost verify apps/server/fingerprints/bundles/technical-contrast --root apps/server/fingerprints/bundles/technical-contrast`.
10. **Run eval loop.** Use the dogfood prompts in `fingerprint-iteration` or the project’s current equivalent. Do not claim lift without scored review rows.

## 14. Out Of Scope

Downstream workers must not:

- modify files outside `apps/server/fingerprints/bundles/technical-contrast` unless explicitly requested;
- edit this plan while implementing the bundle unless they are updating the plan by request;
- create or modify root `.ghost/`;
- run `ghost init .`;
- fingerprint this repository itself;
- copy `marketplace.json` into `fingerprint/`;
- hard-code absolute local paths into portable fingerprint files;
- commit raw Together AI screenshots or copied source art without explicit approval;
- reuse Together AI logos, wordmarks, customer logos, exact headlines, exact model names, exact pricing values, or exact product screenshots as generated exemplar content;
- treat empty checks as proof that no objective checks are possible;
- treat subjective taste as a blocking deterministic gate;
- claim eval lift without scored review rows;
- overwrite human-authored intent or decisions without calling that out;
- use BLInterface as a visual template; it is a maturity reference, not a Technical Contrast style source.
