---
description: Editorial Mono core — a monochrome editorial surface language where the verdict reads first and aligned evidence justifies it, carried by cream paper, black ink, hairline rules, serif display type, and mono metadata.
---

## Intent

Editorial Mono makes a surface feel like a printed page that has already made up
its mind: cream paper, black ink, hairline rules, serif display type, and mono
metadata arranged so the verdict reads first and the evidence justifies it
second. It turns options, criteria, metrics, and judgment into an **edited
editorial surface** rather than a neutral inventory of facts. The voice is calm,
exact, editorial, austere, decisive, and measured — confident enough to commit to
a recommendation without becoming hostile.

It serves readers comparing options, decision-makers who need a recommendation
they can act on, and agents composing refined generated briefs that should scan
before they read. The job is always the same: make the useful claim legible
before the supporting detail, and let type, alignment, rules, and spacing carry
the hierarchy.

**Stance — what this is not:** no generic dashboard shells, marketing hero pages,
or rounded card grids that merely organize content; no cozy planner styling,
garden-note warmth, decorative badges, pastel panels, or soft lifestyle language.
Color is never used as personality — emphasis comes from ink, inverse black
panels, rules, type, and spacing, and semantic colors are reserved for true
danger, success, info, and warning states. The cream surfaces are editorial
**paper**, not beige lifestyle warmth. Completeness must never bury the verdict
under equal-weight criteria, paragraphs, or widgets, and the austerity must never
tip into empty, ornamental, or art-directed output that fails to help a decision.

**Tradeoffs:** prefer the verdict over exhaustive explanation when the user came
to decide; aligned criteria over varied card composition when comparing options;
evidence density over decorative whitespace, while preserving enough air to scan.
Use severity carefully — the tone can be exact and austere without becoming
hostile.

## Signature look & feel

If you stripped every label off an Editorial Mono surface and left only the
shapes, you would still know it by these moves — they belong to this language and
no other in the catalog:

- **Hairline rules do all the drawing.** Structure is cut with `--editorial-hairline`
  and `--editorial-rule-heavy`, never with boxes or fills — a single ink weight
  ruling columns and rows the way a compositor sets a page, so the surface reads
  as drawn, not contained.
- **The whole page sits on ruled paper.** A faint `--editorial-ruled-paper`
  baseline grid runs beneath the type like the ruling of a ledger, with
  `--editorial-ruled-gutter` marking the margin — present at the edge of
  perception, enough to feel like stock you could write on.
- **One slab of inverse ink, and only one.** The verdict alone wears
  `--editorial-verdict-bg` / `--editorial-verdict-fg`: black paper, cream ink,
  square corners, no shadow. It reads first because it is the one place the page
  inverts, and nothing else is allowed to.
- **Folios carry the metadata, tracked and uppercase.** Page numbers, ranks,
  labels, and timestamps run through `--editorial-folio-font` at
  `--editorial-folio-tracking`, sitting beside the `--editorial-registration-mark`
  like crop ticks on a printed sheet — press furniture, not chrome.
- **A serif initial opens the voice.** The oversized `--editorial-dropcap-size`
  drop cap spanning `--editorial-dropcap-lines` lines announces the article
  register before a word is read, anchoring the column to the top-left the way an
  edited page begins.
- **Evidence is justified into ruled columns.** `--editorial-column-rule`
  hairlines and `--editorial-column-gap` split criteria into parallel bands that
  line up across options, so trust comes from alignment rather than color or card
  decoration.
- **Depth comes from rules, never elevation.** Squared geometry and the
  deliberately invisible shadow tokens keep every plane flat; separation is read
  from hairline contrast and paper tiers, the way ink separates regions on a
  printed page.

What holds the identity is the discipline of one ink, one inverse slab, hairlines
that rule instead of enclose, and a verdict that reads before its evidence. What
collapses it into a generic doc or dashboard is the moment any of those soften —
a second accent color, a rounded card, a drop shadow, or evidence given equal
weight to the verdict — and the printed page becomes just another panel.

## Inventory

The material is a monochrome editorial token system: an editorial paper
background, clean and muted paper tiers for shells and secondary bands, hairline
and ink rules, and an ink palette where the accent is ink itself rather than a
chromatic personality color. Type carries the brand through a serif display and
article voice and a mono system for folios, labels, ranks, timestamps, and
criteria. Spacing runs from tight evidence rhythm to large decisive page breaks,
geometry stays squared (pill radius reserved for compact labels and controls
only), and the shadow tokens are deliberately none — depth comes from rules,
contrast, and paper tiers, never elevation.

The literal token vocabulary (inject as the visual source of truth; reference
these custom properties rather than inventing values):

```css
:root {
  color-scheme: light;

  /* Editorial Mono is intentionally stark: paper, ink, hairlines, no color decoration. */
  --color-bg: #f2efe7;
  --color-surface: #fffdf6;
  --color-surface-muted: #e5e0d4;
  --color-border: #b8b0a0;
  --color-border-input: #8f8677;
  --color-border-strong: #11100e;
  --color-text: #11100e;
  --color-text-muted: #5f584d;
  --color-text-alt: #38342d;
  --color-accent: #11100e;
  --color-accent-fg: #fffdf6;
  --color-danger: #8f1d14;
  --color-success: #315f38;
  --color-info: #213f73;
  --color-warning: #7a4600;

  /* Editorial rhythm: tight internal spacing, large decisive breaks. */
  --space-1: 3px;
  --space-2: 6px;
  --space-3: 10px;
  --space-4: 14px;
  --space-5: 22px;
  --space-6: 34px;
  --space-7: 44px;
  --space-8: 64px;
  --space-9: 88px;
  --space-10: 118px;

  /* Squared editorial furniture. */
  --radius-pill: 999px;
  --radius-sm: 0px;
  --radius-md: 2px;
  --radius-lg: 4px;
  --radius-xl: 6px;

  /* Make even generic generated code read editorial. */
  --font-sans: Georgia, "Times New Roman", Times, serif;
  --font-mono: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
  --font-serif: Georgia, "Times New Roman", Times, serif;
  --text-xs: 10px;
  --text-sm: 12px;
  --text-md: 15px;
  --text-lg: 22px;
  --text-xl: 34px;
  --text-2xl: 52px;
  --text-3xl: 76px;
  --text-display: clamp(64px, 10vw, 126px);
  --tracking-label: 0.18em;
  --tracking-tight: -0.035em;
  --tracking-display: -0.075em;
  --leading-display: 0.82;
  --leading-section: 0.95;
  --leading-body: 1.42;
  --leading-reading: 1.6;

  /* Contract-complete shadow tokens, deliberately invisible. */
  --shadow-mini: none;
  --shadow-card: none;
  --shadow-elevated: none;
  --shadow-popover: none;
  --shadow-modal: none;

  /* SIGNATURE — the moves that belong to Editorial Mono alone. Reference these, do not reinvent them. */

  /* The hairline that draws every column and row — one ink weight, never a box. */
  --editorial-hairline: 1px solid #11100e;
  --editorial-hairline-faint: 1px solid #b8b0a0;
  --editorial-rule-heavy: 2px solid #11100e;

  /* Faint ruled-paper grid the whole surface sits on — baseline lines like a printed ledger. */
  --editorial-ruled-paper: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 27px,
    rgba(17, 16, 14, 0.06) 27px,
    rgba(17, 16, 14, 0.06) 28px
  );
  --editorial-ruled-gutter: repeating-linear-gradient(
    to right,
    transparent 0,
    transparent calc(100% - 1px),
    rgba(17, 16, 14, 0.04) calc(100% - 1px),
    rgba(17, 16, 14, 0.04) 100%
  );

  /* The single inverse-ink verdict slab — black paper, cream ink, no rounding, no shadow. */
  --editorial-verdict-bg: #11100e;
  --editorial-verdict-fg: #fffdf6;
  --editorial-verdict-pad: var(--space-7) var(--space-6);
  --editorial-verdict-radius: 0px;

  /* Folio / registration-mark metadata — mono, tracked, uppercase, page-number discipline. */
  --editorial-folio-font: var(--font-mono);
  --editorial-folio-size: var(--text-xs);
  --editorial-folio-tracking: var(--tracking-label);
  --editorial-folio-transform: uppercase;
  --editorial-registration-mark: "✚"; /* crop/registration tick set beside the folio */

  /* Drop-cap / oversized serif initial that opens the article voice. */
  --editorial-dropcap-font: var(--font-serif);
  --editorial-dropcap-size: var(--text-3xl);
  --editorial-dropcap-leading: var(--leading-display);
  --editorial-dropcap-lines: 3;

  /* Column-rule hairlines that split evidence into justified columns. */
  --editorial-column-rule: 1px solid #b8b0a0;
  --editorial-column-gap: var(--space-6);
}
```

The body sits on a faint ruled paper grid, sets type in the serif workhorse, and
routes controls, inputs, labels, and metadata through the mono family; `strong`
emphasis goes heavy rather than colored. The component vocabulary is editorial
furniture, and the copy atoms are exact — Verdict, Evidence, Risk, Caveat,
Recommendation, Accepted tradeoff, What changed, What to watch, Rank, Criteria —
while state variants cover selected option, recommended path, waiting, blocked
risk, ready evidence, empty data, error, and incomplete comparison. The serif
fallback is intentional: generated UI should read editorial even when it uses
generic element names.

The shared material every surface draws on lives in the root nodes that reach
everywhere through the spine: the [masthead / deck / folio shell](masthead) that
frames a composed page, the [mono metadata system](metadata) of folios, labels,
ranks, and timestamps, the [ruled evidence bands](evidence) that justify the
claim, the [single inverse-ink panel](inverse-panel) reserved for the verdict,
and the [editorial close](close) that lands the decision. The surfaces —
[brief](brief), [comparison](comparison), and [report](report) — compose this
material for their own job.

## Composition

Four principles carry the language and are true on every surface:

1. **Editorial hierarchy leads.** Open with a strong typographic claim, then
   support it with measured evidence, compact labels, and visible editorial
   rules. Let type scale, alignment, border weight, column structure, and
   whitespace create hierarchy before any decoration. Prefer monochrome contrast,
   serif display type, mono metadata, square geometry, and ruled rows over
   filler headings, vague labels, or rounded pastel cards.
2. **The verdict earns the page.** Editorial Mono is strongest when the page is
   organized around a verdict, not a neutral inventory of facts. State the
   recommendation, ranking, risk, or outcome before supporting detail; give it
   the largest type or the single inverse ink panel; demote caveats into ruled
   evidence bands so they support the decision rather than competing with it.
3. **Criteria create trust.** Trust comes from shared criteria that line up
   visibly. Use repeated rows, columns, ranks, or labeled evidence bands when
   comparing, keep criteria labels short and parallel, and mark the chosen option
   through position, border weight, or an ink label rather than decorative color.
4. **Monochrome restraint is the material.** Ink, paper, rules, spacing, and type
   carry the personality. Treat cream as editorial paper, not cozy beige; reserve
   semantic colors for true danger, success, info, or warning states; use shadows
   sparingly or not at all and rely on borders and contrast; keep pill radius for
   compact controls and labels, never broad panels.

**Surface obligations (true everywhere).** A reader should understand the
verdict, criteria, and next action before reading paragraph detail. The headline,
recommendation, or metric verdict appears in the first major visual region, and
evidence justifies the claim rather than postponing it — avoid neutral titles
like Overview, Summary, or Dashboard unless paired with a real claim. Comparisons
must share visible criteria rows, columns, or bands using the same labels for
every option. Emphasis is made from ink, rules, inverse panels, type, spacing,
and alignment before color; avoid gradients, soft chromatic backgrounds, and mood
badges. The surface closes with a decision, risk, next action, or editorial
implication kept shorter and stronger than the evidence. Large display type must
wrap cleanly with responsive line breaks, leave at least 72px of top breathing
room for host chrome, and reduce scale before words overlap, clip, or crowd the
edges.
