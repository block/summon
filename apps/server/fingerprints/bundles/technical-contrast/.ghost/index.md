---
description: "Technical Contrast — a restrained technical-platform surface language: contrast planes, white data sheets, midnight proof sections, uppercase mono labels, tight geometric type, hairline structure, and optional large signal artwork."
---

## Intent

Technical Contrast makes complex technical options feel clear, modern, and
production-ready. It treats contrast planes — pale technical landings, crisp
white data sheets, and near-black midnight proof sections — as the primary
material, not decoration. Tight geometric sans copy, uppercase mono labels,
hairline structure, and aligned data carry the page; one large warm-to-cool
signal object is allowed but always optional and subordinate to the claim,
proof, and comparison. The voice is technical, precise, confident, modern,
restrained, and infrastructure-aware.

It serves technical evaluators comparing infrastructure, models, capacity, or
platform capabilities; teams deciding between tiers, workflows, experiments,
rollout paths, or implementation options; and agents composing polished
generated surfaces from structured technical detail. Pricing, model, capacity,
and evidence information should stay dense enough to compare without feeling like
a dashboard dump.

**Stance — what this is not:** no literal brand reuse — never copy source names,
domains, logos, slogans, wordmarks, customer logos, proprietary screenshots,
proprietary copy, exact model or pricing values, or proprietary hero art. No
generic SaaS card grids with soft shadows, full-pill CTAs, neon AI glow, bubbly
effects, or icon-heavy decoration. The optional signal artwork is never the
identity of every surface, never reduced to small repeated marks, and never
spread into a rainbow accent system or many category colors. No marketing
flourish that hides technical comparison, cost, capability, proof, or next
action. Monospace is a label system, not the narrative voice — no console-like
mono paragraphs.

**Tradeoffs:** prefer structured comparison over decorative variety when options
differ by capability, cost, latency, or scale; contrast planes and hairlines over
shadows for hierarchy; no artwork over small repeated artwork on data-heavy or
workflow-heavy surfaces. Use compact spacing inside tables and controls while
preserving generous plane-level breathing room. Allow pale landing planes as
readily as midnight landing planes — choose approachability or proof gravity by
task, and translate public technical-platform research into source-agnostic
generated surfaces without brand mimicry.

## Inventory

The material is a restrained light-rooted technical token system: white and pale
canvases, a near-black midnight plane with a dark-soft companion fill, black ink
text with muted-grey secondary copy, and light hairline borders. Color is held
back to a single black accent plus a contained warm-to-cool signal trio (orange,
magenta, periwinkle) reserved for one large optional artwork, and two pastel
tints (mint, periwinkle) for rare proof tiles. Two type roles do the work — a
tight geometric sans for headlines and body, and an uppercase mono label face for
eyebrows, buttons, tabs, table headers, and metadata — over a 2px-rooted spacing
ladder, lightly rounded rectangle radii, and intentionally quiet, border-led
shadow tokens.

The literal token vocabulary (inject as the visual source of truth; reference
these custom properties rather than inventing values):

```css
:root {
  color-scheme: light;

  /* Technical Contrast is restrained: white sheets, midnight bands, hairlines, and one warm-to-cool chromatic signal object. */
  --color-bg: #ffffff;
  --color-surface: #ffffff;
  --color-surface-muted: #ebebeb;
  --color-surface-dark: #010120;
  --color-surface-dark-soft: #313641;
  --color-border: rgba(0, 0, 0, 0.08);
  --color-border-input: rgba(0, 0, 0, 0.14);
  --color-border-strong: #000000;
  --color-text: #000000;
  --color-text-muted: #959494;
  --color-text-alt: #313641;
  --color-text-on-dark: #ffffff;
  --color-accent: #000000;
  --color-accent-fg: #ffffff;
  --color-signal-a: #fc4c02;
  --color-signal-b: #ef2cc1;
  --color-signal-c: #bdbbff;
  --color-tint-mint: #c8f6f9;
  --color-tint-periwinkle: #d8d7ff;
  --color-danger: #b42318;
  --color-success: #0f6b42;
  --color-info: #2846a8;
  --color-warning: #9a5b00;

  /* 4px-rooted rhythm with compact controls and generous section bands. */
  --space-1: 2px;
  --space-2: 4px;
  --space-3: 8px;
  --space-4: 12px;
  --space-5: 16px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 48px;
  --space-9: 64px;
  --space-10: 80px;

  /* Lightly rounded technical rectangles. */
  --radius-pill: 9999px;
  --radius-sm: 3.25px;
  --radius-md: 4px;
  --radius-lg: 8px;
  --radius-xl: 12px;

  /* Generic substitutes for the source study's custom geometric sans and mono label face. */
  --font-sans: Inter, "Helvetica Neue", Arial, sans-serif;
  --font-mono: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
  --font-serif: Inter, "Helvetica Neue", Arial, sans-serif;
  --text-xs: 10px;
  --text-sm: 11px;
  --text-md: 16px;
  --text-lg: 18px;
  --text-xl: 22px;
  --text-2xl: 40px;
  --text-3xl: 64px;
  --text-display: clamp(48px, 7vw, 86px);
  --tracking-label: 0.055em;
  --tracking-tight: -0.016em;
  --tracking-display: -0.03em;
  --leading-display: 1.1;
  --leading-section: 1.2;
  --leading-body: 1.3;
  --leading-reading: 1.45;

  --shadow-mini: 0 4px 10px rgba(1, 1, 32, 0.10);
  --shadow-card: none;
  --shadow-elevated: none;
  --shadow-popover: 0 24px 70px rgba(1, 1, 32, 0.16);
  --shadow-modal: 0 32px 90px rgba(1, 1, 32, 0.22);
}
```

Surface roles follow polarity: `--color-bg`/`--color-surface` are the white or
pale canvas for sheets, forms, and tables; `--color-surface-muted` is the
hairline-light rail, table-header fill, and subtle footer stencil;
`--color-surface-dark` is the midnight proof plane with `--color-surface-dark-soft`
for dark cards and badges inside it. `--color-accent` (black) is the primary CTA
and selected state on light surfaces; white, mint, or dark-soft fills serve
buttons on midnight planes. The signal trio and the two tints stay contained —
artwork and rare proof tiles only, never a general UI palette. Body copy is the
geometric sans; buttons, inputs, and controls are mono. Depth is border-led:
`--shadow-card` and `--shadow-elevated` are `none`, with shadow reserved only for
truly floating host controls or transient overlays.

## Composition

Five principles carry the language:

1. **Contrast planes carry the drama.** Distinct planes — pale technical landings,
   white data sheets, and midnight proof planes — create rhythm through contrast,
   not decoration. Use pale or white canvases for approachability, product
   detail, pricing, forms, testimonials, and tables; use near-black midnight for
   proof, research, or high-gravity claims. Avoid broad middle-grey backgrounds;
   if a softer rail is needed, keep it hairline-light and functional. Let plane
   changes separate major ideas before adding borders or shadows.
2. **Signal artwork is optional and large-scale.** Contrast, table structure, and
   type carry the language when decoration is unnecessary. Use one large abstract
   signal object only when it clarifies energy, capability, or proof; keep its
   warm-to-cool colors contained in the artwork rather than spreading them across
   controls. Never reduce it to small icons, badges, underlines, category
   swatches, or CTA fills, and omit it entirely on pricing, model, form, or
   workflow surfaces when the data should carry the page.
3. **Type contrast is the technical voice.** Sentence-case geometric sans copy
   and uppercase mono labels create the voice together. Tight geometric sans for
   headlines, body, and narrative; uppercase mono for eyebrows, buttons, tabs,
   table headers, compact metrics, and technical labels. Keep display headlines
   sentence-case and slightly tight; reserve all-caps for the mono system. Never
   set paragraphs in mono or buttons in casual body text.
4. **Technical data stays structured.** Data earns trust through aligned rows,
   tabs, headers, side navigation, and compact labels. Use tabular or matrix
   structures for cost, model, capacity, latency, limits, and feature
   comparisons; keep shared criteria visible rather than buried in separate
   cards; use mono headers and short parallel row labels. Let dense tables
   scroll, stack with preserved row labels, or collapse into category accordions
   instead of being replaced by unrelated cards.
5. **Hairlines, not shadows.** Depth comes from hairline borders, dividers,
   surface contrast, and dark-on-dark panels rather than floating shadows. Use
   1px hairlines on white sheets and dark-soft borders on midnight sections; keep
   card corners lightly rounded and flat; reserve subtle shadow only for truly
   floating host controls or transient overlays. Use border weight, fill
   polarity, or placement to emphasize the chosen option.

The recurring patterns that make a Technical Contrast surface feel intentional:

- **Technical plane landing:** open as a contrast plane — pale or midnight canvas,
  sentence-case claim, mono eyebrow, compact rectangular CTA cluster, muted proof
  rail, and optional large signal artwork. Pale when the surface should feel open
  and product-led; midnight when it should feel research-led or proof-led. On
  narrow screens, crop the large artwork below the CTAs or omit it.
- **Banded technical narrative:** long surfaces move between pale landing planes,
  white technical sheets, and midnight proof planes so each band has a clear job.
  Keep section padding generous at plane boundaries and tighter inside rows; do
  not introduce many tinted bands or stack grey on grey with no polarity change.
- **Mono eyebrow system:** uppercase monospace labels form the technical
  navigation system — eyebrows, buttons, tabs, table headers, badges, and compact
  metadata. Positive tracking, compact sizes, short and parallel; labels orient,
  they never decorate empty chips.
- **Left-sidebar pricing navigation:** dense pricing and capacity pages pair a
  quiet left category rail with a main white data sheet; active category bold or
  darker, inactive muted, hairline dividers between groups. On mobile, collapse
  groups into large plain accordions before the table.
- **Pricing table sheet:** pricing, model, capacity, and capability comparisons
  read as crisp white sheets with uppercase-mono muted headers on a pale rail,
  geometric-sans body cells with aligned numeric columns, and 1px hairline
  separators — no shadows, winner badges, or decorative artwork inside the sheet.
- **Segmented technical tabs:** compact segmented tabs on a hairline rail or white
  sheet, small-radius active pills with mono labels, black fill or stronger border
  for active state on light surfaces; preserve comparison context across tab
  changes. No oversized full-pill tabs or per-category colors.
- **Midnight proof plane + dark proof-card grid:** research or proof sections use a
  midnight plane with a strong display claim, mono eyebrow, muted recognition
  rail, and dark-on-dark proof cards bounded by dark-soft hairlines. Each card
  starts with a mono tag, then a sentence-case title and concise body, and pairs
  the proof point with an operational implication — never bright cards floating on
  the dark plane or neon glows.
- **Tinted stat tiles:** pastel tiles give rare relief on white planes — large
  number in display type, label in mono caps, a restrained mint or periwinkle
  fill, small corners, no shadow. Used sparingly, never a rainbow metric grid.
- **Rectangular CTA system + small-radius rectangles:** actions are small-radius
  rectangular buttons with uppercase mono labels — black fill as primary on light
  surfaces; white, mint, or dark-soft on midnight planes; outline for secondary.
  Radius near 4px (8px only for larger tab rails); circular geometry reserved for
  isolated icon controls. One primary action per region.
- **Technical form sheet:** workflows use white form sheets with mono labels,
  hairline field groups, small-radius inputs, and one black primary action; show
  technical state near the controls it affects, and simplify any product-UI proof
  into neutral configuration state rather than copying source screenshots.
- **Code editor breakout:** a compact dark code or configuration mockup can break
  up a white plane — midnight panel, mono-caption code, small radius, no elaborate
  window chrome, limited syntax accents — paired with a nearby claim as a proof or
  implementation break, never the landing's main decoration.
- **Low-contrast terminal sign-off:** long surfaces may close with an oversized,
  low-contrast terminal phrase tinted close to the hairline surface color as a
  quiet stencil sign-off — derived from the user's prompt, never a source
  wordmark, domain, or slogan; omit it on short or task-like surfaces.
- **Technical update card:** benchmark, certification, model-serving, and research
  updates appear as compact flat proof cards — short uppercase mono category badge
  (BENCHMARK, SECURITY, RESEARCH, CAPABILITY), bold sentence-case headline, one
  short implication sentence, optional neutral graphic plane, hairline bounds,
  small radius, and a quiet next-step action. Connect the update to a capability,
  risk, cost, or decision.
- **Mobile technical collapse:** collapse by preserving claim-first order,
  rectangular actions, cropped large signal art, and visible comparison criteria
  (row labels, sticky labels, horizontal scroll, or grouped accordions). Never
  squeeze a table until criteria disappear, miniaturize artwork into repeated
  badges, or swap to full-pill mobile CTAs.

**Surface obligations.** The first major region must state the technical claim,
comparison frame, or recommended action before details — a sentence-case headline
and concise lead before grids or tables, with CTAs near the claim when action is
expected. Comparisons must expose shared criteria in aligned rows, columns, table
headers, or side-navigation categories using the same criteria names across
options; never make the user infer comparable facts from differently structured
cards. Metrics, proof cards, research snippets, and code/configuration panels must
explain why the primary claim is credible — pair large numbers with labels and
implications, and avoid orphaned stats or testimonial fragments. Primary actions
stay small-radius rectangular with uppercase mono labels and clear contrast, never
full pills. Generated surfaces preserve the composition language without reusing
source names, domains, slogans, logos, wordmarks, proprietary copy, or proprietary
artwork — name the product from the user's prompt and treat signal artwork as an
abstract composition. On mobile, preserve claim-first order, the rectangular action
system, comparison criteria, and contrast-safe mono labels.
