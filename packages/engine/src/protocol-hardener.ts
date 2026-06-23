import {
  parseProtocolLineStrict,
  type ArtifactLine,
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
  validationMode?: 'enforce' | 'observe';
}

const RAW_PREVIEW_LIMIT = 240;

export function createProtocolHardener(options: ProtocolHardenerOptions): ProtocolHardener {
  const validationMode = options.validationMode ?? 'enforce';
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
        if (validationMode === 'observe') {
          const observedLines = issues
            .filter((issue) => issue.severity === 'block')
            .map(validationObservedLine);
          if (isArtifactShapedLine(line)) {
            return {
              outboundLines: [...observedLines, line],
              acceptedLines: [line],
              issues,
              rejectedLine: line,
            };
          }
          return {
            outboundLines: observedLines,
            acceptedLines: [],
            issues,
            rejectedLine: line,
          };
        }
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

      if (line.op === 'artifact' || line.op === 'event' || line.op === 'patch') {
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
  const value = {
    code: issue.code,
    message: issue.message,
    severity: 'warn' as const,
    ...(issue.path ? { path: issue.path } : {}),
    ...(line ? { op: line.op } : {}),
    ...(raw ? { rawPreview: previewRaw(raw) } : {}),
  };
  return { op: 'meta', path: '/protocol-skip', value };
}

function validationObservedLine(issue: ContractIssue): MetaLine {
  return { op: 'meta', path: '/validation-observed', value: issue };
}

function isArtifactShapedLine(line: ProtocolLine): line is ArtifactLine {
  if (line.op !== 'artifact') return false;
  const value = line.value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const artifact = value as { runtime?: unknown; source?: unknown };
  if (artifact.runtime !== 'arrow' && artifact.runtime !== 'html') return false;
  if (!artifact.source || typeof artifact.source !== 'object' || Array.isArray(artifact.source)) return false;
  return Object.values(artifact.source).every((contents) => typeof contents === 'string');
}

function previewRaw(raw: string): string {
  return raw.length > RAW_PREVIEW_LIMIT
    ? `${raw.slice(0, RAW_PREVIEW_LIMIT)}...`
    : raw;
}
