import type {
  ContractIssue,
  ContractPromptBlock,
  ProtocolLine,
  RepairFeedbackMetaValue,
} from '@summon-internal/engine';
import type {
  RepairOptions,
  SummonModelChunk,
  SummonRepairProvider,
  SurfaceGenerationInput,
} from './types.js';

export interface QueuedRepairTarget {
  target: string;
  line: ProtocolLine;
  issue: ContractIssue;
  feedback: RepairFeedbackMetaValue;
}

const DEFAULT_REPAIR_ATTEMPTS = 1;
const DEFAULT_REPAIR_TARGETS = 2;

export type NormalizedRepairOptions = {
  enabled: false;
  maxAttempts: number;
  maxTargets: number;
  provider?: undefined;
} | {
  enabled: true;
  maxAttempts: number;
  maxTargets: number;
  provider: SummonRepairProvider;
};

export function normalizeRepairOptions(
  repair: RepairOptions | null | undefined,
): NormalizedRepairOptions {
  if (!repair?.enabled || !repair.provider) {
    return {
      enabled: false,
      maxAttempts: DEFAULT_REPAIR_ATTEMPTS,
      maxTargets: DEFAULT_REPAIR_TARGETS,
    };
  }
  return {
    enabled: true,
    maxAttempts: clampInt(repair.maxAttempts, 1, 3, DEFAULT_REPAIR_ATTEMPTS),
    maxTargets: clampInt(repair.maxTargets, 1, 5, DEFAULT_REPAIR_TARGETS),
    provider: repair.provider,
  };
}

export async function runRepairForTarget(args: {
  target: QueuedRepairTarget;
  input: SurfaceGenerationInput;
  promptBlocks: ContractPromptBlock[];
  hardenRawLine: (raw: string) => Promise<{
    outboundLines: ProtocolLine[];
    acceptedLines: ProtocolLine[];
    blocked?: ContractIssue;
  }>;
  acceptRepairResult: (result: {
    outboundLines: ProtocolLine[];
    acceptedLines: ProtocolLine[];
  }) => Promise<void>;
  writeProtocolLine: (line: ProtocolLine) => Promise<void>;
  writeRepairFeedback: (feedback: RepairFeedbackMetaValue) => Promise<void>;
  repair: Extract<NormalizedRepairOptions, { enabled: true }>;
}): Promise<boolean> {
  const { target, input, promptBlocks, hardenRawLine, acceptRepairResult, writeProtocolLine, writeRepairFeedback, repair } = args;
  const sectionId = sectionIdFromTarget(target.target);
  for (let attempt = 1; attempt <= repair.maxAttempts; attempt++) {
    await writeProtocolLine({ op: 'meta', path: '/status', value: `repairing ${sectionId}` });
    try {
      const rawRepair = await repair.provider({
        prompt: buildRepairPrompt(target),
        promptBlocks,
        target: target.target,
        sectionId,
        issue: target.issue,
        rejectedLine: target.line,
        feedback: target.feedback,
        attempt,
        signal: input.signal,
      });
      const text = await collectRepairText(rawRepair);
      const lines = extractProtocolCandidateLines(text);
      if (lines.length !== 1) {
        await writeRepairFeedback({
          ...target.feedback,
          status: 'failed',
          attempt,
          retryable: attempt < repair.maxAttempts,
          rawPreview: previewText(text),
          hints: ['Repair must return exactly one JSONL replacement line.'],
        });
        continue;
      }

      const result = await hardenRawLine(lines[0]!);
      const acceptedTarget = result.acceptedLines.some(
        (line) => line.op === 'add' && line.path === target.target,
      );
      if (result.blocked || !acceptedTarget) {
        await writeRepairFeedback({
          ...target.feedback,
          status: 'failed',
          attempt,
          retryable: attempt < repair.maxAttempts,
          rawPreview: previewText(lines[0]!),
          hints: result.blocked
            ? [`Repair still failed validation: ${result.blocked.message}`]
            : ['Repair must target the same path.'],
        });
        continue;
      }

      await acceptRepairResult(result);
      await writeRepairFeedback({
        ...target.feedback,
        status: 'repaired',
        attempt,
        retryable: false,
        hints: ['Replacement target accepted.'],
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await writeRepairFeedback({
        ...target.feedback,
        status: 'failed',
        attempt,
        retryable: attempt < repair.maxAttempts,
        hints: [`Repair call failed: ${message}`],
      });
    }
  }
  return false;
}

function buildRepairPrompt(target: QueuedRepairTarget): string {
  return `A previous Summon patch was blocked by validation.

Target path: ${target.target}
Issue: ${target.issue.code} — ${target.issue.message}

Output exactly one JSONL protocol line: a complete replacement add line for the same target path (${target.target}). Do not emit markdown, prose, meta lines, set /screen, or multiple lines.

Blocked original line:
${JSON.stringify(target.line)}`;
}

function sectionIdFromTarget(target: string): string {
  if (!target.startsWith('/section/')) return target;
  const suffix = target.slice('/section/'.length);
  return suffix.split('/', 1)[0] || target;
}

async function collectRepairText(
  raw: string | AsyncIterable<SummonModelChunk>,
): Promise<string> {
  if (typeof raw === 'string') return raw;
  let out = '';
  for await (const chunk of raw) {
    if (typeof chunk === 'string') out += chunk;
    else if (chunk.type === 'text') out += chunk.text;
  }
  return out.trim();
}

function extractProtocolCandidateLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{') && line.endsWith('}'));
}

function previewText(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > 240 ? `${cleaned.slice(0, 239)}…` : cleaned;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
