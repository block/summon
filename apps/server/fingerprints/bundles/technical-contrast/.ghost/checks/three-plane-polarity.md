---
name: three-plane-polarity-discipline
description: Plane usage must stay disciplined — three named polar planes as argument stages with full inversion on midnight, never rhythmic striping, middle-grey bands, or a midnight section that borrows light-plane tokens.
severity: medium
references:
  - principle.contrast-planes
  - pattern.instrumentation
  - index
---

The three-plane polarity is the bundle's most distinctive invariant: pale
technical landing (`--contrast-plane-pale-bg` #ebebeb), crisp white data sheet
(`--contrast-plane-sheet-bg` #ffffff), and near-black midnight proof plane
(`--contrast-plane-midnight-bg` #010120), each carrying its own fg/bg pair.
Read in order, the planes are the stages of an argument — claim, evidence,
proof — not a color scheme.

Reject the generated surface if:

- planes alternate rhythmically for visual variety (pale/white/midnight/white
  striping) with no argumentative pivot at each change — the midnight plane
  must arrive where the argument pivots from claim to evidence;
- a broad middle-grey background stands in for a named plane, or many tinted
  bands / grey-on-grey stacks appear with no polarity change;
- the midnight plane fails to fully invert: black ink or light-plane hairlines
  (`--contrast-edge-hairline`) surviving on near-black instead of white ink,
  `--contrast-edge-dark`/`--contrast-edge-midnight-soft` borders, and
  `--contrast-surface-midnight-raised` fills;
- a plane repeats the previous plane's job restyled instead of being merged —
  when the argument is short, fewer planes beat thinner ones;
- bands carry side gutters instead of full-bleed edges (`--contrast-band-inset: 0`)
  with the claim landing at the top of each band before any grid, table, or
  artwork;
- no constant anchor persists across the plane changes, so the flips read as
  three stitched pages rather than one document changing register.

Pass when each plane declares a distinct job, the midnight crossing reads as a
deliberate change of register via `--contrast-plane-invert`, and the sequence
advances an argument a scrolling reader can feel.
