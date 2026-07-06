---
description: The streamed answer block — the single dominant region that claims the screen with a display-sized `--dd-numeral` metric or a verdict headline, sized like it is the only thing there at a `--dd-hero-ratio` jump over body, left-aligned with a leading element. Reach for how the surface delivers its main takeaway first and loudest.
---

## Composition

Every Decisive Dark surface opens with exactly one answer block — the main takeaway,
delivered before any supporting detail. It is required and singular: one answer, the
loudest element on the screen, with no competing peer. The reader should understand
the takeaway in one second, and everything below it justifies or extends that answer
rather than competing with it.

**The answer arrives settled.** The hero renders complete on first paint — final
figure, final layout, final position — never behind a skeleton placeholder or a
staggered reveal. The at-most-one settle-in permitted by `--dd-settle-budget`
belongs here or nowhere, easing over `--dd-settle-duration` and never repeating;
it is an acknowledgment that the answer has landed, not a performance. The
emptiness around the hero is part of its size: keep the answer's band unshared
per the [negative-space frame](pattern.negative-space), because a display numeral with a
badge leaning on it is half as loud as one standing alone. The answer carries no
preamble — no "Here's what we found," no framing line above it. Withholding the
introduction is the introduction; the figure states itself.

**Streamed answer block.** Lead with the answer as the visual event. When the answer
is a number — a balance, a total, a figure — render it in `--dd-numeral` at
`--dd-numeral-weight`, locked to tabular figures with `--dd-tnum` and tightened with
`--dd-tracking-numeral`, the unit symbol tight to the number and never floating. When
the answer is a verdict or recommendation, set it as a display-sized headline at
`--dd-hero-size` with `--dd-hero-tracking` and `--dd-hero-leading`, sized at roughly
`--dd-hero-ratio` over body so the type ladder reads as designed intent. Keep it
left-aligned with a leading element and a clean ragged edge — centered hero treatment
is marketing-page logic and reads as a splash, not a tool. Leave `--dd-top-safe`
breathing room above for host chrome, let the hero wrap cleanly with responsive line
breaks, and reduce scale before words clip or crowd the edges.

**Answer shapes by moment.** A factual lookup renders as a big metric, no embedded
chart. A question about a trend pairs the big metric with an embedded [bold
chart](pattern.evidence) and suppresses duplicate evidence below. A live-data question renders
the chart as the answer. A yes/no decision leads with a decisive prefix on its own
line; a recommendation carrying a value integrates as one natural sentence with the
data point emphasized inline — the figure in standard ink and weight 500, the
surrounding sentence in `--color-text-subtle-variant` at weight 400, same size, so
color and weight do the emphasis, not size.

The answer is the loudest the surface gets; it pairs with the [one-sentence
meaning](pattern.meaning) that interprets it, is justified by the [bold evidence](pattern.evidence)
beneath it, and may carry the surface's single [accent moment](pattern.accent-moment) when the
trend is positive or the action is primary.

**Bound vs open.** Bound: exactly one answer block, first major region,
left-aligned with a ragged edge, `--dd-top-safe` above and `--dd-answer-clear`
below, nothing sharing its band, tabular figures with the unit tight to the
number, no preamble line. Open: metric vs verdict form, whether the eyebrow
appears, whether a decisive prefix takes its own line, whether a chart is
embedded (per [evidence](pattern.evidence)), and whether the surface's one
settle-in is spent here.

Related: reinforces `pattern.evidence`, `pattern.meaning`.

## Skeleton

```html
<section class="dd-answer"
         style="margin-top: var(--dd-top-safe); margin-bottom: var(--dd-answer-clear);
                text-align: left;">
  <!-- optional eyebrow: only if the unit/context is not already in the figure -->
  <p style="font-size: var(--text-sm); color: var(--color-text-subtle);
            margin: 0 0 var(--space-2);">{context label}</p>
  <!-- metric form -->
  <h1 style="font-size: var(--dd-numeral); font-weight: var(--dd-numeral-weight);
             font-feature-settings: var(--dd-tnum);
             letter-spacing: var(--dd-tracking-numeral);
             line-height: var(--dd-hero-leading); margin: 0;">{$figure}</h1>
  <!-- OR verdict form (never both):
  <h1 style="font-size: var(--dd-hero-size); letter-spacing: var(--dd-hero-tracking);
             line-height: var(--dd-hero-leading); margin: 0;">{Yes — verdict line}</h1>
  -->
</section>
```
