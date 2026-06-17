import {
  parseProtocolLineStrict,
  type MetaLine,
  type ProtocolLine,
} from './protocol.js';
import {
  contractIssue,
  type ContractIssue,
} from './contracts.js';
import {
  validateProtocolLine,
  type ValidationContext,
} from './runtime-validator.js';
import { normalizeValidationLimits } from './validation-limits.js';

export interface ProtocolSkipMetaValue {
  code: string;
  message: string;
  severity: 'warn';
  path?: string;
  op?: string;
  rawPreview?: string;
}

export interface ProtocolHardenerResult {
  outboundLines: ProtocolLine[];
  acceptedLines: ProtocolLine[];
  issues: ContractIssue[];
  blocked?: ContractIssue;
  rejectedLine?: ProtocolLine;
}

export interface ProtocolHardener {
  processRawLine(raw: string): ProtocolHardenerResult;
}

export interface ProtocolHardenerOptions {
  validationContext: ValidationContext;
}

const RAW_PREVIEW_LIMIT = 240;

export function createProtocolHardener(options: ProtocolHardenerOptions): ProtocolHardener {
  return {
    processRawLine(raw: string): ProtocolHardenerResult {
      const trimmed = raw.trim();
      if (!trimmed) return emptyResult();

      let line: ProtocolLine;
      try {
        line = parseProtocolLineStrict(trimmed, {
          maxLineBytes: normalizeValidationLimits(options.validationContext.limits).maxProtocolLineBytes,
        });
      } catch {
        const issue = contractIssue({
          source: 'protocol',
          severity: 'warn',
          code: 'malformed-jsonl',
          message: 'Model emitted a non-JSONL protocol line',
        });
        return {
          outboundLines: [protocolSkipLine(issue, undefined, trimmed)],
          acceptedLines: [],
          issues: [issue],
        };
      }

      const issues = validateProtocolLine(line, options.validationContext);
      const blocker = issues.find((issue) => issue.severity === 'block');
      if (blocker) {
        return {
          outboundLines: [],
          acceptedLines: [],
          issues,
          blocked: blocker,
          rejectedLine: line,
        };
      }

      if (issues.length > 0) {
        const issue = issues[0]!;
        return {
          outboundLines: [protocolSkipLine(issue, line)],
          acceptedLines: [],
          issues,
          rejectedLine: line,
        };
      }

      if (line.op === 'meta') {
        return {
          outboundLines: [line],
          acceptedLines: [],
          issues: [],
        };
      }

      if (line.op === 'artifact') {
        return {
          outboundLines: [line],
          acceptedLines: [line],
          issues: [],
        };
      }

      if (line.op === 'event') {
        return {
          outboundLines: [line],
          acceptedLines: [line],
          issues: [],
        };
      }

      return emptyResult();
    },
  };
}

function emptyResult(): ProtocolHardenerResult {
  return { outboundLines: [], acceptedLines: [], issues: [] };
}

function protocolSkipLine(
  issue: ContractIssue,
  line?: ProtocolLine,
  raw?: string,
): MetaLine {
  const value: ProtocolSkipMetaValue = {
    code: issue.code,
    message: issue.message,
    severity: 'warn',
  };
  if (issue.path) value.path = issue.path;
  if (line) value.op = line.op;
  if (raw) value.rawPreview = previewRaw(raw);
  return { op: 'meta', path: '/protocol-skip', value };
}

function previewRaw(raw: string): string {
  return raw.length > RAW_PREVIEW_LIMIT
    ? `${raw.slice(0, RAW_PREVIEW_LIMIT)}...`
    : raw;
}
