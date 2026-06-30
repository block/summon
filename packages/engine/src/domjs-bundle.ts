import type { ContractIssue } from './contracts.js';
import { contractIssue } from './contracts.js';
import type { DomjsSurfaceArtifact } from './domjs-artifact.js';

// The structured bundle the model returns for a domjs surface. Mirrors the
// arrow bundle shape, reduced: one `main.js` entry, optional `main.css`. We keep
// it deliberately simpler than the arrow bundle (no preview regions) — the
// surface-vm renderer derives the preview from the emitted render tree.

export interface SummonDomjsBundle {
  schema: 'summon.domjs-bundle/v1';
  source: {
    'main.js'?: string;
    'main.css'?: string;
  };
}

export interface NormalizeDomjsBundleResult {
  bundle: SummonDomjsBundle | null;
  issues: ContractIssue[];
}

export const SUMMON_DOMJS_BUNDLE_SCHEMA = 'summon.domjs-bundle/v1';

const ENTRY_FILE = 'main.js';
// Common field aliases the model sometimes uses for the entry/css instead of the
// canonical file names. Coerced with a warning, like the arrow bundle does.
const ENTRY_ALIASES = ['main.js', 'js', 'javascript', 'code', 'main', 'entry'];
const CSS_ALIASES = ['main.css', 'css', 'style', 'styles'];

export function normalizeDomjsBundle(value: unknown): NormalizeDomjsBundleResult {
  const issues: ContractIssue[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      bundle: null,
      issues: [domjsBundleIssue('invalid-domjs-bundle', 'domjs bundle must be an object')],
    };
  }

  const input = value as Record<string, unknown>;
  if (input.schema !== SUMMON_DOMJS_BUNDLE_SCHEMA) {
    issues.push(domjsBundleIssue(
      'invalid-domjs-bundle-schema',
      `domjs bundle schema must be "${SUMMON_DOMJS_BUNDLE_SCHEMA}"`,
      '/schema',
    ));
  }

  const source: SummonDomjsBundle['source'] = {};
  const sourceInput = input.source;

  if (typeof sourceInput === 'string') {
    issues.push(domjsBundleWarn(
      'coerced-domjs-bundle-source',
      'domjs bundle source was returned as a string; treating it as main.js',
      '/source',
    ));
    source['main.js'] = sourceInput;
  } else if (sourceInput && typeof sourceInput === 'object' && !Array.isArray(sourceInput)) {
    pickAliased(sourceInput as Record<string, unknown>, ENTRY_ALIASES, 'main.js', source, issues);
    pickAliased(sourceInput as Record<string, unknown>, CSS_ALIASES, 'main.css', source, issues);
  } else {
    // Fall back to top-level fields (model returned a flat object).
    pickAliased(input, ENTRY_ALIASES, 'main.js', source, issues);
    pickAliased(input, CSS_ALIASES, 'main.css', source, issues);
  }

  if (!source['main.js']) {
    issues.push(domjsBundleIssue(
      'missing-domjs-bundle-entry',
      'domjs bundle must include a main.js entry',
      '/source',
    ));
  }

  if (issues.some((issue) => issue.severity === 'block')) {
    return { bundle: null, issues };
  }
  return { bundle: { schema: SUMMON_DOMJS_BUNDLE_SCHEMA, source }, issues };
}

export function isSummonDomjsBundle(value: unknown): value is SummonDomjsBundle {
  return normalizeDomjsBundle(value).bundle !== null;
}

export function domjsArtifactFromBundle(bundle: SummonDomjsBundle): DomjsSurfaceArtifact {
  const source: Record<string, string> = {};
  for (const [path, contents] of Object.entries(bundle.source)) {
    if (typeof contents === 'string') source[path] = contents;
  }
  return { runtime: 'domjs', source };
}

export function createDomjsBundleJsonSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['schema', 'source'],
    properties: {
      schema: { const: SUMMON_DOMJS_BUNDLE_SCHEMA },
      source: {
        type: 'object',
        additionalProperties: false,
        required: ['main.js'],
        properties: {
          'main.js': { type: 'string', description: 'Imperative HTML/JS entry. Build with document.createElement/append. Use reactive state(...) with function bindings for dynamic values (textContent = () => s.x, region(() => s.items.map(...))) — mutate state in handlers, no manual update calls. callTool() for host tools. Export the root node as default.' },
          'main.css': { type: 'string', description: 'Optional stylesheet. No @import or external url() references.' },
        },
      },
    },
  };
}

export function createDomjsBundleToolDefinition(): Record<string, unknown> {
  return {
    name: 'emit_domjs_surface',
    description: 'Create a domjs HTML/JS surface bundle for Summon. The server owns validation, repair, and artifact delivery; return only the structured bundle fields.',
    input_schema: createDomjsBundleJsonSchema(),
  };
}

function pickAliased(
  obj: Record<string, unknown>,
  aliases: string[],
  canonical: 'main.js' | 'main.css',
  out: SummonDomjsBundle['source'],
  issues: ContractIssue[],
): void {
  for (const alias of aliases) {
    const v = obj[alias];
    if (typeof v === 'string') {
      if (alias !== canonical) {
        issues.push(domjsBundleWarn(
          'coerced-domjs-bundle-source',
          `domjs bundle "${alias}" coerced to "${canonical}"`,
          '/source',
        ));
      }
      out[canonical] = v;
      return;
    }
  }
}

function domjsBundleIssue(code: string, message: string, path = '/source'): ContractIssue {
  return contractIssue({ source: 'protocol', severity: 'block', code, message, path });
}

function domjsBundleWarn(code: string, message: string, path = '/source'): ContractIssue {
  return contractIssue({ source: 'protocol', severity: 'warn', code, message, path });
}
