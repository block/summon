# Workbench - Design Direction

This is the design direction for Workbench - a dense, neutral UI vocabulary for
operational tools. Response shape is your call based on the user's intent; this
document tells you how things look once you've picked a shape.

## Character

Quiet, structured, and useful under repetition. Workbench favors compact rows,
clear fields, neutral surfaces, and predictable grouping. It is meant for
scanning, comparing, reviewing, and taking small actions without visual drama.

## Signature

- Neutral by default. Most surfaces should be white, muted gray, or bordered.
- Density is a virtue. Use compact type, tight groups, and stable columns.
- No shadows. Hierarchy comes from dividers, muted insets, and section rhythm.
- Controls are restrained: `--radius-sm` or `--radius-md`, clear labels, and
  consistent heights.
- Color appears only for state and warnings. Avoid decorative accent fills.
- Tables, lists, property grids, and review panels are natural fits.

## Decisions

### Color

- Use `--color-bg` for the page and `--color-surface` for panels.
- Use `--color-surface-muted` for inset filter bars, secondary rows, disabled
  states, and low-emphasis callouts.
- Keep `--color-accent` dark and quiet. It is available for a primary action or
  selected state, not ambient decoration.
- Semantic colors should be small and local: status dots, badges, inline
  warnings, and validation feedback.

### Shape

- Use `--radius-sm` for inputs, small controls, and tight containers.
- Use `--radius-md` or `--radius-lg` for panels. Do not pill-round cards.
- Use `--radius-pill` only for compact badges, counts, and status chips.

### Typography

- Body and rows use `--text-sm` or `--text-md` with comfortable but compact
  leading.
- Headings stay modest: `--text-lg` or `--text-xl`, not hero-scale unless the
  prompt asks for a summary-first surface.
- Use `--font-mono` for IDs, timestamps, codes, and aligned numeric metadata.
- Uppercase labels are allowed for table headers and dense metadata, but keep
  them small and sparse.

### Rhythm

- Dense row gaps use `--space-1` and `--space-2`.
- Form groups and card internals use `--space-3` and `--space-4`.
- Panel separation uses `--space-5` or `--space-6`.
- Keep columns aligned and avoid masonry or staggered layouts.

### Surface hierarchy

- Prefer full-width bands, tables, and grouped lists over decorative cards.
- A border is usually enough. If a muted background is already present, do not
  add extra decoration.
- Selected and active rows should be visually obvious but still neutral.

## Voice guidance for generated content

- Use concrete operational copy: "Queued", "Owner missing", "Last checked 9:42".
- Keep labels short and predictable.
- Prefer scannable rows, fields, and statuses over long explanatory paragraphs.
