---
description: The hardware dressing system — screen-in-bezel module framing, one lo-fi pixelated/halftone artifact grammar for imagery, a single page-level texture pass, diegetic silkscreen easter-egg labels, re-skinned early-web furniture, and numbered section-as-scene sequencing. Reach for this when a surface needs its imagery, texture, and set dressing to sell the physical machine.
relates:
  - to: plates
    as: reinforces
  - to: badges
    as: reinforces
  - to: command-nav
    as: reinforces
---

## Composition

Hardware dressing is the set decoration of the chassis: the moves that make a
faceplate read as a manufactured object with a screen, a molding date, and a
service saved — not a webpage wearing retro colors. Every dressing move stays
machined and flat two-tone; nothing here licenses glossy skeuomorphism.

**Screen-in-bezel module framing.** One or two anchor modules — the hero plate, a
live preview, a featured media well — may be framed as a drawn hardware bezel: a
thick molded surround built from `--chrome-bezel-frame` with the flat two-tone
seam of `--chrome-bevel-deep` on the outer lip and `--chrome-inset-input`
pressing the inner screen well into the plate, the screen itself sitting on
`--chrome-bezel-screen`. The bezel is flat periwinkle plastic with hard edges —
never glossy highlights, reflections, curved-glass gradients, or photoreal
skeuomorphism. Ration it: a bezel marks the one or two modules that ARE the
machine's display; if every module wears a bezel, none reads as the screen.

**One lo-fi artifact grammar on imagery.** Photographic and illustrative imagery
is deliberately degraded with ONE artifact treatment held consistent across the
whole surface: either `image-rendering: pixelated` on upscaled low-res sources,
or a halftone/dither overlay laid with `--chrome-artifact-dither`. Pick one
grammar per surface and keep it everywhere — a page that mixes crisp photos,
pixelated thumbnails, and dithered heroes reads as accident, not era. Crisp
untreated imagery is the tell of a counterfeit; so is stacking multiple artifact
styles on one image.

**One global texture pass.** The surface carries a single shared texture layer at
page level — `--chrome-texture-pass`, a faint halftone/noise film fixed over the
chassis — so every plate appears molded from the same batch of plastic. Never
apply per-card or per-module textures: a "sticker sheet" of individually
textured panels breaks the injection-molded illusion. The existing
`--chrome-halftone-carbon` and `--chrome-halftone-dot` grains on slabs and plates
sit UNDER this pass; the pass unifies, it does not replace them.

**Diegetic easter-egg labeling.** Chrome zones — bezels, command slabs, footers,
plate rims — may carry small silkscreen legends set in `--font-mono` micro text
via `--chrome-etch-label`: fake model numbers (CC-2001A), serial strings, port
labels (AV OUT · EXT.2), a PAL/NTSC region badge stamped with the
`--chrome-bevel-hard` seam. These are plausible hardware vernacular, in-world and
deadpan — never meta-jokes, real product names, or regulatory marks, and never
printed over content wells where they would compete with copy. They live only on
chrome, like text molded into the casing.

**Revived early-web furniture, re-skinned.** At most one piece of early-web
furniture per surface, rebuilt in chrome rather than pasted in as kitsch: a
guestbook block as an inset platinum form under a section-label bar, a hit
counter as odometer digits in a `--chrome-inset-input` well with `--font-mono`
numerals, or a static one-line ticker strip on a carbon slab. It must be bolted
in with `--chrome-bevel-hard` and earn a [section-label](badges) like any module
— one per surface, functional in tone, never a pile of animated GIF-era clutter.

**Period-correct texture discipline.** Every texture on the chassis must be one
a 2001-era pipeline could have produced: dot-matrix halftone, silkscreen dots,
hard dither, flat two-tone plastic. Nothing softer sneaks in under the cover of
"texture" — no film grain washes, no chromatic aberration, no bloom, no CRT
glow, no photoreal noise. Those are modern post-processing vocabulary; this
machine's grain is printed, not rendered. The single `--chrome-texture-pass`
plus the slab and plate halftones are the complete texture budget.

**Section-as-scene sequencing.** Long surfaces sequence as numbered "screens":
fixed-height typed modules labeled 01 / 02 / 03 in `--chrome-scene-number` micro
digits, each separated by a full-width carbon command bar riding
`--chrome-halftone-carbon` — a scene change, not a scroll. Every module declares
its type and height like a screen mode; no fluid ambiguous heights dissolving
into an endless modern scroll. The numbering is wayfinding, so it stays cool
silkscreen — amber and orange still mean tool, nav, or forward, never a scene
index.

```css
:root {
  /* HARDWARE DRESSING — set decoration for the chassis, flat and machined. */

  /* Screen-in-bezel: molded surround + recessed dark screen well, two-tone only. */
  --chrome-bezel-frame: linear-gradient(180deg, #9fb2dd 0%, #7a8aba 100%);
  --chrome-bezel-screen: #21242e;
  --chrome-bezel-lip: inset 2px 2px 0 rgba(255,255,255,0.9), inset -3px -3px 0 #2a3877;

  /* Lo-fi artifact grammar: one treatment per surface, held everywhere. */
  --chrome-artifact-render: pixelated; /* apply as image-rendering on treated imagery */
  --chrome-artifact-dither: radial-gradient(circle at center, rgba(33,36,46,0.22) 0.5px, transparent 0.5px) 0 0 / 3px 3px;

  /* Global texture pass: ONE page-level film, never per-card stickers. */
  --chrome-texture-pass: radial-gradient(circle at center, rgba(33,36,46,0.05) 0.5px, transparent 0.5px) 0 0 / 5px 5px;

  /* Diegetic etch labels: silkscreen legends molded into chrome zones only. */
  --chrome-etch-label-font: "Silkscreen", "VT323", "Courier New", ui-monospace, monospace;
  --chrome-etch-label-size: 10px;
  --chrome-etch-label-color: #3d4f97;
  --chrome-etch-label-tracking: 0.08em;

  /* Scene numbering: cool silkscreen screen indices, never warm. */
  --chrome-scene-number-font: "Silkscreen", "VT323", "Courier New", ui-monospace, monospace;
  --chrome-scene-number-size: 11px;
  --chrome-scene-number-color: #5a5f8c;
  --chrome-scene-bar-height: 24px;
}
```

The bezel frames sit on the molded depth of the [beveled plate and chrome
system](plates); etch labels, region badges, and scene numbers are silkscreen
kin of the [badge and section-label system](badges) but mark the casing, not
content status; and the carbon scene bars that separate numbered screens reuse
the slab grammar of the [command and navigation system](command-nav) without
carrying nav — they are punctuation, not controls.
