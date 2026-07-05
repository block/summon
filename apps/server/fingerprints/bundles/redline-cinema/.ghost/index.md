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

**Read order.** For a typical surface, pull in this order: the
[editorial cadence](pattern.editorial-cadence) first (it sets the grid, chapter
pacing, and reveal recipe every act obeys), then the
[cinematic image system](pattern.cinematic-image) for the opening frame, the
[scarce-red controls](pattern.controls) for the one voltage spend, the
[spec system](pattern.spec-system) wherever numbers prove capability, and
[depth](principle.depth) for plate/hairline separation. Before writing markup,
study the [spec-chapter exemplar](exemplar.spec-chapter); before shipping, sweep
against the two guards — [red spent everywhere](anti-goal.red-spent-everywhere)
and [rounded soft luxury](anti-goal.rounded-soft-luxury). Pull the
[player chrome](pattern.player-chrome) and [livery band](pattern.livery-band)
only when footage or a full-width statement is actually in play.

**Silence posture.** This fingerprint is deliberately silent on iconography sets,
data-visualization styling beyond spec grids, illustration, multi-brand theming,
and print. In those gaps, compose provisionally from the same tokens and label
the choice as provisional — hairlines, white ink, square geometry, no new colors —
rather than importing another language's defaults.

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

## Signature look & feel

If you stripped every label off a Redline Cinema surface and left only the
shapes, you would still know it by these moves — they belong to this language and
no other in the catalog:

- **The stage is a warm near-black, never a true black.** Every surface floors on
  `--redline-canvas-warm` (`#181818`), a charcoal with a trace of warmth that
  reads like a darkened screening room, not the dead `#000` of a terminal. The
  warmth is what makes the photography glow rather than sit in a void.
- **A single full-bleed cinematic frame opens the act.** One hero image runs
  edge-to-edge at `--redline-frame-bleed` (`0px` inset) with a square
  `--redline-frame-radius`, dropped under `--redline-frame-overlay` so the headline
  stays legible against it. It is the drama — one image moment, not a gallery of
  decorative cards.
- **Race-red is voltage spent exactly once.** `--redline-voltage` (`#da291c`)
  lights a single role per page — the primary CTA, one decisive metric, or one
  active position — and never leaks into borders, icons, charts, or category
  swatches. Scarcity is the whole point; the `--redline-voltage-stripe` hairline
  appears once or not at all.
- **One full-width red livery band cuts the page, once.** A single
  `--redline-livery-band-h` sweep of `--redline-livery-band` slices full-width
  across the surface as the lone dramatic interruption — a racing livery stripe,
  never a repeated divider.
- **Giant spec numerals carry the proof.** Performance and ranking figures display
  at `--redline-spec-numeral` (up to 132px) in modest `--redline-spec-numeral-weight`,
  each riding beside an uppercase unit tracked at `--redline-spec-unit-tracking`.
  The numbers are dramatic in size, never bombastic in weight.
- **Geometry is square and machined.** CTAs, cards, image plates, and spec cells
  all sit at `--redline-machined-radius` (`0px`) — sharp rectangular precision that
  signals luxury engineering; only tiny utility controls and badge pills are
  allowed to round.
- **Depth comes from hairlines and brightness, not shadow.** A single
  `--redline-hairline` separates regions and an elevated plate rises exactly one
  `--redline-brightness-step` (`#303030`) above the canvas — presence built from
  light and 1px lines, with surface shadows held inert.

The identity holds when red stays scarce, the geometry stays square, one image
carries the emotion, and the canvas keeps its warm near-black glow. It collapses
into generic dark SaaS the moment red becomes a palette, corners soften, and
shadow stacks replace hairlines — or into neon cyberpunk if the red multiplies,
glows, or borrows a real automotive mark.

## Inventory

**Design lineage.** Redline Cinema descends from cinematic luxury-performance and
automotive editorial art direction — the near-black stage, full-bleed hero frame,
and giant spec numerals of the premium performance magazine — cross-cut with
Apple-style product-marketing staging, where one product-hero image is lit against
a dark ground and copy stays quiet and precise. It also inherits the discipline of
premium magazine layout: hairline rules, generous editorial breaks, and uppercase
tracked labels. This is heritage and grounding only; name the tradition, never
borrow a real marque's marks, liveries, or type. The moves below are the source of
truth; reference them rather than reaching for a specific brand's assets.

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

  /* SIGNATURE — the moves that belong to Redline Cinema alone. Reference these, do not reinvent them. */
  --redline-canvas-warm: #181818; /* warm near-black stage — never pure #000, the floor of every frame */
  --redline-canvas-rgb: 24, 24, 24; /* for overlay/atmosphere math against the warm near-black */
  --redline-frame-bleed: 0px; /* full-bleed cinematic image frame: image runs edge-to-edge, zero inset */
  --redline-frame-radius: 0px; /* the image plate is square-cornered, machined, never softened */
  --redline-frame-overlay: linear-gradient(180deg, rgba(24, 24, 24, 0) 35%, rgba(24, 24, 24, 0.82) 100%); /* legibility scrim over photography, not decorative glass */
  --redline-voltage: #da291c; /* scarce race-red — spent exactly once per page, never bled into borders/icons */
  --redline-voltage-hover: #b01e0a;
  --redline-voltage-stripe: 3px; /* the single hairline-thin red accent stripe; one appearance only */
  --redline-livery-band-h: 4px; /* the one full-width red livery band that cuts the page exactly once */
  --redline-livery-band: linear-gradient(90deg, #da291c, #b01e0a); /* the livery band's race-red sweep */
  --redline-spec-numeral: clamp(56px, 9vw, 132px); /* giant performance/spec numerals — oversized numeric display */
  --redline-spec-numeral-weight: 600; /* large but modest-weight: dramatic, never bombastic */
  --redline-spec-unit-tracking: 0.10em; /* uppercase tracked unit/label riding beside the giant numeral */
  --redline-machined-radius: 0px; /* square machined geometry on CTAs, cards, plates, spec cells */
  --redline-hairline: 1px solid #303030; /* depth from a single dark hairline, never a shadow stack */
  --redline-brightness-step: #303030; /* the one brightness step a plate sits above the canvas */

  /* INTERACTION & FOCUS — machined states built from brightness + hairline, never shadow, never new red.
     Depth stays photographic; these only make controls answer touch and keep focus visible on BOTH grounds. */
  --redline-focus-ring: #ffffff; /* crisp focus ring — white reads on the near-black stage without spending voltage */
  --redline-focus-ring-on-light: #181818; /* on white transactional relief bands the ring flips to warm near-black for the same crispness */
  --redline-focus-ring-width: 2px; /* a single sharp 1–2px ring, machined not glowing — no soft halo */
  --redline-focus-ring-offset: 2px; /* small offset so the square ring frames the control cleanly on either ground */

  /* CTA + spec-row states — the rectangular button and hairline row shift by one brightness step or hairline, not elevation. */
  --redline-cta-hover: #b01e0a; /* the one red CTA darkens on hover (mirrors --redline-voltage-hover); still spent once per page */
  --redline-cta-active: #8f1808; /* pressed CTA steps down once more — a brightness step, never a drop-shadow lift */
  --redline-row-hover: #202020; /* spec/list row on the dark stage rises one shy step toward the brightness step on hover */
  --redline-row-hover-on-light: #f2f2f2; /* the same row on a white relief band cools by one step, staying transactional */
  --redline-row-selected-rail: 2px solid #303030; /* selected row marked by a hairline rail, not red and not shadow */

  /* DISABLED — presence drained via muted ink + hairline, the machined shape kept, no red, no glow. */
  --redline-disabled-fg: #626262; /* disabled label mutes toward the grey metadata tone, never the red */
  --redline-disabled-surface: #242424; /* disabled control sits just off the canvas — a half-step, clearly inert */
  --redline-disabled-border: 1px solid #303030; /* disabled edge keeps the standard hairline, no accent leak */

  /* SURFACE & BORDER roles — filling gaps for overlays and relief bands without adding chrome. */
  --redline-scrim: rgba(24, 24, 24, 0.62); /* flat legibility scrim (warm near-black) for modals/overlays over photography */
  --redline-relief-band: #ffffff; /* the white transactional relief band ground — deliberate clarity, returns to near-black after */
  --redline-hairline-on-light: 1px solid #d2d2d2; /* the hairline's counterpart on white sheets — same 1px discipline, no shadow */

  /* MOTION — restrained and cinematic; one slow ease, used sparingly, never bouncy. */
  --redline-ease-cinematic: cubic-bezier(0.22, 0.61, 0.36, 1); /* slow confident ease for hero/overlay reveals — editorial, not playful */
  --redline-duration-slow: 480ms; /* the cinematic reveal duration — restrained, applied to at most one moment per surface */
  --redline-duration-state: 140ms; /* quick, calm state transition for hover/focus — machined, not springy */

  /* PLAYER CHROME & HOVER REVEAL — footage dressed in the same machined vocabulary; no third-party player branding. */
  --redline-player-rail: 1px solid #4a4a4a; /* the scrub bar is a single hairline, kin to --color-border-input — never a thick colored bar */
  --redline-player-progress: #ffffff; /* elapsed footage fills in white ink — progress is brightness, not a second red */
  --redline-timecode-size: 11px; /* mono timecode readout, same scale as the mono-technical data layer */
  --redline-timecode-tracking: 0.14em; /* timecode tracks like the mono data voice — an instrument reading, not decoration */
  --redline-hover-reveal-opacity: 0.9; /* a pointed-at frame fades up in its reserved plate — a fade on the stage, never a zoom or lift */
}
```

The component vocabulary is built from these tokens — cinematic heroes and
image-led mastheads staged like a product-marketing key frame, dark and light top
navigation, a red primary button paired with dark or light outline buttons and
uppercase tertiary links, dark editorial sections, image-first feature cards,
large-number spec cells, hairline event rows, premium directory sheets, white
catalog sheets, rectangular form controls, badge pills, dark CTA bands, and dark
footers. Every one of these is square-cornered at `--redline-machined-radius`
(`0px`) — the CTA is a machined rectangle, never a pill; only tiny utility controls
and compact badges are allowed to round. Copy atoms stay terse and commanding —
Performance, Craft, Motion, Specification, Availability, Configuration, Event,
Position, Detail, Reserve, Explore, Compare, Next session, Directory, Region,
Service.

**Component states, in this language's own terms.** The single red CTA is the
only place voltage is spent, so its states are expressed through the same red,
darkened by one brightness step: rest at `--redline-voltage`, `--redline-cta-hover`
on hover, `--redline-cta-active` when pressed — never a shadow lift, never a second
red appearing elsewhere. Spec rows and hairline list rows answer the pointer by
rising one shy brightness step (`--redline-row-hover` on the dark stage,
`--redline-row-hover-on-light` on a white relief band), and a selected row is
marked by a `--redline-row-selected-rail` hairline rail, not by red or elevation.
Disabled controls keep their machined shape but drain to `--redline-disabled-fg`
ink on a `--redline-disabled-surface` half-step ground with a
`--redline-disabled-border` edge — clearly inert, never greyed with a glow. Loading
and empty states stay near-black and quiet: reserve a full cinematic image slot
under `--redline-frame-overlay` rather than filling space with decorative cards,
and let one line of grey metadata carry an empty result. Error and other semantic
states use the reserved `--color-danger` / `--color-success` / `--color-info`
roles for their actual meaning — the race-red stays reserved for voltage alone.

**Accessibility intent.** Focus is always visible and always crisp: a sharp
`--redline-focus-ring` (white) frames controls on the warm near-black stage, and it
flips to `--redline-focus-ring-on-light` (near-black) the moment a control sits on a
white transactional relief band, so a `--redline-focus-ring-width` ring at
`--redline-focus-ring-offset` reads on both grounds without ever borrowing the red.
White ink on `--redline-canvas-warm` and near-black ink on white relief bands both
hold strong contrast; grey metadata (`--color-text-muted`) is reserved for
secondary information, not primary reading. Uppercase tracked labels keep the
`--tracking-label` breathing room that makes them legible at small sizes, and body
copy holds `--text-md` and up. Motion is optional and honors reduced-motion
preferences — the cinematic reveal is decoration, never a gate on content.

The shared material every surface draws on lives in the root nodes that reach
everywhere: the [cinematic image system](pattern.cinematic-image) that carries the drama
and disciplines placeholders, the [scarce-red CTA and control system](pattern.controls)
that supplies voltage and machined inputs, the [large-number spec
system](pattern.spec-system) that reads data as specification, the [dark elevated plate
and hairline depth system](principle.depth) that builds presence without shadow, the
[single red livery band](pattern.livery-band) reserved for one dramatic interruption, the
[editorial cadence](pattern.editorial-cadence) that paces every surface as numbered
chapters on one four-column backbone, and the [player chrome](pattern.player-chrome) that
dresses motion footage in the same machined hairline-and-mono vocabulary with
zero third-party player branding. Every
generated surface — a launch, a spec story, a catalog, a directory, or a lineup —
is cut from these same building blocks rather than a fixed template, composing the
material for its own job.

## Composition

Seven principles carry the language and are true on every surface:

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

**Cutting a surface from the same parts.** Redline Cinema has no fixed page
types — every surface is edited for its task from the same machined kit of parts,
in the same cinematic reading order. Open on the [cinematic image
system](pattern.cinematic-image) so one full-bleed frame carries the emotion before any
copy; spend the [scarce-red CTA and control system](pattern.controls) on the single
decisive action per region and hold everything else near-black, white, and grey;
let raw figures become proof through the [large-number spec system](pattern.spec-system);
build presence from the [dark elevated plate and hairline depth
system](principle.depth) rather than shadow; and reserve the [single red livery
band](pattern.livery-band) for the one moment that must seize the full width. Let the task
set the shape, not a template: when a surface reveals one thing, cinema leads and
the page tightens after the hero into editorial body with large brightness-paced
breaks; when it proves capability, numbers are the subject and comparisons keep
the same labels parallel across every option so the reader weighs like against
like, with `--redline-voltage` on the one decisive value; when it lists and
transacts, drop to a white sheet for dense relief but keep the hairlines, uppercase
labels, and square geometry continuous with the dark framing; when it routes to
places or people, group compact hairline rows by region, service, or tier with one
squared action each and let the dark masthead carry the drama; when it invites
browsing, delay dense filters behind an image-led gallery of square category
plates. If a task fits none of these, edit a new surface from the same parts under
the same rules — never collapse to a generic layout — compose from the same parts.

**Surface obligations (true everywhere).** Generated surfaces preserve the
luxury-performance composition language without reusing actual source names,
logos, marks, model names, slogans, proprietary images, or licensed font names;
name the generated product, event, category, or task from the user's prompt,
using generic labels such as performance marque, private collection, track
session, studio archive, or service directory. The first major region
establishes cinematic atmosphere and a concise editorial claim — eyebrow,
headline, one deck, at most two actions — before dense detail. Oversized numerals
must carry meaningful performance, ranking, event, availability, or comparison
information, each with a label and unit and aligned with comparable metrics. Red
highlights are limited to the primary action or the one value/state the user must
notice first — one red focal role per region. Listings, forms, and tables stay
dense enough to act while remaining visually connected to the cinematic editorial
frame: white sheets only for transactional regions, uppercase labels,
hairline-separated rows, and a return to dark framing for transitions, CTA bands,
and footers.
