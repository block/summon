# Console Chrome 2001 Dogfood Eval Prompts

Date: 2026-06-22
Bundle: console-chrome-2001
Status: proposed

## Review Criteria

Score each output on a 1-5 scale for:

1. **Faceplate shell fidelity** — root surface reads as one assembled console chassis rather than loose cards.
2. **Material fidelity** — periwinkle chrome, carbon command slabs, hard bevels, halftone/dotted texture, and compact seams are visible.
3. **Warm action semantics** — amber is used for tools/badges; orange is used for forward/submit/open actions.
4. **Module density and scanability** — layout is dense but labeled, useful, and scannable.
5. **Typography/label voice** — small uppercase Arial-like labels and outlined display treatment appear where appropriate.
6. **Usefulness** — the surface answers the prompt and provides practical actions or information.
7. **Accessibility/usability** — controls and copy are legible; narrow surfaces do not require unsafe tiny targets.
8. **IP safety** — no Nintendo, Mario, Pokémon, Game Boy, ESRB, protected screenshots, or exact source copy unless explicitly supplied by the prompt.

## Prompt 1: console-homepage-launch

- **Exact prompt:** Create a retro console-style homepage for a fictional handheld puzzle game club called Puzzle Port. Include a hero, search/finder utility, official updates, featured community links, a player poll, and a sign-up rail. Do not use Nintendo, Mario, Pokémon, Game Boy, or ESRB names or imagery.
- **Eval axis:** generation
- **Suggested loop:** fingerprint-iteration comparing current bundle vs upgraded bundle after exemplars.
- **Claims under test:** faceplate shell, dual command nav, dense modules, right rail, IP safety.
- **Expected strong-output traits:** periwinkle chassis, carbon command bar, pale secondary strip, box-art hero, orange forward arrows, amber utility chips, compact list rows, original mascot/bubble or no mascot.
- **Likely failure modes:** generic SaaS cards, literal Nintendo leakage, pixel-art-only styling, orange used decoratively, no rail.

## Prompt 2: retro-cartridge-catalog

- **Exact prompt:** Build a searchable retro cartridge catalog for an indie game archive. Show filters, four featured cartridges, latest update rows, ratings/status stamps, and a compact details panel for the selected item.
- **Eval axis:** generation
- **Suggested loop:** ghost-lift against generic styling or fingerprint-iteration after catalog exemplar added.
- **Claims under test:** directory situation, search cluster, thumbnail grid, list rows, badges, selected state.
- **Expected strong-output traits:** compact white inputs, amber Go/filter chips, framed thumbnails, platinum rows, trailing orange chevrons, hard bevels, section-label bars.
- **Likely failure modes:** modern marketplace cards, too much whitespace, unrelated neon/pixel palette, no clear selected/action states.

## Prompt 3: playful-access-request-panel

- **Exact prompt:** Design a playful control panel for joining a fictional arcade beta. Include username, favorite genre dropdown, notification options, a terms note, submit action, help rail, and compact success/error states.
- **Eval axis:** generation
- **Suggested loop:** fingerprint-iteration after form exemplar added.
- **Claims under test:** workflow situation, chrome form panels, compact controls, dotted dividers, orange submit, accessibility.
- **Expected strong-output traits:** platinum form panel with label bar, hard-bordered inputs, native-select geometry, dotted note divider, carbon help rail, orange submit, visible focus/error treatment.
- **Likely failure modes:** generic auth card, oversized modern inputs, missing labels, inaccessible tiny controls, green/blue default CTA.

## Prompt 4: scoreboard-brief

- **Exact prompt:** Make a retro console scoreboard brief for choosing which three community tournaments to feature this weekend. Show a ranked recommendation, evidence rows, risk/status stamps, and one next action.
- **Eval axis:** generation
- **Suggested loop:** fingerprint-iteration after brief exemplar added.
- **Claims under test:** brief situation, list rows, badge stamps, side tabs, decision clarity.
- **Expected strong-output traits:** scoreboard-like label system, compact ranking rows, hard seams, orange next action, amber/white stamps, carbon footer or side rail.
- **Likely failure modes:** modern KPI dashboard, no recommendation, generic table, decorative badges without meaning.

## Prompt 5: mobile-stacked-console

- **Exact prompt:** Create a narrow mobile version of a retro console event hub for a fictional chiptune night. Include a compact command header, hero, schedule rows, RSVP form, and help/status module.
- **Eval axis:** generation
- **Suggested loop:** experimental prompt after mobile pattern added.
- **Claims under test:** mobile adaptation without losing faceplate shell.
- **Expected strong-output traits:** bounded shell, stacked command bars, compact but usable controls, rail modules moved below, preserved bevels and orange action semantics.
- **Likely failure modes:** horizontal-scroll desktop clone, generic mobile cards, controls too small, loss of command hierarchy.
