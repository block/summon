import {
  parseProtocolLineStrict,
  type AddLine,
  type MetaLine,
  type ProtocolLine,
  type SetLine,
} from './protocol.js';
import type { SummonLayout } from './prompt.js';
import {
  contractIssue,
  hintsForContractIssue,
  withIssueSeverity,
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

export interface ScreenSynthesizedMetaValue {
  sections: string[];
  reason: 'add-before-screen';
}

export interface RepairFeedbackMetaValue {
  schemaId: 'summon.repair-feedback.v2';
  status: 'blocked' | 'skipped' | 'failed' | 'repaired';
  target?: string;
  issues: ContractIssue[];
  retryable: boolean;
  hints: string[];
  attempt?: number;
  rawPreview?: string;
}

export interface ProtocolHardenerResult {
  outboundLines: ProtocolLine[];
  acceptedLines: ProtocolLine[];
  issues: ContractIssue[];
  blocked?: ContractIssue;
  repairFeedback?: RepairFeedbackMetaValue[];
  rejectedLine?: ProtocolLine;
}

export interface ProtocolHardener {
  processRawLine(raw: string): ProtocolHardenerResult;
}

export interface ProtocolHardenerOptions {
  validationContext: ValidationContext;
  layout?: SummonLayout | null;
  maxSyntheticSections?: number;
  initialScreenSections?: string[];
  allowedSectionIds?: Iterable<string>;
}

const DEFAULT_MAX_SYNTHETIC_SECTIONS = 5;
const SECTION_PREFIX = '/section/';
const RAW_PREVIEW_LIMIT = 240;

const STRUCTURAL_SKIP_CODES = new Set([
  'invalid-meta-path',
  'invalid-set-path',
  'invalid-screen-value',
  'invalid-section-count',
  'invalid-section-id',
  'duplicate-section-id',
  'invalid-add-path',
  'invalid-section-path',
  'invalid-section-html',
  'invalid-block-value',
  'invalid-block-count',
  'invalid-block-id',
  'duplicate-block-id',
  'invalid-block-path',
  'undeclared-block',
]);

interface BlockSectionState {
  blockOrder: string[];
  blockMap: Map<string, string>;
}

export function createProtocolHardener(options: ProtocolHardenerOptions): ProtocolHardener {
  const layout = options.layout ?? null;
  const layoutSections = new Set(layout?.slots.map((slot) => slot.id) ?? []);
  const allowedSectionIds = options.allowedSectionIds
    ? new Set(options.allowedSectionIds)
    : null;
  const maxSyntheticSections = normalizeMaxSyntheticSections(options.maxSyntheticSections);
  let realScreenSections: string[] | null = options.initialScreenSections
    ? [...options.initialScreenSections]
    : null;
  const syntheticSections: string[] = [];
  const blockSections = new Map<string, BlockSectionState>();

  const processParsedLine = (line: ProtocolLine): ProtocolHardenerResult => {
    if (layout && line.op === 'set' && line.path === '/screen') {
      return skipLine(
        layoutDisallowedIssue('Layout mode owns /screen; model screen lines are ignored', line),
        line,
      );
    }

    const validationIssues = validateProtocolLine(line, options.validationContext);
    const blocker = validationIssues.find(isBlockingIssue);
    if (blocker) {
      return {
        outboundLines: [],
        acceptedLines: [],
        issues: normalizeStructuralIssues(validationIssues),
        blocked: blocker,
        repairFeedback: [repairFeedbackForIssue(blocker, line, 'blocked')],
        rejectedLine: line,
      };
    }

    const structuralIssue = validationIssues.find((issue) => STRUCTURAL_SKIP_CODES.has(issue.code));
    if (structuralIssue) {
      return skipLine(structuralIssue, line, validationIssues);
    }

    if (layout && (line.op === 'add' || line.op === 'set') && line.path !== '/screen') {
      const sectionId = sectionIdFromAnyPath(line.path);
      if (sectionId && !layoutSections.has(sectionId)) {
        return skipLine(
          layoutDisallowedIssue(`Section "${sectionId}" is not part of layout "${layout.id}"`, line),
          line,
          validationIssues,
        );
      }
    }

    if (line.op === 'meta') {
      return {
        outboundLines: [line],
        acceptedLines: [],
        issues: validationIssues,
      };
    }

    if (line.op === 'set') {
      return processSetLine(line, validationIssues);
    }

    return processAddLine(line, validationIssues);
  };

  const processSetLine = (line: SetLine, validationIssues: ContractIssue[]): ProtocolHardenerResult => {
    if (line.path === '/screen') {
      const sections = screenSections(line);
      realScreenSections = sections;
      return {
        outboundLines: [line],
        acceptedLines: [line],
        issues: validationIssues,
      };
    }

    const sectionId = sectionIdFromPath(line.path);
    if (!sectionId) {
      return skipLine(
        contractIssue({
          source: 'protocol',
          severity: 'warn',
          code: 'invalid-section-path',
          message: `Invalid section path "${line.path}"`,
          path: line.path,
        }),
        line,
        validationIssues,
      );
    }

    const targetIssue = issueForUntargetedSection(sectionId, line.path);
    if (targetIssue) return skipLine(targetIssue, line, validationIssues);

    const declarationIssue = issueForUndeclaredSection(sectionId, line.path, false);
    if (declarationIssue) return skipLine(declarationIssue, line, validationIssues);

    const blocks = sectionBlocks(line);
    const current = blockSections.get(sectionId);
    const nextMap = new Map<string, string>();
    for (const blockId of blocks) {
      const existing = current?.blockMap.get(blockId);
      if (existing !== undefined) nextMap.set(blockId, existing);
    }
    blockSections.set(sectionId, {
      blockOrder: blocks,
      blockMap: nextMap,
    });
    return {
      outboundLines: [line],
      acceptedLines: [line],
      issues: validationIssues,
    };
  };

  const processAddLine = (line: AddLine, validationIssues: ContractIssue[]): ProtocolHardenerResult => {
    const blockTarget = blockTargetFromPath(line.path);
    if (blockTarget) {
      return processAddBlockLine(line, blockTarget, validationIssues);
    }

    const sectionId = sectionIdFromPath(line.path);
    if (!sectionId) {
      return skipLine(
        contractIssue({
          source: 'protocol',
          severity: 'warn',
          code: 'invalid-section-path',
          message: `Invalid section path "${line.path}"`,
          path: line.path,
        }),
        line,
        validationIssues,
      );
    }

    const targetIssue = issueForUntargetedSection(sectionId, line.path);
    if (targetIssue) return skipLine(targetIssue, line, validationIssues);

    const declarationIssue = issueForUndeclaredSection(sectionId, line.path, true);
    if (declarationIssue) return skipLine(declarationIssue, line, validationIssues);

    if (!layout && !realScreenSections) {
      if (!syntheticSections.includes(sectionId)) {
        if (syntheticSections.length >= maxSyntheticSections) {
          return skipLine(
            contractIssue({
              source: 'protocol',
              severity: 'warn',
              code: 'synthetic-section-limit',
              message: `Synthetic screen cannot exceed ${maxSyntheticSections} sections`,
              path: line.path,
            }),
            line,
            validationIssues,
          );
        }
        syntheticSections.push(sectionId);
        const syntheticScreen = screenLine(syntheticSections);
        return {
          outboundLines: [screenSynthesizedLine(syntheticSections), syntheticScreen, line],
          acceptedLines: [syntheticScreen, line],
          issues: validationIssues,
        };
      }
    }

    blockSections.delete(sectionId);
    return {
      outboundLines: [line],
      acceptedLines: [line],
      issues: validationIssues,
    };
  };

  const processAddBlockLine = (
    line: AddLine,
    target: { sectionId: string; blockId: string },
    validationIssues: ContractIssue[],
  ): ProtocolHardenerResult => {
    const targetIssue = issueForUntargetedSection(target.sectionId, line.path);
    if (targetIssue) return skipLine(targetIssue, line, validationIssues);

    const declarationIssue = issueForUndeclaredSection(target.sectionId, line.path, false);
    if (declarationIssue) return skipLine(declarationIssue, line, validationIssues);

    const state = blockSections.get(target.sectionId);
    if (!state || !state.blockOrder.includes(target.blockId)) {
      return skipLine(
        contractIssue({
          source: 'protocol',
          severity: 'warn',
          code: 'undeclared-block',
          message: `Block "${target.blockId}" was not declared by section "${target.sectionId}"`,
          path: line.path,
        }),
        line,
        validationIssues,
      );
    }

    const candidateBlocks = new Map(state.blockMap);
    candidateBlocks.set(target.blockId, line.html ?? '');
    const composedHtml = composeBlockSectionHtml(state.blockOrder, candidateBlocks);
    const composedIssues = validateProtocolLine({
      op: 'add',
      path: `/section/${target.sectionId}`,
      html: composedHtml,
    }, options.validationContext).map((issue) => ({
      ...issue,
      path: line.path,
    }));
    const composedBlocker = composedIssues.find(isBlockingIssue);
    if (composedBlocker) {
      return {
        outboundLines: [],
        acceptedLines: [],
        issues: normalizeStructuralIssues([...validationIssues, ...composedIssues]),
        blocked: composedBlocker,
        repairFeedback: [repairFeedbackForIssue(composedBlocker, line, 'blocked')],
        rejectedLine: line,
      };
    }

    state.blockMap = candidateBlocks;
    return {
      outboundLines: [line],
      acceptedLines: [line],
      issues: [...validationIssues, ...composedIssues],
    };
  };

  const issueForUntargetedSection = (sectionId: string, path: string): ContractIssue | null => {
    if (!allowedSectionIds || allowedSectionIds.has(sectionId)) return null;
    return contractIssue({
      source: 'edit',
      severity: 'warn',
      code: 'section-not-targeted',
      message: `Section "${sectionId}" is not targeted for this edit`,
      path,
    });
  };

  const issueForUndeclaredSection = (
    sectionId: string,
    path: string,
    allowSynthetic: boolean,
  ): ContractIssue | null => {
    if (realScreenSections && !realScreenSections.includes(sectionId)) {
      return contractIssue({
        source: 'protocol',
        severity: 'warn',
        code: 'undeclared-section',
        message: `Section "${sectionId}" was not declared by the real screen order`,
        path,
      });
    }
    if (!allowSynthetic && !layout && !realScreenSections) {
      return contractIssue({
        source: 'protocol',
        severity: 'warn',
        code: 'undeclared-section',
        message: `Section "${sectionId}" requires a /screen declaration before block fragments`,
        path,
      });
    }
    return null;
  };

  return {
    processRawLine(raw: string): ProtocolHardenerResult {
      const trimmed = raw.trim();
      if (!trimmed) return emptyResult();

      let line: ProtocolLine;
      try {
        line = parseProtocolLineStrict(trimmed, {
          maxLineBytes: normalizeValidationLimits(
            options.validationContext.limits,
          ).maxProtocolLineBytes,
        });
      } catch {
        const issue: ContractIssue = contractIssue({
          source: 'protocol',
          severity: 'warn',
          code: 'malformed-jsonl',
          message: 'Model emitted a non-JSONL protocol line',
        });
        return {
          outboundLines: [protocolSkipLine(issue, undefined, trimmed)],
          acceptedLines: [],
          issues: [issue],
          repairFeedback: [repairFeedbackForIssue(issue, undefined, 'skipped', trimmed)],
        };
      }

      return processParsedLine(line);
    },
  };
}

function emptyResult(): ProtocolHardenerResult {
  return { outboundLines: [], acceptedLines: [], issues: [] };
}

function isBlockingIssue(issue: ContractIssue): boolean {
  return issue.severity === 'block' && !STRUCTURAL_SKIP_CODES.has(issue.code);
}

function normalizeStructuralIssues(issues: ContractIssue[]): ContractIssue[] {
  return issues.map((issue) => (
    STRUCTURAL_SKIP_CODES.has(issue.code)
      ? withIssueSeverity(issue, 'warn')
      : issue
  ));
}

function skipLine(
  issue: ContractIssue,
  line: ProtocolLine,
  existingIssues: ContractIssue[] = [],
): ProtocolHardenerResult {
  const normalizedIssue: ContractIssue = withIssueSeverity(issue, 'warn');
  const issues = existingIssues.length > 0
    ? normalizeStructuralIssues(existingIssues)
    : [normalizedIssue];
  if (!issues.some((candidate) => sameIssue(candidate, normalizedIssue))) {
    issues.push(normalizedIssue);
  }
  return {
    outboundLines: [protocolSkipLine(normalizedIssue, line)],
    acceptedLines: [],
    issues,
    repairFeedback: [repairFeedbackForIssue(normalizedIssue, line, 'skipped')],
    rejectedLine: line,
  };
}

function sameIssue(a: ContractIssue, b: ContractIssue): boolean {
  return (
    a.source === b.source &&
    a.code === b.code &&
    a.message === b.message &&
    a.path === b.path &&
    a.severity === b.severity
  );
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

function screenSynthesizedLine(sections: string[]): MetaLine {
  return {
    op: 'meta',
    path: '/screen-synthesized',
    value: { sections: [...sections], reason: 'add-before-screen' } satisfies ScreenSynthesizedMetaValue,
  };
}

function screenLine(sections: string[]): SetLine {
  return {
    op: 'set',
    path: '/screen',
    value: { sections: [...sections] },
  };
}

function screenSections(line: SetLine): string[] {
  const value = line.value as { sections?: unknown } | undefined;
  return Array.isArray(value?.sections)
    ? value.sections.filter((section): section is string => typeof section === 'string')
    : [];
}

function sectionBlocks(line: SetLine): string[] {
  const value = line.value as { blocks?: unknown } | undefined;
  return Array.isArray(value?.blocks)
    ? value.blocks.filter((block): block is string => typeof block === 'string')
    : [];
}

function sectionIdFromPath(path: string): string | null {
  if (!path.startsWith(SECTION_PREFIX)) return null;
  const sectionId = path.slice(SECTION_PREFIX.length);
  if (sectionId.includes('/')) return null;
  return sectionId.length > 0 ? sectionId : null;
}

function sectionIdFromAnyPath(path: string): string | null {
  return sectionIdFromPath(path) ?? blockTargetFromPath(path)?.sectionId ?? null;
}

function blockTargetFromPath(path: string): { sectionId: string; blockId: string } | null {
  if (!path.startsWith(SECTION_PREFIX)) return null;
  const parts = path.slice(SECTION_PREFIX.length).split('/');
  if (parts.length !== 3 || parts[1] !== 'block') return null;
  const [sectionId, , blockId] = parts;
  if (!sectionId || !blockId) return null;
  return { sectionId, blockId };
}

function composeBlockSectionHtml(blockOrder: string[], blockMap: Map<string, string>): string {
  const parts: string[] = [];
  for (const blockId of blockOrder) {
    const html = blockMap.get(blockId);
    if (html === undefined) continue;
    parts.push(`<div data-summon-block="${escapeAttr(blockId)}">\n${html}\n</div>`);
  }
  return parts.join('\n');
}

function escapeAttr(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

function layoutDisallowedIssue(message: string, line: ProtocolLine): ContractIssue {
  return contractIssue({
    source: 'layout',
    severity: 'warn',
    code: 'layout-disallowed',
    message,
    path: line.path,
  });
}

function repairFeedbackForIssue(
  issue: ContractIssue,
  line: ProtocolLine | undefined,
  status: RepairFeedbackMetaValue['status'],
  raw?: string,
): RepairFeedbackMetaValue {
  const issues = [issue];
  const target = line?.path ?? issue.path;
  return {
    schemaId: 'summon.repair-feedback.v2',
    status,
    ...(target ? { target } : {}),
    issues,
    retryable: isRetryableRepairTarget(line, issue),
    hints: hintsForContractIssue(issue),
    ...(raw ? { rawPreview: previewRaw(raw) } : {}),
  };
}

function isRetryableRepairTarget(
  line: ProtocolLine | undefined,
  issue: ContractIssue,
): boolean {
  return (
    issue.severity === 'block' &&
    line?.op === 'add' &&
    line.path.startsWith(SECTION_PREFIX) &&
    !STRUCTURAL_SKIP_CODES.has(issue.code)
  );
}

function normalizeMaxSyntheticSections(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_MAX_SYNTHETIC_SECTIONS;
  return Math.max(1, Math.min(DEFAULT_MAX_SYNTHETIC_SECTIONS, Math.floor(value)));
}

function previewRaw(raw: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  return cleaned.length > RAW_PREVIEW_LIMIT ? `${cleaned.slice(0, RAW_PREVIEW_LIMIT - 1)}…` : cleaned;
}
