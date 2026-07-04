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

The cadence paces the [tiles and rail](pattern.tiles) that carry the content, gives the
[torn-edge transitions and ref codebook](pattern.transmission-grammar) their editorial
timing, splits the [type system](pattern.type-system) into its skim and dwell voices,
and rations the [hazard accents](principle.canvas) by velocity — saturation rides the skim
layer, the dwell layer stays dark and quiet.

Related: reinforces `pattern.tiles`, `pattern.transmission-grammar`, `pattern.type-system`, `principle.canvas`.
