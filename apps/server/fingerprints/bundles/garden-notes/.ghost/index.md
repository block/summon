---
description: Garden Notes core — a soft planning language that turns messy personal tasks, low-stakes choices, and tiny routines into a manageable plan; warm cream field, rounded note panels, gentle green emphasis, friendly state badges, humane pacing.
---

## Intent

Garden Notes makes a planning surface feel like a warm, unhurried notebook: a soft
cream field, rounded note panels, gentle green emphasis, and friendly state
badges. It turns messy personal requests, low-stakes life-admin choices, prep
tasks, and tiny routines into a **manageable plan** rather than a productivity
dashboard. The voice is warm, practical, unhurried, encouraging, specific, and
low-pressure — calm without becoming vague.

It serves people planning personal tasks, people comparing low-stakes life-admin
options such as errands, purchases, appointments, or household choices, and agents
composing humane planning surfaces. The job is always the same: make the next
small step feel doable now without flattening the user's real context, materials,
uncertainty, or energy.

**Stance — what this is not:** no generic productivity dashboards, kanban boards,
project-management metaphors, or optimization language. No literal botanical
decoration, garden illustrations, or plant motifs that do not clarify the task. No
motivational slogans, self-help filler, or cheerleading standing in for concrete
planning. No hard winner/loser verdicts for low-stakes personal choices. No
arbitrary rounded card piles where every note carries the same weight. No severe
editorial broadsheets, monochrome scorecards, or dense ruled comparison matrices —
the strong contrast against austere critique surfaces is part of this language's
value, so personal planning must never become severe. Soft green is a planning
emphasis color, not a default decoration for every element; garden warmth is
implied through pacing, geometry, and note layering, never literal illustration.

**Tradeoffs:** prefer gentle but decisive guidance over exhaustive task
management; airy but bounded composition over empty pastel whitespace; warmth only
when it helps task clarity, pacing, or emotional ease. Name what can wait as
clearly as what should happen now. The display scale exists for warm headings, but
generated surfaces should scale down before they take a marketing-hero posture.

## Signature look & feel

If you stripped every label off a Garden Notes surface and left only the shapes,
you would still know it by these moves — they belong to this language and no other
in the catalog:

- **Warm cream note-paper, never flat white.** Every panel sits on
  `--garden-note-paper`, a soft top-lit cream gradient that warms toward
  `#f6f0cf` at its base, so a note reads like a page that has caught afternoon
  light rather than a UI card. Dusted over it, `--garden-paper-texture` at
  `--garden-paper-texture-size` leaves a faint warm grain — felt, not seen.
- **One gentle outer lift — no card piles.** Note panels rest on a single soft
  `--garden-note-lift`, one quiet green-tinted shadow that suggests a page set
  down on the field. No stacked elevations, no drop-shadow theatrics; depth is a
  whisper, and every note that matters equally lifts equally.
- **Chlorophyll green is reserved for the one chosen next step.** The
  `--garden-chosen-dot` radial marker, sized at `--garden-chosen-marker` and
  haloed by `--garden-chosen-ring`, appears beside exactly one action — the
  good-enough thing to do now. Green is a spotlight, never a coat of paint; if it
  shows up twice, it has stopped meaning "start here."
- **Pill state-chips are a language, not garnish.** Readiness, waiting, timing,
  and effort ride in `--garden-chip-radius` pills built from `--garden-chip-face`,
  `--garden-chip-ink`, `--garden-chip-edge`, and `--garden-chip-pad`. Each chip
  names a real planning state — Ready, Needs one thing, Can wait — so a row of
  them reads like a status sentence instead of decorative confetti.
- **Clay accents keep warmth human.** A single warm-terracotta
  `--garden-clay-accent` carries the rare "check first" or gentle caution note,
  grounding the green-and-cream field with a hand-thrown, earthy tone instead of a
  shrill alert red.
- **Generously rounded note-panels invite, never command.** Panels round to
  `--garden-panel-radius` (and `--garden-panel-radius-lg` for the larger plans),
  soft enough to feel like a folded notebook corner, so the surface lowers
  pressure by its geometry before a word is read.
- **"Good-enough" calm is built into the spacing and the copy.** The airy rhythm
  and the small human atoms — Now, Next, Later, Can wait, Good enough — give every
  plan a tactile checklist warmth and a low-stakes, unhurried pulse: doable now,
  the rest can keep.

What holds the identity is restraint with the green dot, the single soft lift, and
chips that mean something — warm cream paper pacing one calm chosen step. What
collapses it into a generic kanban or productivity app is green everywhere, stacked
card shadows, urgency copy, and chips worn as decoration.

## Inventory

The material is a soft outdoor-notebook token system: a warm cream field, quiet
muted note areas, gentle plant-toned borders, deep-green primary text with patient
muted secondary context, and a soft chlorophyll-green accent reserved for the
chosen next step. State colors (danger, success, info, warning) exist for real
planning state only — readiness, waiting, blockers, timing — never as confetti. An
airy spacing ladder paces the notebook, soft note-card radii shape the panels, a
pill radius carries badges and compact state chips, and soft shadows give note
layers gentle depth used sparingly. The sans is the friendly planning voice; the
serif is an optional quiet pull-note, never a primary editorial voice; warm
heading scales climb toward a display size that should be scaled down before it
becomes heroic.

The literal token vocabulary (inject as the visual source of truth; reference
these custom properties rather than inventing values):

```css
:root {
  color-scheme: light;

  /* Garden Notes is visibly soft: warm cream, chlorophyll green, clay notes. */
  --color-bg: #eaf1dc;
  --color-surface: #fff8dc;
  --color-surface-muted: #dce8c5;
  --color-border: #c0d19b;
  --color-border-input: #94ad73;
  --color-border-strong: #42633a;
  --color-text: #243821;
  --color-text-muted: #71805d;
  --color-text-alt: #506b45;
  --color-accent: #4f8a3d;
  --color-accent-fg: #fff8dc;
  --color-danger: #b75142;
  --color-success: #4f8a3d;
  --color-info: #527da0;
  --color-warning: #c48735;

  /* Slower, airier planning rhythm. */
  --space-1: 5px;
  --space-2: 10px;
  --space-3: 15px;
  --space-4: 20px;
  --space-5: 30px;
  --space-6: 42px;
  --space-7: 54px;
  --space-8: 72px;
  --space-9: 96px;
  --space-10: 128px;

  /* Soft note-card geometry. */
  --radius-pill: 999px;
  --radius-sm: 14px;
  --radius-md: 22px;
  --radius-lg: 34px;
  --radius-xl: 48px;

  --font-sans: "Avenir Next", "Nunito Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
  --font-serif: Georgia, "Times New Roman", serif;
  --text-xs: 12px;
  --text-sm: 14px;
  --text-md: 16px;
  --text-lg: 22px;
  --text-xl: 32px;
  --text-2xl: 46px;
  --text-3xl: 64px;
  --text-display: clamp(48px, 8vw, 92px);
  --tracking-label: 0.035em;
  --tracking-tight: -0.015em;
  --tracking-display: -0.035em;
  --leading-display: 0.98;
  --leading-section: 1.12;
  --leading-body: 1.58;
  --leading-reading: 1.76;

  --shadow-mini: 0 3px 10px rgba(66, 99, 58, 0.12);
  --shadow-card: 0 18px 45px rgba(66, 99, 58, 0.18);
  --shadow-elevated: 0 28px 70px rgba(66, 99, 58, 0.22);
  --shadow-popover: 0 30px 90px rgba(66, 99, 58, 0.24);
  --shadow-modal: 0 40px 120px rgba(66, 99, 58, 0.30);

  /* SIGNATURE — the moves that belong to Garden Notes alone. Reference these, do not reinvent them. */
  --garden-note-paper: linear-gradient(180deg, #fffae6 0%, #fff8dc 62%, #f6f0cf 100%);
  --garden-note-lift: 0 14px 34px rgba(66, 99, 58, 0.14);
  --garden-chosen-dot: radial-gradient(circle at 50% 50%, #5aa047 0%, #4f8a3d 60%, #42633a 100%);
  --garden-chosen-marker: 10px;
  --garden-chosen-ring: 0 0 0 4px rgba(79, 138, 61, 0.18);
  --garden-chip-radius: 999px;
  --garden-chip-pad: 4px 11px;
  --garden-chip-face: #eef4df;
  --garden-chip-ink: #506b45;
  --garden-chip-edge: 1px solid #c0d19b;
  --garden-clay-accent: #b75142;
  --garden-paper-texture: radial-gradient(circle at 18% 22%, rgba(196, 135, 53, 0.05) 0 1px, transparent 1px), radial-gradient(circle at 67% 71%, rgba(66, 99, 58, 0.04) 0 1px, transparent 1px);
  --garden-paper-texture-size: 22px 22px;
  --garden-panel-radius: 28px;
  --garden-panel-radius-lg: 38px;
}
```

Body sits on the soft cream-on-field gradient in the sans planning voice; `strong`
emphasis takes the green accent. The recurring copy atoms stay small and human —
Tiny start, Now, Next, Later, Can wait, Gather, Check first, Good enough, Low
effort, Ready, Needs one thing, Energy, Season, Timing.

The shared building blocks every surface draws on live in the root nodes that
reach everywhere: the [note-panel and soft-shell system](note-panels) that shapes
every plan, the [gentle depth rules](gentle-depth) that keep layering from
becoming a card pile, the [badge and state system](badges) that carries planning
state, and the [good-enough choice and can-wait notes](good-enough) that lower
pressure. The surfaces — [planner](planner), [staged-plan](staged-plan),
[comparison](comparison), and [routine](routine) — compose this material for their
own job.

## Composition

Four principles carry the language and are true on every surface:

1. **Humane pacing is the structure.** Break tasks into steps that feel doable
   now, next, and later, with soft context preserved around each step. Keep the
   surface airy but bounded so it never feels empty, and use pressure-reducing
   copy: name the easiest next step, what can wait, and what would make the task
   feel lighter. Avoid urgency, slogans, and black-and-white editorial judgment.
2. **Specific context reduces pressure.** Personal planning feels lighter when the
   surface reflects the user's actual context instead of generic advice. Carry
   forward people, places, materials, dates, constraints, uncertainty, and energy
   from the prompt; use concrete nouns and verbs before abstract categories;
   prefer a few grounded steps over a broad productivity framework. Never fall
   back on template labels like Task 1, Task 2, or Optimize.
3. **Good-enough is a design value.** Garden Notes helps users pick a good-enough
   next move instead of maximizing every variable. Name the easiest acceptable
   option when stakes are low, explain the accepted tradeoff gently and briefly,
   and avoid scoring systems that imply false precision or winner-take-all
   rankings for household choices.
4. **Warmth serves action.** Warmth is useful when it makes the next action
   easier; it must not become decoration. Use rounded notes, green emphasis, and
   gentle shadows to pace the plan; let badges communicate readiness, time,
   effort, confidence, season, or energy; avoid literal garden motifs unless the
   task itself is about gardening or seasonal prep, and never let warm filler copy
   replace a concrete recommendation.

**Surface obligations (true everywhere).** Every planning surface must make the
next small step obvious and emotionally easy to begin, highlighting one kind
good-enough choice or first action in a soft rounded callout and using gentle
badges for time, effort, confidence, readiness, or seasonality. Keep the user's
concrete context visible near the plan — reuse meaningful details from the prompt
rather than replacing them with generic labels, and name relevant materials,
timing, constraints, or uncertainty. Gentle surfaces still end in concrete action:
use verbs the user can do today (gather, pick, check, text, set aside, start,
wait), avoid productivity verbs (crush, optimize, maximize, perfect, hack,
dominate, hustle), and make the first action visible without requiring the whole
plan to be read. Comparisons name one kind recommendation and the tradeoff it
accepts, avoiding hard verdict language when stakes are personal and low. Lower
pressure by naming what can wait, but do not hide all non-immediate work if
showing it helps the user trust the plan. Full-screen compositions leave at least
72px of top breathing room for host chrome and keep important headings away from
the extreme top-left edge.
