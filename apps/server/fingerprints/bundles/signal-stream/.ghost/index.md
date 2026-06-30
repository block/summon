---
description: Signal Stream core — a dark, high-voltage editorial stream language where live feeds, feature digests, reviews, and dense technology briefings read as a paced signal, carried by a warm near-black field, hazard accents, condensed display shout, and mono metadata.
---

## Intent

Signal Stream makes a surface feel like a live signal: a near-black field, sharp
metadata, loud editorial type, and saturated moments of emphasis. It turns feeds,
reviews, launch updates, and comparisons into a paced **stream** rather than a
generic dashboard. The voice is electric, editorial, urgent, sharp, dense, and
confident — technical without becoming chaotic.

It serves readers scanning live updates and high-volume editorial feeds,
operators who need fast hierarchy in dense technology briefings, and agents
composing expressive surfaces that should feel urgent but legible.

**Stance — what this is not:** no light-mode news pages, beige editorial paper,
generic SaaS dashboards, or soft note-card planning. No decorative gradients,
glow, drop-shadow elevation, glassmorphism, or atmospheric blur. No square card
grids where every story has equal weight and no stream rhythm. No pastel accent
washes or chromatic backgrounds that dilute the high-voltage signal. The surface
is **source-informed, never source-branded**: source evidence may shape
composition, but generated surfaces stay neutral and fictionalized — never reuse
a real publisher's name, wordmark, masthead, article titles, author names, or
section labels; abstract them into generic roles (lead stack, latest rail,
segmented stream tabs, section digest, saturated interruption tile).

**Tradeoffs:** prefer vivid hierarchy over calm neutrality on an active feed;
color-as-emphasis over shadow-as-elevation; compact metadata and rail structure
over verbose labels when time, status, sequence, or category matters. Keep
saturated fills sparing and small text on stable contrast pairs.

## Signature look & feel

If you stripped every label off a Signal Stream surface and left only the shapes,
you would still know it by these moves — they belong to this language and no other
in the catalog:

- **The warm near-black field reads as the signal, not the backdrop.** Everything
  floats on `--color-bg` — a near-black that's warm, not blue — where white text
  and muted-gray metadata stay crisp and bright fills become rare interruptions.
  Light comes from saturation, never from a lit-up panel.
- **Acid mint and electric violet behave like hazard markers.** The
  `--signal-hazard-mint` / `--signal-hazard-violet` pairs (each carrying its
  `-fg` text color) are deployed like warning tape, not decoration — mint for the
  one primary action or live tile, violet for secondary emphasis and rails. Two
  voltages, used sparingly, never a pastel wash.
- **A condensed Impact "shout" headline anchors the page.** `--signal-shout-*`
  drives an oversized, uppercase, near-solid-leading (`0.86`) display line that
  shouts against the whispered mono metadata beside it — the shout-versus-whisper
  contrast that no calm feed has.
- **A live signal rail runs down the left edge with recency ticks.** The
  `--signal-rail-*` spine drops markers along its length — mint ticks for the
  stream, a violet tick for the most recent — so order and recency are visible as
  a physical column before a single word is read.
- **Tiles are intentionally FLAT and saturated.** `--signal-tile-shadow: none`
  is a rule, not an omission: `--signal-tile-fill-*` blocks of solid mint, violet,
  or surface get hierarchy from color and a 1px border, never from elevation,
  glow, or glass. Color is the emphasis; shadow is forbidden.
- **Segmented mode tabs switch the stream like a hardware selector.** The
  `--signal-tab-*` group is a hairline-bordered, zero-gap segmented control in
  uppercase mono with a 2px mint underline on the active segment — modes feel
  toggled, not clicked through.
- **Uppercase mono metadata pills carry the orientation.** `--signal-pill-*`
  renders tracked, compact, pill-radius mono chips that hold time, order, state,
  and category — navigation disguised as data, never ornament.

What holds the identity: the warm near-black field, two hazard voltages used
sparingly, the condensed shout, the ticked rail, and flat saturated color doing
the work of elevation. What collapses it into a generic light-mode feed or
glassmorphism: lifting tiles with shadow or blur, washing the field pastel,
softening the shout into a normal headline, or letting the metadata go decorative
instead of navigational.

## Inventory

The material is a dark editorial token system: a warm near-black canvas, white and
muted-gray text, hairline borders, and a hazard-accent palette (acid mint,
electric violet, hot pink, warm orange, signal yellow, electric blue). Three type
roles — a condensed **display shout**, a sans workhorse, and **mono metadata** —
plus a tight spacing ladder, nested pill radii, and intentionally flat shadow
tokens.

The literal token vocabulary (inject as the visual source of truth; reference
these custom properties rather than inventing values):

```css
:root {
  color-scheme: dark;

  --color-bg: #131313;
  --color-surface: #1b1b1b;
  --color-surface-muted: #2d2d2d;
  --color-border: #ffffff;
  --color-border-input: #949494;
  --color-border-strong: #3cffd0;
  --color-text: #ffffff;
  --color-text-muted: #949494;
  --color-text-alt: #000000;
  --color-accent: #3cffd0;
  --color-accent-fg: #000000;
  --color-accent-2: #5200ff;
  --color-accent-2-fg: #ffffff;
  --color-accent-hot: #ff4fd8;
  --color-accent-warm: #ff7a1a;
  --color-accent-yellow: #f7ff2a;
  --color-accent-blue: #3860be;
  --color-link-hover: #3860be;
  --color-danger: #5200ff;
  --color-success: #3cffd0;
  --color-info: #3860be;
  --color-warning: #ff7a1a;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;
  --space-9: 88px;
  --space-10: 120px;

  --radius-pill: 999px;
  --radius-xs: 2px;
  --radius-sm: 3px;
  --radius-md: 4px;
  --radius-lg: 20px;
  --radius-xl: 24px;
  --radius-2xl: 40px;

  --font-display: Impact, Haettenschweiler, "Arial Narrow Bold", "Arial Black", sans-serif;
  --font-sans: "Arial", "Helvetica Neue", Helvetica, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: "SF Mono", "Courier New", Courier, ui-monospace, Menlo, Consolas, monospace;
  --font-serif: Georgia, "Times New Roman", Times, serif;
  --text-xs: 10px;
  --text-sm: 12px;
  --text-md: 15px;
  --text-lg: 20px;
  --text-xl: 24px;
  --text-2xl: 34px;
  --text-3xl: 60px;
  --text-display: clamp(54px, 10vw, 108px);
  --tracking-label: 0.15em;
  --tracking-tight: 0.01em;
  --tracking-display: 0.01em;
  --leading-display: 0.86;
  --leading-section: 1;
  --leading-body: 1.5;
  --leading-reading: 1.62;

  /* Depth is intentionally flat. */
  --shadow-mini: none;
  --shadow-card: none;
  --shadow-elevated: none;
  --shadow-popover: 0 0 0 1px rgba(255, 255, 255, 0.22);
  --shadow-modal: 0 0 0 1px rgba(60, 255, 208, 0.45);

  /* SIGNATURE — the moves that belong to Signal Stream alone.
     Reference these, do not reinvent them. */

  /* Hazard accents — acid mint + electric violet emphasis, with fg pairs. */
  --signal-hazard-mint: #3cffd0;
  --signal-hazard-mint-fg: #000000;
  --signal-hazard-violet: #5200ff;
  --signal-hazard-violet-fg: #ffffff;

  /* Condensed Impact "shout" display treatment — oversized, near-solid line-height. */
  --signal-shout-font: var(--font-display);
  --signal-shout-size: var(--text-display);
  --signal-shout-leading: 0.86;
  --signal-shout-tracking: 0.01em;
  --signal-shout-transform: uppercase;
  --signal-shout-weight: 400;

  /* Signal rail — left-edge spine with recency ticks/markers down its length. */
  --signal-rail-width: 2px;
  --signal-rail-color: var(--color-text-muted);
  --signal-rail-gap: var(--space-4);
  --signal-rail-tick-size: 8px;
  --signal-rail-tick-color: var(--signal-hazard-mint);
  --signal-rail-tick-recent: var(--signal-hazard-violet);
  --signal-rail-tick-spacing: var(--space-5);

  /* Saturated flat tiles — color-as-emphasis, intentionally no shadow/glow. */
  --signal-tile-radius: var(--radius-lg);
  --signal-tile-border: 1px solid var(--color-border);
  --signal-tile-shadow: none;
  --signal-tile-fill-mint: var(--signal-hazard-mint);
  --signal-tile-fill-violet: var(--signal-hazard-violet);
  --signal-tile-fill-flat: var(--color-surface);

  /* Segmented stream-mode tabs — hairline-bordered switch, active mint underline. */
  --signal-tab-gap: 0px;
  --signal-tab-border: 1px solid var(--color-border-input);
  --signal-tab-padding: var(--space-2) var(--space-4);
  --signal-tab-radius: var(--radius-sm);
  --signal-tab-active-underline: 2px solid var(--signal-hazard-mint);
  --signal-tab-font: var(--font-mono);
  --signal-tab-transform: uppercase;
  --signal-tab-tracking: var(--tracking-label);

  /* Uppercase mono metadata pills — tracked, compact, time/order/state carriers. */
  --signal-pill-font: var(--font-mono);
  --signal-pill-size: var(--text-sm);
  --signal-pill-transform: uppercase;
  --signal-pill-tracking: var(--tracking-label);
  --signal-pill-radius: var(--radius-pill);
  --signal-pill-padding: var(--space-1) var(--space-3);
  --signal-pill-border: 1px solid var(--color-border-input);
}
```

Buttons are uppercase mono hazard pills (mint fill, black text, no shadow); inputs
sit on the dark field with a 1px muted border; `strong` emphasis takes the mint
accent. Body is the sans workhorse; controls and metadata are mono.

The shared material every surface draws on lives in the root nodes that reach
everywhere: the [dark canvas and hazard-accent system](canvas) that is the field
and its saturated interruptions, the [display-shout and mono-metadata type
system](type-system) that anchors and navigates the page, the [pill-corner stream
tile system](tiles) that carries repeating units and saturated tiles, and the
[segmented tabs and hazard-pill controls](controls) that switch modes and drive
action. The surfaces — [stream](stream), [digest](digest), and
[briefing](briefing) — compose this material for their own job.

## Composition

Five principles carry the language and are true on every surface:

1. **The dark canvas is the material.** The warm near-black field is the primary
   surface and negative space; bright fills are interruptions, not the default.
   White text, muted-gray metadata, and hairline borders stay crisp against it.
   No light-mode shells unless a single bright tile is deliberately interrupting
   the dark rhythm.
2. **Hazard accents earn attention.** Mint and violet behave like hazard markers
   — they identify the most important action, state, rail, or tile. Acid mint for
   primary CTAs, active underlines, and one high-attention tile; electric violet
   for secondary emphasis, promotional outlines, and rails. Saturated tile colors
   are solid editorial blocks, never gradients or pastel washes. The accent's job
   must be legible: priority, action, state, section, or interruption.
3. **Display shout anchors the page.** One oversized condensed display headline,
   tight line-height, contrasted with compact metadata — a shout-versus-whisper.
   Display scale belongs only to a masthead, lead headline, or major section
   statement; never to buttons, tables, or body. Use `clamp()` so it wraps
   cleanly and never clips the host frame.
4. **Metadata is navigation.** Mono uppercase labels (≈0.11–0.18em tracking) carry
   time, order, category, confidence, state, or action — not decoration. Short,
   tracked, placed near what they orient. 10–12px minimum; do not shrink on
   mobile, collapse layout instead.
5. **Flat depth keeps the signal clean.** Hierarchy comes from 1px borders, inset
   rules, saturation, and contrast — never elevation shadows. Saturated fills are
   the loudest tier. Hover changes text or border color, not card lift. No soft
   shadows, glow, blur, glass, or card lift on primary editorial surfaces.

**Surface obligations (true everywhere).** Feeds and digests must make
order/recency/sequence visible without paragraph reading (rail, repeated
timestamp, numbered sequence, or compact status line). A reader should grasp the
lead, current state, and next action before body detail. Every saturated accent
must communicate priority/action/state/interruption — no more than a few per
viewport. Primary hierarchy must never depend on drop shadows. Display headlines
must wrap cleanly inside the host frame; leave ≥72px top breathing room for host
chrome. On mobile, collapse layout while preserving mode controls, lead
hierarchy, metadata, and saturation — never desaturate or drop metadata to fit.
Generated surfaces stay source-informed but never source-branded: name any
publication identity from the user's prompt or a task-derived title, never a real
publisher's mark.
