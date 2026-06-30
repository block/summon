---
description: Technical Noir core — a restrained warm-dark developer surface language where commands, agent activity, logs, and workflow evidence are the material, carried by off-white-on-near-charcoal, hairline depth, and quiet technical hierarchy.
---

## Intent

Technical Noir makes technical work feel legible, calm, and operationally
credible. It frames a surface as a warm near-charcoal workspace where commands,
agent activity, code, logs, and workflow evidence are the primary visual
material — not decoration around it. Warmth replaces chromatic branding: a
brown-warmed dark canvas, an off-white material system, light-weight display
type, compact spacing, tight geometry, and hairline depth carry quiet
confidence. The voice is quiet, technical, precise, restrained, operational, and
confident. "Noir" here means restraint, contrast, and focus — not cinematic
mood.

It serves developers and technical operators, teams reviewing agentic or
terminal-like workflows, and agents composing restrained dark-mode product
surfaces. Every surface should help the user understand what is happening, what
is available, and what action comes next.

**Stance — what this is not:** no literal recreation of a specific
developer-tool website, brand, product names, partner names, logos, screenshots,
or customer quotes. No re-skinning of a researched source site's light-page
expression as the Technical Noir default. No cinematic noir styling —
spotlights, fog, film grain, smoked-glass panels, dramatic shadows,
detective-board metaphors, or mood detached from task evidence. No neon
cyberpunk terminal aesthetics, gradient backdrops, glassmorphism,
pure-black-with-neon-green nostalgia, or colorful accent systems. No generic
SaaS card grids where every panel has equal weight. No soft lifestyle warmth,
oversized rounded cards, friendly pill CTAs, or pastel productivity styling. No
heavy billboard typography, excessive uppercase shouting, or hero layouts that
overpower task content. No decorative terminal mockups with fake or irrelevant
text.

**Tradeoffs:** prefer readable technical density over spacious marketing gloss;
off-white emphasis, alignment, and hairlines over color-coded hierarchy; tight
controls and rectangular chrome over rounded friendliness. Use large type
sparingly — when type is large, keep it light, tracked tight, and calm. Let
terminal or code panels carry evidence only when they clarify the task; muted
semantic state stays secondary to the neutral system.

## Signature look & feel

If you stripped every label off a Technical Noir surface and left only the
shapes, you would still know it by these moves — they belong to this language and
no other in the catalog:

- **The warm-charcoal void.** The page is a brown-warmed near-charcoal (`#2b2622`)
  that reads as a dimmed terminal at 2am, never pure black, never cool slate. The
  warmth is the brand. Cards lift only ~8% off the page; you sense the boundary
  before you see it.
- **Hairlines do all the work.** Every region, row, panel, and input is drawn with
  the single warm 1px `--noir-hairline`. There are no shadows, no glows, no
  fills competing for depth — just a quiet lattice of warm lines. Elevation is a
  lie this language refuses to tell.
- **The mono gutter.** Command lines, log rows, and agent steps are prefixed with
  a `$`, `›`, or hash glyph in the `--noir-gutter`, monospace, muted-beige. The
  surface reads like a transcript you could scroll forever.
- **One live cursor.** Exactly one blinking off-white block cursor (`--noir-cursor`,
  `--noir-cursor-blink`) marks the live edge of activity per panel — the only thing
  on the surface that moves. Liveness, rationed.
- **The off-white spine.** The active row, selected step, or focused command carries
  a 2px off-white left spine (`--noir-spine`) — the single emphatic fill in an
  otherwise fill-less surface. Selection is a bar of light, not a colored chip.
- **Status as 6px dots, not color blocks.** State lives in tiny muted dots
  (`--noir-dot-*`): idle gray, running amber, ok sage, failed clay. Semantics whisper.
- **Felt scan grid.** Behind dense evidence panels, a near-invisible 24px warm
  scan grid (`--noir-grid`) gives the void texture you feel rather than see.

Hold these and a surface is Technical Noir even before a word is set. Drop them
and it collapses into generic dark-mode SaaS.

## Inventory

The material is a warm-dark technical token system: a brown-warmed near-charcoal
page canvas (never pure black or cool gray), slightly lifted warm-dark surfaces
for cards, tiles, mockups, and inputs, off-white primary text and primary action
fill, warm-beige muted secondary copy, and low-contrast warm hairlines that carry
depth instead of shadows. Off-white is both the primary text and the primary
action color, so no separate chromatic accent is required; semantic danger,
success, info, and warning tokens stay muted and tied to real state only. Two
type roles drive the surface — an Inter-like sans for display, headings, body,
navigation, and button labels, and a DM-Mono-like monospace reserved for
commands, logs, code, paths, model names, statuses, and short technical chips —
with an optional rare editorial serif italic. The scale is quiet (display tops
out around 64px and stays light), spacing follows a compact 4px-ish rhythm with
10px control steps and 96px major bands, radii stay tight at 2–6px (pills
reserved for icon buttons and compact state chips), and shadow tokens are
intentionally inert.

The literal token vocabulary (inject as the visual source of truth; reference
these custom properties rather than inventing values):

```css
:root {
  color-scheme: dark;

  /* Technical Noir: near-charcoal with a brown-beige temperature, never pure black. */
  --color-bg: #2b2622;
  --color-surface: #383330;
  --color-surface-muted: #302b28;
  --color-border: #3f3a36;
  --color-border-input: #57504a;
  --color-border-strong: #f7f5f0;
  --color-text: #f7f5f0;
  --color-text-muted: #c9c0ad;
  --color-text-alt: #dad2c1;
  --color-accent: #f7f5f0;
  --color-accent-fg: #2b2622;
  --color-danger: #e08b7d;
  --color-success: #a8c890;
  --color-info: #9fb7d7;
  --color-warning: #d6b16a;

  /* Compact 4px-ish rhythm with deliberate 10px button/control steps. */
  --space-1: 2px;
  --space-2: 4px;
  --space-3: 8px;
  --space-4: 10px;
  --space-5: 16px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 48px;
  --space-9: 64px;
  --space-10: 96px;

  /* Tight developer-tool geometry. Pills are exceptional, not default CTA shape. */
  --radius-pill: 999px;
  --radius-sm: 2px;
  --radius-md: 3px;
  --radius-lg: 4px;
  --radius-xl: 6px;

  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: "DM Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
  --font-serif: "Instrument Serif", Georgia, "Times New Roman", serif;
  --text-xs: 12px;
  --text-sm: 14px;
  --text-md: 16px;
  --text-lg: 18px;
  --text-xl: 24px;
  --text-2xl: 32px;
  --text-3xl: 48px;
  --text-display: clamp(48px, 7vw, 64px);
  --tracking-label: 0.02em;
  --tracking-tight: -0.025em;
  --tracking-display: -0.025em;
  --leading-display: 1.1;
  --leading-section: 1.25;
  --leading-body: 1.5;
  --leading-reading: 1.6;

  /* Depth is hairline/surface contrast; shadow tokens remain inert for contract completeness. */
  --shadow-mini: none;
  --shadow-card: none;
  --shadow-elevated: none;
  --shadow-popover: none;
  --shadow-modal: none;

  /* SIGNATURE — the moves that belong to Technical Noir alone. Reference these, do not reinvent them. */
  /* The single-pixel warm hairline that draws every boundary; depth is hairlines, never shadow. */
  --noir-hairline: 1px solid #3f3a36;
  --noir-hairline-strong: 1px solid #57504a;
  /* Faint warm scan grid behind dense panels — felt, never seen as a pattern. */
  --noir-grid: repeating-linear-gradient(180deg, transparent 0 23px, rgba(247,245,240,0.025) 23px 24px);
  /* The blinking command cursor block: terminal liveness, exactly one per panel. */
  --noir-cursor: #f7f5f0;
  --noir-cursor-blink: 1.06s steps(2, jump-none) infinite;
  /* Status dot system — muted, tied to real state, 6px, never decorative. */
  --noir-dot-idle: #57504a;
  --noir-dot-run: #d6b16a;
  --noir-dot-ok: #a8c890;
  --noir-dot-fail: #e08b7d;
  /* The "$" / "›" gutter glyph that prefixes every command line, set in mono. */
  --noir-gutter: 1.6ch;
  /* Left accent spine on the active row — off-white, 2px, the only emphatic fill. */
  --noir-spine: 2px solid #f7f5f0;
}
```

Off-white is both the primary text and the primary action fill, warm beige is
muted secondary copy and metadata, and warm hairlines carry depth. Sans carries
paragraphs, headings, navigation, and button labels; monospace is reserved for
commands, logs, code, paths, model names, statuses, and short technical chips;
the serif italic is a rare editorial emphasis, never the core UI voice.

The shared material every surface draws on lives in the root nodes that reach
everywhere: the [control and metadata system](controls), the
[terminal evidence panels](terminal-evidence) that prove technical claims, and
the [tile and row system](tiles) that carries repeating units. The surfaces —
[landing](landing), [workspace](workspace), [comparison](comparison), and
[brief](brief) — compose this material for their own job.

## Composition

Six principles carry the language and are true on every surface:

1. **Warm-dark is the material.** The defining surface is a brown-warmed
   near-charcoal canvas with off-white text; warmth replaces chromatic branding.
   Use a warm dark canvas rather than pure black or cool gray, keep cards only
   slightly lighter than the page, and let off-white text, off-white controls,
   and hairline borders carry emphasis. When semantic state is necessary, keep it
   muted and secondary to the neutral system.
2. **Off-white is the accent.** Off-white functions as both primary text and
   primary action color, so no separate chromatic accent is required. Use
   off-white filled buttons on warm dark for the highest-priority action, muted
   warm beige for secondary copy, captions, and metadata, and reach for underline,
   border weight, mono labels, or layout position before introducing color.
3. **Quiet technical hierarchy.** Hierarchy is calm, technical, and readable:
   light-weight display type (weight 400–500, not heavy promotional weights),
   negative tracking, sentence case, and controlled scale. Keep large headings
   concise and pair them with useful structure; use monospace only for commands,
   logs, code, technical labels, and terminal-like content; reserve serif italic
   for rare editorial emphasis, never as the core UI voice.
4. **Terminal evidence, not decoration.** Terminal, code, and agent panels are
   evidence surfaces that explain state, commands, output, or workflow. Keep panel
   chrome minimal — warm-dark fill, tight radius, 1px hairline, monospace content —
   prefer two strong evidence panels over many decorative screenshots, and ensure
   terminal-like text is plausible and tied to the user request. No lorem-ipsum
   code, abstract decorative blocks, or colorful syntax confetti.
5. **Readable density over marketing gloss.** The surface can be dense, but density
   should feel edited, aligned, and scannable rather than busy. Use rows, tiles,
   and panels with shared alignment and consistent padding, keep secondary text
   legible at 14–16px with warm muted contrast, and use hairline dividers for
   press-like lists, logs, job rows, feature rows, and setup steps. Avoid empty
   hero posture when the task calls for operational detail.
6. **Noir means technical restraint.** Use darkness to reduce noise and make
   technical evidence readable. Create presence through hierarchy, alignment,
   silence, and proof instead of fog, glow, spotlight, grain, or dramatic shadow,
   and keep every atmospheric choice tied to task clarity.

**Surface obligations (true everywhere).** Every surface keeps the
off-white-on-warm-dark relationship — a warm near-charcoal canvas (never pure
black), off-white primary text and primary action fill, warmth instead of a
chromatic brand accent. Terminal, code, and agent panels carry plausible,
task-relevant material, never decorative filler. Large type stays light, tracked
tight, and calm; monospace is reserved for technical content. Depth comes from
hairlines and surface contrast, not drop shadows. Generated surfaces never
recreate a specific developer-tool's brand, product names, logos, screenshots,
or customer quotes — name the product from the user's prompt and let the
composition, not a copied source, carry the credibility.
