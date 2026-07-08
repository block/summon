/**
 * Deterministic median-tells scorer.
 *
 * These tells are the measured convergence patterns of unsteered model
 * generation, ported from upstream Ghost's antimedian experiment (300
 * unsteered generations across three frontier models, 2026-07; see
 * `packages/vessel-light/demo/median-tells.json` in block/ghost). An artifact
 * that hits several of these reads as generated regardless of what else it
 * does right.
 *
 * This is a pre-pass, not a replacement for prose conformance checks: every
 * tell here is mechanically detectable with a regex, so burning utility-model
 * budget on them is waste and the LLM evaluator's variance is a liability.
 * The scorer is pure and synchronous — no model call, no timeout, no
 * inconclusive state.
 *
 * Sanctioning: convergence is not the crime; surrendering the choice is.
 * A fingerprint may deliberately share a median pattern (a dark bundle IS
 * dark; a console bundle may sanction gradients-as-texture). Callers pass
 * `sanctionedTellIds` to exclude those tells for that fingerprint, and the
 * report records what was sanctioned so the receipt stays honest.
 */

export interface MedianTell {
  id: string;
  /** Occurrence count in the upstream antimedian corpus (provenance). */
  antimedianCount: number;
  kind: 'regex' | 'text';
  pattern: string;
  /** RegExp flags for `kind: 'regex'` tells (default `i`). */
  flags?: string;
  /** Distinctiveness-destroying power; contributes to the weighted score. */
  weight: number;
  description: string;
}

export interface MedianTellHit {
  id: string;
  weight: number;
  description: string;
  /** Files (artifact source keys) the tell matched in. */
  files: string[];
  /** First matched excerpt, trimmed, for receipt evidence. */
  evidence: string;
}

export interface MedianTellsReport {
  schema: 'summon.median-tells/v1';
  /** Weighted sum of hits. 0 is clean; unsteered pages average ~9 upstream. */
  score: number;
  /** Weighted sum of all evaluated (non-sanctioned) tells. */
  maxScore: number;
  hits: MedianTellHit[];
  /** Tell ids excluded because the fingerprint deliberately shares them. */
  sanctioned: string[];
}

/**
 * The measured tells. Counts and weights follow the upstream corpus; the
 * unprompted-dark and sticky-header tells are the ones most commonly
 * sanctioned per-fingerprint.
 */
export const MEDIAN_TELLS: readonly MedianTell[] = [
  {
    id: 'hover-lift',
    antimedianCount: 341,
    kind: 'regex',
    pattern: ':hover[^}]*transform:[^};]*translateY\\(-',
    weight: 3,
    description: 'Hover-lift (translateY on :hover) — the single most convergent motion tell.',
  },
  {
    id: 'indigo-blue-default-accent',
    antimedianCount: 60,
    kind: 'regex',
    pattern: '#(4f46e5|6366f1|4338ca|2563eb|3b82f6|1d4ed8|4a90e2|4361ee)\\b',
    weight: 3,
    description: 'Indigo/blue default accent family — the most convergent unsteered accent choice.',
  },
  {
    id: 'unprompted-dark-theme',
    antimedianCount: 271,
    kind: 'regex',
    pattern:
      '(?:^|[}\\s,])(?:body|html|:root)\\s*(?:,[^{}]*)?\\{[^}]*background(?:-color)?:\\s*(?:#(?:[0-2][0-9a-fA-F]){3}\\b|#[0-2]{3}\\b|black\\b|rgba?\\(\\s*[0-4]?\\d\\s*,\\s*[0-4]?\\d\\s*,\\s*[0-4]?\\d)',
    weight: 2,
    description: 'Whole-page dark background nobody asked for. Sanction for deliberately dark fingerprints.',
  },
  {
    id: 'gradient-background',
    antimedianCount: 63,
    kind: 'regex',
    pattern: 'background[^;{]*:\\s*(?:linear|radial)-gradient|background-image:\\s*(?:linear|radial)-gradient',
    weight: 3,
    description: 'Gradient page/section backgrounds or gradient-filled CTAs — a model-signature move.',
  },
  {
    id: 'glassmorphism',
    antimedianCount: 23,
    kind: 'regex',
    pattern: 'backdrop-filter:\\s*blur',
    weight: 2,
    description: 'Glassmorphism (backdrop-filter blur) cards.',
  },
  {
    id: 'chat-bubble-avatar',
    antimedianCount: 57,
    kind: 'regex',
    pattern: 'avatar[^}]*border-radius:\\s*50%|initials',
    weight: 1,
    description: 'Chat bubbles with initials-circle avatars for assistant turns.',
  },
  {
    id: 'emoji-icons',
    antimedianCount: 26,
    kind: 'regex',
    pattern: '[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]',
    flags: 'iu',
    weight: 1,
    description: 'Emoji used as icons or imagery in interface chrome.',
  },
  {
    id: 'stock-pricing-copy',
    antimedianCount: 14,
    kind: 'text',
    pattern: 'Simple, transparent pricing',
    weight: 2,
    description: 'Stock template heading copy, verbatim across all three upstream models.',
  },
  {
    id: 'welcome-back-copy',
    antimedianCount: 10,
    kind: 'text',
    pattern: 'Welcome back',
    weight: 1,
    description: 'Stock template greeting copy.',
  },
  {
    id: 'sticky-top-header',
    antimedianCount: 239,
    kind: 'regex',
    pattern: '(?:header|nav)[^}]*position:\\s*(?:sticky|fixed)[^}]*top:\\s*0',
    weight: 1,
    description: 'Sticky/fixed top header as an unexamined default.',
  },
  {
    id: 'viewport-centered-card',
    antimedianCount: 152,
    kind: 'regex',
    pattern:
      '(?:body|\\.container)[^}]*display:\\s*flex[^}]*(?:align-items:\\s*center[^}]*justify-content:\\s*center|justify-content:\\s*center[^}]*align-items:\\s*center)[^}]*(?:min-)?height:\\s*100(?:vh|dvh)',
    weight: 1,
    description: 'Single card flex-centered in the full viewport — the default page skeleton.',
  },
  {
    id: 'inter-font-default',
    antimedianCount: 44,
    kind: 'regex',
    pattern: 'font-family:[^;]*\\bInter\\b',
    weight: 1,
    description: 'Inter as the reached-for font family.',
  },
  {
    id: 'segoe-font-default',
    antimedianCount: 104,
    kind: 'regex',
    pattern: 'font-family:[^;]*Segoe UI',
    weight: 1,
    description: 'Segoe UI system-stack boilerplate as the reached-for font family.',
  },
];

/** Design-bearing files only: the tells target markup and styling. */
function isDesignBearingFile(file: string): boolean {
  return file.endsWith('.css') || file.endsWith('.html');
}

const EVIDENCE_MAX_CHARS = 160;

function compileTell(tell: MedianTell): RegExp {
  if (tell.kind === 'text') {
    return new RegExp(tell.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  return new RegExp(tell.pattern, tell.flags ?? 'i');
}

/**
 * Derive sanctioned tells from the fingerprint's own token CSS. The
 * fingerprint is the design decision record: if its background token is dark,
 * a dark artifact is fidelity, not the unprompted-dark median — so that tell
 * is sanctioned rather than scored. Only mechanically derivable sanctions
 * live here; anything requiring judgment belongs in the fingerprint's prose
 * checks.
 */
export function deriveSanctionedTells(tokensCss: string | null | undefined): string[] {
  if (!tokensCss) return [];
  const sanctioned: string[] = [];
  const bgMatch = tokensCss.match(/--(?:color-)?(?:bg|background|canvas)[\w-]*:\s*(#[0-9a-fA-F]{3,8})/);
  if (bgMatch?.[1] && isDarkHex(bgMatch[1])) sanctioned.push('unprompted-dark-theme');
  return sanctioned;
}

function isDarkHex(hex: string): boolean {
  let value = hex.slice(1);
  if (value.length === 3 || value.length === 4) {
    value = [...value].map((char) => char + char).join('');
  }
  if (value.length < 6) return false;
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  // Relative-luminance approximation; dark means the page is meant to be dark.
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 96;
}

export interface ScoreMedianTellsInput {
  artifactSource: Record<string, string>;
  /** Tell ids the fingerprint deliberately shares; excluded from scoring. */
  sanctionedTellIds?: readonly string[];
  /** Override the tell set (tests, future per-fingerprint corpora). */
  tells?: readonly MedianTell[];
}

export function scoreMedianTells(input: ScoreMedianTellsInput): MedianTellsReport {
  const tells = input.tells ?? MEDIAN_TELLS;
  const sanctionedSet = new Set(input.sanctionedTellIds ?? []);
  const sanctioned = tells.filter((tell) => sanctionedSet.has(tell.id)).map((tell) => tell.id);
  const evaluated = tells.filter((tell) => !sanctionedSet.has(tell.id));

  const files = Object.entries(input.artifactSource)
    .filter(([file, content]) => isDesignBearingFile(file) && typeof content === 'string' && content)
    .sort(([a], [b]) => a.localeCompare(b));

  const hits: MedianTellHit[] = [];
  let score = 0;
  let maxScore = 0;

  for (const tell of evaluated) {
    maxScore += tell.weight;
    const re = compileTell(tell);
    const matchedFiles: string[] = [];
    let evidence = '';
    for (const [file, content] of files) {
      const match = re.exec(content);
      if (!match) continue;
      matchedFiles.push(file);
      if (!evidence) {
        evidence = match[0].replace(/\s+/g, ' ').trim().slice(0, EVIDENCE_MAX_CHARS);
      }
    }
    if (matchedFiles.length > 0) {
      score += tell.weight;
      hits.push({ id: tell.id, weight: tell.weight, description: tell.description, files: matchedFiles, evidence });
    }
  }

  return { schema: 'summon.median-tells/v1', score, maxScore, hits, sanctioned };
}
