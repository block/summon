/**
 * The single source of truth for the design-token vocabulary an LLM is told it
 * may use. Every direction's `tokens.css` is validated against this contract,
 * and the prompt fragment that lists the vocabulary in `SUMMON_FIXED_INSTRUCTIONS`
 * is generated from it — so the prompt can never drift from what directions
 * actually define.
 *
 * Three kinds of tokens:
 *   - required  — every direction MUST define this. Loader rejects directions
 *                 that omit one.
 *   - opt-out   — optional family (e.g., shadows). A direction can omit them
 *                 if `meta.json` declares `opts.<group> = "none"`. The
 *                 per-direction prompt block then suppresses the relevant
 *                 paragraph and tells the model not to synthesize that family.
 *   - opportunistic — defined when meaningful, omitted when not (e.g., spacing
 *                 slots 7/9/11). Per-direction prompt block enumerates which
 *                 slots are actually live.
 */

export type TokenKind =
  | 'color'
  | 'space'
  | 'radius'
  | 'font'
  | 'text'
  | 'tracking'
  | 'leading'
  | 'shadow';

export interface TokenSpec {
  /** Token name without the leading `--`. */
  name: string;
  kind: TokenKind;
  /** One-liner used in the generated prompt vocabulary list. */
  description: string;
}

export interface OptOutGroup {
  /** Name of the opts key in meta.json (e.g., `shadows`). */
  key: string;
  /** Token kinds covered by this opt-out. */
  kinds: TokenKind[];
  /** Sentence appended to the per-direction prompt block when opted out. */
  whenNone: string;
}

export const REQUIRED_TOKENS: TokenSpec[] = [
  // Colors — every direction defines all of these.
  { name: 'color-bg', kind: 'color', description: 'page background' },
  { name: 'color-surface', kind: 'color', description: 'elevated panel/card surface' },
  { name: 'color-surface-muted', kind: 'color', description: 'secondary/disabled surface' },
  { name: 'color-border', kind: 'color', description: 'thin neutral divider' },
  { name: 'color-border-input', kind: 'color', description: 'border on text inputs' },
  { name: 'color-border-strong', kind: 'color', description: 'high-contrast emphasis border' },
  { name: 'color-text', kind: 'color', description: 'primary text' },
  { name: 'color-text-muted', kind: 'color', description: 'subdued/secondary text' },
  { name: 'color-text-alt', kind: 'color', description: 'tertiary text' },
  { name: 'color-accent', kind: 'color', description: 'accent surface' },
  { name: 'color-accent-fg', kind: 'color', description: 'foreground on accent' },
  { name: 'color-danger', kind: 'color', description: 'semantic — destructive/error' },
  { name: 'color-success', kind: 'color', description: 'semantic — success' },
  { name: 'color-info', kind: 'color', description: 'semantic — informational' },
  { name: 'color-warning', kind: 'color', description: 'semantic — warning' },

  // Spacing core — slots 1-6 are baseline; 7..12 are opportunistic and surfaced per-direction.
  { name: 'space-1', kind: 'space', description: '4-ish — hairline / icon gap' },
  { name: 'space-2', kind: 'space', description: '8-ish — tight grouping' },
  { name: 'space-3', kind: 'space', description: '12-ish — default group gap' },
  { name: 'space-4', kind: 'space', description: '16-ish — content gutter' },
  { name: 'space-5', kind: 'space', description: '24-ish — section internal' },
  { name: 'space-6', kind: 'space', description: '32-ish — section gap' },

  // Radii — all directions define the full ladder.
  { name: 'radius-pill', kind: 'radius', description: '999px — interactive pill' },
  { name: 'radius-sm', kind: 'radius', description: 'small structural radius' },
  { name: 'radius-md', kind: 'radius', description: 'medium structural radius' },
  { name: 'radius-lg', kind: 'radius', description: 'large structural radius (cards)' },
  { name: 'radius-xl', kind: 'radius', description: 'extra-large radius (modals/sheets)' },

  // Type — fonts and scale.
  { name: 'font-sans', kind: 'font', description: 'sans-serif body + UI face' },
  { name: 'font-mono', kind: 'font', description: 'monospace face for code/numerals' },
  { name: 'font-serif', kind: 'font', description: 'serif face for editorial accents' },
  { name: 'text-xs', kind: 'text', description: 'extra-small (labels, eyebrows)' },
  { name: 'text-sm', kind: 'text', description: 'small (secondary body)' },
  { name: 'text-md', kind: 'text', description: 'medium (default body)' },
  { name: 'text-lg', kind: 'text', description: 'large (subheadings)' },
  { name: 'text-xl', kind: 'text', description: 'extra-large (section heads)' },
  { name: 'text-2xl', kind: 'text', description: 'display (hero heads)' },
  { name: 'text-3xl', kind: 'text', description: 'big-display (dominant numbers)' },
  { name: 'text-display', kind: 'text', description: 'fluid hero size (clamp() typical)' },

  // Tracking / leading — editorial tuning.
  { name: 'tracking-label', kind: 'tracking', description: 'positive tracking for uppercase eyebrows' },
  { name: 'tracking-tight', kind: 'tracking', description: 'modest negative tracking for headings' },
  { name: 'tracking-display', kind: 'tracking', description: 'heavy negative tracking for hero display' },
  { name: 'leading-display', kind: 'leading', description: 'tightest line-height (display)' },
  { name: 'leading-section', kind: 'leading', description: 'tight line-height (section heads)' },
  { name: 'leading-body', kind: 'leading', description: 'comfortable body line-height' },
  { name: 'leading-reading', kind: 'leading', description: 'relaxed long-form line-height' },
];

export const OPPORTUNISTIC_TOKENS: TokenSpec[] = [
  { name: 'space-7', kind: 'space', description: '~40 — uncommon bridge' },
  { name: 'space-8', kind: 'space', description: '~52-64 — block separation' },
  { name: 'space-9', kind: 'space', description: '~64-80 — wide rhythm' },
  { name: 'space-10', kind: 'space', description: '~75-96 — page chunk' },
  { name: 'space-11', kind: 'space', description: '~120 — hero spacing' },
  { name: 'space-12', kind: 'space', description: '~100-160 — full section break' },
];

export const OPT_OUT_GROUPS: OptOutGroup[] = [
  {
    key: 'shadows',
    kinds: ['shadow'],
    whenNone:
      'This direction has NO shadow vocabulary. Do not synthesize `box-shadow` from `--shadow-*` tokens — they are deliberately undefined. Express elevation through fill, border, or surface ladder instead.',
  },
];

export const SHADOW_TOKENS: TokenSpec[] = [
  { name: 'shadow-mini', kind: 'shadow', description: 'tiny lift — chips, micro-popovers' },
  { name: 'shadow-card', kind: 'shadow', description: 'card-level lift' },
  { name: 'shadow-elevated', kind: 'shadow', description: 'prominent panel lift' },
  { name: 'shadow-popover', kind: 'shadow', description: 'popover/menu' },
  { name: 'shadow-modal', kind: 'shadow', description: 'modal/sheet' },
];

/**
 * Tokens that may exist when a direction does not opt out via `meta.opts`.
 * The validator treats these as required *unless* the matching opt-out group
 * is set to `"none"`.
 */
export const OPT_OUT_TOKENS: Record<string, TokenSpec[]> = {
  shadows: SHADOW_TOKENS,
};

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
 * Renders the "Token contract" paragraph that ships in the fixed instructions.
 * The list is grouped by family and produced from the contract above so the
 * prompt cannot drift from what directions actually define.
 */
export function formatTokenContract(): string {
  const lines: string[] = [];
  lines.push(
    'The host ships a stylesheet with these token families. Reference them as `var(--name)`:'
  );
  lines.push('');
  lines.push(formatFamily('Colors', filterByKind(REQUIRED_TOKENS, 'color')));
  lines.push(
    `- **Spacing**: \`--space-1\` through \`--space-12\` — slots 1–6 are always defined; 7..12 are opportunistic per direction (the per-direction block lists which are live). Scale roughly 4 · 8 · 12 · 16 · 24 · 32 · 52 · 75 · 100.`
  );
  lines.push(formatFamily('Radii', filterByKind(REQUIRED_TOKENS, 'radius')));
  lines.push(formatFamily('Fonts', filterByKind(REQUIRED_TOKENS, 'font')));
  lines.push(formatFamily('Type sizes', filterByKind(REQUIRED_TOKENS, 'text')));
  lines.push(formatFamily('Tracking', filterByKind(REQUIRED_TOKENS, 'tracking')));
  lines.push(formatFamily('Leading', filterByKind(REQUIRED_TOKENS, 'leading')));
  lines.push(
    `- **Shadows** (when the direction defines them): \`--shadow-mini\`, \`--shadow-card\`, \`--shadow-elevated\`, \`--shadow-popover\`, \`--shadow-modal\`. The per-direction block tells you whether to use them or avoid them.`
  );
  return lines.join('\n');
}

function filterByKind(specs: TokenSpec[], kind: TokenKind): TokenSpec[] {
  return specs.filter((s) => s.kind === kind);
}

function formatFamily(label: string, specs: TokenSpec[]): string {
  const names = specs.map((s) => `\`--${s.name}\``).join(', ');
  return `- **${label}**: ${names}.`;
}
