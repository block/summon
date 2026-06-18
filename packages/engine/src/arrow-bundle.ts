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
  if (!sourceInput || typeof sourceInput !== 'object' || Array.isArray(sourceInput)) {
    issues.push(arrowBundleIssue(
      'missing-arrow-bundle-source',
      'Arrow bundle must include a source object',
      '/source',
    ));
    return { bundle: null, issues };
  }

  const source: SummonArrowBundle['source'] = {};
  for (const [path, contents] of Object.entries(sourceInput as Record<string, unknown>)) {
    if (!SOURCE_FILES.has(path)) {
      issues.push(arrowBundleIssue(
        'arrow-bundle-extra-file',
        `Arrow bundle source contains unsupported file "${path}"`,
        `/source/${path}`,
      ));
      continue;
    }
    if (typeof contents !== 'string') {
      issues.push(arrowBundleIssue(
        'invalid-arrow-bundle-source-file',
        `Arrow bundle source file "${path}" must be a string`,
        `/source/${path}`,
      ));
      continue;
    }
    source[path as keyof SummonArrowBundle['source']] = contents;
  }

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
        anyOf: [
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
