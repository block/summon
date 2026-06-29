---
description: Technical Noir — a restrained warm-dark developer surface language for terminal-like workspaces, quiet product narrative, and hairline-separated operational content.
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
expression as the Technical Noir default. No cinematic noir styling — spotlights,
fog, film grain, smoked-glass panels, dramatic shadows, detective-board
metaphors, or mood detached from task evidence. No neon cyberpunk terminal
aesthetics, gradient backdrops, glassmorphism, pure-black-with-neon-green
nostalgia, or colorful accent systems. No generic SaaS card grids where every
panel has equal weight. No soft lifestyle warmth, oversized rounded cards,
friendly pill CTAs, or pastel productivity styling. No heavy billboard
typography, excessive uppercase shouting, or hero layouts that overpower task
content. No decorative terminal mockups with fake or irrelevant text.

**Tradeoffs:** prefer readable technical density over spacious marketing gloss;
off-white emphasis, alignment, and hairlines over color-coded hierarchy; tight
controls and rectangular chrome over rounded friendliness. Use large type
sparingly — when type is large, keep it light, tracked tight, and calm. Let
terminal or code panels carry evidence only when they clarify the task; muted
semantic state stays secondary to the neutral system.

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
}
```

Component vocabulary: a warm-canvas shell and reading-mode header; terminal
evidence panels, agent activity panels, and command-output blocks; hairline
content cards, download/setup tiles, and monochrome integration tiles; press-like
information rows and job/task rows; a compact almost-rectangular primary button
(off-white fill, warm-dark text), a ghost secondary button, and dark text inputs;
mono metadata labels and muted-beige captions; and composite blocks — the
two-panel terminal hero, the brief summary→evidence→action stack, shared-criteria
comparison rows, the tab-rail evidence frame, and the command-action pair. Copy
atoms stay calm and operational (Run, Review, Output, Status, Model, Harness,
Self-hosted, Connected, Own your data). State variants cover running agents,
queued tasks, completed steps, blocked commands, selected setup paths, muted
semantic warnings, and empty terminal states. Terminal panels always show
plausible task-relevant traces, off-white actions sit on warm-dark with 3–4px
radius, and hairline rows carry updates, task lists, and operational timelines.

## Composition

Six principles carry the language:

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

The recurring patterns that make a Technical Noir surface feel intentional:

- **Warm-dark reading-mode shell:** developer workspaces use a single continuous
  warm near-charcoal canvas with clear zones for summary, active work, evidence,
  and next action, framed inside a bounded shell or wide content band aligned to a
  shared width and compact spacing rhythm — never a generic equal-weight dashboard
  grid.
- **Statement-plus-evidence hero:** technical landings pair a quiet light-weight
  sans value statement (tight tracking, restrained scale) with one or two
  terminal-like evidence panels placed close enough to prove the claim. Use
  two-panel splits to contrast modes, inputs/outputs, local/cloud, or human/agent
  handoff; keep the background flat warm-dark and lean on surface contrast and
  hairlines, never gradients.
- **Terminal panels anchor evidence:** render panels on a slightly lifted warm-dark
  fill with a 1px warm hairline and 3–6px radius, monospace commands/logs/agent
  steps/outputs, restrained status color only when it clarifies real state, and a
  small muted or mono metadata label so the user knows what the evidence
  represents.
- **Single-canvas content bands:** sections stay on one warm-dark canvas separated
  by spacing (64–96px major desktop padding), typography, rows, and hairlines
  rather than background changes; canvas-soft fills appear only for contained
  tiles, mockups, forms, or cards.
- **Tight CTA geometry:** primary and secondary controls use compact almost-
  rectangular geometry (3–4px button radii), an off-white fill with warm-dark text
  for one primary action, transparent/canvas-matching secondary actions with
  off-white text, and circular or pill geometry only for icon containers, status
  chips, or minimum mobile touch targets.
- **Hairline depth on tiles:** cards, tiles, inputs, and mockups use a slightly
  lighter warm-dark fill plus a subtle 1px warm hairline for depth, tight 3–6px
  radii, and no drop shadows unless a host runtime requires a minimal modal or
  popover affordance.
- **Mono metadata labels:** monospace marks commands, paths, model names,
  statuses, permission labels, timestamps, platform names, and short technical
  chips, while sans carries paragraphs, headings, navigation, and button labels;
  keep mono compact and purposeful, with muted beige for metadata unless the value
  is selected or primary.
- **Shared-criteria comparison:** technical comparisons use rows or compact tiles
  with shared operational criteria (control, setup effort, data boundary, model
  support, runtime, cost, risk, speed) and a calm recommendation marked by
  off-white border, fill, or button placement rather than saturated color.
- **Compact setup/download tiles:** platform, environment, or setup choices appear
  as 2-up or 3-up compact warm-dark tiles (stacking on mobile), each with a label,
  a short compatibility/detail line, and one clear action, using tight radius,
  hairline border, muted captions, and monochrome or off-white icons.
- **Hairline information rows:** updates, tasks, command history, incident steps,
  and release notes use full-width or panel-contained rows separated by 1px warm
  hairlines with ~16px vertical padding, each scan-friendly (label, short title,
  muted detail, optional compact action) — never equal rounded cards.
- **Summary→evidence→action briefs:** technical briefs open with current state or
  recommendation in quiet sans, place logs, agent steps, diffs, or findings
  immediately after, and end with one calm off-white next action; failure,
  warning, or blocked states stay muted unless severity truly demands stronger
  semantic color.
- **Command-action pairs:** when setup, launch, install, or handoff is the task,
  place an off-white primary button beside a warm-dark command strip with
  plausible, copyable-looking command text — never command snippets as decoration
  or competing primary commands.
- **Tab-rail evidence frame:** product, workflow, or setup alternatives use a
  compact muted selector rail with one high-contrast active option and give most
  space to a materially larger active evidence frame — used for comparing modes,
  not simple one-path tasks.
- **Muted trust signals:** integration, ecosystem, and trust signals stay
  monochrome, secondary, and subordinate to technical proof, kept below the main
  claim/proof area, preferring generic integration categories over copied partner
  logos.

**Surface obligations.** Every surface makes the next action, recommendation, or
setup choice visible without shouting — one primary off-white action when an
action is expected, follow-up actions placed near the relevant panel, row, or
tile, and calm labels instead of urgency language. Generated surfaces must not
introduce a dominant chromatic brand accent when neutral emphasis can solve
hierarchy; warm neutrals and off-white carry primary hierarchy, semantic color
stays muted and tied to real status, and gradients or colorful badges are not
default decoration. Every code, terminal, log, or agent panel must contain
plausible, labeled, task-relevant technical material — no filler strings,
decorative code, or copied source screenshots. Interactive chrome stays compact
and nearly rectangular (2–6px radii) with pills reserved for icons or compact
state, compact desktop button height while preserving accessible mobile touch
targets. Research-source composition may inform the fingerprint, but generated
surfaces must rewrite exemplar copy into generic technical scenarios and must not
reproduce source branding, copy, screenshots, navigation, or proprietary names.
Full-screen compositions leave at least 72px of top breathing room for host
chrome and keep important headings, panel controls, and primary actions away from
the extreme top-left edge.
