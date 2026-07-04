---
description: The editorial cadence system — a four-column backbone with full-bleed breakouts, mono-set technical data labels, numbered chapter chips, typographic collaboration lockups, a single emergence reveal recipe, vertical continuity between bands, and grain as the only permitted texture. Reach for it when a long surface must read as an edited film in chapters rather than a stack of sections.
---

## Composition

Cinema needs an editor. The cadence system paces a Redline Cinema surface the way
a film is cut — one grid, one reveal, one texture, numbered chapters — so the page
reads as a sequence of acts, never a pile of components.

**Mono-technical data layer.** A monospace voice set at `--redline-mono-label`
(11px uppercase, `--redline-mono-tracking` wide tracking) is reserved strictly for
spec data callouts, section indices, and production-tag labels — `01 / CHASSIS`,
`0–100 · 2.9S` — sitting small inside near-black bands. Mono is a data instrument,
never a body or headline face; the moment mono carries prose, the technical read
collapses into terminal cosplay. Display and body stay on the restrained sans.

**Four-column backbone with full-bleed breakouts.** Every section commits to one
consistent `--redline-grid-columns` (4) backbone at `--redline-grid-gutter`
(24px). Hero photography breaks full-bleed across the whole grid at
`--redline-frame-bleed`; captions, spec tables, and editorial copy snap back onto
the columns. No ad-hoc per-section grids — the discipline of one grid is what
makes the full-bleed breakout feel like an event rather than an inconsistency.

**Numbered chapter chips.** Each act opens with a sharp rectangular outline chip —
mono uppercase inside a `--redline-chapter-chip-border` (1px hairline) frame,
squared at `--redline-machined-radius`, reading `[ 03 — POWERTRAIN ]`. Red marks
the current chapter only, and only when the chapter marker is the region's one
voltage spend; every other chip stays hairline-and-ink. No pill shapes, no filled
red on every tag — a row of red chips is a row of nothing.

**Typographic collaboration lockups.** Partnerships and pairings are set as a
single tracked-uppercase typographic lockup, the two names joined by a thin
`--redline-lockup-rule` red hairline or a `×` glyph — never a third-party
logotype, mark, or licensed wordmark. The lockup keeps the surface
source-agnostic: the relationship is typography, not borrowed identity.

**Opening titles, not a loading bar.** When a surface earns an entrance, the
first moments are composed as opening credits: the full-bleed hero frame settles
first, then the eyebrow, headline, and deck emerge in one staggered pass of the
standard reveal recipe — establishing the visual language before any dense
detail. The sequence is the same emergence recipe run once at the top, never a
separate loader vocabulary: no progress bars, no spinner cards, no percentage
counters. Whatever frame opens the entrance is the same frame the hero keeps, so
arrival flows into reading with no reset. The no-JS and reduced-motion state is
simply the composed page — the credits are decoration, never a gate.

**Sans and mono, a deliberate duality.** The two voices are cast against each
other on purpose: the restrained sans carries expression — display, decks, body,
uppercase labels — while the mono layer carries instrumentation — indices, spec
callouts, timecode, production tags. Artistic voice and technical voice sit side
by side in the same band, and neither borrows the other's job. A surface that
sets everything in one voice loses the duality; a surface that lets mono creep
into prose loses the precision.

**Emergence over entrance.** One reveal recipe serves the entire surface:
opacity 0→1 plus a `--redline-reveal-rise` (40px) vertical translate on
`--redline-ease-cinematic`, staggered across siblings via IntersectionObserver.
The resting and no-JS state is fully composed and legible — motion decorates
entry, it never gates content. No 3D scroll transforms, no scroll-jacking, no
parallax theatrics; elements emerge from the dark, they do not perform.

**Directional vertical continuity.** Acts transition softly and vertically — the
reader always moves down through the film. A story closes by ushering into a
next-chapter strip that borrows that story's hero image as the bridge, so the
[cinematic image](pattern.cinematic-image) hands the reader forward. No crossfade-to-white
between sections, no page-flip conceits; the near-black stage stays continuous
underneath.

**Grain, the only texture.** A subtle static film-grain overlay at
`--redline-grain-opacity` (0.05) is the single permitted texture — for loader
frames, band seams, and hover surfaces. No gradients-as-texture, no blur panels,
no glass; grain is atmosphere on the near-black stage, held so low it is felt
before it is seen.

**Red scarcity, codified.** Red appears at most once per viewport, and only on the
highest-intent element in view — the CTA, the decisive value, or the current
chapter chip, never two at once. If two things are red, neither is important; the
cadence system enforces the scarcity that the [controls](pattern.controls) and
[spec system](pattern.spec-system) each spend locally.

```css
:root {
  /* EDITORIAL CADENCE — one grid, one reveal, one texture, numbered chapters. */
  --redline-mono-label: 11px; /* mono reserved for spec data, indices, production tags — never body or headlines */
  --redline-mono-tracking: 0.14em; /* wide uppercase tracking for the mono-technical layer */
  --redline-grid-columns: 4; /* the single four-column backbone every section commits to */
  --redline-grid-gutter: 24px; /* consistent gutter; breakouts go full-bleed, content snaps back */
  --redline-chapter-chip-border: 1px solid #4a4a4a; /* sharp rectangular chapter chip outline — no pills, no filled red per tag */
  --redline-lockup-rule: 1px solid #da291c; /* thin red rule joining a typographic collaboration lockup — never a logotype */
  --redline-reveal-rise: 40px; /* the one emergence recipe: opacity 0→1 + this translate, staggered, no-JS safe */
  --redline-grain-opacity: 0.05; /* subtle static film grain — the only permitted texture, no gradients-as-texture or blur */
}
```

This cadence paces the [cinematic image](pattern.cinematic-image) breakouts and the
[hairline and brightness depth](principle.depth) rhythm into numbered acts, gives the
[large-number spec system](pattern.spec-system) its mono data voice, and holds the
[scarce-red controls](pattern.controls) to one voltage spend per viewport; the
[single red livery band](pattern.livery-band) remains the lone moment allowed to break the
vertical calm the cadence otherwise keeps.

Related: reinforces `pattern.cinematic-image`, `principle.depth`, `pattern.spec-system`; contrasts with `pattern.livery-band`.
