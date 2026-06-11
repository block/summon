import type { ProtocolLine } from '../protocol.js';
import { normalizeValidationLimits } from '../validation-limits.js';
import { protocolBlock } from './issues.js';
import { validateHtmlFragment } from './html.js';
import type { ValidationContext } from './types.js';
import type { ContractIssue } from '../contracts.js';

const SECTION_ID_RE = /^[a-z][a-z0-9-]{0,19}$/;
const BLOCK_ID_RE = SECTION_ID_RE;
const MAX_BLOCKS_PER_SECTION = 8;
const META_PATH_RE = /^\/[a-z][a-z0-9-/]{0,119}$/;
const HOST_OWNED_META_PATHS = new Set(['/surface-policy', '/surface-plan', '/surface-contract']);

export function validateProtocolLine(
  line: ProtocolLine,
  context: ValidationContext,
): ContractIssue[] {
  const issues: ContractIssue[] = [];
  const limits = normalizeValidationLimits(context.limits);

  if (line.op === 'meta') {
    if (!META_PATH_RE.test(line.path)) {
      issues.push(protocolBlock('invalid-meta-path', `Invalid meta path "${line.path}"`, line.path));
    }
    if (HOST_OWNED_META_PATHS.has(line.path)) {
      issues.push(protocolBlock(
        'host-owned-meta',
        `Generated artifacts cannot emit host-owned meta path "${line.path}"`,
        line.path,
      ));
    }
    return issues;
  }

  if (line.op === 'set') {
    if (line.path === '/screen') {
      const value = line.value as { sections?: unknown } | undefined;
      if (!value || !Array.isArray(value.sections)) {
        issues.push(protocolBlock('invalid-screen-value', 'Screen value must include a sections array', line.path));
        return issues;
      }
      if (value.sections.length < 1 || value.sections.length > limits.maxSections) {
        issues.push(
          protocolBlock(
            'invalid-section-count',
            `Screen must declare 1 to ${limits.maxSections} sections`,
            line.path,
          ),
        );
      }
      const seen = new Set<string>();
      for (const section of value.sections) {
        if (typeof section !== 'string' || !SECTION_ID_RE.test(section)) {
          issues.push(
            protocolBlock('invalid-section-id', `Invalid section id "${String(section)}"`, line.path),
          );
          continue;
        }
        if (seen.has(section)) {
          issues.push(protocolBlock('duplicate-section-id', `Duplicate section id "${section}"`, line.path));
        }
        seen.add(section);
      }
      return issues;
    }

    const sectionId = sectionIdFromSectionPath(line.path);
    if (!sectionId) {
      issues.push(protocolBlock('invalid-set-path', `Unsupported set path "${line.path}"`, line.path));
      return issues;
    }

    if (!SECTION_ID_RE.test(sectionId)) {
      issues.push(protocolBlock('invalid-section-path', `Invalid section path "${line.path}"`, line.path));
    }

    const value = line.value as { blocks?: unknown } | undefined;
    if (!value || !Array.isArray(value.blocks)) {
      issues.push(protocolBlock('invalid-block-value', 'Section value must include a blocks array', line.path));
      return issues;
    }
    if (value.blocks.length < 1 || value.blocks.length > MAX_BLOCKS_PER_SECTION) {
      issues.push(
        protocolBlock(
          'invalid-block-count',
          `Section must declare 1 to ${MAX_BLOCKS_PER_SECTION} blocks`,
          line.path,
        ),
      );
    }
    const seen = new Set<string>();
    for (const block of value.blocks) {
      if (typeof block !== 'string' || !BLOCK_ID_RE.test(block)) {
        issues.push(
          protocolBlock('invalid-block-id', `Invalid block id "${String(block)}"`, line.path),
        );
        continue;
      }
      if (seen.has(block)) {
        issues.push(protocolBlock('duplicate-block-id', `Duplicate block id "${block}"`, line.path));
      }
      seen.add(block);
    }
    return issues;
  }

  if (line.op === 'add') {
    const sectionId = sectionIdFromSectionPath(line.path);
    const blockTarget = blockTargetFromPath(line.path);
    if (!sectionId && !blockTarget) {
      issues.push(protocolBlock('invalid-add-path', `Unsupported add path "${line.path}"`, line.path));
      return issues;
    }
    if (sectionId && !SECTION_ID_RE.test(sectionId)) {
      issues.push(protocolBlock('invalid-section-path', `Invalid section path "${line.path}"`, line.path));
    }
    if (blockTarget && (!SECTION_ID_RE.test(blockTarget.sectionId) || !BLOCK_ID_RE.test(blockTarget.blockId))) {
      issues.push(protocolBlock('invalid-block-path', `Invalid block path "${line.path}"`, line.path));
    }
    if (line.html !== undefined && typeof line.html !== 'string') {
      issues.push(protocolBlock('invalid-section-html', 'Section html must be a string', line.path));
      return issues;
    }
    issues.push(...validateHtmlFragment(line.html ?? '', context).map((issue) => ({
      ...issue,
      path: issue.path ?? line.path,
    })));
  }

  return issues;
}

function sectionIdFromSectionPath(path: string): string | null {
  if (!path.startsWith('/section/')) return null;
  const suffix = path.slice('/section/'.length);
  if (!suffix || suffix.includes('/')) return null;
  return suffix;
}

function blockTargetFromPath(path: string): { sectionId: string; blockId: string } | null {
  if (!path.startsWith('/section/')) return null;
  const parts = path.slice('/section/'.length).split('/');
  if (parts.length !== 3 || parts[1] !== 'block') return null;
  const [sectionId, , blockId] = parts;
  if (!sectionId || !blockId) return null;
  return { sectionId, blockId };
}
