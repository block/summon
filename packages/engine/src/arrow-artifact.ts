import type { ContractIssue } from './contracts.js';
import { contractIssue } from './contracts.js';

export type ArrowNetworkPolicy = 'none' | 'restricted-fetch';

export interface ArrowSurfaceArtifact {
  runtime: 'arrow';
  source: Record<string, string>;
  network?: ArrowNetworkPolicy;
}

export interface ArrowArtifactValidationOptions {
  maxSourceBytes?: number;
  network?: ArrowNetworkPolicy;
}

const DEFAULT_MAX_SOURCE_BYTES = 256 * 1024;
const ENTRY_FILES = new Set(['main.ts', 'main.js']);
const OPTIONAL_FILES = new Set(['main.css']);
const MODULE_RE = /^[A-Za-z0-9_./-]+\.(?:ts|js|mjs|css)$/;
const UNSUPPORTED_IDL_PROPERTY_BINDING_RE = /(^|[\s`<])\.[A-Za-z_$][A-Za-z0-9_$-]*\s*=/m;
const UNSUPPORTED_OPEN_TAG_EXPRESSION_RE = /<[^>`]*\s\$\{/m;

export function isArrowSurfaceArtifact(value: unknown): value is ArrowSurfaceArtifact {
  return normalizeArrowSurfaceArtifact(value).artifact !== null;
}

export function normalizeArrowSurfaceArtifact(value: unknown): {
  artifact: ArrowSurfaceArtifact | null;
  issues: ContractIssue[];
} {
  const issues: ContractIssue[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      artifact: null,
      issues: [arrowIssue('invalid-arrow-artifact', 'Arrow artifact must be an object')],
    };
  }

  const input = value as Record<string, unknown>;
  if (input.runtime !== 'arrow') {
    issues.push(arrowIssue('invalid-arrow-runtime', 'Arrow artifact runtime must be "arrow"'));
  }
  if (!input.source || typeof input.source !== 'object' || Array.isArray(input.source)) {
    issues.push(arrowIssue('invalid-arrow-source', 'Arrow artifact source must be a file map'));
    return { artifact: null, issues };
  }

  const source: Record<string, string> = {};
  for (const [rawPath, rawContents] of Object.entries(input.source as Record<string, unknown>)) {
    const path = normalizeArrowSourcePath(rawPath);
    if (!path) {
      issues.push(arrowIssue('invalid-arrow-source-path', `Invalid Arrow source path "${rawPath}"`));
      continue;
    }
    if (typeof rawContents !== 'string') {
      issues.push(arrowIssue('invalid-arrow-source-file', `Arrow source file "${rawPath}" must be a string`));
      continue;
    }
    source[path] = rawContents;
  }

  const entries = Object.keys(source).filter((path) => ENTRY_FILES.has(path));
  if (entries.length !== 1) {
    issues.push(arrowIssue('invalid-arrow-entry', 'Arrow artifact must include exactly one main.ts or main.js entry file'));
  }
  if (Object.keys(source).length === 0) {
    issues.push(arrowIssue('invalid-arrow-source', 'Arrow artifact source cannot be empty'));
  }

  const network = input.network === 'restricted-fetch' || input.network === 'none'
    ? input.network
    : undefined;
  if (input.network !== undefined && !network) {
    issues.push(arrowIssue('invalid-arrow-network', 'Arrow artifact network must be "none" or "restricted-fetch"'));
  }

  if (issues.some((issue) => issue.severity === 'block')) {
    return { artifact: null, issues };
  }
  return {
    artifact: {
      runtime: 'arrow',
      source,
      ...(network ? { network } : {}),
    },
    issues,
  };
}

export function validateArrowSurfaceArtifact(
  artifact: ArrowSurfaceArtifact,
  options: ArrowArtifactValidationOptions = {},
): ContractIssue[] {
  const { artifact: normalized, issues } = normalizeArrowSurfaceArtifact(artifact);
  if (!normalized) return issues;
  const maxSourceBytes = options.maxSourceBytes ?? DEFAULT_MAX_SOURCE_BYTES;
  const sourceBytes = byteLength(JSON.stringify(normalized.source));
  if (sourceBytes > maxSourceBytes) {
    issues.push(arrowIssue('arrow-source-limit', `Arrow source exceeds ${maxSourceBytes} bytes`));
  }
  if (options.network === 'none' && normalized.network === 'restricted-fetch') {
    issues.push(arrowIssue('arrow-network-not-granted', 'Arrow artifact requested restricted fetch without a host network grant'));
  }
  for (const [path, contents] of Object.entries(normalized.source)) {
    if (path.endsWith('.css')) continue;
    if (UNSUPPORTED_IDL_PROPERTY_BINDING_RE.test(contents)) {
      issues.push(arrowIssue(
        'unsupported-arrow-idl-binding',
        `Arrow sandbox does not support IDL property bindings in "${path}" such as ".value=". Use normal HTML attributes and event target snapshots instead.`,
        `/artifact/${path}`,
      ));
    }
    if (UNSUPPORTED_OPEN_TAG_EXPRESSION_RE.test(contents)) {
      issues.push(arrowIssue(
        'unsupported-arrow-open-tag-expression',
        `Arrow sandbox does not support standalone template expressions inside opening tags in "${path}". Put expressions in text, node positions, or quoted attribute values only.`,
        `/artifact/${path}`,
      ));
    }
  }
  return issues;
}

export function normalizeArrowSourcePath(path: string): string | null {
  const normalized = path.replace(/^\/+/, '');
  if (!normalized || normalized.includes('..') || normalized.startsWith('.') || normalized.includes('\\')) {
    return null;
  }
  if (!MODULE_RE.test(normalized)) return null;
  if (normalized.endsWith('.css') && !OPTIONAL_FILES.has(normalized)) return null;
  return normalized;
}

function arrowIssue(code: string, message: string, path = '/artifact'): ContractIssue {
  return contractIssue({
    source: 'protocol',
    severity: 'block',
    code,
    message,
    path,
  });
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
