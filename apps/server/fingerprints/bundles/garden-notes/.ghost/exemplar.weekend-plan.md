---
description: The reference planning surface — a complete note panel with context header, one green-dot next step naming its tradeoff, a can-wait slip, a kept note, and an unclosed later-edge, built entirely from the real --garden-* tokens. Pull before composing any plan to see the whole voice at once.
---

A complete Garden Notes plan for a real, low-stakes personal task. Everything a
generated surface needs is demonstrated here: the context header, the single
chosen step, quiet chips, a kept note, and the open ending.

```html
<main style="background: var(--color-bg); font-family: var(--font-sans); color: var(--color-text); padding: var(--space-8) var(--space-5) 0; min-height: 100vh;">
  <section style="max-width: 640px; margin: 0 auto; background: var(--garden-note-paper), var(--garden-paper-texture); background-size: auto, var(--garden-paper-texture-size); border: 1px solid var(--color-border); border-radius: var(--garden-panel-radius-lg); box-shadow: var(--garden-note-lift); padding: var(--space-6);">

    <!-- Context header: the person's actual situation, never advice -->
    <h1 style="font-size: var(--text-xl); letter-spacing: var(--tracking-tight); line-height: var(--leading-section); margin: 0 0 var(--space-2);">Repotting the balcony herbs before Mara visits Saturday</h1>
    <p style="color: var(--color-text-muted); font-size: var(--text-sm); line-height: var(--leading-body); margin: 0 0 var(--space-5);">Two pots are root-bound, the basil is fine. You have the terracotta pots already — just no fresh soil.</p>

    <!-- The one chosen next step: green dot, tradeoff named gently -->
    <div style="border: 1px solid var(--color-border); border-radius: var(--garden-panel-radius); background: var(--garden-note-paper); box-shadow: var(--garden-note-lift); padding: var(--space-4) var(--space-5); margin-bottom: var(--space-4);">
      <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2);">
        <span style="width: var(--garden-chosen-marker); height: var(--garden-chosen-marker); border-radius: 50%; background: var(--garden-chosen-dot); box-shadow: var(--garden-chosen-ring);"></span>
        <strong style="color: var(--color-accent); font-size: var(--text-md);">Pick up one bag of potting soil today</strong>
      </div>
      <p style="margin: 0 0 var(--space-3); font-size: var(--text-sm); line-height: var(--leading-body);">The garden shop on Elm closes at 6. One small bag covers both pots — buying just enough beats a perfect soil comparison you don't need for two herb pots.</p>
      <div style="display: flex; gap: var(--space-2);">
        <span style="border-radius: var(--garden-chip-radius); background: var(--garden-chip-face); color: var(--garden-chip-ink); border: var(--garden-chip-edge); padding: var(--garden-chip-pad); font-size: var(--text-xs); letter-spacing: var(--tracking-label);">Ready</span>
        <span style="border-radius: var(--garden-chip-radius); background: var(--garden-chip-face); color: var(--garden-chip-ink); border: var(--garden-chip-edge); padding: var(--garden-chip-pad); font-size: var(--text-xs); letter-spacing: var(--tracking-label);">Low effort</span>
      </div>
    </div>

    <!-- Can-wait slip: flat on the panel, no lift, no dot -->
    <div style="border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-3) var(--space-4); margin-bottom: var(--space-4);">
      <p style="margin: 0; font-size: var(--text-sm); color: var(--color-text-alt); line-height: var(--leading-body);">Repotting itself can wait for Saturday morning — it takes twenty minutes and the herbs are happier moved once, not twice.</p>
      <span style="display: inline-block; margin-top: var(--space-2); border-radius: var(--garden-chip-radius); background: var(--garden-chip-face); color: var(--garden-chip-ink); border: var(--garden-chip-edge); padding: var(--garden-chip-pad); font-size: var(--text-xs); letter-spacing: var(--tracking-label);">Can wait</span>
    </div>

    <!-- Kept note: settled, not struck through -->
    <div style="background: var(--garden-kept-paper); color: var(--garden-kept-ink); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-3) var(--space-4); font-size: var(--text-sm); line-height: var(--leading-body);">
      Texted Mara the balcony photos — she's bringing the rosemary cutting.
      <span style="margin-left: var(--space-2); border-radius: var(--garden-chip-radius); background: var(--garden-chip-face); color: var(--garden-chip-ink); border: var(--garden-chip-edge); padding: var(--garden-chip-pad); font-size: var(--text-xs); letter-spacing: var(--tracking-label);">Kept</span>
    </div>

    <!-- Unclosed later-edge: fades, no border, no prompt -->
    <div style="margin-top: var(--space-5); padding-bottom: var(--space-4); color: var(--garden-quiet-note); font-size: var(--text-sm); line-height: var(--leading-body); -webkit-mask-image: linear-gradient(180deg, #000 40%, transparent 100%); mask-image: linear-gradient(180deg, #000 40%, transparent 100%);">
      Later, when it's warmer — the tomato planter, new drip saucers, maybe the trellis…
    </div>
  </section>
</main>
```

## What is load-bearing

- **The context header** carries prompt facts — Mara, Saturday, root-bound pots,
  terracotta already owned. Replace it with "Your Gardening Plan" and the whole
  surface collapses into template.
- **Exactly one `--garden-chosen-dot`**, on the chosen step, haloed by
  `--garden-chosen-ring`. Its paragraph names the accepted tradeoff ("buying
  just enough beats a perfect soil comparison") — kind nudge, not verdict.
- **One `--garden-note-lift` shared** by the outer shell and the chosen note;
  the can-wait slip and kept note stay flat, separated by borders and space.
  That asymmetry is the depth system.
- **The kept note** sits on `--garden-kept-paper` in `--garden-kept-ink` with a
  plain "Kept" chip — no strikethrough, no success-green, no praise copy. Done
  work is held, not crossed off.
- **The later-edge fades and ends nothing** — no closing rule, no call to
  action, `--garden-quiet-note` ink dissolving toward the field.
- **Every chip is the one quiet recipe** (`--garden-chip-face` /
  `--garden-chip-ink` / `--garden-chip-edge` / `--garden-chip-pad`) and names a
  real state in words.

## What is incidental

The herb subject matter, the 640px measure, the exact copy, the number of
supporting notes, and using inline styles rather than classes are all
replaceable. The mask-image fade is one way to realize `--garden-later-fade`'s
intent; an overlaid gradient works too. What must survive any variation: warm
cream over flat white, one dot, one lift, kept-not-struck, and an open ending.
