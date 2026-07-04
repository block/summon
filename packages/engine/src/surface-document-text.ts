/**
 * Tagged-text wire format for Surface Document bundles.
 *
 * Grammar (line-anchored, exact-match fences; trailing whitespace on a fence
 * line is ignored):
 *
 *   === SUMMON-BUNDLE v1 ===
 *   files: main.html, main.css, main.js
 *   === FILE: main.html ===
 *   ...raw unescaped content...
 *   === FILE: main.css ===
 *   ...
 *   === END SUMMON-BUNDLE ===
 *
 * The `files:` line is advisory metadata; the FILE fences are the authority.
 * File names inside fences are passed through as-is — alias coercion happens
 * downstream in normalizeSurfaceDocumentBundle.
 */

import type { ContractIssue } from './contracts.js';
import { contractIssue } from './contracts.js';
import type { SummonSurfaceDocumentBundle } from './surface-document-bundle.js';

export const SURFACE_DOCUMENT_TEXT_HEADER = '=== SUMMON-BUNDLE v1 ===';
export const SURFACE_DOCUMENT_TEXT_END = '=== END SUMMON-BUNDLE ===';

const FILE_FENCE_PATTERN = /^=== FILE: (.+?) ===$/;

export interface ParseSurfaceDocumentTextResult {
  source: Record<string, string> | null;
  issues: ContractIssue[];
}

export function serializeSurfaceDocumentText(bundle: SummonSurfaceDocumentBundle): string {
  const entries = Object.entries(bundle.source)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  const lines: string[] = [SURFACE_DOCUMENT_TEXT_HEADER];
  lines.push(`files: ${entries.map(([name]) => name).join(', ')}`);
  for (const [name, content] of entries) {
    lines.push(`=== FILE: ${name} ===`);
    lines.push(content);
  }
  lines.push(SURFACE_DOCUMENT_TEXT_END);
  return lines.join('\n');
}

export function parseSurfaceDocumentText(text: string): ParseSurfaceDocumentTextResult {
  const issues: ContractIssue[] = [];
  const lines = text.split(/\r?\n/);

  let headerIndex = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (trimEnd(lines[i] ?? '') === SURFACE_DOCUMENT_TEXT_HEADER) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    return {
      source: null,
      issues: [surfaceDocumentTextIssue(
        'invalid-surface-document-bundle',
        `surface-document bundle text must start with "${SURFACE_DOCUMENT_TEXT_HEADER}"`,
      )],
    };
  }

  const preamble = lines.slice(0, headerIndex).join('\n');
  if (preamble.trim() !== '') {
    issues.push(surfaceDocumentTextIssue(
      'invalid-surface-document-bundle',
      `surface-document bundle text must not contain content before "${SURFACE_DOCUMENT_TEXT_HEADER}"`,
    ));
  }

  const source: Record<string, string> = {};
  let currentFile: string | null = null;
  let currentContent: string[] = [];
  let sawEnd = false;
  let endIndex = -1;

  const flush = () => {
    if (currentFile === null) return;
    source[currentFile] = currentContent.join('\n');
    currentFile = null;
    currentContent = [];
  };

  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const fenceLine = trimEnd(line);

    if (fenceLine === SURFACE_DOCUMENT_TEXT_END) {
      flush();
      sawEnd = true;
      endIndex = i;
      break;
    }

    const fileMatch = FILE_FENCE_PATTERN.exec(fenceLine);
    if (fileMatch) {
      flush();
      const name = (fileMatch[1] ?? '').trim();
      if (Object.prototype.hasOwnProperty.call(source, name)) {
        issues.push(surfaceDocumentTextIssue(
          'invalid-surface-document-bundle',
          `surface-document bundle text declares duplicate file fence "${name}"`,
        ));
      }
      currentFile = name;
      continue;
    }

    if (currentFile !== null) {
      currentContent.push(line);
      continue;
    }

    // Between the header and the first FILE fence only the advisory `files:`
    // line and blank lines are allowed.
    if (fenceLine.trim() === '' || /^files:/.test(fenceLine)) continue;
    issues.push(surfaceDocumentTextIssue(
      'invalid-surface-document-bundle',
      'surface-document bundle text must not contain content between the header and the first file fence',
    ));
  }

  if (!sawEnd) {
    flush();
    issues.push(surfaceDocumentTextIssue(
      'invalid-surface-document-bundle',
      `surface-document bundle text is truncated: missing "${SURFACE_DOCUMENT_TEXT_END}"`,
    ));
  } else {
    const trailing = lines.slice(endIndex + 1).join('\n');
    if (trailing.trim() !== '') {
      issues.push(surfaceDocumentTextWarn(
        'trailing-surface-document-bundle-content',
        `surface-document bundle text contains content after "${SURFACE_DOCUMENT_TEXT_END}"; it was ignored`,
      ));
    }
  }

  if (issues.some((issue) => issue.severity === 'block')) return { source: null, issues };
  return { source, issues };
}

function trimEnd(line: string): string {
  return line.replace(/\s+$/, '');
}

function surfaceDocumentTextIssue(code: string, message: string, path = '/source'): ContractIssue {
  return contractIssue({ source: 'protocol', severity: 'block', code, message, path });
}

function surfaceDocumentTextWarn(code: string, message: string, path = '/source'): ContractIssue {
  return contractIssue({ source: 'protocol', severity: 'warn', code, message, path });
}
