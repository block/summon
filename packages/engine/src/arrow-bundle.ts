import type { ContractIssue } from './contracts.js';
import { contractIssue } from './contracts.js';
import type { ArrowSurfaceArtifact } from './arrow-artifact.js';

export interface SummonArrowPreviewRegion {
  id: string;
  role: string;
  label?: string;
  summary?: string;
}

export interface SummonArrowPreview {
  kind: string;
  title?: string;
  regions?: SummonArrowPreviewRegion[];
}

export interface SummonArrowBundle {
  schema: 'summon.arrow-bundle/v1';
  preview?: SummonArrowPreview;
  source: {
    'main.ts'?: string;
    'main.js'?: string;
    'main.css'?: string;
  };
  shadowDOM?: boolean;
  debug?: boolean;
}

export interface NormalizeArrowBundleResult {
  bundle: SummonArrowBundle | null;
  issues: ContractIssue[];
}

export const SUMMON_ARROW_BUNDLE_SCHEMA = 'summon.arrow-bundle/v1';

const SOURCE_FILES = new Set(['main.ts', 'main.js', 'main.css']);
const ENTRY_FILES = new Set(['main.ts', 'main.js']);
const COMMON_SOURCE_FIELDS = new Set([
  'code',
  'ts',
  'typescript',
  'main',
  'entry',
  'js',
  'javascript',
  'css',
  'style',
  'styles',
]);

export function normalizeArrowBundle(value: unknown): NormalizeArrowBundleResult {
  const issues: ContractIssue[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      bundle: null,
      issues: [arrowBundleIssue('invalid-arrow-bundle', 'Arrow bundle must be an object')],
    };
  }

  const input = value as Record<string, unknown>;
  if (input.schema !== SUMMON_ARROW_BUNDLE_SCHEMA) {
    issues.push(arrowBundleIssue(
      'invalid-arrow-bundle-schema',
      `Arrow bundle schema must be "${SUMMON_ARROW_BUNDLE_SCHEMA}"`,
      '/schema',
    ));
  }

  const sourceInput = input.source;
  const source: SummonArrowBundle['source'] = {};
  if (typeof sourceInput === 'string') {
    issues.push(arrowBundleWarn(
      'coerced-arrow-bundle-source',
      'Arrow bundle source was returned as a string; coercing it into a source file map',
      '/source',
    ));
    const parsedSource = parseSourceString(sourceInput);
    if (parsedSource) {
      copySourceObject(parsedSource, source, issues, '/source', { warnCommonFields: false });
    } else {
      source['main.ts'] = sourceInput;
    }
    copyFlattenedSourceFiles(input, source);
  } else if (!sourceInput || typeof sourceInput !== 'object' || Array.isArray(sourceInput)) {
    const topLevelEntries = Object.fromEntries(
      Object.entries(input).filter(([path]) => ENTRY_FILES.has(path)),
    );
    if (Object.keys(topLevelEntries).length > 0) {
      issues.push(arrowBundleWarn(
        'coerced-arrow-bundle-source',
        'Arrow bundle entry files were returned at the top level; treating them as source files',
        '/source',
      ));
      copySourceFiles(topLevelEntries, source, issues, '/source');
      copyFlattenedSourceFiles(input, source);
    } else {
      issues.push(arrowBundleIssue(
        'missing-arrow-bundle-source',
        'Arrow bundle must include a source object',
        '/source',
      ));
      return { bundle: null, issues };
    }
  } else {
    copySourceObject(sourceInput as Record<string, unknown>, source, issues, '/source', { warnCommonFields: true });
    copyFlattenedSourceFiles(input, source);
  }

  normalizeOutputSourceFiles(source, issues);

  const entries = Object.keys(source).filter((path) => ENTRY_FILES.has(path));
  if (entries.length !== 1) {
    issues.push(arrowBundleIssue(
      'invalid-arrow-bundle-entry',
      'Arrow bundle must include exactly one main.ts or main.js entry file',
      '/source',
    ));
  }

  const preview = normalizePreview(input.preview, issues);
  const shadowDOM = typeof input.shadowDOM === 'boolean' ? input.shadowDOM : undefined;
  const debug = typeof input.debug === 'boolean' ? input.debug : undefined;

  if (issues.some((issue) => issue.severity === 'block')) {
    return { bundle: null, issues };
  }

  return {
    bundle: {
      schema: SUMMON_ARROW_BUNDLE_SCHEMA,
      ...(preview ? { preview } : {}),
      source,
      ...(shadowDOM !== undefined ? { shadowDOM } : {}),
      ...(debug !== undefined ? { debug } : {}),
    },
    issues,
  };
}

export function isSummonArrowBundle(value: unknown): value is SummonArrowBundle {
  return normalizeArrowBundle(value).bundle !== null;
}

export function arrowArtifactFromBundle(bundle: SummonArrowBundle): ArrowSurfaceArtifact {
  const source: Record<string, string> = {};
  for (const [path, contents] of Object.entries(bundle.source)) {
    if (typeof contents === 'string') source[path] = contents;
  }
  return {
    runtime: 'arrow',
    source,
  };
}

export function createArrowBundleJsonSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      schema: {
        type: 'string',
        const: SUMMON_ARROW_BUNDLE_SCHEMA,
        enum: [SUMMON_ARROW_BUNDLE_SCHEMA],
      },
      preview: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: { type: 'string' },
          title: { type: 'string' },
          regions: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                role: { type: 'string' },
                label: { type: 'string' },
                summary: { type: 'string' },
              },
              required: ['id', 'role'],
            },
          },
        },
        required: ['kind'],
      },
      source: {
        type: 'object',
        additionalProperties: false,
        properties: {
          'main.ts': { type: 'string', description: 'Main Arrow TypeScript entry file.' },
          'main.js': { type: 'string', description: 'Main Arrow JavaScript entry file.' },
          'main.css': { type: 'string', description: 'Optional stylesheet for the Arrow sandbox root.' },
        },
        oneOf: [
          { required: ['main.ts'] },
          { required: ['main.js'] },
        ],
      },
      shadowDOM: { type: 'boolean' },
      debug: { type: 'boolean' },
    },
    required: ['schema', 'source'],
  };
}

export function createArrowBundleToolDefinition(): Record<string, unknown> {
  return {
    name: 'create_summon_arrow_surface',
    description: 'Create an Arrow sandbox surface bundle for Summon. The server owns streaming protocol and validation; return only the structured bundle fields.',
    input_schema: createArrowBundleJsonSchema(),
  };
}

function normalizeOutputSourceFiles(
  source: SummonArrowBundle['source'],
  issues: ContractIssue[],
): void {
  for (const key of ['main.ts', 'main.js', 'main.css'] as const) {
    const value = source[key];
    if (typeof value !== 'string') continue;
    const normalized = normalizeEscapedSourceString(value);
    if (normalized !== value) {
      source[key] = normalized;
      issues.push(arrowBundleWarn(
        'coerced-arrow-bundle-source-escapes',
        `Arrow bundle source file "${key}" contained escaped template markers; normalizing before render`,
        `/source/${key}`,
      ));
    }
  }
}

function normalizeEscapedSourceString(value: string): string {
  return value.replace(/\\(?=`|\$\{)/g, '');
}

function copySourceFiles(
  input: Record<string, unknown>,
  output: SummonArrowBundle['source'],
  issues: ContractIssue[],
  pathPrefix: string,
): void {
  for (const [path, contents] of Object.entries(input)) {
    if (!SOURCE_FILES.has(path)) {
      if (COMMON_SOURCE_FIELDS.has(path)) continue;
      issues.push(arrowBundleIssue(
        'arrow-bundle-extra-file',
        `Arrow bundle source contains unsupported file "${path}"`,
        `${pathPrefix}/${path}`,
      ));
      continue;
    }
    if (typeof contents !== 'string') {
      issues.push(arrowBundleIssue(
        'invalid-arrow-bundle-source-file',
        `Arrow bundle source file "${path}" must be a string`,
        `${pathPrefix}/${path}`,
      ));
      continue;
    }
    output[path as keyof SummonArrowBundle['source']] = contents;
  }
}

function copySourceObject(
  input: Record<string, unknown>,
  output: SummonArrowBundle['source'],
  issues: ContractIssue[],
  pathPrefix: string,
  options: { warnCommonFields: boolean },
): void {
  copySourceFiles(input, output, issues, pathPrefix);
  const beforeEntries = Object.keys(output).filter((path) => ENTRY_FILES.has(path));
  coerceCommonSourceFields(input, output);
  const afterEntries = Object.keys(output).filter((path) => ENTRY_FILES.has(path));
  if (options.warnCommonFields && beforeEntries.length === 0 && afterEntries.length > 0) {
    issues.push(arrowBundleWarn(
      'coerced-arrow-bundle-source',
      'Arrow bundle source used common code/style keys; coercing them into main.ts/main.css files',
      pathPrefix,
    ));
  }
}

function coerceCommonSourceFields(
  input: Record<string, unknown>,
  output: SummonArrowBundle['source'],
): void {
  if (!output['main.ts']) {
    const ts = firstString(input, ['code', 'ts', 'typescript', 'main', 'entry']);
    if (ts) output['main.ts'] = ts;
  }
  if (!output['main.js']) {
    const js = firstString(input, ['js', 'javascript']);
    if (js && !output['main.ts']) output['main.js'] = js;
  }
  if (!output['main.css']) {
    const css = firstString(input, ['css', 'style', 'styles']);
    if (css) output['main.css'] = css;
  }
}

function firstString(input: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

function copyFlattenedSourceFiles(
  input: Record<string, unknown>,
  output: SummonArrowBundle['source'],
): void {
  for (const path of SOURCE_FILES) {
    const contents = input[`source.${path}`] ?? input[path];
    if (typeof contents === 'string') output[path as keyof SummonArrowBundle['source']] = contents;
  }
}

function parseSourceString(value: string): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const obj = parsed as Record<string, unknown>;
    const nested = obj.source;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) return nested as Record<string, unknown>;
    if (Object.keys(obj).some((key) => SOURCE_FILES.has(key) || COMMON_SOURCE_FIELDS.has(key))) return obj;
    return null;
  } catch {
    return null;
  }
}

function normalizePreview(value: unknown, issues: ContractIssue[]): SummonArrowPreview | undefined {
  if (value === undefined || value === null) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    issues.push(arrowBundleIssue('invalid-arrow-bundle-preview', 'Arrow bundle preview must be an object', '/preview'));
    return undefined;
  }
  const input = value as Record<string, unknown>;
  if (typeof input.kind !== 'string' || !input.kind.trim()) {
    issues.push(arrowBundleIssue('invalid-arrow-bundle-preview', 'Arrow bundle preview.kind must be a non-empty string', '/preview/kind'));
    return undefined;
  }
  const regions: SummonArrowPreviewRegion[] = [];
  if (input.regions !== undefined) {
    if (!Array.isArray(input.regions)) {
      issues.push(arrowBundleIssue('invalid-arrow-bundle-preview', 'Arrow bundle preview.regions must be an array', '/preview/regions'));
    } else {
      for (const [index, region] of input.regions.entries()) {
        if (!region || typeof region !== 'object' || Array.isArray(region)) {
          issues.push(arrowBundleIssue('invalid-arrow-bundle-preview-region', `Preview region ${index} must be an object`, `/preview/regions/${index}`));
          continue;
        }
        const item = region as Record<string, unknown>;
        if (typeof item.id !== 'string' || typeof item.role !== 'string') {
          issues.push(arrowBundleIssue('invalid-arrow-bundle-preview-region', `Preview region ${index} must include string id and role`, `/preview/regions/${index}`));
          continue;
        }
        regions.push({
          id: item.id,
          role: item.role,
          ...(typeof item.label === 'string' ? { label: item.label } : {}),
          ...(typeof item.summary === 'string' ? { summary: item.summary } : {}),
        });
      }
    }
  }
  return {
    kind: input.kind,
    ...(typeof input.title === 'string' ? { title: input.title } : {}),
    ...(regions.length > 0 ? { regions } : {}),
  };
}

function arrowBundleIssue(code: string, message: string, path = '/bundle'): ContractIssue {
  return contractIssue({
    source: 'protocol',
    severity: 'block',
    code,
    message,
    path,
  });
}

function arrowBundleWarn(code: string, message: string, path = '/bundle'): ContractIssue {
  return contractIssue({
    source: 'protocol',
    severity: 'warn',
    code,
    message,
    path,
  });
}
