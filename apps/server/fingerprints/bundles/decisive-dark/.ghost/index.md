---
description: Decisive Dark core — a confident dark answer surface where a single hero result claims the screen, evidence reads as bold discrete data, meaning lands in one sentence, and a single accent is spent at most once, carried by near-black tiers, a clean sans display ladder, oversized tabular numerals, and pill actions.
---

## Intent

Decisive Dark makes a generated surface feel like it has already done the thinking
and is handing you the result: a near-black canvas, one display-sized answer that
claims the screen, bold discrete evidence beneath it, a single sentence of meaning,
and a short stack of pill actions. It turns a question — a figure, a decision, a
what-if, a trend — into a **streamed four-block answer** rather than a dashboard of
equal-weight widgets. The voice is confident, declarative, and calm under data
density — direct enough to state a recommendation outright instead of hedging,
without ever becoming loud for its own sake.

It serves people mid-task, not browsing — they arrived with intent and came to *do a
thing*. The job is always the same: return time to the reader by making the useful
answer legible before any supporting detail, and let type scale, hierarchy,
whitespace, and one earned accent moment carry the screen. Every decision is judged by
whether it gives time back or steals it. The editorial filter is one question: **what
can we delete?**

**Stance — what this is not:** no overfilled pages of equal-weight elements that force
the reader to hunt for the answer; no centered marketing-hero compositions on a
functional surface; no softened, smoothed data viz that hides how the data actually
moves; no light-mode chrome (this surface is dark by design); no hedging copy, no
apologetic empty states, no onboarding banners, tooltips on obvious labels, or
decorative animation. The accent is never decoration — it is the mark of action,
spent zero or one times per surface and never twice. The neutral tiers are **depth**,
not boxes; emphasis comes from size, weight, and space before color.

**Tradeoffs:** prefer one dominant element over a balanced grid; bigger over more;
bold discrete data viz (bars, candlesticks) over subtle continuous lines; confident
silence over explanatory copy; left-aligned leading hero over symmetric centering.
Match the register to the moment — a market chart reads technical and precise, a
personal summary reads warm, where warm means larger `--dd-block-gap` and
`--radius-lg`/`--radius-pill` geometry — never a color shift, never an
illustration — but the DNA holds: the screen must have presence and read in one
glance.

## Signature look & feel

If you stripped every label off a Decisive Dark surface and left only the shapes, you
would still know it by these moves — each held in full by its pattern node:

- **One hero answer owns the screen** — display-sized, no tie ([pattern.answer](pattern.answer)).
- **The canvas is near-black, tiered by depth** — separation reads as planes lifting
  off true black, never borders or fills.
- **The accent is the single mark of action** — at most once, never twice
  ([pattern.accent-moment](pattern.accent-moment)).
- **Numbers are large and tabular** — `--dd-numeral`, `--dd-tnum`, the unit locked to
  the number.
- **Evidence is bold and discrete** — bars and candlesticks, never smoothed curves
  ([pattern.evidence](pattern.evidence)).
- **Actions are neutral pills, left-aligned and stacked** — verb-first, accent only
  when primary ([pattern.action](pattern.action)).
- **Warmth comes from breath and shape, never decoration** — no emoji, no stock
  illustrations, no chrome explaining itself.

What holds the identity is the discipline of one dominant answer, near-black tiered
depth, a single earned accent, large tabular numerals, and bold discrete evidence.
What collapses it into a generic dark dashboard is the moment any of those soften — a
second accent, a centered hero, a smoothed chart, equal-weight widgets, or a hedge
word in the primary line — and the confident statement becomes just another panel.

## Inventory

The material is a dark, answer-native token system: a near-black neutral scale
resolved into background tiers and text tones, a single saturated accent with full
state coverage, status hues reserved for true danger/warning/success state, and a
small set of decorative tones for generated visuals and avatars. Type carries the
surface through a clean sans across a display-to-body ladder and a mono family for
figures and code, with oversized tabular numerals for the hero answer. Spacing runs
generous so hierarchy can land, geometry is softly rounded (pill for actions, large
radius for cards), and elevation is quiet — depth comes from near-black tiers and
restraint, not heavy shadows.

**Design lineage.** Decisive Dark descends from the modern data-dense dark product
tradition — the perceptually-tiered near-black elevation of Radix Colors' dark scales,
the confident restraint and system-native sans of Geist-era product design, and the
calm, keyboard-first dark chrome of contemporary developer tools. Beneath the answer
itself runs the older instinct of the Bloomberg-terminal and calculator display: one
figure, set large and tabular, that *is* the screen. What this language takes from that
heritage is discipline, not decoration — depth read as stacked planes rather than boxes,
numerals locked to a monospaced grid, and neutral surfaces that let a single earned
accent do all the pointing. It stays dark by design throughout; there is no light-mode
counterpart and no chromatic UI system, only near-black tiers and one accent.

The literal token vocabulary (inject as the visual source of truth; reference these
custom properties rather than inventing values):

```css
:root {
  color-scheme: dark;

  /* Decisive Dark is dark by design — near-black tiers, one earned accent, no decoration. */
  --color-bg: #000000;
  --color-surface: #181818;
  --color-surface-muted: #232323;
  --color-canvas: #0f0f0f;
  --color-border-strong: #454545;
  --color-text: #ffffff;
  --color-accent: #ffb020;

  /* Background depth tiers — pick by distance from the canvas, never by box. */
  --dd-bg-app: #000000;
  --dd-bg-subtle: #0f0f0f;
  --dd-bg-standard: #181818;
  --dd-bg-prominent: #232323;
  --dd-bg-extra-prominent: #333333;
  --dd-elevated: #454545;
  --dd-bg-inverse: #ffffff;

  /* Text tones — standard reads first; subtle carries the sentence around the emphasis. */
  --color-text-standard: #ffffff;
  --color-text-subtle: #878787;
  --color-text-subtle-variant: #a2a2a2;
  --color-text-disabled: #595959;
  --color-text-decorative: #c4c4c4;

  /* The accent — the single mark of action, spent zero or one times per surface. */
  --dd-accent: #ffb020;
  --dd-accent-pressed: #e0941a;
  --dd-accent-disabled: #5c4a25;

  /* Status — reserved for true danger / warning / success state, never mood. */
  --color-danger: #f84752;
  --color-danger-pressed: #b31e30;
  --color-warning: #ff8700;
  --color-warning-pressed: #cc4b03;
  --color-success: #00d533;

  /* Secondary hues — category identifiers in rows/avatars only, never on chrome, trends, or actions. */
  --dd-hue-violet: #9752ff;
  --dd-hue-purple: #b141ff;
  --dd-hue-blue: #377bff;
  --dd-hue-sky: #3399ff;

  /* Decorative — generated visuals and gradient avatars only, not product chrome. */
  --dd-decor-magenta: #cc00ff;
  --dd-decor-pink: #fb60c4;
  --dd-decor-mauve: #a43979;

  /* Generous spacing so hierarchy can land — space is a material, not residue. */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 36px;
  --space-7: 48px;
  --space-8: 64px;
  --space-9: 88px;
  --space-10: 120px;

  /* Softly rounded — made for hands, never industrial chrome. */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --radius-xl: 28px;
  --radius-pill: 9999px;

  /* A clean sans carries the surface; mono carries figures and code. */
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --font-display: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --text-xs: 12px;
  --text-sm: 14px;
  --text-md: 16px;
  --text-lg: 20px;
  --text-xl: 24px;
  --text-2xl: 32px;
  --text-3xl: 44px;
  --text-display: clamp(56px, 12vw, 90px);
  --tracking-label: 0;
  --tracking-tight: -0.02em;
  --tracking-display: -0.045em;
  --leading-display: 1.0;
  --leading-section: 1.0;
  --leading-body: 1.5;

  /* Quiet elevation — depth is read from near-black tiers, not heavy shadow. */
  --shadow-mini: none;
  --shadow-card: none;
  --shadow-elevated: 0 8px 40px rgba(0, 0, 0, 0.55);
  --shadow-popover: 0 8px 40px rgba(0, 0, 0, 0.55);
  --shadow-modal: 0 16px 64px rgba(0, 0, 0, 0.65);

  /* SIGNATURE — the moves that belong to Decisive Dark alone. Reference these, do not reinvent them. */

  /* The one hero answer that claims the screen — display-sized, the loudest element, no tie. */
  --dd-hero-ratio: 3;                 /* display-to-body jump that reads as designed intent */
  --dd-hero-size: var(--text-display);
  --dd-hero-tracking: var(--tracking-display);
  --dd-hero-leading: var(--leading-display);

  /* Oversized tabular numerals — the calculator-display instinct scaled to every answer. */
  --dd-numeral: var(--text-display);
  --dd-numeral-weight: 500;
  --dd-tnum: "tnum" on;               /* lock figures to tabular for numbers */
  --dd-tracking-numeral: -0.03em;     /* unit symbol tight to the number */

  /* The single earned accent moment — spent once, the mark of action. */
  --dd-accent-moment: var(--dd-accent);
  --dd-accent-budget: 1;              /* zero or one per surface, never two */

  /* Bold discrete data viz — bars and candlesticks, never smoothed curves. */
  --dd-bar: var(--dd-accent);
  --dd-bar-neutral: var(--color-text-decorative);
  --dd-bar-gap: var(--space-2);
  --dd-axis: var(--color-text-subtle);

  /* Neutral pill actions — left-aligned, stacked, verb-first, accent only when primary. */
  --dd-pill: var(--color-surface-muted);
  --dd-pill-hover: var(--dd-bg-extra-prominent);
  --dd-pill-height: 44px;
  --dd-pill-pad: 0 22px;
  --dd-stack-gap: var(--space-3);

  /* Gradient avatar field — deterministic mesh of decorative tones for generated personas. */
  --dd-avatar-gradient: radial-gradient(circle at 30% 30%, #fb60c4, #cc00ff 55%, #a43979 100%);

  /* Inset that tells the eye "this is content, not chrome" — and host-chrome breathing room. */
  --dd-content-inset: var(--space-4);
  --dd-top-safe: 56px;

  /* Focus — a single subtle ring the dark canvas can carry; keyboard focus is legible, never loud. */
  --dd-focus-ring: 0 0 0 2px var(--dd-accent);   /* the one accent doubles as the focus mark — no second color */
  --dd-focus-ring-neutral: 0 0 0 2px var(--dd-elevated);  /* neutral focus where the accent is already spent */
  --dd-focus-offset: 2px;                         /* lift the ring off the surface so it reads on near-black */

  /* Pill interaction states — the neutral pill system across its full lifecycle, accent only when primary. */
  --dd-pill-active: var(--dd-bg-standard);        /* pressed sinks a tier — depth, not a highlight */
  --dd-pill-disabled: var(--dd-bg-subtle);        /* recedes toward the canvas; the action is not there to take */
  --dd-pill-text: var(--color-text-standard);     /* verb-first label reads first */
  --dd-pill-text-disabled: var(--color-text-disabled);  /* dimmed to match the receded surface */
  --dd-pill-primary: var(--dd-accent);            /* the one primary action — the surface's single spend of accent */
  --dd-pill-primary-active: var(--dd-accent-pressed);   /* pressed primary uses the accent's own darker step */

  /* Missing surface + border roles — quiet separators for when a tier edge alone won't carry the read. */
  --color-border-subtle: #333333;                 /* a hairline between tiers, one step under border-strong */
  --dd-surface-selected: var(--dd-bg-prominent);  /* the chosen row/option in a comparison — position and tier, not fill */

  /* NEGATIVE-SPACE FRAME — emptiness placed first; the quiet that makes the answer loud. */
  --dd-answer-clear: var(--space-8);              /* unshared clearance around the hero — nothing sits in its band */
  --dd-block-gap: var(--space-7);                 /* open canvas between the four blocks — the gap is the divider */
  --dd-frame-gap: var(--space-6);                 /* outer breathing room framing the composition against the canvas */

  /* CONFIRMING MICRO-TRANSITIONS — state changes acknowledged, never performed. */
  --dd-confirm-duration: 120ms;                   /* the smallest legible acknowledgment — tier shifts, nothing showier */
  --dd-confirm-ease: ease-out;                    /* resolves immediately toward rest; no bounce, no flourish */

  /* THE ONE PERMITTED MOTION — a single settle-in of the hero figure, or nothing. */
  --dd-settle-budget: 1;                          /* at most one settle-in, on the hero answer only — otherwise zero motion */
  --dd-settle-duration: 240ms;                    /* the single settle resolves fast; nothing else animates */
}
```

The body sits on the near-black canvas, sets type in the clean sans, routes figures
and code through the mono family, and locks numbers to tabular numerals; `strong`
emphasis goes to standard-weight ink against subtle surrounding text rather than to
color. The component vocabulary is the four-block answer — answer, evidence, meaning,
action — and the copy atoms are verb-first and exact: Pay, Send, Move, View, Compare,
Set, On track, while state variants cover loading/streaming, positive trend, negative
trend, steady, blocked, empty data, and error. Sentence-case labels, no terminating
periods, em dashes for breaks.

**Components read as depth, not chrome.** Rows, panels, and comparison surfaces are
not boxed; they separate by stepping a tier
(`--dd-bg-subtle` → `--dd-bg-standard` → `--dd-bg-prominent`), and where a bare tier
edge won't carry the read a single `--color-border-subtle` hairline is enough — never
a heavy outline or fill. The pill lifecycle, comparison marking
(`--dd-surface-selected`), and numeral treatment live in [pattern.action](pattern.action)
and [pattern.evidence](pattern.evidence); loading/streaming, blocked, empty, and error
resolve in neutrals and the reserved status hues per [pattern.states](pattern.states),
never in mood color. Secondary hues appear only as category identifiers in
rows/avatars, never on chrome, trends, or actions.

**Accessibility intent.** Keyboard focus is always visible: a subtle
`--dd-focus-ring` lifted by `--dd-focus-offset` so the ring reads cleanly off near-black,
falling back to `--dd-focus-ring-neutral` wherever the accent is already spent — focus
never introduces a second color. Text pairings hold real contrast against the tiers
(`--color-text-standard` for the answer, `--color-text-subtle` for the sentence around
it, `--color-text-disabled` only for genuinely inert state), body stays at or above
`--text-sm`, and the accent is a pointer, never the sole carrier of meaning. There is no
decorative animation; state changes are tier and weight shifts that confirm rather
than perform, resolving within `--dd-confirm-duration` or instantly — the surface
arrives settled and stays settled.

The shared material every surface draws on lives in the root nodes that reach
everywhere through the spine: the [streamed answer block](pattern.answer) that claims the
screen, the [bold evidence](pattern.evidence) that shows the data, the [one-sentence
meaning](pattern.meaning) that says the so-what, the [pill action stack](pattern.action) that
guides the next move, the [accent moment](pattern.accent-moment) that spends the accent
exactly once, the [deletion discipline](principle.deletion-discipline) that runs the
what-can-we-delete filter over the whole composition, and the [negative-space
frame](pattern.negative-space) that places the emptiness first so the answer stands
alone in it, and the [states surface](pattern.states) that carries
loading/streaming, empty, error, and blocked when the answer is not ready. Every
surface is streamed together for its own job from these same
building blocks — there are no fixed page types to link to, only the shared kit.
The [reference answer surface](exemplar.spending-answer) shows the whole kit
assembled with its load-bearing moves annotated, and two guards hold the negative
space: [competing heroes](anti-goal.competing-heroes) — the tie, the KPI grid, the
second accent — and [soft smeared evidence](anti-goal.soft-smeared-evidence) — the
smoothed curve and the orphaned stat.

## Read order

For a typical surface, pull in this order: [pattern.answer](pattern.answer) first
(the hero decides everything downstream), then [pattern.evidence](pattern.evidence)
and [pattern.accent-moment](pattern.accent-moment) together (where the one accent
lands is decided across both), then [pattern.meaning](pattern.meaning) and
[pattern.action](pattern.action) to close the four blocks, then
[pattern.negative-space](pattern.negative-space) and
[principle.deletion-discipline](principle.deletion-discipline) as the final pass
over the whole composition. Consult [exemplar.spending-answer](exemplar.spending-answer)
whenever the assembled shape is in doubt, and re-read the guards
([anti-goal.competing-heroes](anti-goal.competing-heroes),
[anti-goal.soft-smeared-evidence](anti-goal.soft-smeared-evidence)) before calling
the work finished.

**Silence posture.** This fingerprint is deliberately silent on light mode (there
is none — the surface is dark by design, full stop), on multi-page navigation
chrome, iconography sets, form-heavy input surfaces, and marketing/landing
compositions. Where the fingerprint is silent, act provisionally and label the
choice as provisional — but carry the DNA into the gap: near-black tiers, one
loudest element, tabular numerals, at most one accent, and the deletion pass
still apply to anything you invent.

## Composition

Four principles carry the language and are true on every surface:

1. **One element owns the screen.** Open with a single dominant answer — a
   display-sized metric or a verdict headline — and let everything else support it.
   There is no tie; if two elements compete, the screen has not made a choice. Let
   type scale, weight, hierarchy, and whitespace create dominance before any
   decoration, and default to bigger over more.
2. **Give time back.** The useful answer reads first, before any supporting detail.
   Delete redundant page titles, decorative chrome, and explanatory copy — confident
   silence over a paragraph. Meaning is one sentence, not three. Every element earns
   its place by helping the reader finish the task faster.
3. **Show the data boldly.** When the answer is a trend or a distribution, the
   visualization is the answer: discrete bars and candlesticks at full real estate
   with clear axis labels, never soft smoothed lines. Match the register to the
   moment — technical and precise for market data, warm for a personal summary,
   where warm means larger `--dd-block-gap` and `--radius-lg`/`--radius-pill`
   geometry — never a color shift, never an illustration.
4. **Spend the accent once.** The accent is the mark of action, spent zero or one
   times per surface and never twice — a positive-trend stroke, an earned gain, or the
   one primary CTA. Zero is correct when the answer is steady or reassuring.
   Everywhere else stays neutral; emphasis is made from size, weight, and space before
   color.

**Composing an answer from the parts.** Decisive Dark has no fixed page types —
every surface is streamed together for its task from the same four-block kit, in
the same order. Lead with the [streamed answer block](pattern.answer) so the takeaway is
the first and loudest visual event; justify it with at most one region of
[bold evidence](pattern.evidence); land the [one-sentence meaning](pattern.meaning) that names the
so-what; close on the [pill action stack](pattern.action) that hands back the next move;
and spend the [accent moment](pattern.accent-moment) once or not at all across the whole
composition. Let the task set the shape of the answer, not a template: a single
lookup or yes/no leads with a `--dd-numeral` metric or a decisive prefix; a field
of metrics resolves into one governing number or delta with the `--dd-bar` chart
given the most real estate — never four equal-weight KPI cards; an option
comparison aligns into uniform parallel rows per [pattern.evidence](pattern.evidence);
a surface whose job is a state — loading, empty, error, blocked — follows
[pattern.states](pattern.states) instead of a hollow four-block scaffold. If a task
fits none of these, stream a new surface from the same parts under the same rules
— never collapse to a generic layout.

**Surface obligations (true everywhere).** A reader should grasp the answer before
reading any supporting detail. Copy is verb-first and verdict-shaped: no hedging
(*"you might want to…"*), no apologies (*"sorry, nothing yet"* → *"nothing yet"* —
see [pattern.states](pattern.states)), no tooltips on obvious labels, no onboarding
chrome on routine surfaces. The accent appears at most once; if it appears twice,
demote one. The surface leaves at least 56px (`--dd-top-safe`) of top breathing room
for host chrome, and large display type wraps cleanly and reduces scale before words
clip or crowd the edges. After the screen is functionally correct, run a final
presence check: is there one unambiguously loudest element, at most one accent
moment, a one-second read, verdict-shaped copy — and nothing on the screen that
exists only to reassure? If any answer is no, the work is not finished — the
presence is missing.
