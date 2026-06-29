---
description: Redline Cinema — a source-agnostic luxury-performance editorial language of near-black cinematic bands, full-bleed photography, scarce race-red voltage, sharp rectangular controls, uppercase tracked labels, and generous 8px-paced sections.
---

## Intent

Redline Cinema makes a surface feel cinematic, precise, and performance-led. The
near-black canvas is the stage; full-bleed photography or image placeholders carry
the drama; a single saturated race-red accent supplies voltage; and sharp
rectangular geometry gives every control machined precision. It turns launches,
spec stories, catalogs, directories, and editorial features into edited
luxury-magazine acts rather than generic commerce or dashboard pages. The voice is
cinematic, precise, luxury, restrained, performance-led, and editorial.

It serves people exploring premium products, launches, events, or high-performance
comparisons; readers who expect cinematic editorial storytelling before
transactional detail; and agents composing polished generated surfaces from
luxury-performance briefs. Photography carries the emotion; tables, spec rows, and
large numerals carry the proof.

**Stance — what this is not:** this language is **source-informed, never
source-branded.** Never reintroduce a real automotive identity — no actual brand
names, logos, animal marks, shield shapes, model names, slogans, licensed fonts,
racing teams, or proprietary photography. It is equally not a generic SaaS
dashboard, bubbly lifestyle card set, pastel palette, glassmorphism surface, neon
cyberpunk skin, or soft rounded commerce grid. Do not overuse red as a background,
border, icon, chart, or category color until it loses voltage. Do not let bold
bombastic display type compete with the image. Avoid drop-shadow elevation
systems, pill CTAs, confetti badges, and decorative icon sets that replace
cinematic composition.

**Tradeoffs:** prefer one cinematic image moment over many decorative cards;
scarce red emphasis over multi-color categorization; sharp rectangular precision
over soft friendliness; spec rows, hairlines, and large numerals over dashboard
widgets when communicating performance. White bands are deliberate transactional
clarity, not the default mood — return to near-black for framing, footers, and
cinematic breaks.

## Inventory

The material is a dark cinematic token system: a warm near-black canvas (never
pure black), dark editorial sections, a single brightness-step elevated plate, and
deliberate white sheets for dense transactional relief. Text is white ink and grey
metadata on dark, near-black copy on white. A scarce race-red accent supplies the
only high-voltage color; a yellow exists strictly for exceptional specialty focus,
not the main palette. Geometry is sharp by default — `--radius-sm` and
`--radius-md` are `0px` so CTAs, cards, and image plates read machined; only tiny
utility radii and badge pills round. Type is a restrained sans with large but
modest-weight display, uppercase tracked labels, and calm editorial body. Depth is
photographic, hairline, and brightness-led; surface shadows are deliberately none.

The literal token vocabulary (inject as the visual source of truth; reference
these custom properties rather than inventing values):

```css
:root {
  color-scheme: dark;

  /* Redline Cinema: luxury-performance editorial, source-agnostic and mark-free. */
  --color-bg: #181818;
  --color-surface: #181818;
  --color-surface-muted: #303030;
  --color-surface-light: #ffffff;
  --color-surface-light-muted: #f7f7f7;
  --color-border: #303030;
  --color-border-input: #4a4a4a;
  --color-border-strong: #ffffff;
  --color-border-on-light: #d2d2d2;
  --color-text: #ffffff;
  --color-text-muted: #969696;
  --color-text-alt: #cfcfcf;
  --color-text-on-light: #181818;
  --color-accent: #da291c;
  --color-accent-hover: #b01e0a;
  --color-accent-fg: #ffffff;
  --color-accent-yellow: #f6e500;
  --color-danger: #f13a2c;
  --color-success: #03904a;
  --color-info: #4c98b9;
  --color-warning: #f13a2c;

  /* Attached study used an explicit 4/8px-rooted ladder with very large editorial breaks. */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 16px;
  --space-4: 24px;
  --space-5: 32px;
  --space-6: 48px;
  --space-7: 64px;
  --space-8: 96px;
  --space-9: 128px;
  --space-10: 160px;

  /* Sharp by default: primary CTAs, cards, and image plates should read machined, not soft. */
  --radius-pill: 9999px;
  --radius-sm: 0px;
  --radius-md: 0px;
  --radius-lg: 2px;
  --radius-xl: 4px;

  /* Licensed source faces are not assumed. Use strong system substitutes. */
  --font-sans: Inter, "Helvetica Neue", Arial, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
  --font-serif: Inter, "Helvetica Neue", Arial, ui-sans-serif, system-ui, sans-serif;
  --text-xs: 11px;
  --text-sm: 13px;
  --text-md: 14px;
  --text-lg: 18px;
  --text-xl: 26px;
  --text-2xl: 36px;
  --text-3xl: 56px;
  --text-display: clamp(44px, 7vw, 80px);
  --tracking-label: 0.10em;
  --tracking-tight: -0.01em;
  --tracking-display: -0.02em;
  --leading-display: 1.05;
  --leading-section: 1.18;
  --leading-body: 1.5;
  --leading-reading: 1.62;

  /* Depth is photography, hairlines, and brightness steps; shadows remain inert. */
  --shadow-mini: none;
  --shadow-card: none;
  --shadow-elevated: none;
  --shadow-popover: 0 24px 70px rgba(0, 0, 0, 0.28);
  --shadow-modal: 0 40px 120px rgba(0, 0, 0, 0.38);
}
```

The component vocabulary built from these tokens: cinematic heroes and image-led
mastheads, dark and light top navigation, a red primary button paired with dark or
light outline buttons and uppercase tertiary links, full-bleed photo bands, dark
editorial sections, one single red accent band, image-first feature cards, dark
elevated profile/driver/spec plates, large-number spec cells, race-or-event
position cells and hairline event rows, premium directory sheets, white catalog
sheets with image-first listing cards, rectangular form controls, badge pills, dark
CTA bands, and dark footers. Copy atoms stay terse and commanding — Performance,
Craft, Motion, Specification, Availability, Configuration, Event, Position, Detail,
Reserve, Explore, Compare, Next session, Directory, Region, Service.

## Composition

Seven principles carry the language:

1. **Cinema is the chrome.** Full-bleed cinematic imagery or image placeholders
   carry the drama; navigation, headings, and CTAs stay quiet. When no real
   imagery is available, reserve a large cinematic image slot with a gradient or
   dark overlay rather than inventing logos or proprietary artwork. Let body
   sections tighten after the hero so the page feels edited, not empty.
2. **Red is voltage, not palette.** A single saturated race-red accent is used
   sparingly — the main CTA, one highlighted metric, an active event position, or
   one full-width band. Keep surrounding surfaces near-black, white, and grey so
   red stays high-voltage. Reserve semantic colors for actual states.
3. **Sharp precision signals luxury.** Square corners on CTAs, cards, image
   plates, spec cells, and major bands give machined precision. Allow a tiny 4px
   radius for inputs, modals, and utility controls only when usability requires it;
   reserve pill geometry for compact badges, never for the primary CTA shape.
4. **Restrained sans does not shout.** Large display can be dramatic with tight
   line-height and slight negative tracking, but weight stays modest. Nav items,
   CTAs, badges, and section labels are uppercase with generous tracking; body copy
   stays small, calm, and editorial. Use substitute sans fonts only.
5. **Data reads as specification.** Performance, racing, event, or product data
   reads as specification: large numerals paired with labels and units, compact
   uppercase labels, aligned hairline rows and grids for comparison, and red on
   only the decisive value or active position.
6. **White is transactional relief.** White sheets are deliberate relief for
   dense catalog, price, dealer, and form contexts; they keep typography, spacing,
   and sharp geometry continuous with dark sections and return to near-black for
   framing. Avoid pale-grey SaaS backgrounds beyond a tight table rail or subtle
   listing divider.
7. **Hairlines and brightness create depth.** Depth comes from photographic
   atmosphere, 1px hairlines, dark-grey brightness steps, and occasional dark
   gradients — never shadow stacks. Dark elevated plates sit one brightness step
   above the canvas; overlays make image text legible, not decorative glass;
   shadows are reserved for transient overlays only.

The recurring patterns that make a Redline Cinema surface feel intentional:

- **Full-bleed cinematic hero:** a viewport-scale dark image field with overlay,
  restrained display headline near the lower edge or in a tight dark band below, a
  compact deck, and at most two sharp actions; minimal nav so the image is the
  event. On mobile, crop vertically while preserving the cinematic frame.
- **Scarce red CTA cluster:** 48px-class rectangular buttons with square corners,
  uppercase tracked labels, one red fill primary per region, and outline/white/
  text secondaries. Copy stays short and commanding — Explore, Reserve, Configure,
  Compare, View details.
- **Editorial dark-to-body pacing:** long pages move from a dark cinematic opening
  into tighter editorial body sections with large 96–128px breaks between acts,
  a broad editorial container, and tighter 24–48px spacing inside cards and rows.
- **Image-first feature card:** edge-to-edge media occupying the top/majority,
  square corners, no shadow, tight title/body copy beneath, in two-up or three-up
  grids rather than crowded masonry.
- **Large-number spec grid:** oversized numerals for meaningful values, each
  paired with a compact uppercase label and unit, aligned in a grid or row with
  hairline dividers, red on only one decisive value.
- **Race-or-event row system:** hairline-separated rows with date/sequence at
  left, name/context in the middle, status/result/action at right, uppercase
  labels and muted metadata, and red only for the active position or primary row
  action.
- **White catalog sheet & image-first listing card:** dense listings, tables,
  filters, and forms on sharp white sheets framed by dark sections; near-black
  text, hairline dividers, red or ink rectangular CTAs; listing cards with
  top edge-to-edge images, aligned metadata, square corners, and no shadows.
- **Rectangular form-and-control system:** 48px-class inputs and buttons, 4px
  radius for inputs only where required (CTAs stay square), hairline borders,
  high-contrast text, and disciplined filter rows that stack cleanly on mobile.
- **Dark elevated plates:** dark-grey panels one brightness step above the canvas,
  separated by 1px hairlines rather than shadow, with concise copy and images or
  large numerals as the focal point.
- **Single red livery band:** at most one full-width red accent band as a dramatic
  interruption for a major statement, event status, or transition — white,
  large, restrained text and no extra colors — omitted on compact task surfaces.
- **Premium directory sheet:** grouped sheets and compact hairline rows by region,
  service type, availability, or tier with uppercase section labels and one clear
  rectangular action per row, framed by a dark masthead or footer — never generic
  map-app chrome or undifferentiated link lists.
- **Lineup category browse:** image-led category plates for product families,
  collections, sessions, or chapters with sparse uppercase (optionally numbered)
  labels, delaying dense filters until after the first image-led browse moment.
- **Derived image-placeholder discipline:** when prompt imagery is absent, use
  dark gradients, cropped light streaks, abstract silhouettes, material detail, or
  generic performance photography descriptions — never invented source-branded
  vehicles, marks, or model photography. Prefer no image over a fake brand image.

**Surface obligations.** Generated surfaces preserve the luxury-performance
composition language without reusing actual source names, logos, marks, model
names, slogans, proprietary images, or licensed font names; name the generated
product, event, category, or task from the user's prompt, using generic labels
such as performance marque, private collection, track session, studio archive, or
service directory. The first major region establishes cinematic atmosphere and a
concise editorial claim — eyebrow, headline, one deck, at most two actions —
before dense detail. Oversized numerals must carry meaningful performance,
ranking, event, availability, or comparison information, each with a label and
unit and aligned with comparable metrics. Red highlights are limited to the
primary action or the one value/state the user must notice first — one red focal
role per region. Listings, forms, and tables stay dense enough to act while
remaining visually connected to the cinematic editorial frame: white sheets only
for transactional regions, uppercase labels, hairline-separated rows, and a return
to dark framing for transitions, CTA bands, and footers.
