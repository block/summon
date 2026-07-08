---
description: The transmission grammar — mono catalog-card metadata blocks, the two-voice shout-plus-margin type pairing, atmosphere-first openings on solid plates, torn-edge hard-matte section transitions, rationed static RGB-split emphasis, and a cross-referencing codebook of section codes. Gather when a surface needs section navigation, internal anchors/jump links, per-item metadata cards, annotations, or section transitions — the filing system that makes the feed read as an intercepted transmission.
---

## Composition

The transmission grammar is how a Signal Stream surface paces, annotates, and
cross-references itself — the moves that make the feed read as an intercepted
transmission with a filing system behind it, not a styled blog. Everything here
stays hard-matte and static: no blur, no glow, no feathering, no animation.
The codebook and filing cards earn their place only when the surface has 3+
sections or items that cross-reference; below that, the mono pills of
[pattern.type-system](pattern.type-system) carry orientation alone.

**Catalog-card metadata blocks.** Each stream item may carry a mono filing-card
index: a compact `--signal-card-*` block listing source, timestamp, ref code,
and category as key–value rows with a fixed key column at
`--signal-card-key-width`, keys set in `--signal-card-key-color` (a hazard
accent doing orientation work), values in white mono. The card is a 1px-bordered
flat block on `--color-surface` — never a lifted panel. Keys never invent data:
every field is real, task-derived, or omitted; a filing card with fake filler
values is worse than no card. One card per item, placed where the
[mono metadata pills](pattern.type-system) would otherwise crowd.

**Two-voice type system.** The condensed `--signal-shout-*` display keeps its
job, and it gains a counterpart: a small mono "margin voice" set with
`--signal-margin-*` — a quiet annotation beside or beneath an item, the analyst's
pencil note against the broadcast shout. At most one margin-voice annotation per
item; it is muted-gray or hazard-keyed mono at 10–12px, never glowing, never
italic-decorative, and never a second shout. The two voices must stay
distinguishable at a glance: if the margin voice grows, it stops being a margin.

**Atmosphere-first openings.** A surface may open on atmosphere before the shout
lands: a held full-bleed image or a dense mono transmission block (call signs,
timestamps, ref codes stacked in `--font-mono`) that sets the field, then the
`--signal-shout-*` headline strikes. Any text over imagery sits on a solid
near-black plate — `--signal-opening-plate` — hard-edged and fully opaque, never
a soft gradient scrim or translucent overlay. The opening is one beat, not a
hero carousel; the shout must still land within the first viewport.

**Torn-edge section transitions.** Pacing shifts between sections are cut, not
faded: a stepped/notched horizontal rule, an offset double-line
(`--signal-tear-rule`), or a jagged clip-path band striped with
`--signal-tear-hazard` where the stream changes register. Edges are hard and
matte — solid color against solid color with zero blur, glow, or feathering —
and a tear marks a real pacing shift, not every gap; routine separation stays
hairline. The tear is the physical version of the rail's tick: you feel the
splice before you read it. When the shift is a true change of register — live
updates giving way to analysis, one story window closing and another opening —
the tear carries an editorial voice: a condensed `--signal-chapter-size`
statement seated on its rule, with its own ref code from the codebook, turning
the splice into a chapter break the reader can cite. Chapters are rationed like
tears, and the [stream cadence](pattern.cadence) governs when a feed has earned one.

**Static RGB-split emphasis.** One display-scale line per surface, at most, may
carry static RGB-split emphasis: two hard-offset solid-color shadows
(`--signal-rgb-split`) behind white display text, a frozen misregistration.
Never animated, never a flicker loop, never applied to body text, metadata, or
controls — it is a poster move for the shout or a section statement only, and
the offsets are solid hazard colors, not transparency or blur. A second instance
on the same surface collapses it into a gimmick.

**Cross-referencing title codebook.** Sections and items carry coherent internal
codes — a codebook the surface invents once and obeys (SIG-01, SIG-02; or
FIELD/A, FIELD/B) rendered in `--signal-ref-*` mono. Body and margin text may
cite them as `→ REF: SIG-02` mono citations, and every citation must resolve to
a real anchor on the surface — a dangling ref code is a broken transmission.
Codes are wayfinding, not decoration: keep the scheme flat, sequential, and
consistent with the rail's ordering.

```css
:root {
  /* TRANSMISSION GRAMMAR — filing, pacing, and citation on the dark field. */

  /* Catalog-card metadata blocks: mono filing-card index per stream item. */
  --signal-card-border: 1px solid var(--color-border-input);
  --signal-card-fill: var(--color-surface);
  --signal-card-key-width: 9ch;
  --signal-card-key-color: var(--signal-hazard-mint);
  --signal-card-font: var(--font-mono);
  --signal-card-size: var(--text-sm);
  --signal-card-row-gap: var(--space-1);

  /* Margin voice: the small mono annotation against the shout. One per item. */
  --signal-margin-font: var(--font-mono);
  --signal-margin-size: var(--text-sm);
  --signal-margin-color: var(--color-text-muted);
  --signal-margin-accent: var(--signal-hazard-violet);
  --signal-margin-tracking: var(--tracking-label);

  /* Atmosphere-first opening: text rides a solid near-black plate, never a scrim. */
  --signal-opening-plate: #131313;
  --signal-opening-plate-border: 1px solid var(--color-border);
  --signal-opening-min-height: 320px;

  /* Torn-edge transitions: hard matte splices at pacing shifts. */
  --signal-tear-rule: repeating-linear-gradient(90deg, var(--color-border) 0 24px, transparent 24px 32px);
  --signal-tear-hazard: repeating-linear-gradient(-45deg, var(--signal-hazard-mint) 0 8px, var(--color-bg) 8px 16px);
  --signal-tear-notch-depth: 10px;
  --signal-tear-band-height: 20px;

  /* Static RGB-split emphasis: two hard-offset solid shadows, frozen, once per surface. */
  --signal-rgb-split: 3px 0 0 var(--signal-hazard-mint), -3px 0 0 var(--signal-hazard-violet);
  --signal-rgb-split-offset: 3px;

  /* Ref codebook: mono internal section codes and resolving citations. */
  --signal-ref-font: var(--font-mono);
  --signal-ref-size: var(--text-sm);
  --signal-ref-color: var(--signal-hazard-mint);
  --signal-ref-tracking: var(--tracking-label);
  --signal-ref-prefix: "→ REF: ";
}
```

**Bound:** the solid opaque opening plate under any text-over-image; one shout,
optionally RGB-split, in the first viewport; the fixed-key-column filing card
with real-or-omitted values; one margin voice per item; tears only at true
register shifts, always hard-matte; every `→ REF:` citation resolving to a real
`id` anchor; the flat sequential codebook. **Open:** whether an opening is
atmosphere or shout-first, which items carry cards, tear form (stepped rule,
double line, or hazard band), the codebook naming scheme, and all content.

The filing cards and margin voice extend the [display-shout and mono-metadata
type system](pattern.type-system) — same whisper register, more structure; catalog cards
and opening plates sit flat on the [tile system](pattern.tiles) rails under the same
no-shadow rule, and tears splice between its tile groups; and every hazard key,
tear stripe, and RGB offset draws only the voltages already rationed by the
[dark canvas and hazard-accent system](principle.canvas) — the grammar adds filing and
pacing, never a third accent.

Related: reinforces `pattern.type-system`, `pattern.tiles`, `principle.canvas`.

## Skeleton

```html
<article class="transmission" style="background: var(--color-bg); color: var(--color-text);">
  <!-- Atmosphere-first opening: solid plate, never a scrim; shout lands in first viewport -->
  <header class="opening" style="min-height: var(--signal-opening-min-height); background: var(--signal-opening-plate); border: var(--signal-opening-plate-border);">
    <p class="callsign" style="font-family: var(--font-mono); color: var(--color-text-muted); text-transform: uppercase; letter-spacing: var(--tracking-label);">SIG-01 · 13:07 UTC · INTERCEPT</p>
    <h1 class="shout" style="font-family: var(--signal-shout-font); font-size: var(--signal-shout-size); line-height: var(--signal-shout-leading); text-transform: var(--signal-shout-transform); text-shadow: var(--signal-rgb-split);">
      <!-- ONE shout per surface; RGB-split optional and at most once -->
    </h1>
  </header>

  <!-- Stream item with filing card + margin voice -->
  <section class="item" id="sig-02">
    <dl class="catalog-card" style="border: var(--signal-card-border); background: var(--signal-card-fill); font-family: var(--signal-card-font); font-size: var(--signal-card-size); display: grid; grid-template-columns: var(--signal-card-key-width) 1fr; row-gap: var(--signal-card-row-gap);">
      <dt style="color: var(--signal-card-key-color);">REF</dt><dd>SIG-02</dd>
      <dt style="color: var(--signal-card-key-color);">TIME</dt><dd><!-- real value or omit the row --></dd>
    </dl>
    <h2><!-- item headline, sans or condensed, below shout scale --></h2>
    <p class="margin-voice" style="font-family: var(--signal-margin-font); font-size: var(--signal-margin-size); color: var(--signal-margin-color); letter-spacing: var(--signal-margin-tracking);">→ REF: SIG-04 <!-- must resolve to a real anchor --></p>
  </section>

  <!-- Torn-edge splice at a real register shift; routine gaps stay hairline -->
  <div class="tear" role="separator" style="height: var(--signal-tear-band-height); background: var(--signal-tear-hazard);"></div>
  <h2 class="chapter" id="sig-03" style="font-family: var(--signal-chapter-font); font-size: var(--signal-chapter-size); border-bottom: var(--signal-chapter-rule); text-transform: uppercase;">
    <!-- chapter statement + its own ref code -->
  </h2>
</article>
```
