---
description: Deletion discipline — the dependency test where every label, divider, icon, and caption must state a reason it earns its place (default is deletion, convention is not a reason), trust built through hierarchy never genre costume, each tier answering one question at a glance, the next action surfaced exactly once where the decision completes, and stability as part of confidence — complete on arrival within a `--dd-settle-budget` of one. Reach for what to cut and how the surface stays trustworthy without decoration.
---

## Composition

Deletion discipline is the editorial filter — *what can we delete?* — made
operational. It governs every element that is not the answer itself, and its
default verdict is deletion.

**The dependency test.** Every label, divider, icon, and caption must state a
reason it earns its place: what breaks if it goes? If nothing depends on it, it
is deleted. "Dashboards usually have this," "the section needed a header," and
"it looked empty" are not reasons — convention is not a reason. A divider earns
its place only where two regions would otherwise blur; a caption only where the
figure would be misread without it; an icon only where it is faster to parse
than the word it decorates. The burden of proof is on the element, never on the
deletion.

**Trust through hierarchy, never genre costume.** Credibility comes from the
tier system, the type ladder, and exact figures — never from dashboard tropes.
No gauges, no status icons scattered as reassurance, no "insights" chrome, no
sparkline garnish dressed on to look analytical. When a surface feels like it
needs more credibility, add precision, not decoration: a tighter number, a
narrower range, a small `--dd-source-note` line in `--color-text-subtle` at
`--text-xs` naming where the figure came from. A costume says "this looks like
analysis"; a source note says "this is analysis."

**Omission is the voice of authority.** The most powerful move is knowing what
not to add. What the surface withholds — the framing chrome, the explanatory
label, the reassuring preamble — is as authored as what it shows: a surface
that explains itself is asking permission, and a surface that simply states the
answer has already been trusted with the question. Withholding is only earned
when the remaining elements are unambiguous, which is why deletion and
precision travel together: cut the label, then make the figure so exact it
never needed one. The reader experiences this as confidence; the discipline
behind it is that every omission was a decision, not a shortcut.

**Each tier answers one question at a glance.** The four blocks are a scanning
contract: reading only the headline of each tier — [answer](pattern.answer),
[evidence](pattern.evidence), [meaning](pattern.meaning), [action](pattern.action) — must yield the
complete argument: what is it → how do we know → what does it mean → what do I
do. If a tier only makes sense after reading its body copy, the heading has
failed; rewrite the heading until it carries the tier's answer alone, rather
than adding explanatory copy beneath it.

**The next action is never buried.** Pill actions appear exactly once, exactly
where the decision completes — after the [meaning](pattern.meaning) sentence, when the
reader knows enough to act. Never a CTA repeated top and bottom, never a sticky
button shadowing the scroll, never an action hidden behind a disclosure the
reader must hunt for. One [action stack](pattern.action), one location, no CTA spam and
no hide-and-seek: the reader finishes the argument and the move is right there.

**Stability is part of confidence.** A surface that shifts under the reader is
hedging in motion. Everything arrives complete: no skeleton loaders, no
staggered fade-ins, no reflowing rows as data lands late. The one permitted
motion is a single settle-in of the hero figure — `--dd-settle-budget: 1`, spent
on the [answer](pattern.answer) or not at all, easing over `--dd-settle-duration` and
never repeated. After that instant, nothing on the surface moves, loads, or
shifts; layout stability is the visual form of "we already did the thinking."

**Performance is a design value, not an engineering afterthought.** The surface
arrives settled: complete markup, final layout, no skeleton theater standing in
for content, no placeholder shimmer promising an answer it does not yet have.
A skeleton loader is hedging rendered as UI — it says "we are still thinking" —
and Decisive Dark never says that; if the answer is not ready, the streaming
state is honest and minimal, never a fake page. Treat every element as a cost
the reader pays in time: an asset, an effect, or a layer that does not shorten
the path to the answer is weight, and weight is deleted under the same
dependency test as any caption. Ship only what is necessary, and make what
ships count — speed is the first thing the reader feels, before any pixel, and
it is part of the same promise as the exact figure: we did the work already.

```css
:root {
  /* DELETION DISCIPLINE — precision over decoration, stillness over theatrics. */
  --dd-source-note: var(--text-xs);    /* the small provenance line that replaces credibility chrome */
  --dd-settle-budget: 1;               /* at most one settle-in, on the hero figure only — otherwise zero motion */
  --dd-settle-duration: 240ms;         /* the single settle resolves fast; nothing else animates */
  --dd-divider-earned: 1px solid var(--color-border-subtle); /* the only divider — used where two regions would blur, else deleted */
}
```

Deletion discipline is the pass run over the whole four-block composition: it
keeps the [answer](pattern.answer) unaccompanied, the [evidence](pattern.evidence) free of
gauge costume, the [meaning](pattern.meaning) to one sentence, the [action stack](pattern.action)
in exactly one place, and the [accent moment](pattern.accent-moment) honest — because
after everything deletable is gone, whatever remains is unmistakably the point.

Related: reinforces `pattern.answer`, `pattern.meaning`, `pattern.action`.
