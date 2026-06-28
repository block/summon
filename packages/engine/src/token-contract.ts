/**
 * Token vocabulary helpers.
 *
 * Summon does not own product/design token semantics. Active design sources
 * (Ghost fingerprints or app-provided stylesheets) may define any valid CSS
 * custom-property vocabulary. Summon only surfaces the vocabulary to models and
 * validates runtime safety elsewhere; it must not require tokens like
 * `--color-bg` or `--space-4`.
 *
 * The empty exported token constants are retained only for public-API
 * stability; they carry no product requirements.
 */

export type TokenKind =
  | 'color'
  | 'space'
  | 'radius'
  | 'font'
  | 'text'
  | 'tracking'
  | 'leading'
  | 'shadow'
  | 'unknown';

export interface TokenSpec {
  /** Token name without the leading `--`. */
  name: string;
  kind: TokenKind;
  /** One-liner used in generated prompt vocabulary lists when available. */
  description: string;
}

export interface OptOutGroup {
  key: string;
  kinds: TokenKind[];
  whenNone: string;
}

export const REQUIRED_TOKENS: TokenSpec[] = [];
export const OPPORTUNISTIC_TOKENS: TokenSpec[] = [];
export const OPT_OUT_GROUPS: OptOutGroup[] = [];
export const SHADOW_TOKENS: TokenSpec[] = [];
export const OPT_OUT_TOKENS: Record<string, TokenSpec[]> = {};

export interface TokenContract {
  required: TokenSpec[];
  opportunistic: TokenSpec[];
  optOuts: OptOutGroup[];
  optOutTokens: Record<string, TokenSpec[]>;
}

export const TOKEN_CONTRACT: TokenContract = {
  required: REQUIRED_TOKENS,
  opportunistic: OPPORTUNISTIC_TOKENS,
  optOuts: OPT_OUT_GROUPS,
  optOutTokens: OPT_OUT_TOKENS,
};

/**
 * Fixed prompt language for token handling. Per-run Ghost/direction blocks list
 * the concrete active vocabulary. This fixed block intentionally has no token
 * names or design opinions.
 */
export function formatTokenContract(): string {
  return [
    'The host may ship a stylesheet from the active design source. Treat its CSS custom properties as an opaque design vocabulary for this run; do not assume Summon-specific token names.',
    'Use the token names that are actually listed in the Ghost/direction block. You may define local aliases in `main.css` when helpful, but do not reference unrelated or undefined external variables.',
    'Token names and values belong to the selected design source; Summon only provides the Arrow runtime and safety boundary.',
  ].join('\n');
}
