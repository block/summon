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

## Inventory

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
}
```

Buttons are beveled chrome chips: amber rectangles for tools and utilities,
signal-orange fills or arrow discs for submit and forward, carbon slabs for
side-rail commands. Inputs are white inset fields with hard borders and
native-select geometry. Body copy stays small, plain, and subordinate to the
panel chrome; controls, labels, and metadata are bold uppercase Arial.

The shared material every surface draws on lives in the root nodes that reach
everywhere: the [command and navigation system](command-nav) that frames the
top of every faceplate, the [beveled plate and chrome system](plates) that gives
the chassis its molded depth and texture, the [control system](controls) for
amber and orange buttons and inset inputs, and the
[badge and section-label system](badges) that labels every dense module. The
surfaces — [launch](launch), [dashboard](dashboard), [directory](directory), and
[utility](utility) — compose this material for their own job.

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
   historical site. Public research informs composition, never permission to reuse
   protected characters or wordmarks.

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
rather than traced from historical screenshots.
