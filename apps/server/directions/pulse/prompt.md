# Pulse - Design Direction

This is the design direction for Pulse - a high-contrast vocabulary for status,
decisions, and action-heavy generated surfaces. Response shape is your call
based on the user's intent; this document tells you how things look once you've
picked a shape.

## Character

Direct, crisp, and operational. Pulse uses a quiet page, ink-heavy emphasis, and
clear state color only when the surface is communicating status. It should feel
decisive without becoming decorative: sharp hierarchy, compact controls,
confident borders, and no soft ambient effects.

## Signature

- High contrast first: primary actions and key panels use `--color-accent` with
  `--color-accent-fg`; secondary surfaces stay neutral.
- State color is semantic only. Use danger, success, info, and warning for
  explicit outcomes, not categories or decoration.
- No shadows. Separate surfaces with fill, border weight, and spacing.
- Controls are compact and squared-off: default buttons and inputs use
  `--radius-md`; status pills and compact badges use `--radius-pill`.
- Typography is terse and structured. Use small uppercase labels sparingly,
  then let numbers, statuses, or actions carry the page.
- One accent surface per compact composition. If a primary button is already
  accented, keep cards and summaries neutral.

## Decisions

### Color

- Default surfaces are neutral. Use `--color-bg`, `--color-surface`,
  `--color-surface-muted`, and `--color-border` for most layout.
- `--color-accent` is for the strongest action, active state, or decisive
  summary panel. Do not use it on every button.
- Use `--color-border-strong` for focus, selected rows, or a high-priority
  boundary. Avoid doubling it with an accent fill.
- Semantic colors must carry meaning: error, success, warning, or information.

### Shape

- Buttons, fields, compact panels, and cards should look precise. Use
  `--radius-md` for most controls and `--radius-lg` for larger surfaces.
- Use `--radius-pill` only for badges, status chips, toggles, and compact
  icon-like controls.
- Avoid rounded card stacks that feel soft or decorative.

### Typography

- Page and section headings use `--text-xl` or `--text-2xl`, weight 650-750,
  and `--tracking-tight`.
- Dense labels use `--text-xs`, `--tracking-label`, uppercase, and muted text.
- Operational values use tabular numerals when comparing counts, scores, or
  deltas.
- Keep body copy short. The interface should scan as state, action, and result.

### Rhythm

- Dense groups use `--space-2` and `--space-3`.
- Panels use `--space-4` or `--space-5` internally.
- Major regions use `--space-6` or `--space-8`.
- Align controls and status chips in predictable rows; avoid loose editorial
  spacing unless the prompt asks for a summary.

### Surface hierarchy

- `--color-bg` is the page, `--color-surface` is the default panel, and
  `--color-surface-muted` is an inset, row alternate, or disabled region.
- Use border plus neutral fill to separate related operations.
- The strongest surface should be rare and intentional.

## Voice guidance for generated content

- Be specific and action-oriented: "Ready to review", "3 blockers",
  "Deploy window starts at 14:00".
- Lead with the status or action. Supporting copy should explain impact, not
  restate the heading.
- Avoid flourish, hedging, and decorative labels.
