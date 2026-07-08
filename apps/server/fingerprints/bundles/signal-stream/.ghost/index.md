---
description: Signal Stream core — a dark, high-voltage editorial stream language where live feeds, feature digests, reviews, and dense technology briefings read as a paced signal, carried by a warm near-black field, hazard accents, condensed display shout, and mono metadata.
---

## Intent

Signal Stream makes a surface feel like a live signal: a near-black field, sharp
metadata, loud editorial type, and saturated moments of emphasis. It turns feeds,
reviews, launch updates, and comparisons into a paced **stream** rather than a
generic dashboard. When legibility and urgency conflict, urgency loses: the
field stays scannable at speed; when calm neutrality and vivid hierarchy
conflict, hierarchy wins.

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

## Read order

For a typical surface, pull in this order: the [dark canvas and hazard-accent
field](principle.canvas) first — the field and the two voltages govern everything
else; then the [display shout and mono metadata](pattern.type-system) for the
first read; then the [stream tiles and signal rail](pattern.tiles) plus the
[stream cadence](pattern.cadence) to pace the content; the [segmented tabs and
hazard-pill controls](pattern.controls) when modes or actions exist; the
[transmission grammar](pattern.transmission-grammar) when the surface files,
splices, or cites itself. Before composing any feed, check the
[annotated stream fragment](exemplar.stream-fragment) as the quality bar, and
hold the two guards — [no soft-glow depth](anti-goal.soft-glow-depth) and
[no source-brand costume](anti-goal.source-brand-costume) — as hard lines.

**Silence posture.** This fingerprint is deliberately silent on data
visualization idioms, form-heavy flows, iconography sets, and print/export
styling. Where it is silent, compose provisionally from the same tokens and the
flat-depth rule, label the choice as provisional, and never import outside
conventions (no shadows, no light shells, no third accent) to fill the gap.

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

**Design lineage.** Signal Stream descends from high-voltage editorial and
neo-brutalist information design: the dense data-journalism of Bloomberg-style
financial pages, the hazard-tape and industrial signage traditions that speak in
warning voltages, condensed-Impact poster typography where a single line shouts,
and the flat saturated color-blocking of contemporary conference and tech-event
branding (the Config-era poster energy where color, not shadow, carries the
weight). It is named as heritage, never copied: the language borrows the
grammar — near-black field, two hazard markers, condensed shout, ticked rail,
flat saturated tiles — while every surface stays neutral and fictionalized.

The material is a dark editorial token system: a warm near-black canvas, white and
muted-gray text, hairline borders, and a hazard-accent palette (acid mint,
electric violet, hot pink, warm orange, signal yellow, electric blue). Three type
roles — a condensed **display shout**, a sans workhorse, and **mono metadata** —
plus a tight spacing ladder, nested pill radii, and intentionally flat shadow
tokens. Read against its industrial-signage roots, the near-black `--color-bg` is
the field an operator scans; hazard mint and violet are the two voltages allowed
to interrupt it, deployed like painted floor tape rather than ornament.

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

  /* Interaction states — hazard voltages doing the work, never elevation.
     Focus is a bright mint outline that reads on the dark field; hover/active
     shift text and border color or saturation, NOT lift; nothing glows. */
  --signal-focus-ring: 2px solid var(--signal-hazard-mint);   /* bright hazard-mint outline on near-black */
  --signal-focus-offset: 2px;                                 /* small gap so the ring stays crisp, not fused */
  --signal-hover-border: var(--color-border-strong);          /* border brightens to mint on hover — no shadow */
  --signal-hover-text: var(--signal-hazard-mint);             /* links/labels shift to mint, never underline-lift */
  --signal-active-border: var(--signal-hazard-violet);        /* pressed state drops to the second voltage */
  --signal-tile-hover-border: var(--color-border-strong);     /* flat tile brightens its 1px edge, stays flat */
  --signal-tab-hover-text: var(--color-text);                 /* inactive tab warms to full white before select */
  --signal-disabled-fg: var(--color-text-muted);              /* disabled reads as muted-gray metadata */
  --signal-disabled-border: var(--color-border-input);        /* disabled edge falls back to the muted hairline */
  --signal-disabled-opacity: 0.55;                            /* dimmed, not blurred — signal simply quiets */

  /* Electric, snappy motion — minimal, for state changes only. Never decorative. */
  --signal-duration-snap: 90ms;                               /* tab/hover flips feel like a hardware selector */
  --signal-ease-snap: cubic-bezier(0.2, 0, 0, 1);             /* fast-in, hard-settle — no float, no bounce */

  /* Stream cadence — runs, interruptions, chapters, loop splice, dwell register. */
  --signal-cadence-run-gap: var(--space-3);                   /* dense-row runs read as one burst on the rail */
  --signal-cadence-run-length: 4;                             /* rows per run before the rhythm must break */
  --signal-cadence-break-gap: var(--space-8);                 /* dark field held around a full-width interruption */
  --signal-chapter-font: var(--font-display);                 /* chapter break voice — condensed, below the shout */
  --signal-chapter-size: var(--text-2xl);                     /* section-scale statement, never display scale */
  --signal-chapter-rule: 1px solid var(--color-border-input); /* hairline seat under the chapter statement */
  --signal-loop-gap: var(--space-9);                          /* held field before the tail resolves to the head */
  --signal-dwell-measure: 62ch;                               /* dwell passages narrow for stopped reading */
  --signal-dwell-leading: var(--leading-reading);             /* dwell register opens up; skim stays compact */
}
```

Buttons are uppercase mono hazard pills (mint fill, black text, no shadow); on
hover the border brightens toward `--signal-hover-border` and the label toward
`--signal-hover-text`, on press it drops to `--signal-active-border` — color and
saturation move, the pill never lifts. Inputs sit on the dark field with a 1px
muted border that goes mint on focus via `--signal-focus-ring` at
`--signal-focus-offset`, so focus is a visible hazard outline rather than a soft
halo. Segmented mode tabs are a zero-gap hairline switch: the inactive segment
warms to `--signal-tab-hover-text` on hover and the selected one carries the 2px
mint underline, flipping in `--signal-duration-snap` / `--signal-ease-snap` like a
hardware selector. Flat saturated tiles get their hierarchy from the fill and a
single 1px edge that brightens to `--signal-tile-hover-border` on hover — never a
shadow, glow, or elevation change. Metadata pills stay navigational, carrying
time, order, state, and category as tracked mono chips, never ornament. Disabled
controls quiet to `--signal-disabled-fg` / `--signal-disabled-border` at
`--signal-disabled-opacity` — dimmed, never blurred. `strong` emphasis takes the
mint accent. Body is the sans workhorse; controls and metadata are mono.
Accessibility rides on stable contrast pairs — white and muted-gray on near-black,
and every hazard fill paired with its `-fg` text color — with mono metadata held
at a 10–12px floor and focus made unmistakable by the mint ring on the dark field.

The shared material every surface draws on lives in the root nodes that reach
everywhere: the [dark canvas and hazard-accent system](principle.canvas) that is the field
and its saturated interruptions, the [display-shout and mono-metadata type
system](pattern.type-system) that anchors and navigates the page, the [pill-corner stream
tile system](pattern.tiles) that carries repeating units and saturated tiles, and the
[segmented tabs and hazard-pill controls](pattern.controls) that switch modes and drive
action, while the [transmission grammar](pattern.transmission-grammar) paces, annotates,
and cross-references the stream and the [stream cadence](pattern.cadence) sets the meter
— dense runs, full-width interruptions, chapter breaks, the loop splice, and the
skim-versus-dwell registers. Every surface tunes these same building blocks to
its own job.

## Composition

Five principles carry the language and are true on every surface — each is
stated in full in its owning node; the index only names them:

1. **The dark canvas is the material** — the field contract lives in the
   [dark canvas and hazard-accent field](principle.canvas).
2. **Hazard accents earn attention** — rationing, jobs, and the two voltages
   live in [principle.canvas](principle.canvas).
3. **Display shout anchors the page** — the shout-versus-whisper contract lives
   in the [type system](pattern.type-system).
4. **Metadata is navigation** — the mono pill rules live in the
   [type system](pattern.type-system).
5. **Flat depth keeps the signal clean** — the no-elevation rule lives in
   [principle.canvas](principle.canvas) and the [tiles](pattern.tiles).

**Tuning a surface from the signal.** Signal Stream has no fixed page types —
every surface is tuned for its task from the same kit of parts, laid down on the
field in the same order. Lay everything on the [dark canvas and hazard-accent
field](principle.canvas) so bright fills stay interruptions, not the default; anchor the
first read with the [display shout and mono metadata](pattern.type-system) so the loudest
signal states itself before any prose and the whisper kicker orients it; carry the
content on the [stream tiles and the signal rail](pattern.tiles) so order, recency, and
sequence read as a physical column before a word is read; switch modes and drive
the one next action with the [segmented tabs and hazard-pill controls](pattern.controls).
Let the task set the shape of the signal, not a template: when it reports a state
or verdict, state the claim first in the shout, prove it with compact hairline rows
on `--signal-tile-fill-flat`, and land on a single mint `--signal-pill-*` action,
keeping saturation muted unless severity truly demands a hazard accent; when it
ranks stories, let the feature lead own the first read and earn its span by
priority so not every story carries equal weight, and mark the one editorial lead
with a solid `--signal-tile-fill-mint`/`-violet` block rather than a viewport of
saturated tiles; when it runs live updates, stack them on the ticked
`--signal-rail-*` spine at tight 12–16px gaps so they read as one continuous
stream, letting only an occasional saturated tile interrupt the rhythm — never
every row equal weight. If a task fits none of these, tune a new surface from the
same parts under the same rules: never collapse to a generic layout — compose from
the same parts.

**Surface obligations (true everywhere).** Feeds and digests must make
order/recency/sequence visible without paragraph reading (rail, repeated
timestamp, numbered sequence, or compact status line). A reader should grasp the
lead, current state, and next action before body detail. Every saturated accent
must communicate priority/action/state/interruption — at most 3 saturated fills
per viewport; at most 1 mint CTA per region. Primary hierarchy must never depend on drop shadows. Display headlines
must wrap cleanly inside the host frame; leave ≥72px top breathing room for host
chrome. On mobile, collapse layout while preserving mode controls, lead
hierarchy, metadata, and saturation — never desaturate or drop metadata to fit.
Generated surfaces stay source-informed but never source-branded: name any
publication identity from the user's prompt or a task-derived title, never a real
publisher's mark.
