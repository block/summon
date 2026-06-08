# Ghost UI — Design Direction

*Source: Ghost UI expression snapshot (commit `16f0ab5`; see `bucket.json` for scanned provenance). Re-sync outside Summon when the portable Ghost expression evolves.*

This is the design direction for Ghost UI — the visual vocabulary you emit into HTML. Response shape (plan vs article vs comparison vs tracker) is your call based on the user's intent; this document tells you *how* things look once you've picked a shape.

## Character

A monochromatic, magazine-inspired design language that treats color as communication rather than decoration. The default palette is entirely achromatic — near-black on white — with hue reserved for semantic states and chart data. Pill-shaped interactive elements contrast with moderately rounded containers, and display typography pushes ultra-tight line-heights (0.85–0.88) with heavy negative tracking for an editorial spread aesthetic. The system ships no bundled typefaces; the host's platform face becomes the brand face.

## Signature

- Achromatic by default — primary/accent is the extremity of the gray scale (`#1a1a1a`). Color is opt-in semantic communication, not ambient decoration
- Pill-first radius philosophy — buttons, inputs, and badges fully round to 999px; structural containers (cards, modals) use moderate radii (10–24px). Shape is how users intuit what is tappable versus what is container
- Magazine-scale display typography — headings push ultra-tight line-heights (0.85–0.88) with heavy negative letter-spacing (−0.05em); paired with uppercase label type at 0.12em tracking as "byline voice"
- Layered shadow hierarchy named by role (mini / card / elevated / popover / modal), not by numeric size
- Compact controls inside spacious containers — buttons and inputs sit at 32–40px height; cards breathe at 24px internal padding; sections at 75–100px vertical
- No gradients, no illustrations, no decorative hover effects — motion is functional (fade, scale-in, accordion), never ornamental
- No bundled fonts — system-ui sans, Geist Mono, and a generic serif fallback chain

## Decisions

### Color

- **Default is achromatic.** Grays only — `--color-bg` through `--color-text`. Any chromatic token that appears must carry semantic meaning (danger, success, info, warning) or be data (charts).
- **Accent is the extremity of the gray scale**, not a brand hue. `--color-accent` maps to `#1a1a1a` on light. Use it sparingly — one accent surface per composition.
- **State colors are reserved** — red for danger, green for success, blue for info, yellow for warning. Do not repurpose them for decoration.
- **Off-palette hex literals are drift.** Every color in your output should resolve through a `--color-*` token (or a chart hex, when emitting charts).

### Shape

- **Interactive elements are pills.** Buttons, badges, chips, and text inputs use `border-radius: var(--radius-pill)` (999px). This is non-negotiable — it's how users recognize tappable.
- **Structural containers are moderately rounded.** Cards, panels, dialogs, and surfaces use `--radius-lg` (20px) or `--radius-md` (14px). Never pill-round a card.
- **Container radii come from the canonical set** (`--radius-sm` through `--radius-xl`). Avoid arbitrary `border-radius: 13px` — it breaks the shape vocabulary.

### Typography

- **Display type is editorial**: large heading (`--text-2xl` or more), weight 700–900, line-height 0.88–0.95, letter-spacing `-0.03em` to `-0.05em`. Tight, confident.
- **Body copy relaxes**: line-height 1.55–1.65, neutral tracking. Comfortable for reading.
- **Use uppercase label type for eyebrows** — small (11–12px), weight 600, letter-spacing 0.12em. Acts as a section kicker.
- **Type sizes come from the ramp** (`--text-xs` through `--text-display`). At most three type sizes per surface — size is not the only hierarchy lever; use weight, color, and tracking too.

### Rhythm

- **Compact controls, spacious containers.** Buttons 32–40px tall; cards padded generously (24px internal); sections use tall vertical rhythm.
- **Group tightly, separate generously.** Items within a group use `--space-2` to `--space-3`; groups within a section use `--space-5` to `--space-6`.
- **Bottom of a surface should feel lighter** than the top — fewer elements, more room.
- **Spacing comes from the 4px-base scale** (4 / 8 / 12 / 16 / 24 / 32 / 52 / 75 / 100). Off-scale values like `padding: 13px` break layout rhythm.

### Surface hierarchy

- **Use `--color-surface-muted` as layering**, not decoration. Alternate rows, secondary blocks, or contextual backgrounds.
- **Borders are optional.** Either a thin border OR a muted background — rarely both on the same element.
- **Name surfaces by intent**: `--color-bg` is page; `--color-surface` is an elevated panel/card; `--color-surface-muted` is a secondary or disabled surface.

### Elevation

- **Shadows are named by role, not size.** `--shadow-mini` for buttons and cards at rest; `--shadow-card` shares that tier; `--shadow-elevated` for raised panels; `--shadow-popover` for floating layers; `--shadow-modal` for dialogs.
- **Shadows cue elevation, not decoration.** A hover that lifts a card is fine; ambient shadows on every container are not.
- **Don't invent shadow values inline.** Reach for a role token, or omit shadow entirely.

### Motion

- **Animations are functional, never decorative.** Reveals only — accordion expand, fade-in, scale-in, word-reveal entrance, route transitions.
- **No hover ornaments.** No `transition: all`, no looping spinners, no bouncing chevrons. The editorial tone stays serious.
- **One easing, three durations** — fast (~0.15s), normal (~0.2s), slow (~0.4s) on a single spring curve. Don't mix durations within a surface.

### Focus

- **A single focus rule.** A 1px ring in `--color-border-strong` at half opacity, applied uniformly to buttons, inputs, and badges. Don't replace it with ad-hoc outlines, color shifts, or border swaps.

### Fonts

- **No bundled typefaces.** Use the declared `--font-sans` / `--font-mono` / `--font-serif` stacks — they're system fallback chains; the host's platform face is the brand face.
- **Don't `@import` web fonts or declare `@font-face`.** A foreign typeface breaks the language.

## Voice guidance for generated content

- Be specific. "Sarah Chen", "$4,280.50", "Mar 14" — not "user name", "amount", "date".
- Be direct. No hedging, no "here's your…" preambles.
- The editorial eyebrow-over-tight-headline pattern is one tool, not the default. Use it when the response actually leads with a declarative headline (a recommendation, a status, a launch). For long-form explanations, lead with body copy. For trackers, lead with the big number. For comparisons, skip a top headline entirely and let the compared options do the talking.
