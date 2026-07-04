import type { ContractIssue } from './contracts.js';
import { contractIssue } from './contracts.js';
import type { SurfaceDocumentArtifact } from './surface-document-artifact.js';
import { parseSurfaceDocumentText } from './surface-document-text.js';

export interface SummonSurfaceDocumentBundle {
  schema: 'summon.surface-document-bundle/v1';
  source: {
    'main.html'?: string;
    'main.css'?: string;
    'main.js'?: string;
  };
}

export interface NormalizeSurfaceDocumentBundleResult {
  bundle: SummonSurfaceDocumentBundle | null;
  issues: ContractIssue[];
}

export const SUMMON_SURFACE_DOCUMENT_BUNDLE_SCHEMA = 'summon.surface-document-bundle/v1';

const HTML_ALIASES = ['main.html', 'html', 'body.html', 'body', 'markup', 'structure'];
const CSS_ALIASES = ['main.css', 'css', 'style', 'styles'];
const JS_ALIASES = ['main.js', 'js', 'javascript', 'behavior', 'code'];

export function normalizeSurfaceDocumentBundle(value: unknown): NormalizeSurfaceDocumentBundleResult {
  const issues: ContractIssue[] = [];
  if (typeof value === 'string') {
    // Tagged-text wire format: parse the fences, then feed the resulting
    // source map through the same alias/coercion logic as object input.
    const parsed = parseSurfaceDocumentText(value);
    if (!parsed.source) return { bundle: null, issues: parsed.issues };
    const objectResult = normalizeSurfaceDocumentBundle({
      schema: SUMMON_SURFACE_DOCUMENT_BUNDLE_SCHEMA,
      source: parsed.source,
    });
    return {
      bundle: objectResult.bundle,
      issues: [...parsed.issues, ...objectResult.issues],
    };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      bundle: null,
      issues: [surfaceDocumentBundleIssue('invalid-surface-document-bundle', 'surface-document bundle must be an object')],
    };
  }

  const input = value as Record<string, unknown>;
  if (input.schema !== SUMMON_SURFACE_DOCUMENT_BUNDLE_SCHEMA) {
    issues.push(surfaceDocumentBundleIssue(
      'invalid-surface-document-bundle-schema',
      `surface-document bundle schema must be "${SUMMON_SURFACE_DOCUMENT_BUNDLE_SCHEMA}"`,
      '/schema',
    ));
  }

  const source: SummonSurfaceDocumentBundle['source'] = {};
  const sourceInput = input.source;
  if (sourceInput && typeof sourceInput === 'object' && !Array.isArray(sourceInput)) {
    const obj = sourceInput as Record<string, unknown>;
    pickAliased(obj, HTML_ALIASES, 'main.html', source, issues);
    pickAliased(obj, CSS_ALIASES, 'main.css', source, issues);
    pickAliased(obj, JS_ALIASES, 'main.js', source, issues);
  } else {
    // Fall back to top-level fields (model returned a flat object).
    pickAliased(input, HTML_ALIASES, 'main.html', source, issues);
    pickAliased(input, CSS_ALIASES, 'main.css', source, issues);
    pickAliased(input, JS_ALIASES, 'main.js', source, issues);
  }

  if (!source['main.html']) {
    issues.push(surfaceDocumentBundleIssue(
      'missing-surface-document-bundle-html',
      'surface-document bundle must include main.html',
      '/source',
    ));
  }
  if (!source['main.css']) {
    issues.push(surfaceDocumentBundleIssue(
      'missing-surface-document-bundle-css',
      'surface-document bundle must include main.css',
      '/source',
    ));
  }

  if (issues.some((issue) => issue.severity === 'block')) return { bundle: null, issues };
  return { bundle: { schema: SUMMON_SURFACE_DOCUMENT_BUNDLE_SCHEMA, source }, issues };
}

export function isSummonSurfaceDocumentBundle(value: unknown): value is SummonSurfaceDocumentBundle {
  return normalizeSurfaceDocumentBundle(value).bundle !== null;
}

export function surfaceDocumentArtifactFromBundle(bundle: SummonSurfaceDocumentBundle): SurfaceDocumentArtifact {
  const source: SurfaceDocumentArtifact['source'] = {
    'main.html': bundle.source['main.html'] ?? '',
    'main.css': bundle.source['main.css'] ?? '',
    ...(typeof bundle.source['main.js'] === 'string' ? { 'main.js': bundle.source['main.js'] } : {}),
  };
  return { runtime: 'surface-document', source };
}

export function createSurfaceDocumentBundleJsonSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['schema', 'source'],
    properties: {
      schema: { const: SUMMON_SURFACE_DOCUMENT_BUNDLE_SCHEMA },
      source: {
        type: 'object',
        additionalProperties: false,
        required: ['main.html', 'main.css'],
        properties: {
          'main.html': {
            type: 'string',
            description: 'Required inert semantic HTML structure. Use ids/classes/data-* hooks for optional behavior. No <script>, <style>, iframe/object/embed, inline on* handlers, javascript: URLs, or form actions that imply ambient browser authority.',
          },
          'main.css': {
            type: 'string',
            description: 'Required stylesheet expressing the Ghost fingerprint. Put visual styling here. No @import, external URLs, data: URLs, javascript: URLs, external images, external fonts, or external stylesheets.',
          },
          'main.js': {
            type: 'string',
            description: 'Optional governed behavior. Runs in the Summon VM against the parsed main.html root using scoped DOM APIs, state(), region(), getState/onState, and callTool(). No fetch/XHR/WebSocket, window, document.body, storage, eval, dynamic import, innerHTML, or outerHTML.',
          },
        },
      },
    },
  };
}

export function createSurfaceDocumentBundleToolDefinition(): Record<string, unknown> {
  return {
    name: 'emit_surface_document',
    description: 'Create a Summon Surface Document bundle: inert main.html structure, main.css fingerprint styling, and optional governed main.js behavior.',
    input_schema: createSurfaceDocumentBundleJsonSchema(),
  };
}

function pickAliased(
  obj: Record<string, unknown>,
  aliases: string[],
  canonical: keyof SummonSurfaceDocumentBundle['source'],
  out: SummonSurfaceDocumentBundle['source'],
  issues: ContractIssue[],
): void {
  for (const alias of aliases) {
    const value = obj[alias];
    if (typeof value === 'string') {
      if (alias !== canonical) {
        issues.push(surfaceDocumentBundleWarn(
          'coerced-surface-document-bundle-source',
          `surface-document bundle "${alias}" coerced to "${canonical}"`,
          '/source',
        ));
      }
      out[canonical] = value;
      return;
    }
  }
}

function surfaceDocumentBundleIssue(code: string, message: string, path = '/source'): ContractIssue {
  return contractIssue({ source: 'protocol', severity: 'block', code, message, path });
}

function surfaceDocumentBundleWarn(code: string, message: string, path = '/source'): ContractIssue {
  return contractIssue({ source: 'protocol', severity: 'warn', code, message, path });
}
