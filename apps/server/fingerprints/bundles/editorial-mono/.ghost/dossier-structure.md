---
description: The dossier structure — a lettered `--editorial-index-char` section ladder for 3+ sequential movements, `--editorial-verdict-frame` paired hairlines that frame the verdict block once per document, a constrained named-block vocabulary, a plain mono contents index instead of interface chrome, a colophon register shift, and the serif logotype as the only identity mark. Reach for how a long-form document orders its movements and frames its one verdict.
relates:
  - to: masthead
    as: reinforces
  - to: inverse-panel
    as: reinforces
  - to: metadata
    as: reinforces
---

## Composition

A long Editorial Mono document reads as a dossier: an edited sequence of named
movements, ordered by a lettered ladder, framed once at its verdict, and closed
by a colophon — never a scroll of ad-hoc panels. The structure is combination,
not novelty: every region on the page is one of a fixed set of named blocks, and
the document's character comes from how they are ordered, not from inventing new
furniture.

**Lettered section ladder.** When a document runs three or more sequential
movements, index them with mono characters — `A.` `B.` `C.` or `01` `02` `03` —
set in `--editorial-index-char-font` at `--editorial-index-char-size` with
`--editorial-index-char-tracking`, placed adjacent to the serif section heading
and separated from it by `--editorial-index-char-gap`. The ladder exists to make
sequence legible, so it appears only when there is a real sequence: fewer than
three movements take no index characters, and the characters are never decorative
numerals, oversized ghost digits, or ornamental chapter art. The index character
is [mono metadata](metadata) furniture — tracked, exact, press-set — not display
type.

**Verdict framing.** The verdict block may be framed exactly once per document:
a `--editorial-verdict-frame-rule` hairline above and its pair below, optionally
registered with `--editorial-verdict-frame-tick` corner ticks like crop marks on
a proof sheet. The paired hairlines mark the one place the document commits —
whether the verdict rides the [single inverse-ink panel](inverse-panel) or sits
on paper. Framing a second region, or boxing evidence, captions, or asides in
the same treatment, spends the emphasis and collapses the frame into decoration;
if two moments compete for the frame, the verdict wins.

**Constrained block vocabulary.** The dossier is assembled from a fixed set of
named blocks and nothing else: the **verdict** (framed or inverse), the
**evidence table** ([ruled evidence bands](evidence) or justified columns), the
**aligned comparison**, the **prose argument** (serif article voice under the
[masthead](masthead) register), and the **source list** (mono, ruled, cited).
No ad-hoc callouts, tinted panels, icon boxes, or one-off widgets — if content
does not fit a named block, it is edited until it does, or it demotes into the
prose argument. Variety comes from the order and weight of these blocks, never
from inventing a sixth.

**Contents as catalog.** When the contents index runs long — many movements,
appendices, or cited sources — it takes the [catalog index grammar](catalog-index):
each entry opened by its mono counter or ladder character, entries aligned on
one shared measure, folios flush right, the whole sequence visible at once. The
contents page of a well-set book is itself a specimen of the book's discipline;
here it doubles as proof that the document knows its own order before the reader
commits to it.

**Interface subtraction.** A dossier carries no interface chrome: no sticky
navigation, no tab strips, no floating table-of-contents widgets. If a document
is long enough to need orientation, set a plain mono contents index styled like
a book's contents page — entry, leader space at `--editorial-contents-indent`,
folio — using the same `--editorial-folio-font` discipline as every other label.
The contents index is printed matter on the page, not a control panel above it.

**Register shift by document role.** The colophon or credits region may drop to
`--editorial-colophon-size` at `--editorial-colophon-leading` in the mono voice
and take a more personal register — who set the page, when, from what sources.
The shift is typographic only: smaller mono, looser voice, same black ink on the
same paper. Color never marks the register change; ink stays black, per the
core stance.

**Type as logotype.** The document's identity mark is type itself: the display
serif set at `--editorial-logotype-size` with `--editorial-logotype-tracking`,
recurring at the same size and tracking wherever the document names itself — the
masthead, a folio corner, the colophon. No graphic marks, monograms, or ornament;
the logotype is a recurring typographic fact, and its consistency is the brand.

New tokens in the editorial namespace (extending the core vocabulary):

```css
:root {
  /* Lettered section ladder — mono index characters beside serif headings, 3+ movements only. */
  --editorial-index-char-font: var(--font-mono);
  --editorial-index-char-size: var(--text-sm);
  --editorial-index-char-tracking: var(--tracking-label);
  --editorial-index-char-gap: var(--space-4);

  /* Verdict framing — paired hairlines above and below the one verdict block, once per document. */
  --editorial-verdict-frame-rule: var(--editorial-hairline);
  --editorial-verdict-frame-tick: "┐"; /* optional corner tick, set like a crop mark */
  --editorial-verdict-frame-gap: var(--space-4);

  /* Plain mono contents index — a book's contents page, not a nav control. */
  --editorial-contents-indent: var(--space-6);

  /* Colophon register shift — smaller mono, personal voice, same black ink. */
  --editorial-colophon-size: var(--text-xs);
  --editorial-colophon-leading: var(--leading-body);

  /* Type-as-logotype — the display serif at one recurring reference size and tracking. */
  --editorial-logotype-font: var(--font-serif);
  --editorial-logotype-size: var(--text-lg);
  --editorial-logotype-tracking: var(--tracking-tight);
}
```

The ladder orders the movements the [masthead](masthead) opens; the frame spends
the same emphasis budget as the [inverse-ink panel](inverse-panel); the contents
index, index characters, and colophon all speak in the [mono metadata](metadata)
voice; and the dossier still lands on the [editorial close](close) as its final
committed line.
