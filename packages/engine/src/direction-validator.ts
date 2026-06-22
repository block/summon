/**
 * Token vocabulary parser for active design-source stylesheets.
 *
 * Summon is token-agnostic: it does not require any particular CSS custom
 * property names. This module parses whatever variables a Ghost fingerprint or
 * host direction provides and surfaces non-fatal warnings only for malformed or
 * empty vocabularies.
 */

export type OptOutValue = 'none' | 'default';

export interface DirectionOpts {
  [key: string]: OptOutValue;
}

export interface ValidationResult {
  /** Token names (without `--`) actually defined in tokens.css. */
  defined: Set<string>;
  /** Legacy compatibility field. No Summon-owned opportunistic slots exist. */
  liveOpportunistic: string[];
  /** Summon no longer emits fatal token-vocabulary errors. */
  errors: string[];
  /** Non-fatal token vocabulary warnings. */
  warnings: string[];
}

/**
 * Returns every CSS custom-property name declared in the stylesheet.
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
 * Parses CSS custom properties into a `{ name → value }` map. Values are
 * returned trimmed and without trailing comments.
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
  _opts: DirectionOpts | undefined
): ValidationResult {
  const defined = parseDefinedTokens(css);
  const warnings: string[] = [];
  if (!css.trim()) {
    warnings.push('active token stylesheet is empty');
  } else if (defined.size === 0) {
    warnings.push('active token stylesheet defines no CSS custom properties');
  }
  return { defined, liveOpportunistic: [], errors: [], warnings };
}

/**
 * Legacy compatibility. Summon no longer interprets token opt-out groups.
 */
export function coerceOpts(_raw: unknown): DirectionOpts {
  return {};
}
