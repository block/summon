---
description: Humane orientation rules — lead with the person's concern rather than task taxonomy, one decision per panel, forward-facing phrasing that orients toward where they're going (never red-alarm behind-ness), slight structural texture between "someday" and "this week" states, and a light unclosed `--garden-later-fade` region that leaves the future visibly open. Reach for how a plan faces the person and paces the days.
relates:
  - to: note-panels
    as: reinforces
  - to: good-enough
    as: reinforces
---

## Composition

Humane orientation is how a Garden Notes surface faces the person instead of the
system: the plan opens with what they care about, asks for one decision at a
time, points forward rather than backward, and never closes the door on later.

**Lead with the person's concern, not task taxonomy.** Open every plan with the
thing the person actually cares about — the trip, the visit, the leaky faucet —
before any system category like Tasks, Projects, or Categories. Human framing
beats system framing, and clarity beats cuteness: name things plainly (Ready,
Can wait, Needs one thing) and never reach for chirpy synonyms or invented
whimsy-words where an ordinary phrase does the job. Warmth lives in the pacing
and the paper, not in cute vocabulary.

**One decision per panel.** Each note panel asks for at most one decision — one
call to action, rendered as the single filled `--color-accent` button or the note
wearing the `--garden-chosen-dot`. Secondary options stay quiet as plain text
links in `--garden-quiet-note` or `--color-text-muted` ink, never a second
button competing for the same choice. When a plan genuinely holds two decisions,
split it into two panels under the [note-panel system](note-panels) rather than
stacking competing buttons in one; a panel with two loud buttons has stopped
lowering pressure.

**Orient forward, never behind.** Phrase state toward where the person is going,
not where they are behind: "ready when you are," "picks up Thursday," "waiting
on the paint to arrive" — never overdue counts in alarm styling or red-tinted
guilt. Being behind is a system's judgment; Garden Notes only ever describes
what comes next. Dates and counts stay exact — "picks up Thursday," "3 things to
gather" — because forward phrasing is a posture, not vagueness; softening a date
into "soon" trades trust for tone.

**Vary the day's texture.** Give "this week" and "someday" states a slight
structural difference so a long plan never reads as an undifferentiated wall:
a this-week note keeps the standard `--garden-note-paper` while a someday note
settles onto the softer `--garden-someday-paper` cream shift, and its chips may
trade the pill for the gently squared `--garden-someday-chip-radius`. The
variation is structural — tone, badge shape, spacing — never decorative
illustration; two notes should feel like different days, not different themes.

**Leave the future visibly open.** End every plan with a light, unclosed
"later…" region: Later items fade gently through `--garden-later-fade` toward
the field with no hard terminal border, no closing rule, and no bottom-of-page
prompt. The open edge is the point — do not fill it with motivational copy,
suggestions, or calls to action. A plan that trails off softly tells the person
the future has room in it; a plan that ends with a hard line tells them the
system is done with them.

**Rest quietly between decisions.** Humane pacing includes what the surface
does when the person does nothing: nothing. No idle animation, no pulsing
reminders, no "still there?" nudges, no content that rearranges itself while
they think. A plan waiting for a decision holds still the way a notebook holds
still — and when the person returns after days away, it greets them with the
same forward phrasing as ever ("ready when you are"), never a tally of missed
time. Stillness is the surface's way of saying there is no hurry, and it must
be as deliberately designed as any interaction.

```css
:root {
  /* HUMANE ORIENTATION — forward-facing texture and the open later-edge. */
  --garden-someday-paper: linear-gradient(180deg, #fbf6e0 0%, #f6f0cf 100%); /* someday notes settle a shade quieter than this-week paper */
  --garden-someday-chip-radius: 12px;  /* someday chips square gently so the week's texture varies structurally */
  --garden-later-fade: linear-gradient(180deg, rgba(234, 241, 220, 0) 0%, #eaf1dc 100%); /* the unclosed later… edge dissolving into the field */
  --garden-later-ink: #9aab86;         /* later items rest in quiet-note ink — present, unhurried, unclosed */
}
```

These rules shape how the [note panels](note-panels) open and end, keep the
[good-enough choice and can-wait notes](good-enough) pointed at one easy move,
and let the [badges](badges) carry exact forward-facing state — "picks up
Thursday" as a chip, never an overdue alarm — across the [planner](planner),
[staged-plan](staged-plan), and [routine](routine) surfaces.
