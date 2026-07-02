import type { ContractIssue } from './contracts.js';
import { contractIssue } from './contracts.js';

// Surface Document: native generated UI contract.
// - main.html: inert structure
// - main.css: fingerprint styling
// - main.js: optional governed behavior in surface-vm
//
// This validator is an early, repairable protocol gate. The surface-vm parser is
// still the execution gate; keep this conservative and false-positive-light.

export interface SurfaceDocumentArtifact {
  runtime: 'surface-document';
  source: {
    'main.html': string;
    'main.css': string;
    'main.js'?: string;
  };
}

export interface SurfaceDocumentValidationOptions {
  maxSourceBytes?: number;
}

const DEFAULT_MAX_SOURCE_BYTES = 256 * 1024;
const ALLOWED_FILES = new Set(['main.html', 'main.css', 'main.js']);
const REQUIRED_FILES = ['main.html', 'main.css'] as const;
const FORBIDDEN_TAG_RE = /<\s*\/?\s*(script|style|iframe|object|embed)\b/i;
const INLINE_HANDLER_RE = /\s(on[A-Za-z][A-Za-z0-9_-]*)\s*=/i;
const JAVASCRIPT_URL_RE = /\b(?:href|src|action|formaction|xlink:href)\s*=\s*(["'])\s*javascript:/i;
const CSS_IMPORT_RE = /@import\b/i;
const CSS_EXTERNAL_URL_RE = /url\(\s*(["']?)\s*(?:https?:|data:|javascript:)/i;
const JS_NETWORK_RE = /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b/m;
const JS_UNSUPPORTED_PATTERNS: Array<{ re: RegExp; api: string; hint: string }> = [
  { re: /\.innerHTML\b/, api: 'innerHTML', hint: 'Put inert structure in main.html or build nodes with createElement; do not inject HTML strings at runtime.' },
  { re: /\.outerHTML\b/, api: 'outerHTML', hint: 'Put inert structure in main.html or build nodes with createElement; do not inject HTML strings at runtime.' },
  { re: /\.parentNode\b|\.parentElement\b/, api: 'parentNode', hint: 'Hold references to nodes you created or query the Surface Document root.' },
  { re: /\bwindow(?:\.[A-Za-z_$]|\s*\[)/, api: 'window', hint: 'The window object is not available in the sandbox.' },
  { re: /\bdocument\.body\b/, api: 'document.body', hint: 'Use the parsed main.html root and scoped document queries.' },
  { re: /\beval\s*\(/, api: 'eval', hint: 'Dynamic code evaluation is not available in the sandbox.' },
];

export function isSurfaceDocumentArtifact(value: unknown): value is SurfaceDocumentArtifact {
  return normalizeSurfaceDocumentArtifact(value).artifact !== null;
}

export function normalizeSurfaceDocumentArtifact(value: unknown): {
  artifact: SurfaceDocumentArtifact | null;
  issues: ContractIssue[];
} {
  const issues: ContractIssue[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { artifact: null, issues: [surfaceDocumentIssue('invalid-surface-document-artifact', 'surface-document artifact must be an object')] };
  }

  const input = value as Record<string, unknown>;
  if (input.runtime !== 'surface-document') {
    issues.push(surfaceDocumentIssue('invalid-surface-document-runtime', 'surface-document artifact runtime must be "surface-document"'));
  }
  if (!input.source || typeof input.source !== 'object' || Array.isArray(input.source)) {
    issues.push(surfaceDocumentIssue('invalid-surface-document-source', 'surface-document artifact source must be a file map'));
    return { artifact: null, issues };
  }

  const source: Partial<SurfaceDocumentArtifact['source']> = {};
  for (const [rawPath, rawContents] of Object.entries(input.source as Record<string, unknown>)) {
    const path = rawPath.replace(/^\/+/, '');
    if (!ALLOWED_FILES.has(path)) {
      issues.push(surfaceDocumentIssue('invalid-surface-document-source-path', `Invalid surface-document source path "${rawPath}"`, `/artifact/${rawPath}`));
      continue;
    }
    if (typeof rawContents !== 'string') {
      issues.push(surfaceDocumentIssue('invalid-surface-document-source-file', `surface-document source file "${rawPath}" must be a string`, `/artifact/${rawPath}`));
      continue;
    }
    source[path as keyof SurfaceDocumentArtifact['source']] = rawContents;
  }

  for (const file of REQUIRED_FILES) {
    if (typeof source[file] !== 'string' || source[file] === '') {
      issues.push(surfaceDocumentIssue('missing-surface-document-file', `surface-document artifact must include ${file}`, `/artifact/${file}`));
    }
  }

  if (issues.some((issue) => issue.severity === 'block')) return { artifact: null, issues };
  return {
    artifact: {
      runtime: 'surface-document',
      source: {
        'main.html': source['main.html']!,
        'main.css': source['main.css']!,
        ...(typeof source['main.js'] === 'string' ? { 'main.js': source['main.js'] } : {}),
      },
    },
    issues,
  };
}

export function validateSurfaceDocumentArtifact(
  artifact: SurfaceDocumentArtifact,
  options: SurfaceDocumentValidationOptions = {},
): ContractIssue[] {
  const { artifact: normalized, issues } = normalizeSurfaceDocumentArtifact(artifact);
  if (!normalized) return issues;

  const maxSourceBytes = options.maxSourceBytes ?? DEFAULT_MAX_SOURCE_BYTES;
  const sourceBytes = byteLength(JSON.stringify(normalized.source));
  if (sourceBytes > maxSourceBytes) {
    issues.push(surfaceDocumentIssue('surface-document-source-limit', `surface-document source exceeds ${maxSourceBytes} bytes`));
  }

  validateHtml(normalized.source['main.html'], issues);
  validateCss(normalized.source['main.css'], issues);
  if (normalized.source['main.js']) validateJs(normalized.source['main.js'], issues);
  return issues;
}

function validateHtml(html: string, issues: ContractIssue[]): void {
  const forbidden = html.match(FORBIDDEN_TAG_RE)?.[1];
  if (forbidden) {
    issues.push(surfaceDocumentIssue(
      'surface-document-html-forbidden-tag',
      `main.html uses forbidden <${forbidden.toLowerCase()}>; Surface Document HTML must be inert. Put behavior in main.js.`,
      '/artifact/main.html',
    ));
  }
  const handler = html.match(INLINE_HANDLER_RE)?.[1];
  if (handler) {
    issues.push(surfaceDocumentIssue(
      'surface-document-html-inline-handler',
      `main.html uses inline event attribute ${handler}. Wire behavior in main.js with scoped DOM APIs instead.`,
      '/artifact/main.html',
    ));
  }
  if (JAVASCRIPT_URL_RE.test(html)) {
    issues.push(surfaceDocumentIssue(
      'surface-document-html-javascript-url',
      'main.html uses a javascript: URL. Surface Document HTML must be inert.',
      '/artifact/main.html',
    ));
  }
}

function validateCss(css: string, issues: ContractIssue[]): void {
  if (CSS_IMPORT_RE.test(css)) {
    issues.push(surfaceDocumentIssue('surface-document-css-import', 'main.css must not use @import; include local CSS only.', '/artifact/main.css'));
  }
  if (CSS_EXTERNAL_URL_RE.test(css)) {
    issues.push(surfaceDocumentIssue('surface-document-css-external-url', 'main.css must not reference external, data:, or javascript: URLs.', '/artifact/main.css'));
  }
}

function validateJs(js: string, issues: ContractIssue[]): void {
  if (JS_NETWORK_RE.test(js)) {
    issues.push(surfaceDocumentIssue(
      'surface-document-network-not-granted',
      'main.js uses network APIs (fetch/XHR/WebSocket). Use host tools via callTool() instead.',
      '/artifact/main.js',
    ));
  }
  for (const { re, api, hint } of JS_UNSUPPORTED_PATTERNS) {
    if (re.test(js)) {
      issues.push(surfaceDocumentIssue(
        'surface-document-unsupported-api',
        `main.js uses ${api}, which the sandbox does not support. ${hint}`,
        '/artifact/main.js',
      ));
    }
  }
}

function surfaceDocumentIssue(code: string, message: string, path = '/artifact'): ContractIssue {
  return contractIssue({ source: 'protocol', severity: 'block', code, message, path });
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
