---
description: An annotated stream fragment — a dense four-row run on the ticked rail interrupted by one mint transmission card — showing the cadence, the filing card, and the flat-depth rule with real tokens; pull it as the quality bar before composing any feed.
---

## Fragment

A run of compact stream rows on the signal rail, broken by one saturated
transmission-card interruption, then resuming. This is the load-bearing rhythm
of any Signal Stream feed.

```html
<section style="background: var(--color-bg); color: var(--color-text); font-family: var(--font-sans); padding: var(--space-6);">
  <!-- Dense run: rows ride the ticked rail, gaps at --signal-cadence-run-gap -->
  <ol style="list-style: none; margin: 0; padding: 0; border-left: var(--signal-rail-width) solid var(--signal-rail-color); display: flex; flex-direction: column; gap: var(--signal-cadence-run-gap);">
    <li style="position: relative; padding-left: var(--signal-rail-gap);">
      <span style="position: absolute; left: -5px; top: 6px; width: var(--signal-rail-tick-size); height: var(--signal-rail-tick-size); background: var(--signal-rail-tick-recent);"></span>
      <span style="font-family: var(--signal-pill-font); font-size: var(--signal-pill-size); text-transform: uppercase; letter-spacing: var(--signal-pill-tracking); color: var(--color-text-muted);">13:07&nbsp;UTC&nbsp;·&nbsp;LIVE</span>
      <h3 style="margin: var(--space-1) 0 0; font-size: var(--text-lg); line-height: var(--leading-section);">Booster static fire completes on second attempt</h3>
    </li>
    <li style="position: relative; padding-left: var(--signal-rail-gap);">
      <span style="position: absolute; left: -5px; top: 6px; width: var(--signal-rail-tick-size); height: var(--signal-rail-tick-size); background: var(--signal-rail-tick-color);"></span>
      <span style="font-family: var(--signal-pill-font); font-size: var(--signal-pill-size); text-transform: uppercase; letter-spacing: var(--signal-pill-tracking); color: var(--color-text-muted);">12:41&nbsp;UTC</span>
      <h3 style="margin: var(--space-1) 0 0; font-size: var(--text-lg); line-height: var(--leading-section);">Range weather holds at 80% favorable</h3>
    </li>
    <li style="position: relative; padding-left: var(--signal-rail-gap);">
      <span style="position: absolute; left: -5px; top: 6px; width: var(--signal-rail-tick-size); height: var(--signal-rail-tick-size); background: var(--signal-rail-tick-color);"></span>
      <span style="font-family: var(--signal-pill-font); font-size: var(--signal-pill-size); text-transform: uppercase; letter-spacing: var(--signal-pill-tracking); color: var(--color-text-muted);">12:12&nbsp;UTC</span>
      <h3 style="margin: var(--space-1) 0 0; font-size: var(--text-lg); line-height: var(--leading-section);">Payload fairing encapsulation confirmed</h3>
    </li>
    <li style="position: relative; padding-left: var(--signal-rail-gap);">
      <span style="position: absolute; left: -5px; top: 6px; width: var(--signal-rail-tick-size); height: var(--signal-rail-tick-size); background: var(--signal-rail-tick-color);"></span>
      <span style="font-family: var(--signal-pill-font); font-size: var(--signal-pill-size); text-transform: uppercase; letter-spacing: var(--signal-pill-tracking); color: var(--color-text-muted);">11:58&nbsp;UTC</span>
      <h3 style="margin: var(--space-1) 0 0; font-size: var(--text-lg); line-height: var(--leading-section);">Crew access arm retraction rehearsal wraps</h3>
    </li>
  </ol>

  <!-- Interruption: one full-width saturated tile with a mono filing card.
       Held dark field on both sides at --signal-cadence-break-gap. -->
  <article style="margin: var(--signal-cadence-break-gap) 0; background: var(--signal-tile-fill-mint); color: var(--signal-hazard-mint-fg); border: var(--signal-tile-border); border-radius: var(--signal-tile-radius); box-shadow: var(--signal-tile-shadow); padding: var(--space-7);">
    <span style="font-family: var(--signal-ref-font); font-size: var(--signal-ref-size); letter-spacing: var(--signal-ref-tracking); text-transform: uppercase;">SIG-04 · TRANSMISSION</span>
    <h2 style="margin: var(--space-2) 0 var(--space-4); font-family: var(--signal-shout-font); font-weight: var(--signal-shout-weight); font-size: var(--text-3xl); line-height: var(--signal-shout-leading); letter-spacing: var(--signal-shout-tracking); text-transform: var(--signal-shout-transform);">Launch window moves up forty minutes</h2>
    <dl style="margin: 0; border: var(--signal-card-border); background: var(--color-surface); color: var(--color-text); border-radius: var(--radius-sm); padding: var(--space-3); font-family: var(--signal-card-font); font-size: var(--signal-card-size); display: grid; grid-template-columns: var(--signal-card-key-width) 1fr; row-gap: var(--signal-card-row-gap);">
      <dt style="color: var(--signal-card-key-color); text-transform: uppercase;">REF</dt><dd style="margin: 0;">SIG-04</dd>
      <dt style="color: var(--signal-card-key-color); text-transform: uppercase;">TIME</dt><dd style="margin: 0;">13:07 UTC</dd>
      <dt style="color: var(--signal-card-key-color); text-transform: uppercase;">STATE</dt><dd style="margin: 0;">WINDOW REVISED</dd>
      <dt style="color: var(--signal-card-key-color); text-transform: uppercase;">CAT</dt><dd style="margin: 0;">LAUNCH OPS</dd>
    </dl>
  </article>

  <!-- Run resumes: the rail continues, the margin voice cites the card. -->
  <p style="margin: 0; font-family: var(--signal-margin-font); font-size: var(--signal-margin-size); letter-spacing: var(--signal-margin-tracking); color: var(--signal-margin-color); text-transform: uppercase;">→ REF: SIG-04 — revised T-0 propagates to all rows below</p>
</section>
```

## What is load-bearing

- **The run/interruption alternation.** Four rows at
  `--signal-cadence-run-gap` (12px) read as one burst; the mint tile spans full
  width with `--signal-cadence-break-gap` (64px) of dark field held on both
  sides. Remove the held gap and the interruption stops interrupting.
- **The ticked rail.** The 2px muted spine with mint ticks and one violet
  `--signal-rail-tick-recent` marker makes order and recency legible before a
  word is read. It must survive any layout collapse.
- **The flat tile.** `box-shadow: var(--signal-tile-shadow)` resolves to
  `none` — the mint fill, black `-fg` text, and 1px white border are the entire
  elevation story. Adding any shadow here breaks the language.
- **The filing card.** Mono key–value rows with a fixed `--signal-card-key-width`
  (9ch) column, mint keys, real task-derived values. Every field is real or
  omitted — no filler.
- **One voltage per moment.** The interruption is mint; the only violet in the
  fragment is the recency tick. Two voltages, each with one job.
- **The resolving citation.** `→ REF: SIG-04` in the margin voice points at a
  real anchor on the surface — a dangling ref code is a broken transmission.

## What is incidental

The launch-ops subject matter, the specific timestamps, the four-row run length
(anywhere near `--signal-cadence-run-length` works), the `<ol>`/`<dl>` element
choices, and the inline styles (a real surface would use classes bound to the
same tokens). The headline copy is fictional by rule, not by accident — swap it
freely, never for a real publisher's title.
