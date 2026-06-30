import type { ContractIssue } from './contracts.js';
import { contractIssue } from './contracts.js';

// The domjs surface artifact: model-authored imperative HTML/JS that runs in the
// surface-vm capability sandbox. One `main.js` entry, optional `main.css`.
//
// The validator's job is to catch, BEFORE mount, the unsupported-API usages that
// the surface-vm domjs facade would throw on at runtime. Turning a runtime throw
// into a repairable block is the same lesson as the original `.map` crash: the
// repair loop fixes it instead of the user seeing "Surface runtime failed".

export interface DomjsSurfaceArtifact {
  runtime: 'domjs';
  source: Record<string, string>;
}

export interface DomjsArtifactValidationOptions {
  maxSourceBytes?: number;
}

const DEFAULT_MAX_SOURCE_BYTES = 256 * 1024;
const ENTRY_FILE = 'main.js';
const OPTIONAL_FILES = new Set(['main.css']);
const MODULE_RE = /^[A-Za-z0-9_./-]+\.(?:js|css)$/;

const FETCH_USAGE_RE = /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b/m;

// Unsupported facade APIs. Each maps to the exact throw the domjs facade emits,
// so catching it here surfaces the same repair hint earlier. Kept conservative:
// only unambiguous tokens, to keep false positives near zero (a false positive
// blocks valid code, which is worse than a caught runtime throw).
const UNSUPPORTED_API_PATTERNS: Array<{ re: RegExp; api: string; hint: string }> = [
  { re: /\.innerHTML\b/, api: 'innerHTML', hint: 'Build nodes with document.createElement and append.' },
  { re: /\.outerHTML\b/, api: 'outerHTML', hint: 'Build nodes with document.createElement and append.' },
  { re: /\.querySelector(All)?\s*\(/, api: 'querySelector', hint: 'Hold references to nodes you created.' },
  { re: /\bgetElementById\s*\(/, api: 'getElementById', hint: 'Hold references to nodes you created.' },
  { re: /\.insertBefore\s*\(/, api: 'insertBefore', hint: 'Use region(...) for dynamic lists.' },
  { re: /\.removeChild\s*\(/, api: 'removeChild', hint: 'Use region(...) for dynamic lists.' },
  { re: /\.style\b/, api: 'style', hint: "Use setAttribute('style', ...) or className." },
  { re: /\bwindow\b/, api: 'window', hint: 'The window object is not available in the sandbox.' },
  { re: /\bdocument\.body\b/, api: 'document.body', hint: 'Return your root node via export default.' },
];

export function isDomjsSurfaceArtifact(value: unknown): value is DomjsSurfaceArtifact {
  return normalizeDomjsSurfaceArtifact(value).artifact !== null;
}

export function normalizeDomjsSurfaceArtifact(value: unknown): {
  artifact: DomjsSurfaceArtifact | null;
  issues: ContractIssue[];
} {
  const issues: ContractIssue[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      artifact: null,
      issues: [domjsIssue('invalid-domjs-artifact', 'domjs artifact must be an object')],
    };
  }

  const input = value as Record<string, unknown>;
  if (input.runtime !== 'domjs') {
    issues.push(domjsIssue('invalid-domjs-runtime', 'domjs artifact runtime must be "domjs"'));
  }
  if (!input.source || typeof input.source !== 'object' || Array.isArray(input.source)) {
    issues.push(domjsIssue('invalid-domjs-source', 'domjs artifact source must be a file map'));
    return { artifact: null, issues };
  }

  const source: Record<string, string> = {};
  for (const [rawPath, rawContents] of Object.entries(input.source as Record<string, unknown>)) {
    const path = normalizeDomjsSourcePath(rawPath);
    if (!path) {
      issues.push(domjsIssue('invalid-domjs-source-path', `Invalid domjs source path "${rawPath}"`));
      continue;
    }
    if (typeof rawContents !== 'string') {
      issues.push(domjsIssue('invalid-domjs-source-file', `domjs source file "${rawPath}" must be a string`));
      continue;
    }
    source[path] = rawContents;
  }

  if (!source[ENTRY_FILE]) {
    issues.push(domjsIssue('invalid-domjs-entry', 'domjs artifact must include a main.js entry file'));
  }

  if (issues.some((issue) => issue.severity === 'block')) {
    return { artifact: null, issues };
  }
  return { artifact: { runtime: 'domjs', source }, issues };
}

export function validateDomjsSurfaceArtifact(
  artifact: DomjsSurfaceArtifact,
  options: DomjsArtifactValidationOptions = {},
): ContractIssue[] {
  const { artifact: normalized, issues } = normalizeDomjsSurfaceArtifact(artifact);
  if (!normalized) return issues;

  const maxSourceBytes = options.maxSourceBytes ?? DEFAULT_MAX_SOURCE_BYTES;
  const sourceBytes = byteLength(JSON.stringify(normalized.source));
  if (sourceBytes > maxSourceBytes) {
    issues.push(domjsIssue('domjs-source-limit', `domjs source exceeds ${maxSourceBytes} bytes`));
  }

  for (const [path, contents] of Object.entries(normalized.source)) {
    if (path.endsWith('.css')) continue;

    if (FETCH_USAGE_RE.test(contents)) {
      issues.push(domjsIssue(
        'domjs-network-not-granted',
        `domjs source "${path}" uses network APIs (fetch/XHR/WebSocket). Use host tools via callTool() instead.`,
        `/artifact/${path}`,
      ));
    }

    for (const { re, api, hint } of UNSUPPORTED_API_PATTERNS) {
      if (re.test(contents)) {
        issues.push(domjsIssue(
          'domjs-unsupported-api',
          `domjs source "${path}" uses ${api}, which the sandbox does not support. ${hint}`,
          `/artifact/${path}`,
        ));
      }
    }
  }
  return issues;
}

export function normalizeDomjsSourcePath(path: string): string | null {
  const normalized = path.replace(/^\/+/, '');
  if (!normalized || normalized.includes('..') || normalized.startsWith('.') || normalized.includes('\\')) {
    return null;
  }
  if (!MODULE_RE.test(normalized)) return null;
  if (normalized.endsWith('.css') && !OPTIONAL_FILES.has(normalized)) return null;
  return normalized;
}

function domjsIssue(code: string, message: string, path = '/artifact'): ContractIssue {
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
