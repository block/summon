# Technical Contrast Dogfood Prompts

Use these as single-task prompts for fingerprint-iteration or Summon workbench review. One prompt should produce one generation per fingerprint version. Score outputs with `fingerprint/sources/curation/dogfood-review-rubric-2026-06-22.md`.

## tc-pricing-model-comparison

**Prompt:** Create a technical pricing and capacity comparison page for an AI inference platform with serverless, dedicated, and batch options. Include model category tabs, input/output cost columns, cached-token notes, latency/capacity limits, and a recommendation for teams moving from prototype to production.

- **Eval axis:** generation
- **Claims under test:** `comparison-criteria-stay-visible`, `pricing-table-sheet`, `left-sidebar-pricing-navigation`, `segmented-technical-tabs`, `source-agnostic-output`
- **Expected strong-output traits:** white data sheet, aligned columns, mono headers, compact tabs, no source names, clear recommendation, black primary action, no decorative signal art inside the table
- **Likely failure modes:** generic pricing cards, inconsistent criteria per tier, copied source model names or prices, rainbow category colors, full-pill CTAs

## tc-research-proof-plane

**Prompt:** Create a research credibility section for a model-serving platform announcing a new throughput benchmark. It should explain why the benchmark matters, show three proof cards, include a muted recognition rail, and offer a next step for infrastructure teams.

- **Eval axis:** generation
- **Claims under test:** `midnight-proof-plane`, `dark-proof-card-grid`, `proof-supports-claim`, `type-contrast-is-technical-voice`, `source-agnostic-output`
- **Expected strong-output traits:** midnight plane, one strong claim, muted recognition rail with generic placeholders, dark-on-dark proof cards, metrics paired with operational implications, rectangular CTA
- **Likely failure modes:** neon/glow AI treatment, bright white cards floating on dark, orphaned stats, copied conference/customer names, decorative research thumbnails

## tc-technical-workflow-config

**Prompt:** Create a configuration workflow for launching a dedicated GPU cluster. Include deployment mode selection, hardware choice, region, estimated cost, capacity warning, and a final create action.

- **Eval axis:** generation
- **Claims under test:** `technical-form-sheet`, `actions-remain-rectangular-and-clear`, `hairlines-not-shadows`, `technical-data-stays-structured`
- **Expected strong-output traits:** white form sheet, mono labels, grouped controls, visible constraints, summary panel, one black primary action, small-radius inputs, no friendly onboarding illustration
- **Likely failure modes:** bubbly setup wizard, hidden constraints, multiple equal primary actions, heavy shadows, generic cloud dashboard UI

## tc-mobile-landing-stack

**Prompt:** Create a mobile landing screen for a production AI platform that introduces low-latency inference, shows two calls to action, includes one abstract signal artwork element, and preserves a muted trusted-by proof rail.

- **Eval axis:** generation
- **Claims under test:** `mobile-technical-collapse`, `technical-plane-landing`, `signal-artwork-is-optional`, `primary-claim-before-detail`
- **Expected strong-output traits:** stacked or clearly ordered claim, compact rectangular CTAs, large cropped signal art, muted proof rail, no tiny repeated signal icons, no source logo
- **Likely failure modes:** desktop hero squeezed onto mobile, signal artwork reduced to badges, full-pill CTAs, customer logo copying, weak claim hierarchy

## tc-benchmark-update-card

**Prompt:** Create a row of three technical update cards for an AI infrastructure site: one benchmark report, one security certification, and one new model-serving capability. Each card should include a category badge, headline, short implication, and a read-more action.

- **Eval axis:** generation
- **Claims under test:** `technical-update-card`, `proof-supports-claim`, `type-contrast-is-technical-voice`, `source-agnostic-output`
- **Expected strong-output traits:** mono badges, bold technical headlines, short implication copy, flat cards, optional neutral graphic panels, no logos in card art
- **Likely failure modes:** copied source blog headlines, logo-in-card mimicry, generic blog cards, decorative gradients with no technical meaning
