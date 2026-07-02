# Flourish-inventory pattern — grounding each fingerprint in a design-system lineage

Goal: enrich each fingerprint's `## Inventory` section so it reads as a mature,
well-grounded design-system spec — WITHOUT changing its identity, its existing
token values, or violating its "what this is not" stance.

## What to produce (in the assigned fingerprint's `index.md` `## Inventory`)

1. **Design lineage note (new).** A short paragraph (2–4 sentences) naming the
   real design-system tradition(s) this language descends from — provided in your
   task. Frame it as *lineage and grounding*, e.g. "Editorial Mono descends from
   the Swiss International Typographic Style…". This orients the model in a known
   design vocabulary. Respect source-neutrality: name design *traditions/systems/
   conventions*, never instruct copying a specific forbidden brand's assets.

2. **Enriched material + component prose.** Deepen the existing prose: the
   component vocabulary (what buttons, rows, panels, inputs, tables, chips, etc.
   look like in this language), interaction states (hover, focus, active,
   disabled, selected, loading, empty, error), density/responsive behavior, and
   accessibility intent (contrast pairing, focus visibility, min text sizes).
   Ground each in the matched lineage's conventions.

3. **Carefully extended token vocabulary.** ADD coherent tokens that fill real
   generation gaps AND match the lineage — good candidates: focus-ring tokens,
   interaction/state tokens, any missing semantic surface/border roles, and (only
   if the stance allows motion) minimal `--ease-*` / `--duration-*` tokens. Every
   added token MUST:
   - be derived from and consistent with the fingerprint's EXISTING values and
     signature (same hues, same rhythm, same geometry);
   - be genuinely useful to a generator;
   - carry a short comment in the fingerprint's own voice.
   Add them in a clearly-commented new group inside the existing `:root { … }`
   block (do not start a second `:root`).

4. **Fix stale node links.** The Inventory (and any prose) currently links to
   DELETED assembly folders (e.g. `[brief](brief)`, `[landing](landing)`,
   `[stream](stream)`). Those folders no longer exist. Repair every link so it
   points only to EXISTING building-block nodes (the top-level `*.md` files) or
   drop the reference. Verify by listing the `.ghost/` directory: the only nodes
   are `index.md` + the building-block `*.md` files (+ maybe a `checks/` folder,
   which is validation, not a linkable surface).

## Hard rules

- **Never change an existing token name or value.** Only add. Never remove the
  signature token groups.
- **Never violate the "what this is not" stance.** Read the Intent's stance
  paragraph first. If it forbids motion/animation, add NO motion tokens. If it
  forbids shadows/elevation, keep shadow tokens inert/none. If it forbids a
  color system, do not introduce chromatic tokens. When in doubt, don't add.
- **Stay in voice.** Comments and prose must sound like this fingerprint (read
  its Intent + Signature). Do not import another fingerprint's vocabulary.
- **Do not touch** `## Intent`, `## Signature look & feel`, `## Composition`,
  `manifest.yml`, or `bundle.json`. Only edit `## Inventory`.
- **Keep it tight and real.** Flourish means depth and grounding, not bloat. No
  filler. Every added line must help a generator make on-brand decisions.

## Definition of done

- `## Inventory` gained a design-lineage note, richer material/component/state
  prose, and a coherent set of added tokens consistent with the signature.
- No existing token value changed; stance fully respected.
- All stale links to deleted assembly folders repaired to existing nodes.
- Report back: the lineage you named, the token groups you added (names only),
  and which stale links you fixed.
