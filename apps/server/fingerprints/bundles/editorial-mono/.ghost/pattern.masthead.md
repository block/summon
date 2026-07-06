---
description: The masthead / deck / folio shell — the editorial frame that opens a page with compact mono metadata, an oversized serif verdict headline, a serif `--editorial-dropcap` initial, an interpreting deck, and the `--editorial-rule-heavy` seam over a strict body grid. Reach for how the surface frames its verdict and opens the composed page.
---

## Composition

A composed Editorial Mono surface opens with a masthead-like frame that makes the
verdict the visual event before any supporting detail. The shell carries the page
the way a printed front page does: compact metadata above the fold, an oversized
serif verdict headline with tight line-height as the visual event, a deck for
interpretation rather than filler, a strong rule under the masthead, a strict body
grid, and a restrained close.

**Masthead / deck / folio shell.** Lead with the masthead frame — set the verdict
headline in serif display at the largest scale on the page, give it tight
`--leading-display` and negative `--tracking-display`, and let it wrap cleanly with
responsive line breaks while leaving at least 72px of top breathing room for host
chrome. Open the article voice with a serif initial: the deck or lead paragraph
takes an `--editorial-dropcap-font` drop cap sized at `--editorial-dropcap-size`,
set at `--editorial-dropcap-leading` and spanning `--editorial-dropcap-lines` lines,
anchored to the top-left so the column announces its editorial register before a
word is read. The deck beneath interprets the claim in the serif article voice; it
earns its place by adding judgment, never by restating the headline. Close the
masthead with the `--editorial-rule-heavy` rule — not a faint hairline — so its
2px ink weight reads as the deliberate seam that opens the strict body grid below
it. The body sits on a faint ruled paper grid, sets type in the serif workhorse,
and keeps geometry squared so the page reads as edited paper rather than a card
layout.

**The breath before the claim.** A well-set front page does not start at its own
top edge. Above the masthead, spend real emptiness — a `--space-9` or `--space-10`
band of bare paper carrying only the folio corner — so the verdict headline lands
after a pause, the way a printed opening spread breathes before the text begins.
The emptiness is deliberate stock, not wasted room: it is what makes the display
serif feel decisive when it finally arrives, and it absorbs the 72px host-chrome
obligation without crowding. Never fill this band with a preamble, a logo lockup,
or an ornament; the pause is the ornament.

**The sheet as an object.** The masthead frame may treat the whole surface as a
single printed sheet: the page-tier paper (`--editorial-paper-page`) running edge
to edge, with the shell tier (`--editorial-paper-shell`) set inside it like a
trimmed leaf laid on the desk, its edge cut by a hairline rather than a shadow.
This is print-object framing — the reader should feel they are holding one
composed document, not scrolling a feed. The distinction between tiers is stock
weight, read from the two paper values and a rule; never elevation, texture
images, or skeuomorphic curl.

**Bound:** the order (breath → masthead → heavy seam → body → close), the
`--editorial-rule-heavy` seam under the masthead, the folio-only emptiness above
it, the display-serif headline as the largest type, and the deck's interpreting
role. **Open:** the measure and column count of the body grid, whether the deck
takes the drop cap, whether the shell tier (`--editorial-paper-shell`) frames
the sheet inside the page tier, and how the close is labeled.

The headline and deck carry the verdict; the [mono metadata system](pattern.metadata) sets
the folio, issue label, and timestamps that frame the masthead, and the
[ruled evidence bands](pattern.evidence) fill the body grid beneath the strong rule. The
shell ends in the [editorial close](pattern.close) rather than a passive recap.

Related: reinforces `pattern.metadata`, `pattern.evidence`.

## Skeleton

```html
<article class="sheet" style="background: var(--editorial-paper-page); background-image: var(--editorial-ruled-paper); color: var(--color-text); font-family: var(--font-serif);">
  <!-- The breath before the claim: bare paper, folio corner only -->
  <div class="breath" style="padding-top: var(--space-9);">
    <p class="folio" style="font-family: var(--editorial-folio-font); font-size: var(--editorial-folio-size); letter-spacing: var(--editorial-folio-tracking); text-transform: uppercase; color: var(--color-text-muted);">
      ✚ <!-- folio · issue label · set date --></p>
  </div>

  <header class="masthead" style="border-bottom: var(--editorial-rule-heavy); padding-bottom: var(--space-6);">
    <h1 class="verdict-headline" style="font-size: var(--text-2xl); line-height: var(--leading-display); letter-spacing: var(--tracking-display);">
      <!-- the verdict as a claim, largest type on the page --></h1>
    <p class="deck" style="font-size: var(--text-md); line-height: var(--leading-reading); color: var(--color-text-alt); max-width: 60ch;">
      <!-- interpretation of the claim — judgment, never restatement --></p>
  </header>

  <main class="body-grid" style="padding-top: var(--space-7);">
    <!-- ruled evidence bands / dossier blocks on the strict body grid -->
  </main>

  <footer class="close" style="border-top: var(--editorial-rule-heavy); padding-top: var(--space-4);">
    <!-- editorial close: decision, risk, or next action -->
  </footer>
</article>
```
