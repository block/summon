# Redline Cinema source study

Date: 2026-06-22

This curation note distills a user-provided luxury-performance automotive design analysis plus public Ferrari web research into an agnostic Ghost fingerprint for generated Summon surfaces. The fingerprint must preserve composition signals, not Ferrari identity. It intentionally avoids generation guidance that would reuse Ferrari names, Cavallino/shield marks, Scuderia/F1 team identifiers, model names, slogans, proprietary photography, or licensed typeface claims.

## Sources read

- `/Users/nahiyan/Downloads/DESIGN-ferrari.md` — user-provided design analysis; primary token/component/style extraction source.
- `https://www.ferrari.com/en-EN/auto` — official Range / line-up page; public composition corroboration. Text extraction returned title `Ferrari Range: All the Models on Sale - Ferrari.com`, line-up heading, navigation taxonomy, and many image-led model entries.
- `https://preowned.ferrari.com/en-US` — official Approved / preowned page; public composition corroboration for catalog and listing surfaces. Text extraction returned hero copy, listing imagery, `in the foreground in USA`, dealer and genuine-accessory CTA blocks.
- `https://www.ferrari.com/en-EN/history` — official History page; public composition corroboration for heritage/editorial storytelling. Text extraction returned title `The Ferrari History`, cinematic introductory imagery, and an origins/legend section.
- `https://www.ferrari.com/en-EN/auto/dealers` — official Dealers and service page; public composition corroboration for dense directory/service content. Text extraction returned regional headings and many dealer/service rows.
- `https://www.ferrari.com/en-EN/news` — official News page; public composition corroboration for editorial index/navigation taxonomy.

## Sources attempted but blocked or incomplete

- `https://www.ferrari.com/en-EN` returned CloudFront 403 through CLI extraction.
- `https://www.ferrari.com/en-EN/formula1` returned CloudFront 403 through CLI extraction.
- `https://www.ferrari.com/en-EN/formula1/races` and related Formula 1 pages returned 403 or timed out through CLI extraction.
- Individual model pages may require browser/manual research; use them only for observation unless explicit approval exists to store screenshots or assets.

## Classification

| Source | Classification | Notes |
| --- | --- | --- |
| Attached design analysis | primary extraction | Supplies tokens, component vocabulary, spacing, typography, and explicit do/don't guidance. |
| Official Range page | public composition corroboration | Supports cinematic line-up, image-led model browsing, uppercase/letter-spaced heading behavior, and full-bleed media-first framing. |
| Official Approved / preowned page | public composition corroboration | Supports white transactional relief, image-first listing cards, catalog density, and dealer/accessory CTA bands. |
| Official History page | public composition corroboration | Supports heritage/editorial narrative, cinematic imagery, large section pacing, and restrained copy. |
| Official Dealers page | public composition corroboration | Supports dense regional directory/list structure within a premium brand frame. |
| Official News page | public composition corroboration | Supports editorial index/navigation taxonomy across racing, sports cars, collections, experiences, and company content. |
| Derived exemplar PNGs | portable visual evidence | Original agnostic images created for this bundle; they are not screenshots or copied source assets. |

## Durable signals promoted

- The dominant canvas is a warm near-black rather than pure black. It holds white display type, muted grey body copy, dark-grey elevated plates, and 1px hairlines.
- White-canvas bands appear selectively for transactional or catalog-like content: preowned/listing surfaces, pricing, dealers, booking, filters, dense forms, and directory flows.
- The chromatic signature is a single saturated race-red accent. It is scarce: primary CTAs, one important highlight, racing/event-position numerals, or a single accent band. It is not a broad palette.
- The strongest visual material is full-bleed cinematic photography or an image-like placeholder: vehicles, motion, trackside details, engineered close-ups, heritage imagery, and dramatic crops. The photograph is the depth system.
- Typography is a restrained sans system. Display copy is large but not heavy; body copy is modest. Buttons, navigation, badges, and labels use uppercase tracking.
- Geometry is sharp by default. CTAs, cards, image plates, and bands use square corners; small form radii exist only for inputs and utility controls. Pill geometry is reserved for badges.
- Spacing follows an explicit 4/8px-rooted ladder with generous 96–128px editorial sections.
- Depth comes from photography, brightness steps, hairline dividers, and occasional dark gradients. Drop-shadow tiers and glassy SaaS effects are not part of the language.
- Racing, event, technical, dealer, or product information reads through large numerals, compact uppercase labels, hairline-separated rows, and disciplined grids.
- Official public pages show separate modes for emotional launch/editorial content and utilitarian catalog/directory content; Redline Cinema should preserve that contrast.

## Curation cautions

- Ferrari identity is research-only. Generated surfaces must not reuse Ferrari names, Cavallino/shield marks, Scuderia/F1 team identifiers, model names, slogans, proprietary photography, or licensed typeface claims unless the user's prompt independently supplies them.
- Public pages are useful for composition signals, but official screenshots and source imagery are not included as portable exemplars in this bundle.
- Text extraction can miss CSS, viewport behavior, and image choreography. Browser/manual research should confirm visual claims before treating this as Tier 4 reference evidence.
- The attached design analysis includes brand-specific names for color and type. The fingerprint translates those into generic roles such as race-red accent, restrained sans, and near-black canvas.
- Race/event patterns in this bundle are composition guidance, not official Formula 1 or Scuderia identity guidance.

## Derived exemplars

The portable exemplars in `examples/core/` were produced specifically for this bundle. They lean on public research into Ferrari.com composition but remain agnostic and original.

- `cinematic-launch-hero.png` — supports full-bleed cinematic hero, scarce red CTA, restrained nav, and source-agnostic naming.
- `performance-spec-grid.png` — supports large spec numerals, labels/units, hairline grid alignment, and one decisive red value.
- `white-preowned-catalog-sheet.png` — supports white transactional relief, image-first listing cards, compact metadata, and sharp controls.
- `event-row-system.png` — supports hairline event/result rows, date/context/status alignment, and one decisive red position.
- `heritage-editorial-feature.png` — supports image-led heritage/editorial pacing and feature cards without ecommerce chrome.
- `single-red-livery-band.png` — supports a single red accent band as a rare editorial interruption.

## Durable translation

The resulting language should feel cinematic, precise, high-performance, and editorial without copying any actual automotive brand. Preserve the composition system: near-black cinema, scarce race-red voltage, full-bleed image slots or abstract photo placeholders, sharp rectangular actions, uppercase tracked metadata, structured spec/race/event rows, selective white transactional sheets, and generous editorial pacing.
