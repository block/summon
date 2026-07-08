---
description: The badge and section-label system — small uppercase section-label bars, stamped amber/white rating and status marks like silkscreened controller legends, and the optional mascot bubble masthead. Reach for this when a surface needs labeling, status stamps, or section legends to annotate the chassis.
---

## Composition

Small uppercase Arial labels act like silkscreened controller legends and carry
the interface structure. No unlabeled content islands.

**Section-label bars.** Every dense module earns a small uppercase section-label
bar (Official, Featured, Poll, Finder, Archive, Login, Status, Help…) in Arial
Bold uppercase at 10–12px with slight tracking and strong contrast, capped onto
the plate with the `--chrome-bevel-hard` seam and parted from its module body by
`--chrome-divider-dotted`. Give every list, poll, form, and promo a visible
section-label job.

**Badge and rating stamps.** Small trust, rating, status, and category marks read
as hard-edged squares carrying the `--chrome-bevel-hard` two-tone seam with micro
uppercase text; an active amber stamp may be ringed by `--chrome-led-amber` to
distinguish a lit status from a steady-state mark — generic unless user-supplied,
never real rating-authority marks or friendly rounded pills. A stamp marks
status, so it never borrows the `--chrome-led-glow` reserved for orange forward
actions.

**Status readouts as diegetic legends.** Live counts, capacity, sync state, and
similar machine facts may present as inset readout wells — `--font-mono`
numerals in cool `--chrome-readout-text` teal pressed into a plate — reading
like a display on the casing rather than a stat card. A readout reports, it
never invites: it carries no lit amber or orange, no hover answer, and sits
beside section-label bars as the machine's own voice. The readout and
boot-strip grammar lives in the [screen logic system](pattern.screen-logic).

**Mascot bubble masthead.** A small original mascot, helper icon, or speech
bubble may break the masthead grid sparingly with short useful copy, overlapping
the chrome slightly — never literal real-brand characters or a large illustration
that replaces the console UI. Generated surfaces stay source-agnostic: original
or abstract mascot and hardware motifs only.

These labels and stamps cap the [beveled plates](pattern.plates) and sit beside but stay
distinct from the action chips of the [control system](pattern.controls): a badge marks
status or category, a control commits an action.

**Bound:** every dense module capped by a small uppercase Arial Bold
section-label bar riding the `--chrome-bevel-hard` seam; stamps as hard-edged
beveled squares, never friendly rounded pills; readouts in cool
`--chrome-readout-text` teal with no lit warmth and no hover answer; no
`--chrome-led-glow` on any stamp. **Open:** the label vocabulary, which
modules earn an amber-ringed lit stamp versus a steady mark, whether readouts
appear at all, and whether a mascot bubble breaks the masthead.

Related: contrasts with `pattern.controls`; reinforces `pattern.plates`.
