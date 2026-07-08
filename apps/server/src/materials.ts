/**
 * The shared structural materials layer (Reading A of vessel-light adoption).
 *
 * Upstream vessel-light ships Vessel's design language as `.ghost/materials/`:
 * a brand-agnostic structural grammar (`primitives.css` — surface/stack/
 * button/input/text classes driven entirely by custom properties) plus
 * typefaces. Summon vendors that layer once, here, and hooks it up to ALL
 * catalog fingerprints: `bridge.css` maps Vessel's token vocabulary onto the
 * shared dialect every vendored fingerprint already defines
 * (`--color-bg`, `--color-surface`, `--color-accent`, `--radius-*`, ...),
 * so one structural layer re-skins per fingerprint with zero changes to the
 * upstream file or the fingerprints.
 *
 * Composition order matters only for readability — the bridge is pure var()
 * indirection, resolved at computed-value time. The layer is appended to the
 * host token source (never to generated main.css), so it rides the existing
 * trusted styling channel into the surface shadow root.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MATERIALS_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'fingerprints',
  'materials',
);

const VESSEL_LIGHT_DIR = join(MATERIALS_ROOT, 'vessel-light');

export interface StructuralMaterials {
  /** primitives.css + bridge.css, ready to append to the host token source. */
  css: string;
  /** @font-face CSS for the fontFacesSource host channel (document-level). */
  fontFacesCss: string;
  /** Compact prompt block teaching the model the structural class grammar. */
  brief: string;
}

let cached: StructuralMaterials | null = null;

export function structuralMaterials(): StructuralMaterials {
  if (cached) return cached;
  const primitives = readFileSync(join(VESSEL_LIGHT_DIR, 'primitives.css'), 'utf-8');
  const bridge = readFileSync(join(VESSEL_LIGHT_DIR, 'bridge.css'), 'utf-8');
  const fontFacesCss = readFileSync(join(VESSEL_LIGHT_DIR, 'fonts.css'), 'utf-8');
  const css = [
    '/* --- structural materials layer (vessel-light, bridged) --- */',
    bridge,
    primitives,
  ].join('\n');
  cached = { css, fontFacesCss, brief: structuralBrief() };
  return cached;
}

/**
 * The generation-facing contract for the structural layer. Kept deliberately
 * short: the classes are the API, the fingerprint prose stays the design
 * authority, and main.css remains where fingerprint expression happens.
 */
function structuralBrief(): string {
  return [
    '## Structural materials layer',
    '',
    'A structural stylesheet is preloaded alongside the fingerprint tokens. It',
    'provides layout and control primitives that already resolve to the active',
    "fingerprint's tokens — use these class names in main.html instead of",
    'reinventing base structure in main.css:',
    '',
    '- `surface` (+ `surface--card|muted|popover|dark`, `surface--pad-xs..lg`,',
    '  `surface--radius-sm|md|lg|card|pill`, `surface--border`,',
    '  `surface--elevation-card|popover|modal`)',
    '- `stack` (+ `stack--row`, `stack--gap-none..xl`, `stack--wrap`,',
    '  `stack--align-start|center|end|baseline`,',
    '  `stack--justify-center|between|end`)',
    '- `button` (+ `button--primary|secondary|outline|ghost|destructive`,',
    '  `button--size-xs|sm|lg`, `button--icon`)',
    '- `input` (+ `input--textarea`, `input--select`, `input--checkbox`),',
    '  `field`, `label`, `field-error`',
    '- `text` (+ `text--display|headline|title|label|mono|muted|inverse`,',
    '  status variants)',
    '',
    'These primitives handle structure only. The fingerprint prose above is the',
    'design authority: express its look in main.css on top of (or instead of)',
    'any primitive whenever the fingerprint calls for a different grammar.',
    'Never restyle the primitive class names globally in main.css.',
  ].join('\n');
}

/**
 * Resolve a materials asset path for static serving. Returns null unless the
 * normalized path stays inside the materials root (no traversal, no absolute
 * escape) — the route serves vendored font/css assets only.
 */
export function resolveMaterialsAssetPath(relativePath: string): string | null {
  const normalized = normalize(relativePath);
  if (normalized.startsWith('..') || normalized.includes(`..${sep}`)) return null;
  const abs = resolve(MATERIALS_ROOT, normalized);
  if (abs !== MATERIALS_ROOT && !abs.startsWith(MATERIALS_ROOT + sep)) return null;
  return abs;
}

export function materialsRoot(): string {
  return MATERIALS_ROOT;
}
