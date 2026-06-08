/**
 * Validates a direction's `tokens.css` against TOKEN_CONTRACT. The host loader
 * (apps/server/src/directions-loader.ts) calls this to refuse directions that
 * fail to define required tokens, and to surface which opportunistic spacing
 * slots are live so the per-direction prompt block can list them.
 *
 * The "parser" is regex over `--name:` declarations — sufficient for our
 * tokens.css shape (single :root block, top-level custom properties). Anything
 * fancier (calc(), nested selectors) doesn't change which token names exist.
 */

import {
  REQUIRED_TOKENS,
  OPPORTUNISTIC_TOKENS,
  OPT_OUT_GROUPS,
  OPT_OUT_TOKENS,
} from './token-contract.js';

export type OptOutValue = 'none' | 'default';

export interface DirectionOpts {
  /** Per-family opt-outs keyed by OPT_OUT_GROUPS.key (e.g., shadows: 'none'). */
  [key: string]: OptOutValue;
}

export interface ValidationResult {
  /** Token names (without `--`) actually defined in tokens.css. */
  defined: Set<string>;
  /** Opportunistic slots that are live (e.g., `space-8`, `space-12`). */
  liveOpportunistic: string[];
  /** Errors fatal to loading this direction. */
  errors: string[];
  /** Non-fatal warnings (e.g., a token defined but the direction opted out). */
  warnings: string[];
}

/**
 * Returns the set of token names declared inside the `:root { ... }` block.
 * If no `:root` is found, falls back to scanning the whole file (covers cases
 * where authors use `:where(:root)` or `html` selectors).
 */
export function parseDefinedTokens(css: string): Set<string> {
  const found = new Set<string>();
  const declRe = /--([a-zA-Z0-9_-]+)\s*:/g;
  let match: RegExpExecArray | null;
  while ((match = declRe.exec(css)) !== null) {
    found.add(match[1]!);
  }
  return found;
}

/**
 * Parses tokens.css into a `{ name → value }` map. Used by the override
 * bridge to surface the base value alongside the host's new value in the
 * prompt block, so the model can reason about the delta.
 *
 * Values are returned trimmed and without trailing semicolons or comments.
 */
export function parseTokenValues(css: string): Map<string, string> {
  const values = new Map<string, string>();
  const declRe = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = declRe.exec(css)) !== null) {
    const name = match[1]!;
    const value = match[2]!.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    values.set(name, value);
  }
  return values;
}

export function validateDirection(
  css: string,
  opts: DirectionOpts | undefined
): ValidationResult {
  const defined = parseDefinedTokens(css);
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const spec of REQUIRED_TOKENS) {
    if (!defined.has(spec.name)) {
      errors.push(`required token --${spec.name} is not defined`);
    }
  }

  // Opt-out families: required unless meta.opts says "none".
  for (const group of OPT_OUT_GROUPS) {
    const setting = opts?.[group.key] ?? 'default';
    const tokens = OPT_OUT_TOKENS[group.key] ?? [];
    if (setting === 'none') {
      // Direction opted out — tokens MAY still be present, but we warn so an
      // accidental partial opt-out (declared "none" but emitted shadows anyway)
      // is visible in the loader log.
      for (const spec of tokens) {
        if (defined.has(spec.name)) {
          warnings.push(
            `--${spec.name} is defined but meta.opts.${group.key} = "none" — token will be ignored by the prompt`
          );
        }
      }
    } else {
      // Default — every token in the group is required.
      for (const spec of tokens) {
        if (!defined.has(spec.name)) {
          errors.push(
            `token --${spec.name} is not defined (set meta.opts.${group.key} = "none" to opt out)`
          );
        }
      }
    }
  }

  const liveOpportunistic = OPPORTUNISTIC_TOKENS.filter((s) =>
    defined.has(s.name)
  ).map((s) => s.name);

  return { defined, liveOpportunistic, errors, warnings };
}

/**
 * Coerces meta.opts into a strictly-typed map. Unknown keys are dropped;
 * non-"none" values normalize to "default".
 */
export function coerceOpts(raw: unknown): DirectionOpts {
  const out: DirectionOpts = {};
  if (!raw || typeof raw !== 'object') return out;
  const obj = raw as Record<string, unknown>;
  const keys = new Set(OPT_OUT_GROUPS.map((g) => g.key));
  for (const k of Object.keys(obj)) {
    if (!keys.has(k)) continue;
    out[k] = obj[k] === 'none' ? 'none' : 'default';
  }
  return out;
}
