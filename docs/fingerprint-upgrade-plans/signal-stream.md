# Signal Stream Fingerprint Upgrade Plan

Date: 2026-06-22
Bundle: `apps/server/fingerprints/bundles/signal-stream`
Reference maturity bar: BLInterface in `/Users/nahiyan/Development/ghost-internal/fingerprints/bundles/blinterface`

## 1. Bundle Snapshot

- **Bundle id:** `signal-stream`
- **Current tier:** Tier 2 / early Tier 3 — usable generation guidance, underdeveloped evidence.
- **Target tier:** Tier 3 marketplace-ready draft, with a Tier 4 follow-up path.
- **Current role:** A dark, high-voltage editorial stream language for live feeds, feature digests, reviews, and dense technology briefings.
- **Required files present:** `bundle.json`, `tokens.css`, `fingerprint/manifest.yml`, `fingerprint/prose.yml`, `fingerprint/inventory.yml`, `fingerprint/composition.yml`, `fingerprint/enforcement/checks.yml`, and one curation note.
- **Current usefulness:** The fingerprint can steer generated surfaces toward a distinct visual and compositional language: near-black canvas, hazard accents, mono metadata, rail-based stream structure, pill-corner tiles, saturated editorial interruptions, flat hairline depth, and display-scale headline hierarchy.
- **Highest-risk gap:** The package has no portable exemplars and no dogfood eval records. It is style-rich but evidence-thin compared with BLInterface.

## 2. Upgrade Goal

Upgrade Signal Stream into a mature, agnostic medium/style fingerprint that helps agents generate dense editorial and live-update surfaces with strong hierarchy, sequence, and visual voltage without copying a publisher brand.

The upgraded fingerprint should preserve:

- dark-canvas dominance
- editorial stream pacing
- rail and timestamp order
- saturated interruption blocks
- display-shout / metadata-whisper typography
- flat graphic depth
- mobile collapse that keeps order and saturation intact

It should prevent:

- literal source imitation
- source names, logos, mastheads, marks, and proprietary copy
- generic card grids
- light SaaS dashboards
- decorative gradients or shadows
- overuse of hazard accents
- metadata that decorates but does not orient

## 3. Scope Classification

- **Primary classification:** `medium` + `style`
- **Secondary classification:** `moment` for live-update, digest, and fast editorial scanning contexts.
- **Not a brand bundle:** Signal Stream must not become a clone of The Verge or any publisher. The source site is evidence for composition only.
- **Not a product substrate:** Unlike BLInterface, this bundle should not encode product-specific schemas such as finance response blocks, catalogs, or brand assets.

Belongs here:

- feed and digest hierarchy
- dark editorial material rules
- saturated color-block interruption rules
- mono timestamp / kicker / CTA conventions
- rail-based live-update structures
- review/brief layouts that need high visual confidence

Belongs elsewhere:

- specific publisher brands
- proprietary logos, wordmarks, section names, and typefaces
- ad product patterns
- legal/compliance claims about media, publishing, or journalism
- product-specific workflows unrelated to feed/digest/review composition

## 4. Current Strengths To Preserve

### Prose strengths

- Clear anti-goal against source-specific imitation.
- Strong tradeoff language around color-as-emphasis and flat depth.
- Useful situations: live feed, digest, feature/review lead, actionable technical brief.
- Good experience contracts around order visibility, accent purpose, no-shadow elevation, display fit, and scan-before-detail.

### Composition strengths

- `signal-rail-feed` is the clearest signature pattern.
- `saturated-hazard-tile` gives concrete color-as-elevation guidance.
- `display-shout-with-whisper-kicker` captures the main typographic contrast.
- `flat-hairline-depth` is objective enough to guide review.
- `responsive-stream-collapse` gives useful mobile behavior.

### Inventory strengths

- Topology is already scoped around feed, digest, review, and brief.
- Token inventory is concrete and Summon-friendly.
- Notes explicitly keep the bundle agnostic.

## 5. Gaps To Close

1. **No portable exemplars.** BLInterface has five local exemplars with refs to patterns, principles, and contracts. Signal Stream has none.
2. **Curation note is too short.** It should classify the source evidence, name promoted signals, name non-promoted signals, and record evidence strength.
3. **No generated neutral exemplars.** The source site should inform exemplar composition, but final portable exemplars should be redrawn / neutralized unless screenshot use is explicitly approved.
4. **No dogfood prompts.** There are no exact prompts for generation evaluation.
5. **No review rubric.** There is no scored way to say whether a generated surface used the fingerprint well.
6. **No source-specific safety check.** The bundle should eventually have an objective check preventing source brand strings in portable generation guidance.
7. **Published status may be premature.** Until exemplars and evals exist, `review` is more honest than `published`.
8. **No memory/intent note.** BLInterface has human-readable intent. Signal Stream should add a short, approved intent note once the user confirms this plan.

## 6. Source Exemplar Recon: The Verge

I inspected `https://www.theverge.com/` at desktop and mobile breakpoints on 2026-06-22. Observed source regions are useful as evidence, but final fingerprint files should abstract the source into agnostic exemplar names and copy.

### Observed desktop regions

#### A. Lead editorial stack

Candidate source region:

- Desktop homepage lead area around the giant vertical masthead, large image, white headline slab, and 2x2 supporting story grid.
- Screenshot observed at `/tmp/theverge-viewport.png`; crop inspected around `x=80,y=330,width=800,height=1050`.

Promoted signals:

- one huge display identity/lead moment
- dominant image paired with an overlapping white headline slab
- secondary stories in a compact grid below
- tiny uppercase metadata with blue/violet author accents
- strict hairline separators
- no card shadows

Do not promote:

- source wordmark
- source article text
- exact logo placement
- exact publisher typography names
- ad content

#### B. Right-rail latest stream

Candidate source region:

- Desktop right rail with pill tabs (`Latest`, `Following`), avatar/author metadata, timestamp, short update body, link, source bracket, comment/link icons, and ad interruption.
- Screenshot crop inspected around `x=900,y=360,width=500,height=1000`.

Promoted signals:

- segmented pill tabs with one saturated active tab
- latest feed as compact vertical stream
- avatar + uppercase metadata + timestamp cluster
- link-heavy body with strong underline treatment
- hairline separators between updates
- dense editorial rhythm

Do not promote:

- actual author names
- source-specific tab labels unless genericized
- ad module as a core exemplar
- exact comments/social affordances

#### C. Section digest modules farther down page

Candidate source region:

- Staff picks / gear / regulatory sections from homepage body.

Promoted signals:

- kicker phrase paired with section title
- ranked or grouped digest rows
- mixture of feature item and compact supporting stories
- flat separators and dense metadata

Do not promote:

- source section names
- story copy
- ad placement

### Observed mobile regions

#### D. Mobile top stories stack

Candidate source region:

- Mobile viewport at `/tmp/theverge-mobile-viewport.png`.

Promoted signals:

- compact top controls with subscribe/action, bell, hamburger
- large masthead-scale display wordmark area
- full-width segmented pill nav
- image-first lead story
- huge condensed headline below image
- metadata row with uppercase author/time/comment count
- no loss of saturation or headline confidence on mobile

Do not promote:

- source mark
- source labels verbatim
- exact article content

#### E. Mobile quick-post stream

Candidate source region:

- Mobile full page after top lead, around "latest quick posts" stream.

Promoted signals:

- mobile collapse of live stream into full-width stacked posts
- author/timestamp before body
- short update body followed by linked evidence
- comment affordance at bottom
- no card lift or gradient

Do not promote:

- source author names
- specific story topics
- ad cards

## 7. Proposed Exemplar Strategy

Use The Verge as **source evidence**, then create **portable agnostic exemplars**. Do not commit raw source screenshots unless explicitly approved for repo licensing.

Preferred approach:

1. Keep source observations in `fingerprint/sources/curation/theverge-homepage-2026-06-22.md`.
2. Create neutral, redrawn exemplars under `examples/core/` using fictional content and no source marks.
3. Add `inventory.exemplars[]` entries that point to the neutral exemplars, not to `/tmp` screenshots or raw source captures.
4. Mention in exemplar notes that each is a **source-informed neutral redraw** with evidence strength `weighted`, not canonical brand evidence.

### Proposed portable exemplars

#### 1. `examples/core/signal-lead-stack-desktop.png`

- **Title:** Signal lead stack desktop
- **Surface type:** `digest`
- **Scope:** `stream-editorial`
- **Evidence strength:** `weighted source-informed neutral redraw`
- **Source inspiration:** Desktop lead editorial stack.
- **Why it matters:** Shows display shout, image lead, white headline slab, dense supporting grid, hairline separators, and flat depth.
- **Refs:**
  - `composition.pattern:display-shout-with-whisper-kicker`
  - `composition.pattern:color-block-feature`
  - `composition.pattern:dense-editorial-grid`
  - `prose.principle:display-shout-anchors-the-page`
  - `prose.experience_contract:scan-before-detail`

#### 2. `examples/core/latest-signal-rail-desktop.png`

- **Title:** Latest signal rail desktop
- **Surface type:** `feed`
- **Scope:** `stream-editorial`
- **Evidence strength:** `weighted source-informed neutral redraw`
- **Source inspiration:** Desktop right-rail latest stream.
- **Why it matters:** Shows active segmented pill, compact author/time metadata, feed separators, short update body, and restrained link treatment.
- **Refs:**
  - `composition.pattern:signal-rail-feed`
  - `composition.pattern:mono-uppercase-metadata`
  - `composition.pattern:flat-hairline-depth`
  - `prose.principle:metadata-is-navigation`
  - `prose.experience_contract:stream-order-is-visible`

#### 3. `examples/core/mobile-top-story-stack.png`

- **Title:** Mobile top story stack
- **Surface type:** `digest`
- **Scope:** `stream-editorial`
- **Evidence strength:** `weighted source-informed neutral redraw`
- **Source inspiration:** Mobile top stories viewport.
- **Why it matters:** Shows mobile collapse preserving huge display hierarchy, full-width tabs, image-first lead, metadata row, and saturated active control.
- **Refs:**
  - `composition.pattern:responsive-stream-collapse`
  - `composition.pattern:display-shout-with-whisper-kicker`
  - `composition.pattern:hazard-pill-cta`
  - `prose.experience_contract:display-type-must-fit`
  - `prose.experience_contract:small-text-stays-legible`

#### 4. `examples/core/saturated-interruption-tile.png`

- **Title:** Saturated interruption tile
- **Surface type:** `brief`
- **Scope:** `feature-brief`
- **Evidence strength:** `supporting source-informed neutral redraw`
- **Source inspiration:** Source color-block and active-pill language plus the existing design study.
- **Why it matters:** Shows when a bright fill is allowed: priority, alert, selected state, or CTA emphasis — not decorative wash.
- **Refs:**
  - `composition.pattern:saturated-hazard-tile`
  - `composition.pattern:hazard-pill-cta`
  - `prose.principle:hazard-accents-earn-attention`
  - `prose.experience_contract:accent-has-purpose`

#### 5. `examples/core/section-digest-module.png`

- **Title:** Section digest module
- **Surface type:** `digest`
- **Scope:** `stream-editorial`
- **Evidence strength:** `supporting source-informed neutral redraw`
- **Source inspiration:** Homepage section modules below the lead.
- **Why it matters:** Shows grouped digest hierarchy without turning every item into a card.
- **Refs:**
  - `composition.pattern:dense-editorial-grid`
  - `composition.pattern:pill-corner-stream-tile`
  - `composition.pattern:mono-uppercase-metadata`
  - `prose.experience_contract:scan-before-detail`

## 8. Proposed Prose Upgrades

### Add / refine anti-goals

Add explicit anti-goals for:

- copying publisher-specific marks, names, or article text
- treating ads as canonical fingerprint guidance
- using source screenshots as production assets
- overfitting to one homepage breakpoint
- turning the bundle into a generic tech-news brand

### Add principle: source-informed-not-source-branded

- **id:** `source-informed-not-source-branded`
- **Principle:** Source evidence may shape composition, but generated surfaces must use neutral content, marks, and names.
- **Guidance:** Abstract source patterns into roles such as lead stack, latest rail, digest module, and mobile stream. Never output source brand strings unless the user explicitly asks for source analysis.
- **Contracts:** should back a no-source-brand deterministic check.

### Add experience contract: exemplar-abstraction-boundary

- **id:** `exemplar-abstraction-boundary`
- **Contract:** Portable exemplars teach composition and hierarchy without carrying source brand identity.
- **Obligations:** neutral copy, neutral marks, no source logos, no exact article titles, no ad creative.

### Refine current situations

- `high-voltage-digest`: add refs to the future lead stack and section digest exemplars.
- `live-signal-feed`: add refs to the future latest rail and mobile quick-post exemplars.
- `feature-or-review-lead`: clarify that display shout can be source-inspired but must be fallback-safe and brand-neutral.

## 9. Proposed Composition Upgrades

### Add pattern: source-neutral-masthead-placeholder

- **Kind:** `rule`
- **Applies to:** `digest`, `review`
- **Guidance:** Use a neutral display title, issue label, or generated publication name only when a masthead role is needed; never reproduce source marks.
- **Review role:** advisory + candidate deterministic check for forbidden strings.

### Add pattern: segmented-stream-tabs

- **Kind:** `visual`
- **Applies to:** `feed`, `digest`
- **Guidance:** Use a full-pill segmented control with one saturated active segment and muted inactive segments; labels are uppercase mono and orient stream mode.
- **Evidence:** latest rail desktop, mobile top story stack.

### Add pattern: lead-image-headline-slab

- **Kind:** `layout`
- **Applies to:** `digest`, `review`
- **Guidance:** Lead story can use image first, then an overlapping or tightly attached headline slab; metadata sits below the deck; supporting items appear in a compact grid.
- **Evidence:** lead stack desktop and mobile top story stack.

### Add pattern: compact-supporting-story-grid

- **Kind:** `layout`
- **Applies to:** `digest`
- **Guidance:** Supporting stories should be compact rows or cells with thumbnail, headline, and metadata; avoid equal large cards.
- **Evidence:** lead stack desktop and section digest module.

### Add pattern: mobile-tabs-preserve-mode

- **Kind:** `layout`
- **Applies to:** `feed`, `digest`
- **Guidance:** On mobile, collapse rail and grid structures but keep the active mode control, metadata row, and story order visible.
- **Evidence:** mobile top story stack.

## 10. Proposed Inventory And Evidence Upgrades

Add:

```yaml
exemplars:
  - id: signal-lead-stack-desktop
    path: examples/core/signal-lead-stack-desktop.png
    title: "Signal lead stack desktop"
    surface_type: "digest"
    scope: stream-editorial
    note: "Weighted source-informed neutral redraw; approved on <date>."
    why: "Shows display shout, image lead, headline slab, compact supporting grid, and flat depth."
    refs:
      - composition.pattern:display-shout-with-whisper-kicker
      - composition.pattern:lead-image-headline-slab
      - composition.pattern:dense-editorial-grid
      - prose.experience_contract:scan-before-detail
```

Repeat for the five proposed exemplars above.

Add inventory notes:

- raw source screenshots are curation inputs, not portable generation assets
- generated/redrawn exemplars are the portable evidence
- source site observations are time-bound to the capture date
- ads are excluded from canonical style guidance except as examples of what not to promote

## 11. Evidence And Exemplar Gaps

| Gap | Label | Action |
| --- | --- | --- |
| No neutral exemplar images exist | missing | Create five source-informed redraws under `examples/core/`. |
| Source screenshots only exist in `/tmp` | non-portable | Do not cite them directly; summarize observations in a bundle-local curation note. |
| Screenshot licensing for raw source captures is unclear | uncurated / rights-risk | Prefer neutral redraws; ask before committing raw screenshots. |
| The current design study file is outside the repo | non-portable | Summarize durable signals in curation note; do not cite `/Users/...` paths in inventory. |
| No human approval of exemplar weights | uncurated | Mark as `source-informed neutral redraw` until reviewed. |
| No dogfood run outputs | missing | Add prompts and run fingerprint-iteration after exemplars exist. |
| No objective source-brand check | missing | Add candidate check after final forbidden-string list is agreed. |

## 12. Candidate Deterministic Checks

### Check 1: no source-brand strings in portable fingerprint layers

- **Objective signal:** Exact forbidden strings do not appear in `prose.yml`, `inventory.yml`, `composition.yml`, `tokens.css`, or exemplar captions except in curation notes where source attribution is allowed.
- **Inspected files:** portable fingerprint core layers and bundle metadata.
- **Failure condition:** source publisher name, exact masthead text, or source article titles appear in generation guidance.
- **False-positive risk:** low if curation notes are excluded or allowlisted.
- **Why check:** This is an objective brand-agnostic boundary.

### Check 2: exemplar paths resolve

- **Objective signal:** Every `inventory.exemplars[].path` exists inside the bundle.
- **Inspected files:** `fingerprint/inventory.yml`, `examples/**`.
- **Failure condition:** missing exemplar file.
- **False-positive risk:** low.
- **Why check:** Portable evidence should not break.

### Check 3: no absolute local paths

- **Objective signal:** No `/Users/`, `/tmp/`, `file://`, or private local source path appears in canonical inventory or composition evidence.
- **Inspected files:** fingerprint core layers and curation notes, with possible curation-note exception if provenance is intentionally recorded.
- **Failure condition:** canonical evidence points at local machine paths.
- **False-positive risk:** medium if curation provenance records local paths. Prefer core-layer-only enforcement.
- **Why check:** Portability.

### Check 4: no shadow-as-elevation token regression

- **Objective signal:** `tokens.css` does not define large non-none drop shadows for `--shadow-card`, `--shadow-elevated`, or primary surface classes.
- **Inspected files:** `tokens.css`.
- **Failure condition:** shadow token contains a blur/spread beyond an approved 1px ring.
- **False-positive risk:** medium; generated CSS may need exceptions for focus/accessibility.
- **Why check:** It protects one of the clearest objective Signal Stream rules.

Keep these advisory, not deterministic:

- whether a display headline feels loud enough
- whether a digest has enough voltage
- whether a saturated tile is tasteful
- whether the source abstraction feels sufficiently transformed

## 13. Dogfood Eval Prompts

### Prompt 1: live launch feed

- **id:** `signal-live-launch-feed`
- **Axis:** generation
- **Suggested loop:** fingerprint-iteration
- **Prompt:** `Create a live update surface for a hardware launch that has six updates over the last hour, one confirmed delay, two hands-on notes, and one recommended next action. Make order and recency obvious. Avoid a generic dashboard or plain chat transcript.`
- **Claims under test:** rail order, mono metadata, action CTA, flat depth, scan-before-detail.
- **Strong output traits:** visible sequence, timestamps, active stream tab, one action, dark canvas, compact updates, no shadows.
- **Likely failure modes:** generic cards, missing recency, too many bright blocks, dashboard metrics, chat bubbles.

### Prompt 2: dense technology review digest

- **id:** `signal-review-digest`
- **Axis:** generation
- **Suggested loop:** fingerprint-iteration
- **Prompt:** `Design a review digest comparing four new smart-home devices. Lead with the product worth paying attention to, include compact supporting entries, show one score or verdict treatment, and make it feel like a high-energy editorial surface rather than a shopping grid.`
- **Claims under test:** display shout, lead hierarchy, supporting story grid, saturated interruption tile, metadata labels.
- **Strong output traits:** one dominant lead, compact supporting items, contrast-safe accent use, clear verdict, no equal-weight cards.
- **Likely failure modes:** ecommerce card grid, star-rating clutter, pastel shopping UI, too many CTAs.

### Prompt 3: policy situation brief

- **id:** `signal-policy-brief`
- **Axis:** generation
- **Suggested loop:** fingerprint-iteration
- **Prompt:** `Create an editorial brief explaining a new AI regulation fight. It should include the current state, why it matters, three evidence rows, one risk, and what to watch next. Keep it dense, urgent, and readable.`
- **Claims under test:** brief anatomy, evidence rows, verdict-shaped copy, metadata as navigation.
- **Strong output traits:** strong headline/current-state lead, three ruled evidence bands, next-watch close, restrained accent.
- **Likely failure modes:** essay page, policy dashboard, generic timeline, overuse of warning color.

### Prompt 4: mobile quick-post stream

- **id:** `signal-mobile-quick-posts`
- **Axis:** generation
- **Suggested loop:** fingerprint-iteration with mobile screenshot review
- **Prompt:** `Create a mobile-first quick-post stream for a technology news app. Show top story, latest mode, three short updates, one linked evidence item, and comment counts. Preserve order and hierarchy on a narrow screen.`
- **Claims under test:** responsive stream collapse, mobile tabs, small text legibility, metadata order.
- **Strong output traits:** full-width segmented control, image or display lead, stacked updates, visible timestamps, no shrunk unreadable metadata.
- **Likely failure modes:** desktop layout squeezed onto mobile, missing mode control, metadata hidden, tiny labels.

## 14. Review Criteria For Dogfood Runs

Score each run 0–2 on:

1. **Order and recency:** Can the reader tell what came first/latest/current?
2. **Dominant lead:** Is one headline, verdict, metric, or image unmistakably primary?
3. **Metadata utility:** Do labels/timestamps/categories orient the surface?
4. **Accent discipline:** Are saturated accents purposeful and contrast-safe?
5. **Flat depth:** Are hierarchy and interaction carried without drop shadows, glows, or gradients?
6. **Mobile resilience:** Does the layout collapse without losing sequence or legibility?
7. **Source agnosticism:** Does the output avoid publisher names, marks, article titles, and imitation?
8. **Actionability:** For briefs or launch feeds, is there a next action or what-to-watch close?

A strong Signal Stream generation should score at least 12/16 without source-brand violations.

## 15. Implementation Sequence

1. Change `bundle.json` status from `published` to `review` until evidence and dogfood records exist.
2. Add `fingerprint/memory/intent.md` with the user-approved agnostic intent.
3. Expand the curation note into `fingerprint/sources/curation/theverge-homepage-2026-06-22.md` with source classifications, promoted signals, non-promoted signals, evidence strength, and rights/abstraction stance.
4. Create five neutral source-informed exemplar images under `examples/core/`.
5. Add `inventory.exemplars[]` records with refs and evidence-strength notes.
6. Add the prose principle and contract for source abstraction.
7. Add the proposed composition patterns for segmented tabs, lead image/headline slab, supporting story grid, and mobile mode preservation.
8. Add candidate checks only for objective portability/source-brand boundaries.
9. Add dogfood prompt records, either under `examples/dogfood/`, `fingerprint/sources/curation/`, or a repo-standard eval location if one is introduced for Summon.
10. Run:

```bash
ghost lint apps/server/fingerprints/bundles/signal-stream
ghost verify apps/server/fingerprints/bundles/signal-stream --root apps/server/fingerprints/bundles/signal-stream
```

11. Run at least the four dogfood prompts through the Summon workbench and record scored review notes before returning status to `published`.

## 16. Out Of Scope

Workers must not:

- copy The Verge logos, masthead, article titles, author names, or ad creative into canonical exemplars
- cite `/Users/...`, `/tmp/...`, or local browser captures as portable evidence
- turn raw screenshots into committed assets unless screenshot rights are explicitly approved
- add deterministic checks for subjective taste such as "high-energy" or "electric"
- make Signal Stream a general news brand or source-specific clone
- weaken the no-shadow / no-gradient rule just to make generated work feel more familiar
- treat ads as part of the core visual system

## 17. Tier 4 Follow-Up

After Tier 3 is complete, a Tier 4 pass should add:

- accepted generation screenshots from dogfood runs
- scored review rows with before/after fingerprint-iteration evidence
- stable deterministic checks for source-brand boundaries and exemplar resolution
- human-approved exemplar weights
- an advisory `ghost review` packet template for Signal Stream drift
