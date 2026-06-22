# Redline Cinema dogfood prompts

Date: 2026-06-22

Use these prompts to evaluate whether Redline Cinema preserves source-agnostic luxury-performance composition under generation pressure. Review generated outputs for brand leakage, generic SaaS drift, red overuse, rounded/pill controls, missing cinematic hierarchy, and unstructured specs/listings/events.

## Prompt A: premium electric motorcycle launch

**Prompt:** Generate a landing page for a premium electric motorcycle launch called Night Arrow. It should announce the product, show three performance specs, and invite users to reserve a private test ride.

- Eval axis: generation
- Claims under test: cinematic hero, scarce red CTA, spec grid, source-agnostic language, sharp geometry
- Strong output traits: full-bleed dark hero, one red CTA, no source-brand references, large meaningful spec numerals, restrained copy, no rounded SaaS cards
- Likely failures: generic EV SaaS page, too many red accents, invented source-like shield/animal imagery, oversized unlabelled stats

## Prompt B: private track-day booking and lineup comparison

**Prompt:** Generate a premium track-day booking surface for three anonymous performance cars. Include availability, package comparison, and a booking CTA.

- Eval axis: generation
- Claims under test: white transactional sheet, catalog/listing cards, comparison structure, rectangular controls
- Strong output traits: dark editorial frame, white booking/catalog region, aligned package comparison, image-first cards, sharp buttons, one red primary action
- Likely failures: generic travel booking UI, pill filters, sale badges, multiple red buttons, no cinematic frame

## Prompt C: race-week results recap

**Prompt:** Generate a race-week recap surface for a fictional racing academy. Show session results, driver positions, and one editorial highlight without using any real racing brand.

- Eval axis: generation
- Claims under test: event row system, large red decisive value, source-agnostic boundary
- Strong output traits: hairline-separated rows, red only for winning/active position, large number cell with label, fictional names, no real team identifiers
- Likely failures: real brand leakage, sports scoreboard cliché, many team colors, dashboard table without editorial hierarchy

## Prompt D: heritage editorial feature

**Prompt:** Generate an editorial feature page for a fictional design studio’s 50-year performance archive. It should feel cinematic and premium, with a history section, two feature cards, and a closing CTA.

- Eval axis: generation
- Claims under test: heritage editorial pacing, image-first feature cards, dark-to-body rhythm, restrained typography
- Strong output traits: cinematic intro, broad editorial spacing, image-first cards, muted body copy, no ecommerce density, no copied source names
- Likely failures: generic blog page, too much copy, card feed, no image-led hierarchy
