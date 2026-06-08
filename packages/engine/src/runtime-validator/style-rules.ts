import type { ContractIssue } from '../contracts.js';
import { warn } from './issues.js';

const TOKEN_RE = /var\(--([a-zA-Z0-9_-]+)/g;
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const CSS_COLOR_FN_RE = /\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\s*\(/gi;
const PX_RE = /(?:^|[^\w-])(-?\d+(?:\.\d+)?px)\b/g;

export function scanTokenReferences(
  html: string,
  definedTokens: ReadonlySet<string> | undefined,
  issues: ContractIssue[],
): void {
  if (!definedTokens) return;
  let match: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(html)) !== null) {
    const token = match[1]!;
    if (!definedTokens.has(token)) {
      issues.push(warn('unknown-token', `Token --${token} is not defined`));
    }
  }
}

export function scanStyleDrift(html: string, issues: ContractIssue[]): void {
  if (HEX_RE.test(html)) {
    issues.push(warn('raw-color', 'Raw color literal found; prefer color tokens'));
  }
  HEX_RE.lastIndex = 0;
  if (CSS_COLOR_FN_RE.test(html)) {
    issues.push(warn('raw-color', 'Raw CSS color function found; prefer color tokens'));
  }
  CSS_COLOR_FN_RE.lastIndex = 0;
  if (PX_RE.test(html)) {
    issues.push(warn('raw-px', 'Raw px value found; prefer spacing/type/radius tokens'));
  }
  PX_RE.lastIndex = 0;
}
