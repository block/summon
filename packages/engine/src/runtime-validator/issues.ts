import { contractIssue, type ContractIssue } from '../contracts.js';

export function protocolBlock(code: string, message: string, path?: string): ContractIssue {
  return contractIssue({ source: 'protocol', severity: 'block', code, message, path });
}

export function block(code: string, message: string, path?: string): ContractIssue {
  return contractIssue({ source: 'html', severity: 'block', code, message, path });
}

export function warn(code: string, message: string): ContractIssue {
  return contractIssue({ source: 'html', severity: 'warn', code, message });
}

export function dedupeIssues(issues: ContractIssue[]): ContractIssue[] {
  const seen = new Set<string>();
  const out: ContractIssue[] = [];
  for (const issue of issues) {
    const key = `${issue.source}:${issue.severity}:${issue.code}:${issue.message}:${issue.path ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(issue);
  }
  return out;
}

export function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
