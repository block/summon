---
description: The command and navigation system — the carbon dual-command bar, side-mounted vertical tabs with amber wayfinding LEDs, right action rail, and beveled chrome footer slab that frame every faceplate, including how the dual bars compress on narrow/mobile screens. Reach for this when a surface needs hardware-style navigation, command bars, rails that bracket the chassis, or responsive nav compression.
---

## Composition

Navigation in Console Chrome reads as hardware command surfaces clipped into the
chassis, not as a clean modern top nav. Carbon is for controls and system
framing, not every content panel.

**Dual command navigation.** A carbon primary command bar dusted with
`--chrome-halftone-carbon` carries nav-gold uppercase Arial Bold words and rides on
the hard `--chrome-bevel-hard` seam where it clips into the chassis; below it a
quieter pale-sky secondary strip carries amber tool chips for search, finder,
code, filter, or go utilities, each beading a `--chrome-led-pip` to mark its
go-utility role. The two bars are parted by `--chrome-divider-dotted` rather than
a plain rule. No clean modern top nav with large spacing and no texture. On
narrow surfaces the dual nav compresses into a carbon command header plus a pale
secondary row while keeping orange forward cues and amber utility chips visible.

**Right action rail.** A narrow right rail stacks carbon action slabs above a
white explainer box, amber tab, poll, promo plate, calendar, or compact form,
making secondary actions feel like console-side controls. On mobile it moves
below primary content but keeps the command-slab styling.

**Side-mounted vertical tabs.** Optional left-edge vertical carbon tabs clip into
the chassis as rotated or stacked labels for rankings, archives, categories, or
ratings — secondary navigation or status, never primary reading content.

**Navigation changes screens, not scroll position.** Command words, tabs, and
rail actions behave like a console menu: choosing one swaps the view in place —
old screen out, new screen in on the stepped `--chrome-screen-swap` cut — rather
than smooth-scrolling to an anchor or sliding a drawer. The active command word
or tab holds a pressed `--chrome-bevel-pressed` state or lit amber pip so the
current screen is always readable off the chrome itself, like a mode LED on the
faceplate; there is never ambiguity about which screen the machine is on. The
discrete-swap grammar and its hardware cursor are specified in the [screen
logic system](pattern.screen-logic).

**Chrome footer slab.** The page closes with a carbon footer slab textured by
`--chrome-halftone-carbon` and nested inside the chassis, carrying micro
practical copy, status marks, and the hard chamfered edges of `--chrome-bevel-hard`,
its rows parted by `--chrome-divider-dotted` — not a spacious modern multi-column
footer.

The command bar's halftone carbon texture and the rail's action slabs are part of
the [beveled plate and chrome system](pattern.plates); the nav words, tool chips, and
rail buttons follow the [control system](pattern.controls) for their amber/orange/carbon
semantics.

**Bound:** the two-layer order (carbon primary over pale secondary), the
halftone carbon fill, the `--chrome-bevel-hard` seam where bars clip into the
chassis, nav-gold command words on carbon, amber pip-beaded tool chips, the
dotted seam between bars, and the carbon footer slab close. **Open:** the
number of command words and tool chips, the presence of a right action rail or
side-mounted vertical tabs, whether the wordmark sits in the bar or a masthead
above, and how the two bars compress on narrow screens (carbon header + pale
row, warm cues kept visible).

Related: reinforces `pattern.plates`, `pattern.controls`.

## Skeleton

```html
<header class="chrome-command-layer">
  <!-- Primary carbon command bar: halftone grain, bolted onto the chassis seam -->
  <nav class="chrome-command-bar"
       style="background:var(--chrome-halftone-carbon); box-shadow:var(--chrome-bevel-hard);">
    <span class="chrome-wordmark"><!-- outlined box-art site name --></span>
    <a class="chrome-command-word" style="color:var(--color-accent-nav);"><!-- PRIMARY --></a>
    <a class="chrome-command-word" style="color:var(--color-accent-nav);"><!-- COMMAND --></a>
    <a class="chrome-command-word chrome-command-word--quiet"><!-- SECONDARY --></a>
  </nav>

  <!-- Dotted silkscreen seam parting the two bars -->
  <div class="chrome-seam" style="background:var(--chrome-divider-dotted); height:3px;"></div>

  <!-- Pale secondary tool strip: amber utility chips with molded pips -->
  <nav class="chrome-tool-strip"
       style="background:var(--color-surface-soft); box-shadow:var(--chrome-bevel-hard);">
    <button class="chrome-tool-chip"
            style="background:var(--color-accent-utility); box-shadow:var(--chrome-led-amber);">
      <i class="chrome-pip" style="background:var(--chrome-led-pip);"></i><!-- TOOL -->
    </button>
    <!-- search / finder / filter / go chips repeat here -->
  </nav>
</header>

<!-- ... faceplate body ... -->

<footer class="chrome-footer-slab"
        style="background:var(--chrome-halftone-carbon); box-shadow:var(--chrome-bevel-hard);">
  <!-- micro practical copy + status marks, rows parted by var(--chrome-divider-dotted) -->
</footer>
```
