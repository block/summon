---
description: The stream cadence — dense-row runs punctuated by full-width interruptions, editorial chapter breaks inside the feed, a loop splice so the stream never dead-ends, and two reading velocities (skim versus dwell) that decide how loud each passage may be. Reach for this when a surface needs its pacing over time, not just its parts.
---

## Composition

The cadence is what a Signal Stream surface does over time — how the feed
breathes as the reader moves through it. The parts (tiles, rail, shout, pills)
are the vocabulary; the cadence is the meter. A surface that lays equal rows at
equal gaps has the parts and none of the language.

**Dense runs, then interruption.** The stream alternates between two registers
of density. A **run** is a burst of compact rows at `--signal-cadence-run-gap`
— tight enough that the rows read as one transmission, timestamps ticking down
the rail. After roughly `--signal-cadence-run-length` rows, the rhythm must
break: a full-width saturated tile, a lead-image slab, or a chapter break spans
the column and holds `--signal-cadence-break-gap` of dark field on either side.
The alternation is deliberate — the interruption earns its span by priority, and
the held gap around it is what makes the dense run feel dense. A feed of
uninterrupted equal rows is a log; a feed of nothing but interruptions is a
poster wall. Signal Stream is the alternation.

**Chapter breaks inside the feed.** A long stream is edited into chapters, not
merely scrolled. Where the register truly shifts — live updates give way to
analysis, one launch window closes and another opens — a **chapter break**
lands: a condensed `--signal-chapter-font` statement at `--signal-chapter-size`
(loud, but never the shout scale — one shout per surface), seated on a
`--signal-chapter-rule` hairline, carrying its own mono ref code from the
codebook. A chapter break is a torn-edge moment's editorial voice: the
[tear](pattern.transmission-grammar) is the splice you feel, the chapter statement is
the splice you read. Chapters are rationed like tears — a real shift in
register, never a decorative subhead every few rows.

**No dead ends — the loop splice.** The stream must never stop against a blank
wall. Where the feed runs out, it resolves: the tail returns the reader to the
head — a repeat of the lead's metadata card, a mono `→ REF:` citation back to
the first chapter, or a compact index of the chapters just passed — across a
`--signal-loop-gap` of held dark field. The splice is honest wayfinding, not an
infinite-scroll trick: it says *the transmission continues from the top*, in
the same mono register as the rail. A footer that trails off into silence, or a
"load more" dead-end, breaks the signal; the loop splice keeps it live.

**Two reading velocities.** Every passage is composed for one of two speeds.
The **skim register** is what a moving eye catches: the rail's ticks, mono
pills, the shout, chapter statements, saturated fills — compact leading, tracked
uppercase, color doing the flagging. The **dwell register** is where the reader
stops: body passages narrow to `--signal-dwell-measure` and open to
`--signal-dwell-leading`, saturation drops away, and the field goes quiet
around the text. The rule is directional: loudness belongs to the skim layer,
room belongs to the dwell layer. A saturated fill inside a dwell passage, or a
62ch measure forced on a skim row, mixes the velocities and muddies both.

**The rail is the spatial anchor.** Across every run, break, chapter, and dwell,
the `--signal-rail-*` spine is the one continuous element — the index the eye
returns to. Chapter breaks register on it as marked ticks; the loop splice
resolves to it; dwell passages keep it in the margin even as the measure
narrows. The reader should always be able to answer *where am I in the stream*
from the rail alone, without reading a word. If a layout collapse would sever
the rail mid-stream, collapse the columns instead — the spine survives.

**Bound:** the run/interruption alternation (a break roughly every
`--signal-cadence-run-length` rows), the held `--signal-cadence-break-gap`
around interruptions, chapter statements at `--signal-chapter-size` seated on
their rule, dwell passages at `--signal-dwell-measure` / `--signal-dwell-leading`
with saturation stripped, the loop splice across `--signal-loop-gap`, and the
rail running unbroken end to end. **Open:** run lengths per section, what form
each interruption takes, how many chapters a feed earns, and whether the loop
splice is a repeated lead card, a citation, or a chapter index.

The cadence paces the [tiles and rail](pattern.tiles) that carry the content, gives the
[torn-edge transitions and ref codebook](pattern.transmission-grammar) their editorial
timing, splits the [type system](pattern.type-system) into its skim and dwell voices,
and rations the [hazard accents](principle.canvas) by velocity — saturation rides the skim
layer, the dwell layer stays dark and quiet.

Related: reinforces `pattern.tiles`, `pattern.transmission-grammar`, `pattern.type-system`, `principle.canvas`.

## Skeleton

```html
<main class="stream" style="background: var(--color-bg); border-left: var(--signal-rail-width) solid var(--signal-rail-color);">
  <!-- RUN: compact rows read as one burst; ~--signal-cadence-run-length rows, then break -->
  <ol class="run" style="display: flex; flex-direction: column; gap: var(--signal-cadence-run-gap); list-style: none;">
    <li class="row"><!-- tick on the rail + mono pill + headline (skim register) --></li>
    <li class="row"><!-- ... --></li>
    <li class="row"><!-- ... --></li>
    <li class="row"><!-- ... --></li>
  </ol>

  <!-- INTERRUPTION: full-width, held dark field on both sides -->
  <article class="interruption" style="margin: var(--signal-cadence-break-gap) 0; background: var(--signal-tile-fill-mint); color: var(--signal-hazard-mint-fg); border: var(--signal-tile-border); border-radius: var(--signal-tile-radius); box-shadow: var(--signal-tile-shadow);">
    <!-- saturated lead, image slab, or transmission card -->
  </article>

  <!-- CHAPTER: register shift, section scale (never the shout), own ref code -->
  <h2 class="chapter" id="sig-02" style="font-family: var(--signal-chapter-font); font-size: var(--signal-chapter-size); border-bottom: var(--signal-chapter-rule);">
    <!-- chapter statement -->
  </h2>

  <!-- DWELL: narrow, quiet, unsaturated; the rail stays in the margin -->
  <section class="dwell" style="max-width: var(--signal-dwell-measure); line-height: var(--signal-dwell-leading);">
    <p><!-- stopped-reading prose; no saturated fills in here --></p>
  </section>

  <!-- LOOP SPLICE: the tail resolves to the head across held field -->
  <footer class="loop" style="margin-top: var(--signal-loop-gap); font-family: var(--font-mono); color: var(--color-text-muted);">
    → REF: SIG-01 — transmission continues from the top
  </footer>
</main>
```
