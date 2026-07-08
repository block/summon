---
description: The screen logic system — game-UI feedback grammar where every interactive element acknowledges input like console hardware, discrete screen-swap transitions instead of smooth scroll, a hardware selection cursor, boot-sequence orientation framing, and diegetic slot/readout chrome including empty (NO CARD), loading, and status states. Reach for this when a surface needs console-menu interaction, screen transitions, or when designing empty states, loading states, or live status readouts.
---

## Composition

A Console Chrome surface is not a document you scroll — it is a menu system you
operate. Screen logic governs how the machine answers input and how it moves
between views: every rule here descends from game-console UI, where the hardware
acknowledges the player before anything else happens.

**Total acknowledgment.** Every interactive element responds to input the way
console hardware does — visibly, instantly, mechanically. Nothing on the
faceplate may be silently interactive: a hover lights the `--chrome-hover-pip`
bead or lifts to `--chrome-hover-plate`; a press inverts to
`--chrome-bevel-pressed` and nudges by `--chrome-press-offset`; a completed
commit may flash its `--chrome-led-glow` once like a confirmed button press. The
grammar is call-and-response: input in, bevel/LED out, always within
`--chrome-motion-click` or `--chrome-motion-instant`. A control that gives no
physical answer is a dead button on the pad — the tell of a counterfeit.

**The hardware selection cursor.** Focus and selection read as one cursor moving
between fixed positions, the way a console highlight jumps between menu entries
— never a soft glow, never an ambiguous "somewhere on the page" state. The
focused row, tile, or chip wears `--chrome-cursor-frame` (a white keyline doubled
with an amber ring — amber because the cursor IS navigation) or, on text targets,
the dotted `--chrome-focus-outline`. Exactly one cursor exists per screen; it
snaps between targets with `--chrome-motion-instant`, it never glides. Lists and
grids should feel D-pad traversable: uniform target geometry, predictable order,
no orphan targets floating outside the cursor's track.

**Screens swap, they do not scroll.** When a view change replaces the user's
task context, swap; when content genuinely exceeds one screen, sequence
numbered scenes — never smooth-scroll between them. Major view changes are
discrete screen swaps: the old screen cuts out, the new screen cuts in, stepped by
`--chrome-screen-swap` — optionally through a brief `--chrome-screen-shutter`
carbon blackout, like a console changing modes. Tabs, wizards, pagination,
result pages, and detail views all prefer swap-in-place over smooth scrolling or
sliding panels; within one screen, content fits the fixed canvas or paginates.
Long surfaces that must extend use the numbered section-as-scene sequencing of
the [hardware dressing system](pattern.hardware-dressing), where each carbon scene bar
is a screen boundary. Parallax, scroll-linked animation, ease-glide carousels,
and infinite scroll are modern SaaS motion and never appear here.

**Boot-sequence orientation.** First-visit or entry framing may read as a boot
sequence: a compact carbon strip or inset well that states, in `--font-mono`
silkscreen micro text, what this machine is and what it is ready to do —
SYSTEM READY · 3 MODULES LOADED — before yielding to the faceplate. It is
orientation cast as diegetic chrome: one short pass, cool-toned, deadpan, never
a skippable animated intro, never a loading theater that delays real content.

**Slots and readouts.** Persistent state gets diegetic chrome. Saved items,
sessions, drafts, and attachments may present as card slots — deep
`--chrome-slot-well` recesses holding compact beveled tiles, an empty slot
reading NO CARD in disabled grey rather than vanishing. Live values — counts,
capacity, connection, last-sync — sit in inset readout wells with `--font-mono`
numerals in `--chrome-readout-text` cool teal, kin of the hit-counter odometer.
Slots and readouts are status furniture, so they stay cool: amber and orange
still mean tool, nav, or forward, never a passive gauge.

The cursor and acknowledgment grammar govern the chips and fields of the
[control system](pattern.controls); screen swaps pace the bars and tabs of the [command
and navigation system](pattern.command-nav); slot wells press into the [beveled plate
and chrome system](pattern.plates); and boot strips and readouts are silkscreen kin of
the [badge and section-label system](pattern.badges) — they report the machine's state,
they never commit an action.

**Bound:** total acknowledgment — no silently interactive element; exactly one
hardware cursor per screen, snapping with `--chrome-motion-instant`; discrete
`--chrome-screen-swap` cuts for view changes, never smooth scroll, parallax,
or ease-glide; empty slots read NO CARD in disabled grey rather than
vanishing; slots and readouts stay cool. **Open:** whether a boot strip
appears, the wording of boot and readout copy, whether swaps pass through the
`--chrome-screen-shutter` blackout, and which persistent state earns slot
treatment.

Related: reinforces `pattern.controls`, `pattern.command-nav`, `pattern.hardware-dressing`.
