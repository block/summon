---
description: Garden Notes core — a soft planning language that turns messy personal tasks, low-stakes choices, and tiny routines into a manageable plan; warm cream field, rounded note panels, gentle green emphasis, friendly state badges, humane pacing.
---

## Intent

Garden Notes makes a planning surface feel like a warm, unhurried notebook: a soft
cream field, rounded note panels, gentle green emphasis, and friendly state
badges. It turns messy personal requests, low-stakes life-admin choices, prep
tasks, and tiny routines into a **manageable plan** rather than a productivity
dashboard. When warmth conflicts with a concrete recommendation, the
recommendation wins. When calm conflicts with an exact date, the date wins
("picks up Thursday", never "soon").

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

**Design lineage.** Garden Notes descends from the humane, calm-productivity
tradition — the gentle task warmth of Things 3, the soft note-paper feel of Bear,
and the low-pressure surfaces of Notion — and grounds its palette in the natural,
perceptually-even "sand/olive" families of the Radix Colors scales. It borrows
their conventions, not their brand assets: warm-cream paper over flat white, a
single gentle lift instead of stacked elevation, reserved chlorophyll-green
emphasis on one chosen step, and human state-chips that read like a sentence. The
inheritance is a posture — unhurried, warm, decisive — never a copied surface.

The material is a soft outdoor-notebook token system: a warm cream field, quiet
muted note areas, gentle plant-toned borders, deep-green primary text with patient
muted secondary context, and a soft chlorophyll-green accent reserved for the
chosen next step. State colors (danger, success, info, warning) exist for real
planning state only — readiness, waiting, blockers, timing — never as confetti. An
airy spacing ladder paces the notebook, soft note-card radii shape the panels, a
pill radius carries badges and compact state chips, and soft shadows give note
layers gentle depth used sparingly. The sans is the friendly planning voice; the
serif is an optional quiet pull-note — reach for `--font-serif` only when
quoting the person's own words back to them, never as a primary editorial voice; warm
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

  /* CALM STATES — gentle interaction feedback in the Garden Notes voice.
     Derived from the existing green/cream signature: focus is a soft
     chlorophyll-tinted halo (never a harsh system ring), note panels and chips
     warm by a hair on hover and settle a touch on press, and a quiet-note token
     dims a can-wait or unavailable step without ever alarming. */
  --garden-focus-ring: 0 0 0 3px rgba(79, 138, 61, 0.22); /* calm green halo, kin to --garden-chosen-ring, softer */
  --garden-panel-hover: #fffef0;   /* note-paper lifts a shade warmer under the cursor */
  --garden-panel-pressed: #f6f0cf; /* the paper settles to its gradient base when pressed */
  --garden-chip-hover: #e6efd3;    /* chip face warms gently, still quiet */
  --garden-chip-pressed: #dce8c5;  /* chip settles onto the muted note tone */
  --garden-quiet-note: #9aab86;    /* can-wait / disabled ink: present but resting, never harsh grey */
  --garden-ease-soft: cubic-bezier(0.32, 0.72, 0.28, 1); /* one unhurried ease — warmth in the pacing, no bounce */

  /* KEPT NOTES & PICKING UP — keepsake completion and close inspection,
     derived from the existing paper, lift, and quiet-note values. */
  --garden-kept-paper: #f6f0cf;        /* a kept (done) note settles onto the note-paper gradient's own base */
  --garden-kept-ink: #71805d;          /* kept-note text rests in the muted planning ink — held, not crossed off */
  --garden-pickup-lift: 0 24px 60px rgba(66, 99, 58, 0.20); /* the one deeper lift, only while a note is picked up */
  --garden-pickup-scale: 1.02;         /* a held note grows by a hair — closer, never zoomed */
  --garden-recede-veil: rgba(234, 241, 220, 0.72); /* the rest of the plan softens behind the field color while one note is held */

  /* HUMANE ORIENTATION — forward-facing texture and the open later-edge
     (defined here as the source of truth; principle.humane-orientation explains their use). */
  --garden-someday-paper: linear-gradient(180deg, #fbf6e0 0%, #f6f0cf 100%); /* someday notes settle a shade quieter than this-week paper */
  --garden-someday-chip-radius: 12px;  /* someday chips square gently so the week's texture varies structurally */
  --garden-later-fade: linear-gradient(180deg, rgba(234, 241, 220, 0) 0%, #eaf1dc 100%); /* the unclosed later… edge dissolving into the field */
  --garden-later-ink: #9aab86;         /* later items rest in quiet-note ink — present, unhurried, unclosed */
}
```

Body sits on the soft cream-on-field gradient in the sans planning voice; `strong`
emphasis takes the green accent. The recurring copy atoms stay small and human —
Tiny start, Now, Next, Later, Can wait, Gather, Check first, Good enough, Low
effort, Ready, Needs one thing, Energy, Season, Timing.

**Component vocabulary, in this voice.** Every surface is built from the same soft
kit. **Note panels** are the primary container: cream note-paper
(`--garden-note-paper`) rounded to `--garden-panel-radius` (larger plans use
`--garden-panel-radius-lg`), resting on the single `--garden-note-lift` — one
quiet lift, never a card pile, in the calm-note-paper manner of Bear. **Buttons**
are gentle rather than glossy — the primary action fills `--color-accent` with
`--color-accent-fg` ink at `--radius-md`, secondary actions stay quiet on
`--color-surface-muted` with a `--color-border` edge; nothing shouts. **Inputs**
carry a `--color-border-input` edge that firms toward `--color-border-strong` only
on focus, so the field feels like writing on paper, not filling a form. **State
chips** are the readable language of the surface: `--garden-chip-radius` pills from
`--garden-chip-face`/`--garden-chip-ink`/`--garden-chip-edge` at `--garden-chip-pad`,
each naming a real planning state (Ready, Needs one thing, Can wait) so a row reads
like a status sentence — the Things-3 warmth of a task that tells you where it is.
The **chosen-dot** (`--garden-chosen-dot`, `--garden-chosen-marker`,
`--garden-chosen-ring`) lands beside exactly one step; comparisons and grids stay
soft, never a numeric scorecard.

**Interaction states, kept calm.** Hover is a whisper: note panels warm to
`--garden-panel-hover` and chips to `--garden-chip-hover`, a single shade brighter,
never a lift change (the one lift is constant). Press settles the surface —
`--garden-panel-pressed` and `--garden-chip-pressed` ease the paper toward its
gradient base, a gentle "received" rather than a click. **Focus** is a soft
green-tinted halo (`--garden-focus-ring`), kin to the chosen-ring but quieter —
visible and reassuring, never a harsh default outline, in the Radix-Colors spirit
of a perceptually calm accent. **Disabled / can-wait** steps take
`--garden-quiet-note` ink: present and legible but resting, never a cold grey-out
or an alarm. Where motion helps (a panel opening, a chip settling), use the single
`--garden-ease-soft` at a short duration — warmth lives in unhurried pacing, so
there is one gentle ease and no bounce, no urgency, no spinner theatrics. Empty
states stay encouraging and concrete (name a tiny start); error/caution is rare
and rides the earthy `--garden-clay-accent`, not a shrill red. **Idle is a
state, and its state is stillness.** A Garden Notes surface at rest does
nothing: no pulsing dots, no auto-advancing content, no attention-seeking
motion, no nudges to come back. The plan sits like an open notebook on a
table — legible, patient, ready when the person is — because a surface that
fidgets while someone thinks is applying pressure, and pressure is the one
thing this language refuses to add.

**Density & accessibility.** The airy spacing ladder (`--space-*`) is the
low-pressure pacing itself — surfaces breathe first and tighten only when a plan
grows long; full-screen compositions keep the 72px top breathing room. Body text
holds at `--text-md` with generous `--leading-body`/`--leading-reading` so a plan
reads like a page. Deep-green `--color-text` on cream surfaces clears comfortable
contrast; muted `--color-text-muted` is reserved for secondary context, never for
the primary next step. The chosen-dot and clay accent never carry meaning by color
alone — a chip label or copy atom (Good enough, Check first) always names the
state in words. Focus is always visible via `--garden-focus-ring`, and green
emphasis stays reserved for the one chosen step so it never dilutes into
decoration.

The shared building blocks every surface draws on live in the root nodes that
reach everywhere: the [note-panel and soft-shell system](pattern.note-panels) that shapes
every plan, the [gentle depth rules](principle.gentle-depth) that keep layering from
becoming a card pile, the [badge and state system](pattern.badges) that carries planning
state, the [good-enough choice and can-wait notes](pattern.good-enough) that lower
pressure, the [humane orientation rules](principle.humane-orientation) that keep every
plan facing the person, one decision at a time, with the future left visibly
open, and the [kept notes and pick-up moves](pattern.kept-notes) that let done work
settle into small keepsakes and let one note be held closer while the rest of
the page recedes. There are no fixed page types — planners, staged plans, comparisons, and
routines are all composed on demand from these same four building blocks under the
same unhurried rules. The [annotated weekend plan](exemplar.weekend-plan) shows
the whole voice on one surface, and two guards name what this language refuses:
[no productivity dashboards](anti-goal.productivity-dashboard) and [no card
piles](anti-goal.card-pile).

## Read order

For a typical planning surface, pull in this order:

1. [The weekend-plan exemplar](exemplar.weekend-plan) — see the whole voice at
   once before composing anything.
2. [The note-panel system](pattern.note-panels) — bound the surface: one shell,
   context header, one primary step; begin from its Skeleton.
3. [The good-enough choice and can-wait notes](pattern.good-enough) — place the
   one green-dot recommendation and name what can wait.
4. [The badge and state system](pattern.badges) — add chips only where state
   helps.
5. [The humane orientation rules](principle.humane-orientation) — write the
   copy: person's concern first, forward phrasing, open later-edge.
6. [The gentle depth rules](principle.gentle-depth) — audit elevation before
   finishing; if done work or close inspection appears, pull
   [kept notes and pick-up moves](pattern.kept-notes) too.
7. Check the result against the guards:
   [no productivity dashboards](anti-goal.productivity-dashboard) and
   [no card piles](anti-goal.card-pile).

**Silence posture.** This fingerprint is deliberately silent on dark mode (the
language is light-only, `color-scheme: light`), data visualization, dense
tables, multi-user or collaborative surfaces, and navigation chrome beyond a
single page. Where it is silent, compose provisionally in the same voice — warm
cream, one lift, quiet chips, no urgency — and label the choice as provisional
rather than inventing new tokens or borrowing dashboard conventions to fill the
gap.

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
   gentle shadows to pace the plan; reach for a chip only when the state actually
   helps the user decide — a note without a meaningful state gets no chip, and a
   row of badges must read like a status sentence, never confetti; avoid literal garden motifs unless the
   task itself is about gardening or seasonal prep, and never let warm filler copy
   replace a concrete recommendation.

**Laying out a plan from the notes.** Garden Notes has no fixed page types — every
surface is composed for its task from the same small kit of parts, in the same
unhurried reading order. Bound the plan inside the [note-panel and soft-shell
system](pattern.note-panels), opening with a context line that reflects the real task, not
advice; keep the layering quiet with the [gentle depth rules](principle.gentle-depth) so a
few notes lift and the rest stay flat on the paper; let the [badge and state
system](pattern.badges) carry time, effort, readiness, season, and energy so a row of chips
reads like a status sentence; and point the whole thing at one move with the
[good-enough choice and can-wait notes](pattern.good-enough). Let the task set the shape,
not a template: when one clear move is all it needs, one note carrying the single
`--garden-chosen-dot` is the whole plan; when the task has real sequence, pace it
through soft panels and gather what it needs into a prep basket before a short
beginnable checklist, using now/next/later only as a pressure-release and making
Later explicitly reassuring; when it weighs low-stakes options, compare them
the way the [good-enough choice and can-wait notes](pattern.good-enough)
prescribe — soft parallel criteria, one kind recommendation on the green dot,
never a scorecard or verdict; when it repeats, keep it a short tactile checklist with
gentle reminder rows, never a streak-counting dashboard. The green marker lands
once; a rare "check first" caution rides `--garden-clay-accent`, not alert red. If
a task fits none of these shapes, compose a new surface from the same notes under
the same rules — never let it collapse into a generic productivity dashboard of
equal cards because no familiar shape fit.

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
