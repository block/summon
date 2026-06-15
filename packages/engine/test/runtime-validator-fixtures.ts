import type { ContractIssue } from '../src/index.ts';

export const baseContext = {
  mode: 'static' as const,
  allowedIntents: ['choose'],
  capabilities: [{ name: 'choose', triggers: ['click' as const] }],
  definedTokens: new Set(['color-text', 'space-2', 'radius-pill']),
};

export function codes(issues: ContractIssue[]): string[] {
  return issues.map((issue) => issue.code).sort();
}
