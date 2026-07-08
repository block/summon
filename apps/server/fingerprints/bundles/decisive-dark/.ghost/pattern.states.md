---
description: States on the answer surface — loading/streaming, empty data, error, and blocked, each stated plainly in neutrals and the reserved status hues, with no skeleton theater, no apology, no illustration. Reach for this when the answer is not ready, the data is empty, or something failed — any surface whose job is a state rather than a result.
---

## Composition

A state is not a lesser surface — it is the surface, for as long as it lasts, and it
holds the same posture as a finished answer: one plain statement, near-black tiers,
confident silence around it. The state names itself and stops; it never performs,
apologizes, or decorates.

**The four-block contract is conditioned here.** An empty or error state is *not*
forced into answer/evidence/meaning/action. When there is no result, there is no
evidence to show and often no meaning to interpret — the state line takes the
answer's position and scale posture (left-aligned, first major region, band
unshared per the [negative-space frame](pattern.negative-space)), optionally followed by
at most one [pill action](pattern.action) that resolves the state (*Retry*, *Add an
account*). Rendering a hollow four-block scaffold around a missing result is
skeleton theater by another name.

**Loading and streaming — honest and minimal.** If the answer is not ready, the
streaming state is honest and minimal, never a fake page: no skeleton loaders, no
placeholder shimmer promising an answer the surface does not yet have, no layout
that reflows when the real data lands. Per the [deletion
discipline](principle.deletion-discipline), a skeleton loader is hedging rendered as UI —
it says "we are still thinking," and Decisive Dark never says that. Show the
smallest true statement (*Getting your figures*) in `--color-text-subtle`, and let
the answer arrive settled — final figure, final layout — spending the surface's one
`--dd-settle-budget` settle-in on the [answer](pattern.answer) or not at all.

**Empty data — stated, never apologized.** No apologetic empty states: *"sorry,
nothing yet"* → *"nothing yet."* The empty statement is plain and declarative in
neutrals (*No transactions this month*), with no illustration, no mascot, no
consolation paragraph. If the emptiness has a next move, one neutral pill offers it;
if not, the quiet is the answer.

**Error and blocked — reserved status hues, named downsides.** `--color-danger` is
for true danger only, `--color-warning` for true warning — never mood, never
emphasis, never a tinted panel wash. An error names what failed and, where possible,
what to do (*Couldn't reach your bank — Retry*); a blocked state states plainly that
the action is not there to take, using the receded `--dd-pill-disabled` /
`--color-text-disabled` treatment rather than hiding the control.

**Copy voice in every state.** Verb-first atoms and exact statements, sentence case,
no terminating periods, em dashes for breaks. No hedging, no customer-service tone,
no exclamation. The state variants covered are loading/streaming, positive trend,
negative trend, steady, blocked, empty data, and error — the trend and steady
variants resolve in neutrals and the reserved status hues on the
[evidence](pattern.evidence), never in mood color.

**Bound vs open.** Bound: one plain state line in the answer's position; neutrals
plus reserved status hues only; no skeleton loaders, shimmer, illustration, or
apology; no forced four-block scaffold; verb-first sentence-case copy with no
terminating period. Open: whether a resolving action pill appears, whether the state
line carries a `--dd-source-note`-style detail beneath it, and the exact wording —
so long as it is a statement, not a plea.

Related: reinforces `pattern.answer`, `pattern.action`, `principle.deletion-discipline`.

## Skeleton

```html
<section class="dd-state"
         style="margin-top: var(--dd-top-safe); margin-bottom: var(--dd-answer-clear);
                text-align: left;">
  <p style="font-size: var(--text-lg); color: var(--color-text-standard);
            margin: 0;">{Nothing yet}</p>
  <!-- error form: name what failed, plainly -->
  <!-- <p style="font-size: var(--text-lg); color: var(--color-danger);
            margin: 0;">{Couldn't reach your bank}</p> -->
  <!-- optional single resolving action — neutral pill, verb-first -->
  <button style="height: var(--dd-pill-height); padding: var(--dd-pill-pad);
                 border-radius: var(--radius-pill); border: none;
                 background: var(--dd-pill); color: var(--dd-pill-text);
                 font-family: var(--font-sans); font-size: var(--text-sm);
                 margin-top: var(--space-5); cursor: pointer;">{Retry}</button>
</section>
```
