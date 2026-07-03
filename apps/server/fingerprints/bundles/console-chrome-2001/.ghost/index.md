---
description: Console Chrome 2001 core — a retro Y2K game-console web language of periwinkle beveled plates, carbon command bars, amber/orange wayfinding, dense fixed-canvas modules, outlined box-art display type, and halftone hardware texture.
---

## Intent

Console Chrome 2001 makes a surface feel physically assembled from game
hardware: cool periwinkle molded plates, carbon command slabs, inset content
modules, hard indigo bevel seams, and a visible chassis. It turns dashboards,
launch pages, directories, and playful utility surfaces into a compact machine
faceplate rather than a modern SaaS page. The voice is playful, hardware-like,
compact, arcade, directional, early-web, and toyetic — dense and tactile without
losing legibility.

It serves people asking for retro game-console dashboards, launch pages,
directories, or playful utility surfaces; users who want early-2000s web
density, tactile chrome, and game-box energy without copying a protected brand;
and agents composing generated surfaces that should feel like a compact machine
faceplate rather than modern SaaS.

**Stance — what this is not:** no literal brand reproduction — no real
game-company wordmarks, mascot or character imagery, real console product names,
rating-authority marks, exact navigation labels, copied screenshots, or source
copy unless the user supplies it as content to transform. No modern airy SaaS
pages, glassmorphism, soft gradient dashboards, material shadows, or uniformly
rounded card grids. No pastel nostalgia without hardware structure — the
signature is machined chrome, not soft retro color alone. No warm accent color
used decoratively; amber and orange must mean tool, nav, badge, commit, or
forward motion. No responsive-first spacious layouts that erase the desktop-era
fixed-canvas density, and no pixel-art-only retro styling without molded console
chrome, command slabs, dense modules, or warm action semantics.

**Tradeoffs:** prefer dense useful modules over luxurious whitespace while
preserving enough seams and labels to scan; hard bevels, chamfered corners,
texture, and pictorial hero fields over blurred shadows for depth; one
brand-neutral mascot or playful signoff moment over pervasive character
decoration. Modern ports may stack columns on narrow screens, but should
preserve the faceplate metaphor and command hierarchy.

## Signature look & feel

If you stripped every label off a Console Chrome 2001 surface and left only the
shapes, you would still know it by these moves — they belong to this language and
no other in the catalog:

- **Hard pixel bevels with no blur.** Every plate, chip, and slab wears a
  one-pixel light edge top-left and a chrome-indigo dark edge bottom-right via
  `--chrome-bevel-hard` (and `--chrome-bevel-deep` for hero plates). The depth is
  machined, not blurred — there is never a soft material drop shadow, only the
  crisp two-tone seam that makes a module look injection-molded into the chassis.
- **Beveled periwinkle faceplates.** Major regions are molded plates, not floating
  cards: `--chrome-faceplate` lays a cool periwinkle top-to-bottom mold and
  `--chrome-faceplate-rim` rings it with a hard machined edge so the whole surface
  reads as a console body with content bolted in.
- **Halftone carbon command slabs.** Nav bars, rails, and footers are dark carbon
  dusted with the fine dot-matrix grain of `--chrome-halftone-carbon` — a Y2K
  injection-texture you feel before you read, with `--chrome-halftone-dot` available
  to stipple lighter plates. Flat solid-black bars are the tell of a counterfeit.
- **Rationed amber/orange wayfinding LEDs.** Warmth is never decoration — it is a
  lit signal. `--chrome-led-glow` and `--chrome-led-amber` ring forward, submit,
  open, and launch cues, while `--chrome-led-pip` is the molded amber bead on
  tools, tabs, and Go buttons. Everything steady-state stays cool; the warm color
  is the eye's wayfinding beacon.
- **Dotted silkscreen dividers.** Modules and rows are separated by the stitched
  dot seam of `--chrome-divider-dotted` (and its vertical twin
  `--chrome-divider-dotted-v`), like legend printing on a controller — never a
  plain hairline rule, never luxury whitespace doing the dividing.
- **Chrome inset inputs.** Fields are pressed into the faceplate with
  `--chrome-inset-input`: a recessed white well with a hard pressed-in rim and
  native-select geometry, so every input looks like a recessed slot in the machine
  rather than an outlined modern textbox.
- **Box-art hero on a dense, dual-command chassis.** An outlined heavy box-art
  wordmark with a hard offset shadow anchors a top carbon command bar plus a pale
  secondary command row, all packed at desktop-era density inside the fixed canvas
  — often topped by a brand-neutral mascot speech-bubble masthead.

What holds the identity: hard zero-blur bevels, halftone carbon, rationed warm
LEDs, dotted seams, and dense faceplate density assembled into one bounded
chassis. What collapses it into generic flat SaaS: soft blurred shadows, airy
whitespace, decorative warm color, uniform rounded cards, and a single roomy
column floating on a flat gradient.

## Inventory

**Design lineage.** Console Chrome 2001 descends from the early-2000s / Y2K
operating-system and hardware-chrome tradition — the beveled skeuomorphism of the
Windows XP "Luna" era, the glossy-but-machined Frutiger Aero moment, game-console
faceplate industrial design, and the dense early-web portal. It is the same
vocabulary that modern CSS revival libraries (XP.css, 98.css, 7.css) re-encode:
hard pixel bevels, dot-matrix halftone, silkscreen legends, and injection-molded
plastic plates. We inherit the *conventions* of that era — the two-tone raised
edge, the pressed-in well, the printed-on label — not any vendor's chrome or brand
assets; the periwinkle-and-carbon palette, rationed amber wayfinding, and box-art
display type are this fingerprint's own dialect of that shared machine grammar.

The material is a cool molded-plastic console token system: a neutral desktop-era
browser background outside a central periwinkle chassis, white and platinum
content plates, pale-sky secondary strips, carbon command slabs, and hard
chrome-indigo bevel edges. Warm color is rationed wayfinding — signal orange for
forward, submit, open, launch, and arrow cues; amber for tools, badges, tabs, and
search Go buttons; deeper nav gold for primary command words on carbon. Brand red
is a sparse identity or error mark, never a page fill. Type is web-safe Arial with
small uppercase silkscreen labels, heavy outlined box-art display for hero
wordmarks, and optional pixel micro-text for captions and machine legends.
Spacing is a compact 2–16px control rhythm with 16–48px seams between modules.
Geometry is sharp or chamfered by default; true roundness is reserved for physical
controls — logo pills, radio dots, and arrow discs. Depth is hard Y2K bevels,
rings, and offset shadows, never blurred material elevation.

The literal token vocabulary (inject as the visual source of truth; reference
these custom properties rather than inventing values):

```css
:root {
  color-scheme: light;

  /* Console Chrome 2001: cool molded-plastic chassis with rationed warm directional signal. */
  --color-bg: #d7d7d7;
  --color-surface: #ffffff;
  --color-surface-muted: #dedede;
  --color-surface-soft: #9fbee7;
  --color-canvas: #7a8aba;
  --color-canvas-raised: #8ba1d4;
  --color-canvas-lavender: #acace7;
  --color-canvas-ice: #c0d5e6;
  --color-command: #21242e;
  --color-command-soft: #303645;
  --color-border: #5a5f8c;
  --color-border-strong: #3d4f97;
  --color-highlight: #c7d6f5;
  --color-text: #21242e;
  --color-text-muted: #3d4f97;
  --color-text-alt: #ffffff;
  --color-accent: #f68d1f;
  --color-accent-fg: #ffffff;
  --color-accent-utility: #ecab37;
  --color-accent-nav: #e48600;
  --color-brand-red: #e60012;
  --color-systems-teal: #206479;
  --color-games-red: #a7282b;
  --color-danger: #e60012;
  --color-success: #206479;
  --color-info: #3d4f97;
  --color-warning: #ecab37;

  /* Compact desktop-era rhythm: whitespace is a seam between plates, not luxury air. */
  --space-1: 2px;
  --space-2: 4px;
  --space-3: 8px;
  --space-4: 12px;
  --space-5: 16px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 48px;
  --space-9: 64px;
  --space-10: 88px;

  /* Sharp/chamfered by default; full roundness is reserved for physical controls. */
  --radius-pill: 9999px;
  --radius-none: 0px;
  --radius-xs: 2px;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 10px;
  --radius-xl: 14px;

  /* Web-safe early-2000s type. Display imitates box-art wordmarks through weight, stroke, and hard shadow. */
  --font-sans: Arial, Helvetica, ui-sans-serif, system-ui, sans-serif;
  --font-display: "Arial Black", Impact, "Archivo Black", Arial, Helvetica, sans-serif;
  --font-mono: "Silkscreen", "VT323", "Courier New", ui-monospace, monospace;
  --font-serif: Arial, Helvetica, ui-sans-serif, system-ui, sans-serif;
  --text-xs: 10px;
  --text-sm: 11px;
  --text-md: 12px;
  --text-lg: 15px;
  --text-xl: 22px;
  --text-2xl: 32px;
  --text-3xl: 44px;
  --text-display: clamp(38px, 6.2vw, 58px);
  --tracking-label: 0.045em;
  --tracking-tight: 0em;
  --tracking-display: -0.015em;
  --leading-display: 0.95;
  --leading-section: 1.1;
  --leading-body: 1.4;
  --leading-reading: 1.5;

  /* Hard Y2K depth: bevels, rings, and offset shadows instead of blurred material elevation. */
  --shadow-mini: inset 0 1px 0 rgba(255,255,255,0.65), inset 0 -1px 0 #3d4f97;
  --shadow-card: inset 0 1px 0 rgba(255,255,255,0.75), inset 0 -2px 0 #3d4f97, 0 1px 0 rgba(33,36,46,0.45);
  --shadow-elevated: inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -3px 0 #3d4f97, 0 2px 0 rgba(33,36,46,0.45);
  --shadow-popover: 4px 4px 0 rgba(33,36,46,0.45), inset 0 1px 0 rgba(255,255,255,0.72);
  --shadow-modal: 6px 6px 0 rgba(33,36,46,0.50), inset 0 1px 0 rgba(255,255,255,0.72);

  /* SIGNATURE — the moves that belong to Console Chrome 2001 alone. Reference these, do not reinvent them. */

  /* Hard pixel bevel: bright light edge top-left, chrome-indigo dark edge bottom-right, ZERO blur. */
  --chrome-bevel-hard: inset 1px 1px 0 rgba(255,255,255,0.85), inset -2px -2px 0 #3d4f97;
  --chrome-bevel-deep: inset 2px 2px 0 rgba(255,255,255,0.9), inset -3px -3px 0 #2a3877, 1px 1px 0 rgba(33,36,46,0.5);
  --chrome-bevel-light-edge: #ffffff;
  --chrome-bevel-dark-edge: #3d4f97;

  /* Beveled chrome faceplate: molded periwinkle plate with a hard machined rim. */
  --chrome-faceplate: linear-gradient(180deg, #8ba1d4 0%, #7a8aba 100%);
  --chrome-faceplate-rim: inset 1px 1px 0 rgba(255,255,255,0.8), inset -2px -2px 0 #3d4f97, 0 1px 0 rgba(33,36,46,0.45);

  /* Halftone / dotted carbon texture: a fine dot-matrix grain over the command slabs. */
  --chrome-halftone-carbon: radial-gradient(circle at center, rgba(255,255,255,0.07) 0.5px, transparent 0.5px) 0 0 / 4px 4px, #21242e;
  --chrome-halftone-dot: radial-gradient(circle at center, rgba(33,36,46,0.18) 0.5px, transparent 0.5px) 0 0 / 3px 3px;

  /* Amber/orange wayfinding LED: a rationed warm glow that means tool, nav, or forward. */
  --chrome-led-amber: 0 0 0 1px #e48600, inset 0 1px 0 rgba(255,255,255,0.55);
  --chrome-led-glow: 0 0 6px rgba(246,141,31,0.65), 0 0 0 1px #f68d1f;
  --chrome-led-pip: radial-gradient(circle at 35% 30%, #ffd089 0%, #f68d1f 55%, #c96a00 100%);

  /* Dotted dividers: silkscreened seams between dense modules and rows. */
  --chrome-divider-dotted: repeating-linear-gradient(90deg, #5a5f8c 0 2px, transparent 2px 5px);
  --chrome-divider-dotted-v: repeating-linear-gradient(180deg, #5a5f8c 0 2px, transparent 2px 5px);

  /* Chrome inset input: recessed white field with a hard pressed-in rim. */
  --chrome-inset-input: inset 1px 1px 0 #9aa0c4, inset -1px -1px 0 #ffffff, inset 0 0 0 1px #5a5f8c;

  /* INTERACTION STATES — hard-edged, machined, zero-blur. Depth is bevels and halftone, never soft glow.
     Warmth here still MEANS action/nav/tool; it never softens into decorative color. */

  /* Focus: a hard pressed pixel ring, not a soft halo — a stamped indigo outline
     doubled with a white keyline so it reads on both carbon and periwinkle. */
  --chrome-focus-ring: 0 0 0 1px #ffffff, 0 0 0 3px #3d4f97;
  --chrome-focus-ring-warm: 0 0 0 1px #ffffff, 0 0 0 3px #e48600; /* focus on a lit action/nav control */
  --chrome-focus-outline: 2px dotted #3d4f97; /* silkscreen dotted ring for links and text targets */

  /* Pressed/active: the bevel INVERTS — light edge drops to bottom-right, dark edge
     climbs to top-left, so a control physically sinks into the chassis when clicked. */
  --chrome-bevel-pressed: inset -1px -1px 0 rgba(255,255,255,0.85), inset 2px 2px 0 #3d4f97;
  --chrome-bevel-pressed-deep: inset -2px -2px 0 rgba(255,255,255,0.9), inset 3px 3px 0 #2a3877;
  --chrome-press-offset: 1px; /* nudge label down/right by this to sell the mechanical push */

  /* Hover: light the molded amber bead without moving the plate — a lit LED pip,
     reserved for action/nav/tool controls, never a decorative warm wash on surfaces. */
  --chrome-hover-pip: 0 0 0 1px #ecab37, inset 0 1px 0 rgba(255,255,255,0.6);
  --chrome-hover-plate: #e8ecf9; /* faint cool lift for a hovered periwinkle plate — stays cool, no warmth */

  /* Disabled: a greyed dead plate — flattened bevel, drained warmth, no lit signal. */
  --chrome-disabled-plate: #c4c4cc;
  --chrome-disabled-text: #8b8ba0;
  --chrome-disabled-bevel: inset 1px 1px 0 rgba(255,255,255,0.4), inset -1px -1px 0 #9a9ab0;

  /* Mechanical, not smooth — state changes snap or step, they never ease-glide. */
  --chrome-motion-instant: 0ms; /* default: bevels flip with no transition */
  --chrome-motion-click: 60ms steps(2, end); /* stepped press feedback, arcade-quick */

  /* SCREEN LOGIC — console menus change screens, they never glide-scroll.
     Discrete swaps, a hardware selection cursor, and slot/readout wells,
     all derived from the existing chassis palette and bevel grammar. */
  --chrome-screen-swap: 120ms steps(3, end); /* hard stepped cut between screens, kin of --chrome-motion-click */
  --chrome-screen-shutter: #21242e; /* carbon blackout plate that covers a screen mid-swap */
  --chrome-cursor-frame: 0 0 0 1px #ffffff, 0 0 0 3px #e48600, inset 0 1px 0 rgba(255,255,255,0.55); /* hardware selection cursor — amber means nav */
  --chrome-slot-well: inset 2px 2px 0 #9aa0c4, inset -2px -2px 0 #ffffff, inset 0 0 0 1px #5a5f8c; /* deep card-slot recess, deeper kin of --chrome-inset-input */
  --chrome-readout-text: #206479; /* cool systems-teal readout numerals on inset status wells */
}
```

Buttons are beveled chrome chips riding `--chrome-bevel-hard`: amber rectangles
for tools and utilities, signal-orange fills or arrow discs for submit and
forward, carbon slabs for side-rail commands. Inputs are white inset fields
pressed in with `--chrome-inset-input`, hard borders, and native-select geometry.
Panels are molded periwinkle faceplates with a `--chrome-faceplate-rim`; rows are
platinum strips parted by `--chrome-divider-dotted`; chips and tabs carry a
`--chrome-led-pip` amber bead; tables are inset wells with dotted seams between
lines rather than luxury whitespace. Body copy stays small, plain, and
subordinate to the panel chrome; controls, labels, and metadata are bold
uppercase Arial silkscreen legends.

Interaction states are mechanical, not animated fades. **Hover** lights the
molded bead with `--chrome-hover-pip` (or lifts a cool plate to
`--chrome-hover-plate`) — warmth appears only on an action, nav, or tool control,
never as decoration on a resting surface. **Focus** stamps a hard pressed pixel
ring: `--chrome-focus-ring` (indigo doubled with a white keyline) on cool
controls, `--chrome-focus-ring-warm` on lit action/nav chips, and the dotted
`--chrome-focus-outline` on links and text targets — always a crisp zero-blur
outline, never a soft glow halo. **Active/pressed** inverts the bevel with
`--chrome-bevel-pressed` (`--chrome-bevel-pressed-deep` on hero plates) and nudges
the label by `--chrome-press-offset`, so the control physically sinks into the
chassis; any transition uses `--chrome-motion-click` (stepped, arcade-quick) or
`--chrome-motion-instant`, never a smooth ease. **Disabled** drops to a greyed
dead plate — `--chrome-disabled-plate` behind `--chrome-disabled-text`, the seam
flattened to `--chrome-disabled-bevel`, all warm signal drained. **Selected**
holds a lit amber pip or an inverted-bevel pressed state; **loading** and **empty**
stay in cool chrome with a section-label bar so no module reads as a blank island;
**error** is the sparse `--color-brand-red` identity mark, never a page fill.

Density is desktop-era and fixed-canvas: modules pack onto the faceplate at the
compact 2–16px control rhythm with 16–48px seams, and narrow screens stack the
plates inside one bounded machine frame rather than dissolving into airy columns.
Accessibility intent: routine controls stay at 11–12px (`--text-sm`/`--text-md`)
or larger with 10px reserved for micro captions; focus is always visible through
the hard ring or dotted outline; carbon slabs pair `--color-text-alt` on
`--color-command` and periwinkle plates pair `--color-text` on light plates for
legible contrast; and touch surfaces get enlarged invisible padding around the
compact chrome so the dense faceplate stays operable.

The shared material every surface draws on lives in the root nodes that reach
everywhere: the [command and navigation system](command-nav) that frames the
top of every faceplate, the [beveled plate and chrome system](plates) that gives
the chassis its molded depth and texture, the [control system](controls) for
amber and orange buttons and inset inputs, and the
[badge and section-label system](badges) that labels every dense module, with
the [hardware dressing system](hardware-dressing) supplying bezel framing,
lo-fi image artifacts, the single page-level texture pass, and numbered
scene sequencing, and the [screen logic system](screen-logic) governing how the
machine acknowledges input, swaps between screens, and reports its own state.
Surfaces — launch pages, dashboards, directories, and playful utility screens —
compose these building blocks for their own job.

## Composition

Six principles carry the language and are true on every surface:

1. **A surface is an assembled console faceplate.** Treat the root shell as a
   molded plastic console faceplate, not a neutral webpage background. Build major
   regions from periwinkle, pale-sky, platinum, and white plates with hard indigo
   bevel edges; use chamfered or sharp outer geometry for large modules and
   reserve true roundness for controls and brand-neutral pills. Panel headers,
   rails, and seams make content feel bolted into the chassis — never floating
   white cards on a flat gradient.
2. **Warmth means direction.** Warm color is rationed wayfinding. Use signal
   orange for forward arrows, submit buttons, advance chips, and commit actions;
   amber for tools, badges, tabs, search Go buttons, and small utility
   affordances. Keep steady-state surfaces in cool periwinkle, pale sky, platinum,
   white, and carbon. Brand red is a sparse identity or error accent, not a page
   fill. No orange section backgrounds with no action role and no rainbow category
   systems that weaken the chrome-and-command palette.
3. **Bevels are depth.** Depth comes from hard bevel simulation, halftone command
   texture, inset fields, and pictorial hero layers — never blurred elevation.
   Give plates a bright top/left edge and a chrome-indigo bottom/right shadow line;
   use carbon command slabs with subtle dot-matrix texture for nav, rails, and
   footers; use inset white or platinum fields for rows, inputs, calendars, and
   forms; use hard offset text shadows for display wordmarks. No material card
   shadows, frosted glass, or neon cyberpunk glow.
4. **Small labels carry structure.** Small uppercase Arial labels act like
   silkscreened controller legends and carry the interface structure. Set section
   titles, buttons, tabs, nav, labels, metadata, and row actions in bold
   Arial-like uppercase with slight tracking; keep body copy small, plain, and
   subordinate to panel chrome. Reserve pixel-like micro text for captions, folios,
   and machine details, and outlined heavy display type for hero names and
   scoreboard titles — never for routine controls.
5. **Density is control-panel texture.** The compact fixed-canvas density is part
   of the aesthetic; modules should feel like controls packed onto a faceplate.
   Use a narrow desktop-era max width or an explicitly framed central chassis even
   on wide screens; combine hero, lists, thumbnail grids, search, forms, polls,
   badges, and rails when the request supports multiple affordances; use 2–16px
   internal rhythms for chrome details and 16–24px seams between modules. Let
   labels and bevels prevent clutter — do not create luxury whitespace to solve
   hierarchy.
6. **Source-agnostic playfulness.** The surface can be character-led and game-like,
   but generated output must remain source-agnostic unless the user's task supplies
   specific IP. Use generic mascots, speech bubbles, hardware metaphors, cartridges,
   controllers, stars, arrows, or circuitry as abstract motifs; rename nav, badges,
   product panels, and hero copy to match the user's prompt rather than any
   older site. Public research informs composition, never permission to reuse
   protected characters or wordmarks.

**Bolting a faceplate from the parts.** Console Chrome 2001 has no fixed page
types — every surface is a faceplate assembled for its task from the same small
kit, bolted together in the same order. Frame the top of the chassis with the
[command and navigation system](command-nav) — a carbon dual-command bar over a
pale secondary tool strip parted by `--chrome-divider-dotted`; mold the body and
its box-art hero from the [beveled plate and chrome system](plates) so the first
impression is a composed faceplate riding a hard `--chrome-bevel-hard` seam,
never a floating card; wire every interactive move through the
[control system](controls) with signal-orange forward LEDs and amber utility
chips; and cap each dense module with the [badge and section-label
system](badges) so no plate reads as an unlabeled island. Let the task set the
shape, not a template: when it announces one thing, spend the box-art hero plate
and a single signal-orange forward disc lit by `--chrome-led-glow`, then tighten
into supporting modules so the page never reads as empty marketing air; when it
scans many updates, stack compact platinum rows parted by
`--chrome-divider-dotted` with trailing orange chevron chips, each bolted in on
`--chrome-bevel-hard` — never four equal cards where rows belong; when it helps
find one item in a collection, make the amber tool-chip search cluster (a
`--chrome-inset-input` well, a native select, a `--chrome-led-pip` Go chip) the
primary way in and grid the results as tight beveled thumbnail tiles; when it
enters or submits, press fields into platinum panels with `--chrome-inset-input`
under section-label bars and mark the one commit in signal orange, support cool.
Hold the fixed-canvas density and keep warmth meaning direction; if no task
matches these shapes, never collapse to a generic layout — compose from the same
parts.

**The universal shell.** Every Console Chrome surface is built inside one fixed
console shell: a central fixed-canvas chassis (~780–900px when the viewport
allows, or an explicitly bounded max-width shell on modern screens) — grey
browser field outside, periwinkle molded body inside, chamfered outer corners,
hard indigo lower edge, and dense modules bolted into the faceplate rather than
floating independently. Narrow or mobile surfaces stack command bars, hero
plates, rows, forms, and rail modules inside one bounded machine frame rather
than forcing a desktop clone, compressing dual nav into a carbon command header
plus a pale secondary row while keeping orange forward cues and amber utility
chips visible.

**Surface obligations (true everywhere).** The first visible impression must be a
composed console faceplate — an outer chassis, bevels, a command layer, and plate
seams — with at least one signature hardware motif (halftone command slab,
chamfered panel, outlined box-art title, side rail, or orange arrow controls),
never unframed generic header-card layouts. Forward, submit, continue, open, and
launch actions must read as signal orange while amber stays reserved for utility
and badge-like tools; orange must never be passive decoration. Dense modules must
still reveal what can be clicked, searched, read, or advanced at a glance — pair
rows with compact labels, icons, or trailing arrow chips, and give every list,
poll, form, and promo a visible section-label job. Controls may feel desktop-era
compact but must stay usable: routine controls at 11–12px or larger, 10px only
for micro captions, with visible focus outlines or dotted rings and enlarged
invisible padding when touch use is likely. Generated surfaces must stay
source-agnostic — generic product naming from the user's prompt, original or
abstract mascot and hardware motifs, and new layouts generated from the patterns
rather than traced from older screenshots.
