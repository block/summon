---
description: The reference answer surface in full — streamed four-block composition with a display numeral hero, discrete neutral bars with one accent spend, one-sentence meaning, and a pill action stack, annotated so the load-bearing moves are named and the incidental content is marked swappable.
---

## The fragment

A complete Decisive Dark answer surface for the question *"How's my spending
this month?"* — every value drawn from the bundle's token vocabulary:

```html
<main style="background: var(--dd-bg-app); color: var(--color-text-standard);
             font-family: var(--font-sans); min-height: 100vh;
             padding: var(--dd-top-safe) var(--dd-frame-gap) var(--dd-frame-gap);">

  <!-- Block 1: the streamed answer — the loudest element, band unshared -->
  <section style="margin-bottom: var(--dd-answer-clear);">
    <p style="font-size: var(--text-sm); color: var(--color-text-subtle);
              margin: 0 0 var(--space-2);">Spent this month</p>
    <h1 style="font-size: var(--dd-numeral); font-weight: 500;
               font-feature-settings: var(--dd-tnum);
               letter-spacing: var(--dd-tracking-numeral);
               line-height: var(--dd-hero-leading); margin: 0;">$2,418</h1>
  </section>

  <!-- Block 2: discrete evidence — frameless bars on the open canvas -->
  <section aria-label="Weekly spending" style="margin-bottom: var(--dd-block-gap);">
    <div style="display: flex; align-items: flex-end; gap: var(--dd-bar-gap); height: 120px;">
      <div style="flex: 1; height: 62%; background: var(--dd-bar-neutral); border-radius: var(--radius-sm) var(--radius-sm) 0 0;"></div>
      <div style="flex: 1; height: 88%; background: var(--dd-bar-neutral); border-radius: var(--radius-sm) var(--radius-sm) 0 0;"></div>
      <div style="flex: 1; height: 74%; background: var(--dd-bar-neutral); border-radius: var(--radius-sm) var(--radius-sm) 0 0;"></div>
      <!-- the single accent spend: this week's improving trend -->
      <div style="flex: 1; height: 41%; background: var(--dd-accent); border-radius: var(--radius-sm) var(--radius-sm) 0 0;"></div>
    </div>
    <div style="display: flex; gap: var(--dd-bar-gap); margin-top: var(--space-2);
                font-size: var(--text-xs); color: var(--dd-axis);
                font-feature-settings: var(--dd-tnum);">
      <span style="flex: 1;">W1 · $598</span>
      <span style="flex: 1;">W2 · $849</span>
      <span style="flex: 1;">W3 · $714</span>
      <span style="flex: 1;">W4 · $257</span>
    </div>
  </section>

  <!-- Block 3: one-sentence meaning — subtle line, load-bearing value lifted -->
  <section style="margin-bottom: var(--dd-block-gap);">
    <p style="font-size: var(--text-md); color: var(--color-text-subtle);
              line-height: var(--leading-body); margin: 0; max-width: 44ch;">
      You're trending down —
      <strong style="color: var(--color-text-standard); font-weight: 500;">$310 under</strong>
      your usual pace with a week to go</p>
  </section>

  <!-- Block 4: neutral pill action stack — accent already spent above -->
  <section style="display: flex; flex-direction: column; align-items: flex-start;
                  gap: var(--dd-stack-gap);">
    <button style="height: var(--dd-pill-height); padding: var(--dd-pill-pad);
                   border-radius: var(--radius-pill); border: none;
                   background: var(--dd-pill); color: var(--dd-pill-text);
                   font-family: var(--font-sans); font-size: var(--text-sm);
                   cursor: pointer;">Move $100 to savings</button>
    <button style="height: var(--dd-pill-height); padding: var(--dd-pill-pad);
                   border-radius: var(--radius-pill); border: none;
                   background: var(--dd-pill); color: var(--dd-pill-text);
                   font-family: var(--font-sans); font-size: var(--text-sm);
                   cursor: pointer;">Compare to last month</button>
  </section>
</main>
```

## What is load-bearing

- **One hero, no tie.** `$2,418` in `--dd-numeral` with `--dd-tnum` and
  `--dd-tracking-numeral` is unambiguously the loudest thing; its eyebrow
  label sits above the band, and `--dd-answer-clear` keeps the band unshared.
  Removing this dominance collapses the surface into a widget.
- **The accent is spent exactly once**, on the W4 bar — the earned positive
  trend. Because it is spent there, both pills stay neutral `--dd-pill`; an
  accent CTA here would be the two-accent failure the guards refuse.
- **Evidence is discrete and frameless.** Four bars at `--dd-bar-gap` on the
  bare canvas, three in `--dd-bar-neutral`, axis labels in `--dd-axis` with
  tabular figures. No panel fill, no gridlines, no smoothing — the heights
  state the trend before the labels are read.
- **Meaning is one sentence** in `--color-text-subtle` with only "$310 under"
  lifted to `--color-text-standard` at weight 500 — emphasis by ink and
  weight, not size or color.
- **The rhythm is gap → block → gap**: `--dd-answer-clear` then two
  `--dd-block-gap` intervals, no dividers, no headers. The gaps are the
  structure.
- **Nothing moves.** The fragment carries no animation; it arrives settled,
  per `--dd-settle-budget` (the one optional settle-in belongs to the hero or
  nowhere).

## What is incidental

The spending domain, the dollar figures, the four-week window, and the two
verb-first labels are all swappable content. A market chart would swap the
bars for candlesticks and read more technical; a verdict question would swap
the numeral for a `--dd-hero-size` headline. The composition — one hero,
discrete evidence, one sentence, neutral pills, one accent spend — is the
fingerprint.
