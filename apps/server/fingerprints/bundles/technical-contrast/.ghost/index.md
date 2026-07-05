---
description: "Technical Contrast core — a restrained technical-platform surface language: contrast planes, white data sheets, midnight proof sections, uppercase mono labels, tight geometric type, hairline structure, and optional large signal artwork. Reach when the question is 'what is true on every Technical Contrast surface?'"
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

## Signature look & feel

If you stripped every label off a Technical Contrast surface and left only the
shapes, you would still know it by these moves — they belong to this language and
no other in the catalog:

- **Stark plane polarity that flips the page.** The eye travels across three
  named planes — a pale technical landing (`--contrast-plane-pale-bg`), a crisp
  white data sheet (`--contrast-plane-sheet-bg`), and a near-black midnight proof
  plane (`--contrast-plane-midnight-bg`) that inverts everything via
  `--contrast-plane-invert`: black ink becomes white, hairlines become dark-soft.
  Each plane carries its own fg/bg pair, so the swap reads as a deliberate change
  of register, not a theme toggle.
- **Claim-first banded narrative.** Sections are full-bleed edge-to-edge bands
  (`--contrast-band-inset: 0`) with generous vertical air
  (`--contrast-band-pad-y`) and a contained reading measure
  (`--contrast-band-max`). The headline and its claim land at the top of every
  band before any grid, table, or artwork — the band is the unit of thought.
- **Uppercase mono eyebrows.** One all-caps voice runs the labels: eyebrows,
  tabs, table headers, and button text set in `--contrast-eyebrow-font` at
  `--contrast-eyebrow-size` with `--contrast-eyebrow-tracking` open spacing. The
  narrative itself stays sentence-case geometric sans — mono is a label system,
  never a paragraph.
- **A contained warm-to-cool signal trio, used once.** Orange → magenta →
  periwinkle (`--contrast-signal-warm`, `--contrast-signal-mid`,
  `--contrast-signal-cool`, bound in `--contrast-signal-gradient`) appears as one
  large optional artwork and nowhere else — never bleeding into buttons, badges,
  or category swatches.
- **Border-led depth — borders are the elevation.** Hairlines do the lifting:
  `--contrast-edge-hairline` on white sheets, `--contrast-edge-dark` on midnight
  panels, `--contrast-edge-strong` to mark the chosen option. There is no
  floating shadow — `--contrast-elevation` is `none`, so cards sit flat and
  structural, defined by their edges.
- **Small square-ish rectangular CTAs.** Primary actions are tight rectangles at
  `--contrast-cta-radius` (barely rounded) with `--contrast-cta-font` uppercase
  mono labels and compact `--contrast-cta-pad-*` padding — crisp and clickable,
  never a full pill.
- **Aligned numeric columns in the data sheets.** Numbers stack in
  `--contrast-num-font` tabular figures, `--contrast-num-align` right-aligned with
  `--contrast-num-variant` so digits line up decimal-for-decimal under mono
  headers, separated by `--contrast-num-col-gap` — comparison reads down a column,
  not across scattered cards. Every surface is source-agnostic, named from the
  prompt, never from any brand.

What holds the identity is the discipline: three polar planes, hairline edges
instead of shadows, one all-caps mono label voice, and a single contained signal
object. It collapses the moment those soften into generic SaaS card grids with
drop shadows and full-pill buttons, or the contained trio spreads into neon AI
glow and rainbow accents.

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

**Design lineage.** Technical Contrast descends from the modern
developer-marketing and technical-product design tradition — the crisp,
plane-layered marketing surfaces and geometric-sans discipline of contemporary
platform design systems (Geist-style monochrome polarity, the layered white/dark
marketing planes of payments-infrastructure sites, the flat contrast planes of
developer-tooling brands), grounded in the data-grid rigor of enterprise systems
like IBM Carbon. From that heritage it inherits its core grammar: pale/white/
midnight contrast planes instead of drop-shadowed cards, a geometric sans paired
with an uppercase mono label system, hairline structure carrying hierarchy, and
aligned tabular data as the proof surface. It is named as heritage, not copied —
no brand assets, wordmarks, or palettes travel with it; only the structural
conventions do.

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

  /* SIGNATURE — the moves that belong to Technical Contrast alone. Reference these, do not reinvent them. */

  /* Three-plane polarity: each plane carries its own fg/bg pair, and the midnight plane inverts the page. */
  --contrast-plane-pale-bg: #ebebeb;
  --contrast-plane-pale-fg: #000000;
  --contrast-plane-sheet-bg: #ffffff;
  --contrast-plane-sheet-fg: #000000;
  --contrast-plane-midnight-bg: #010120;
  --contrast-plane-midnight-fg: #ffffff;
  --contrast-plane-invert: invert(1);

  /* Banded full-width narrative sections: edge-to-edge bleed with generous vertical air, no side gutters on the band itself. */
  --contrast-band-inset: 0;
  --contrast-band-pad-y: var(--space-10);
  --contrast-band-pad-x: var(--space-7);
  --contrast-band-max: 1200px;

  /* Uppercase mono eyebrow/label treatment — the one all-caps voice on the page. */
  --contrast-eyebrow-font: var(--font-mono);
  --contrast-eyebrow-transform: uppercase;
  --contrast-eyebrow-size: var(--text-sm);
  --contrast-eyebrow-tracking: var(--tracking-label);
  --contrast-eyebrow-weight: 500;

  /* Contained warm-to-cool signal trio — a tight 3-color set for one large artwork, used sparingly, never as UI palette. */
  --contrast-signal-warm: #fc4c02;
  --contrast-signal-mid: #ef2cc1;
  --contrast-signal-cool: #bdbbff;
  --contrast-signal-gradient: linear-gradient(120deg, #fc4c02 0%, #ef2cc1 55%, #bdbbff 100%);

  /* Border-led depth — borders ARE the elevation; no floating shadows. */
  --contrast-edge-hairline: 1px solid rgba(0, 0, 0, 0.08);
  --contrast-edge-strong: 1px solid #000000;
  --contrast-edge-dark: 1px solid #313641;
  --contrast-elevation: none;

  /* Small-radius rectangular CTAs — square-ish, never pills. */
  --contrast-cta-radius: var(--radius-sm);
  --contrast-cta-pad-y: var(--space-3);
  --contrast-cta-pad-x: var(--space-5);
  --contrast-cta-font: var(--font-mono);
  --contrast-cta-transform: uppercase;

  /* Aligned numeric data columns — tabular figures, right-aligned, mono headers. */
  --contrast-num-font: var(--font-mono);
  --contrast-num-align: right;
  --contrast-num-variant: tabular-nums;
  --contrast-num-col-gap: var(--space-6);

  /* INTERACTION & PLANE STATES — crisp, hairline-first, plane-aware. Depth stays border-led; these only clarify focus, hover, and selection on both polarities. Reference these, do not reinvent them. */

  /* Focus ring — one crisp technical outline that reads on both pale/white and midnight planes. Offset keeps it clear of hairline edges; the light ring rides on dark planes, the dark ring on light ones. */
  --contrast-focus-width: 2px;
  --contrast-focus-offset: 2px;
  --contrast-focus-ring-light: 0 0 0 var(--contrast-focus-width) #000000; /* on pale/white planes */
  --contrast-focus-ring-dark: 0 0 0 var(--contrast-focus-width) #ffffff;  /* on midnight planes */

  /* Rectangular CTA states — polarity flip and border shift, never a glow. On light planes the black CTA lifts to dark-soft on hover; on midnight the white/dark-soft CTA firms its edge. */
  --contrast-cta-bg-hover: #313641;        /* black CTA warms toward dark-soft on hover */
  --contrast-cta-bg-active: #010120;       /* pressed returns to full midnight */
  --contrast-cta-border-hover: var(--contrast-edge-strong);
  --contrast-cta-disabled-bg: #ebebeb;     /* muted pale fill, no shadow */
  --contrast-cta-disabled-fg: #959494;     /* muted-grey label */
  --contrast-cta-disabled-opacity: 0.6;

  /* Data-sheet row states — hairline-and-fill only, so comparison reads down the column without card lift. */
  --contrast-row-hover-bg: #ebebeb;              /* pale wash on light sheets */
  --contrast-row-hover-bg-dark: #313641;         /* dark-soft wash on midnight sheets */
  --contrast-row-selected-border: var(--contrast-edge-strong); /* chosen option marked by edge weight */
  --contrast-row-divider: var(--contrast-edge-hairline);       /* between-row rule */

  /* Midnight-plane surface & border roles — the missing dark-plane companions so dark sections don't borrow light-plane tokens. */
  --contrast-surface-midnight-raised: #313641; /* dark card/badge fill on the midnight plane */
  --contrast-edge-midnight-soft: 1px solid rgba(255, 255, 255, 0.14); /* hairline that reads on near-black */

  /* Restrained technical motion — functional only: quick, linear-ish transitions for state and plane changes, never decorative easing. */
  --contrast-duration-fast: 120ms;   /* hover/focus state change */
  --contrast-duration-plane: 200ms;  /* plane/tab transitions */
  --contrast-ease-technical: cubic-bezier(0.2, 0, 0, 1); /* crisp, precise, no bounce */

  /* Drafting marks — technical-drawing micro-detail at the finest line weight: corner ticks, register marks, dimension callouts. Sparse by rule; derived from the hairline and mono-label vocabulary. */
  --contrast-tick-length: var(--space-3);                       /* short corner-tick stroke */
  --contrast-tick-stroke: 1px solid rgba(0, 0, 0, 0.08);        /* tick ink on pale/white planes */
  --contrast-tick-stroke-dark: 1px solid rgba(255, 255, 255, 0.14); /* tick ink on midnight */
  --contrast-dimension-rule: 1px solid rgba(0, 0, 0, 0.14);     /* dimension-line hairline with terminal ticks */
  --contrast-dimension-font: var(--font-mono);                  /* callout label voice */
  --contrast-dimension-size: var(--text-xs);                    /* callout label size */
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

**Components and states.** The rectangular CTA is the load-bearing control: a
tight `--contrast-cta-radius` rectangle with an uppercase mono label, black on
light planes and white or dark-soft on midnight. Its states flip polarity rather
than glow — hover warms the black fill toward `--contrast-cta-bg-hover`
(dark-soft) and firms its edge with `--contrast-cta-border-hover`, active presses
back to `--contrast-cta-bg-active` (full midnight), and disabled drops to the
muted `--contrast-cta-disabled-bg`/`--contrast-cta-disabled-fg` pair at
`--contrast-cta-disabled-opacity` with no shadow. Data-sheet rows follow the same
discipline: hover is a hairline-quiet wash (`--contrast-row-hover-bg` on light
sheets, `--contrast-row-hover-bg-dark` on midnight), the chosen option is marked
by `--contrast-row-selected-border` edge weight, and rows are separated by
`--contrast-row-divider` — never lifted onto shadowed cards. Proof cards sit flat
and structural, defined by `--contrast-edge-hairline` on light and
`--contrast-edge-midnight-soft` / `--contrast-surface-midnight-raised` on the
midnight plane, pairing each large number with its implication rather than
floating a stat. Empty and weak cells stay visible because gaps are part of the
comparison; loading and transient states use only the restrained
`--contrast-duration-fast` / `--contrast-ease-technical` motion, and plane or tab
changes use `--contrast-duration-plane` — functional, crisp, never decorative.

**Accessibility.** Focus is always visible and plane-aware: apply
`--contrast-focus-ring-light` (black) on pale and white surfaces and
`--contrast-focus-ring-dark` (white) on the midnight plane, held clear of hairline
edges by `--contrast-focus-offset` so the ring reads on both polarities. Every
plane carries its own fg/bg pair for high text contrast — black ink on
white/pale, white on near-black — and the muted-grey `--color-text-muted` is
reserved for secondary copy, not primary reading text. Keep mono labels at or
above `--text-sm` so the uppercase label system stays legible, and never rely on
the signal trio or fill polarity alone to convey the chosen option — pair it with
`--contrast-edge-strong` weight or a label.

The shared material every surface draws on lives in the root nodes that reach
everywhere: the [contrast-plane system](principle.contrast-planes) that bands the page, the
[mono eyebrow and label system](pattern.mono-labels), the
[rectangular CTA system](pattern.cta-system), the
[pricing-table and data-sheet system](pattern.data-sheets), the
[proof-card system](pattern.proof-cards), the [instrumentation system](pattern.instrumentation)
that makes the sheet read as a genuinely engineered document, and the
[drafting-mark system](pattern.drafting-marks) that supplies its sparse
technical-drawing micro-detail. Every surface is composed from these same
building blocks for its own job — a pricing sheet, a proof band, a workflow
configuration, or a technical landing — under the one contrast-plane register,
never from a fixed page template. The negative space is guarded by two hard
refusals — [no shadow-soft depth](anti-goal.shadow-soft-depth) and
[no source-brand leakage](anti-goal.source-brand-leakage) — and the whole
grammar is assembled in one worked fragment, the
[annotated capacity sheet](exemplar.capacity-sheet).

## Read order

For a typical surface, pull in this order:

1. [principle.contrast-planes](principle.contrast-planes) — set the macro rhythm
   and decide which planes the argument needs.
2. [pattern.mono-labels](pattern.mono-labels) — establish the one all-caps label
   voice before writing any header, eyebrow, or button.
3. The task's spine: [pattern.data-sheets](pattern.data-sheets) for comparison,
   [pattern.proof-cards](pattern.proof-cards) for evidence,
   [pattern.cta-system](pattern.cta-system) for action.
4. [pattern.instrumentation](pattern.instrumentation) and
   [pattern.drafting-marks](pattern.drafting-marks) — the engineered-document
   finish, applied last and sparsely.
5. [exemplar.capacity-sheet](exemplar.capacity-sheet) — check the assembled
   grammar against the worked fragment.
6. The guards — [anti-goal.shadow-soft-depth](anti-goal.shadow-soft-depth) and
   [anti-goal.source-brand-leakage](anti-goal.source-brand-leakage) — before
   calling the surface done.

**Silence posture.** This fingerprint is deliberately silent on iconography
sets, illustration style beyond the single signal object, chart/graph anatomy,
long-form documentation typography, and toast/notification chrome. Where it is
silent, compose provisionally in the same register — hairline-led, mono-labeled,
plane-aware — and label the choice as provisional rather than inventing a new
subsystem; never import a foreign idiom (soft shadows, pills, rainbow accents)
to fill the gap.

## Composition

Five principles carry the language and are true on every surface:

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

**Composing a surface from the planes.** Technical Contrast has no fixed page
types — every surface is composed for its task from the same small kit of parts,
in the same reading register. Set the macro rhythm with the
[contrast-plane system](principle.contrast-planes): band the page full-bleed and let each
plane declare a job — pale or white for product detail, pricing, forms, and
tables; near-black midnight, flipped via `--contrast-plane-invert`, for proof and
high-gravity claims. Orient every band with [uppercase mono labels](pattern.mono-labels)
over sentence-case geometric sans, then structure quantitative comparison with the
[white data sheets](pattern.data-sheets), carry credibility with the
[proof-card system](pattern.proof-cards), and drive action with the
[rectangular CTA system](pattern.cta-system). Let the task set the shape, not a template:
lead every band with the claim before any grid, table, or artwork; when the task
resolves a field of numbers, align shared criteria down mono-headed
`--contrast-num-align` columns so comparison reads down a column — never scattered
across differently-structured cards, keep weak or empty cells visible because gaps
are part of the comparison, and mark the chosen option with `--contrast-edge-strong`
or fill polarity rather than a winner badge or color; when the task argues proof,
pull the page onto the midnight plane and pair each dark-on-dark card's number with
its operational implication, never an orphaned stat; when the task is configuration,
let the white form sheet and its state carry the page and spend the single large
warm-to-cool signal object — if at all — on one moment and nowhere in the controls.
If a task fits none of these, compose a new surface from the same planes, labels,
sheets, cards, and rectangles under the same rules — never collapse to a generic
layout — compose from the same parts.

**Surface obligations (true everywhere).** The first major region must state the
technical claim, comparison frame, or recommended action before details — a
sentence-case headline and concise lead before grids or tables, with CTAs near
the claim when action is expected. Comparisons must expose shared criteria in
aligned rows, columns, table headers, or side-navigation categories using the
same criteria names across options; never make the user infer comparable facts
from differently structured cards. Metrics, proof cards, research snippets, and
code/configuration panels must explain why the primary claim is credible — pair
large numbers with labels and implications, and avoid orphaned stats or
testimonial fragments. Primary actions stay small-radius rectangular with
uppercase mono labels and clear contrast, never full pills. Generated surfaces
preserve the composition language without reusing source names, domains, slogans,
logos, wordmarks, proprietary copy, or proprietary artwork — name the product
from the user's prompt and treat signal artwork as an abstract composition. On
mobile, preserve claim-first order, the rectangular action system, comparison
criteria, and contrast-safe mono labels.

**Mobile technical collapse.** Collapse by preserving claim-first order,
rectangular actions, cropped large signal art, and visible comparison criteria
(row labels, sticky labels, horizontal scroll, or grouped accordions). Never
squeeze a table until criteria disappear, miniaturize artwork into repeated
badges, or swap to full-pill mobile CTAs.
