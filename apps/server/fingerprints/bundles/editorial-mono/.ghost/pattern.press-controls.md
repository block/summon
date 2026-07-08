---
description: Ink-drawn controls and page states — buttons as ruled mono labels (inverse slab only for the one decisive action), underscored hairline inputs, hover as rule weight, focus as a crisp ink outline, and loading/empty/error as ruled placeholders on the page. Gather when the ask involves forms, settings, filters, toolbars, buttons, inputs, selection, disabled states, or empty/error/loading surfaces.
---

## Composition

The component vocabulary is editorial furniture in the broadsheet tradition:
buttons are set as ink-ruled labels — squared, mono, tracked — that fill to the
inverse slab only when they carry the one decisive action, and rest as
hairline-outlined text otherwise; rows are ruled bands separated by
`--editorial-hairline`, not boxed cards; panels are framed by rules and paper
tiers rather than fills or elevation; inputs are underscored or hairline-boxed
fields whose label sits above in tracked mono like a form set at the press;
tables are the native idiom — parallel columns split by `--editorial-column-rule`
with folio-style headers; chips are the one place pill radius is allowed, small
mono labels that register status, never decorative badges.

**Interaction states are drawn, not tinted.** Interaction state is expressed as
ink and rule weight, never color or glow. **Hover** thickens a rule to
`--editorial-hover-rule` or inks a label; **focus** is a crisp
`--editorial-focus-ring` outline held off the mark by `--editorial-focus-offset`,
a registration crop rather than a glow; **active/pressed** commits the rule to
full ink via `--editorial-active-rule`; **selected** marks the chosen option
with `--editorial-selected-border` weight and the margin
`--editorial-selected-marker`, never a color wash; **disabled** sets back to
`--editorial-disabled-ink` on `--editorial-disabled-paper`, legible but quieted
without opacity tricks — the muted paper tier, no dimming.

**Page states stay on the page.** **Loading, empty, and error** stay on the page
as ruled placeholders and set labels so gaps read as part of the record — a
missing region is a ruled band with a tracked mono label (Waiting, Empty data,
Error, Incomplete comparison), never a spinner overlay, a toast, or a blank
card. A printed page accounts for its own gaps.

The token commentary from the core vocabulary governs the states exactly:

```css
/* INTERACTION STATE — expressed as ink and rule weight, never color or glow.
   Focus is a crisp inked outline like a compositor's registration crop, not a halo;
   hover and selection thicken the rule or ink the label, they do not tint the plane. */
--editorial-focus-ring: 2px solid #11100e; /* crisp ink outline — no glow, no chroma */
--editorial-focus-offset: 2px;             /* a hairline of paper between mark and outline */
--editorial-hover-rule: var(--editorial-rule-heavy);   /* hover reads as a heavier rule, not a fill */
--editorial-active-rule: var(--editorial-rule-heavy);  /* pressed = the rule commits to full ink */
--editorial-selected-border: var(--editorial-rule-heavy); /* chosen option marked by border weight, not color */
--editorial-selected-marker: "▍"; /* an ink marker set in the margin beside the chosen row */
--editorial-disabled-ink: #8f8677; /* muted to the input-border ink — legible but set back */
--editorial-disabled-paper: #e5e0d4; /* rests on the muted paper tier, no dimming or opacity tricks */
```

**Bound:** squared mono-tracked buttons with the inverse fill reserved for the
one decisive action, tracked mono labels above inputs, drawn (never tinted)
hover/focus/active/selected/disabled states, and loading/empty/error as ruled
in-page placeholders. **Open:** whether inputs underscore or hairline-box,
where the decisive action sits, and how a placeholder's label is worded within
the copy atoms.

Controls speak in the [mono metadata](pattern.metadata) voice; the one inverse-filled
action spends the same emphasis budget as the [single inverse-ink panel](pattern.inverse-panel);
placeholder bands ride the [ruled evidence](pattern.evidence) rhythm.

Related: reinforces `pattern.metadata`, `pattern.inverse-panel`; contrasts with `anti-goal.soft-card-slop`.
