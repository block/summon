import type { ContractIssue, ProtocolLine, StreamGraph } from '@summon-internal/engine';
import type { RepairStats } from './types.js';

const MAX_VALIDATION_EXAMPLES = 8;

export function summarizeContractIssues(issues: ContractIssue[]): {
  blocked: number;
  warnings: number;
  codes: Record<string, number>;
  examples: ContractIssue[];
} {
  const codes: Record<string, number> = {};
  const examples: ContractIssue[] = [];
  const exampleCodes = new Set<string>();
  let blocked = 0;
  let warnings = 0;
  for (const issue of issues) {
    if (issue.severity === 'block') blocked++;
    else warnings++;
    codes[issue.code] = (codes[issue.code] ?? 0) + 1;
    if (examples.length < MAX_VALIDATION_EXAMPLES && !exampleCodes.has(issue.code)) {
      examples.push({ ...issue });
      exampleCodes.add(issue.code);
    }
  }
  return { blocked, warnings, codes, examples };
}

export async function writeFinalSummaries(args: {
  writeProtocolLine: (line: ProtocolLine) => Promise<void>;
  validationIssues: ContractIssue[];
  streamGraph: StreamGraph;
  repair: { enabled: boolean };
  repairStats: RepairStats;
}) {
  if (args.repair.enabled) {
    await args.writeProtocolLine({
      op: 'meta',
      path: '/repair-summary',
      value: args.repairStats,
    });
  }
  if (args.validationIssues.length > 0) {
    await args.writeProtocolLine({
      op: 'meta',
      path: '/validation-summary',
      value: summarizeContractIssues(args.validationIssues),
    });
  }
  await args.writeProtocolLine({
    op: 'meta',
    path: '/stream-graph-summary',
    value: args.streamGraph.snapshot(),
  });
}
