---
description: The workflow form-sheet system — white sheets with uppercase mono field labels, hairline inputs, a single primary rectangular submit, and plane-aware focus rings. Reach for forms, settings, configuration, inputs, and validation.
---

## Composition

A form is a control surface, not a document: the white sheet and its state
carry the page, and every element already exists in the core vocabulary — the
form sheet invents nothing.

**White sheet, mono field labels.** Configuration and workflow forms live on the
white sheet plane (`--contrast-plane-sheet-bg`/`--contrast-plane-sheet-fg`).
Field labels speak in the one all-caps [mono label](pattern.mono-labels) voice —
`--contrast-eyebrow-font` uppercase at `--contrast-eyebrow-size` with
`--contrast-eyebrow-tracking` — short and parallel, set above their inputs. The
values a user types stay sentence-case geometric sans; mono labels the field,
it never fills it.

**Hairline inputs.** Inputs are flat rectangles bounded by `--color-border-input`
at `--radius-sm`, filled with `--color-surface` — no inset shadows, no floating
lift, no pill geometry. Grouped fields separate with `--contrast-edge-hairline`
rules rather than boxed cards; the sheet's structure is the grouping. Disabled
fields drop to the muted `--color-surface-muted`/`--color-text-muted` pair.

**Validation as tinted text and edge.** Field errors and confirmations use the
status colors as tint text and hairline edges only — `--color-danger`,
`--color-success`, `--color-info`, `--color-warning` may ink a message line or a
1px input border, never a chip fill, never a pill, never the signal trio. The
message is a plain sentence-case line under the field, stating what failed and
what fixes it.

**Single primary submit.** One primary action closes the form: a black-fill
small-radius rectangle from the [CTA system](pattern.cta-system) with an
uppercase mono label naming the mechanical step (`SAVE CONFIGURATION`,
`RUN EXPERIMENT`). Secondary actions are outline rectangles; there is never a
second filled primary on the sheet.

**Plane-aware focus.** Focus is always visible: `--contrast-focus-ring-light`
on the white sheet, held clear of the input's hairline by
`--contrast-focus-offset`; if a form element ever sits on midnight, it takes
`--contrast-focus-ring-dark` instead.

Because a form is a control, not a document, it omits the
[instrumentation](pattern.instrumentation) strip and locator — the constant
anchor alone may persist. The signal object is spent — if at all — on one
moment elsewhere on the surface, never in the controls.

**Bound:** white sheet plane; mono uppercase field labels; hairline
`--color-border-input` inputs at `--radius-sm`; one primary submit per form;
status colors as tint text and hairline edges only; plane-aware focus rings.
**Open:** single-column vs grouped layout, label-above vs inline metadata,
whether groups collapse into accordions, where the secondary action sits.

Related: reinforces `pattern.mono-labels`, `pattern.cta-system`, `principle.contrast-planes`.
