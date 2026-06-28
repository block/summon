import { parseFragment, serialize, type DefaultTreeAdapterTypes } from 'parse5';
import postcss from 'postcss';
import valueParser, { type Node as CssValueNode } from 'postcss-value-parser';
import type { ContractIssue } from './contracts.js';
import { contractIssue } from './contracts.js';
import { DEFAULT_VALIDATION_LIMITS } from './validation-limits.js';

export const SUMMON_HTML_BUNDLE_SCHEMA = 'summon.html-bundle/v0';

export interface SummonHtmlPreviewRegion {
  id: string;
  role: string;
  label?: string;
  summary?: string;
}

export interface SummonHtmlPreview {
  kind: string;
  title?: string;
  regions?: SummonHtmlPreviewRegion[];
}

export interface SummonHtmlBundle {
  schema: typeof SUMMON_HTML_BUNDLE_SCHEMA;
  preview?: SummonHtmlPreview;
  source: {
    'body.html': string;
    'main.css'?: string;
    'main.js'?: string;
  };
}

export interface HtmlSurfaceArtifact {
  runtime: 'html';
  schema?: typeof SUMMON_HTML_BUNDLE_SCHEMA;
  preview?: SummonHtmlPreview;
  source: {
    'body.html': string;
    'main.css'?: string;
    'main.js'?: string;
  };
}

export type HtmlPatchAction = 'append' | 'replace' | 'update' | 'remove' | 'morph';

export interface HtmlSurfacePatch {
  runtime: 'html';
  action: HtmlPatchAction;
  target: string;
  html?: string;
}

export interface HtmlArtifactValidationOptions {
  allowScript?: boolean;
  maxSourceBytes?: number;
  maxCssBytes?: number;
  maxDomDepth?: number;
  maxDomNodes?: number;
}

export interface NormalizeHtmlBundleResult {
  bundle: SummonHtmlBundle | null;
  issues: ContractIssue[];
}

const SOURCE_FILES = new Set(['body.html', 'main.css', 'main.js']);
const COMMON_BODY_FIELDS = new Set(['html', 'body', 'bodyHtml', 'markup', 'content']);
const COMMON_CSS_FIELDS = new Set(['css', 'style', 'styles']);
const COMMON_JS_FIELDS = new Set(['js', 'javascript', 'script']);
const UNSAFE_TAGS = new Set([
  'base',
  'embed',
  'form',
  'frame',
  'frameset',
  'body',
  'head',
  'html',
  'iframe',
  'link',
  'meta',
  'object',
  'portal',
  'script',
]);
const STYLE_TAGS = new Set(['style']);
const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title']);
const URL_ATTRS = new Set([
  'action',
  'cite',
  'data',
  'formaction',
  'href',
  'manifest',
  'poster',
  'src',
  'xlink:href',
]);
const SRCSET_ATTRS = new Set(['srcset']);
const GLOBAL_ATTRS = new Set([
  'aria-activedescendant',
  'aria-atomic',
  'aria-autocomplete',
  'aria-busy',
  'aria-checked',
  'aria-colcount',
  'aria-colindex',
  'aria-colspan',
  'aria-controls',
  'aria-current',
  'aria-describedby',
  'aria-description',
  'aria-details',
  'aria-disabled',
  'aria-errormessage',
  'aria-expanded',
  'aria-flowto',
  'aria-haspopup',
  'aria-hidden',
  'aria-invalid',
  'aria-keyshortcuts',
  'aria-label',
  'aria-labelledby',
  'aria-level',
  'aria-live',
  'aria-modal',
  'aria-multiline',
  'aria-multiselectable',
  'aria-orientation',
  'aria-owns',
  'aria-placeholder',
  'aria-posinset',
  'aria-pressed',
  'aria-readonly',
  'aria-relevant',
  'aria-required',
  'aria-roledescription',
  'aria-rowcount',
  'aria-rowindex',
  'aria-rowspan',
  'aria-selected',
  'aria-setsize',
  'aria-sort',
  'aria-valuemax',
  'aria-valuemin',
  'aria-valuenow',
  'aria-valuetext',
  'class',
  'hidden',
  'id',
  'inert',
  'role',
  'style',
  'title',
]);
const HTML_ATTRS = new Set([
  'alt',
  'aria-label',
  'checked',
  'colspan',
  'datetime',
  'decoding',
  'disabled',
  'height',
  'loading',
  'name',
  'open',
  'placeholder',
  'readonly',
  'rowspan',
  'scope',
  'selected',
  'type',
  'value',
  'width',
]);
const SVG_ATTRS = new Set([
  'clip-path',
  'cx',
  'cy',
  'd',
  'fill',
  'fill-rule',
  'focusable',
  'height',
  'mask',
  'opacity',
  'pathlength',
  'points',
  'preserveaspectratio',
  'r',
  'rx',
  'ry',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-width',
  'transform',
  'viewbox',
  'width',
  'x',
  'x1',
  'x2',
  'y',
  'y1',
  'y2',
]);
const SAFE_AT_RULES = new Set([
  'container',
  'font-face',
  'keyframes',
  'media',
  'supports',
]);
const TARGET_ID_RE = /^[A-Za-z][A-Za-z0-9_-]{0,79}$/;
const UNSAFE_SCRIPT_RE = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|Worker|SharedWorker|importScripts|indexedDB|localStorage|sessionStorage|eval|Function)\b|document\s*\.\s*cookie|window\s*\.\s*(?:top|parent|opener)|globalThis\s*\.\s*(?:top|parent|opener)|navigator\s*\.\s*serviceWorker|\bimport\s*\(/m;

export function normalizeHtmlBundle(value: unknown): NormalizeHtmlBundleResult {
  const issues: ContractIssue[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      bundle: null,
      issues: [htmlIssue('invalid-html-bundle', 'HTML bundle must be an object', '/bundle')],
    };
  }

  const input = value as Record<string, unknown>;
  if (input.schema !== SUMMON_HTML_BUNDLE_SCHEMA) {
    issues.push(htmlIssue(
      'invalid-html-bundle-schema',
      `HTML bundle schema must be "${SUMMON_HTML_BUNDLE_SCHEMA}"`,
      '/schema',
    ));
  }

  const sourceInput = input.source;
  const source: SummonHtmlBundle['source'] = { 'body.html': '' };
  if (sourceInput && typeof sourceInput === 'object' && !Array.isArray(sourceInput)) {
    copyHtmlSourceFiles(sourceInput as Record<string, unknown>, source, issues, '/source');
  } else {
    copyFlattenedHtmlSourceFiles(input, source);
    if (!source['body.html']) {
      issues.push(htmlIssue('missing-html-bundle-source', 'HTML bundle must include source["body.html"]', '/source'));
    } else {
      issues.push(htmlWarn(
        'coerced-html-bundle-source',
        'HTML bundle source files were returned at the top level; treating them as source files',
        '/source',
      ));
    }
  }

  copyFlattenedHtmlSourceFiles(input, source);

  if (typeof source['body.html'] !== 'string' || !source['body.html'].trim()) {
    issues.push(htmlIssue('missing-html-body', 'HTML bundle must include non-empty source["body.html"]', '/source/body.html'));
  }

  const preview = normalizePreview(input.preview, issues);
  if (issues.some((issue) => issue.severity === 'block')) {
    return { bundle: null, issues };
  }

  return {
    bundle: {
      schema: SUMMON_HTML_BUNDLE_SCHEMA,
      ...(preview ? { preview } : {}),
      source,
    },
    issues,
  };
}

export function isSummonHtmlBundle(value: unknown): value is SummonHtmlBundle {
  return normalizeHtmlBundle(value).bundle !== null;
}

export function htmlArtifactFromBundle(bundle: SummonHtmlBundle): HtmlSurfaceArtifact {
  return {
    runtime: 'html',
    schema: SUMMON_HTML_BUNDLE_SCHEMA,
    ...(bundle.preview ? { preview: bundle.preview } : {}),
    source: {
      'body.html': bundle.source['body.html'],
      ...(typeof bundle.source['main.css'] === 'string' ? { 'main.css': bundle.source['main.css'] } : {}),
      ...(typeof bundle.source['main.js'] === 'string' ? { 'main.js': bundle.source['main.js'] } : {}),
    },
  };
}

export function normalizeHtmlSurfaceArtifact(value: unknown): {
  artifact: HtmlSurfaceArtifact | null;
  issues: ContractIssue[];
} {
  const issues: ContractIssue[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      artifact: null,
      issues: [htmlIssue('invalid-html-artifact', 'HTML artifact must be an object', '/artifact')],
    };
  }
  const input = value as Record<string, unknown>;
  if (input.runtime !== 'html') {
    issues.push(htmlIssue('invalid-html-runtime', 'HTML artifact runtime must be "html"', '/artifact/runtime'));
  }
  const sourceInput = input.source;
  if (!sourceInput || typeof sourceInput !== 'object' || Array.isArray(sourceInput)) {
    issues.push(htmlIssue('invalid-html-source', 'HTML artifact source must be a file map', '/artifact/source'));
    return { artifact: null, issues };
  }
  const source: HtmlSurfaceArtifact['source'] = { 'body.html': '' };
  copyHtmlSourceFiles(sourceInput as Record<string, unknown>, source, issues, '/artifact/source');
  if (typeof source['body.html'] !== 'string' || !source['body.html'].trim()) {
    issues.push(htmlIssue('missing-html-body', 'HTML artifact must include non-empty source["body.html"]', '/artifact/source/body.html'));
  }
  const preview = normalizePreview(input.preview, issues);
  if (issues.some((issue) => issue.severity === 'block')) {
    return { artifact: null, issues };
  }
  return {
    artifact: {
      runtime: 'html',
      schema: SUMMON_HTML_BUNDLE_SCHEMA,
      ...(preview ? { preview } : {}),
      source,
    },
    issues,
  };
}

export function isHtmlSurfaceArtifact(value: unknown): value is HtmlSurfaceArtifact {
  return normalizeHtmlSurfaceArtifact(value).artifact !== null;
}

export function validateHtmlSurfaceArtifact(
  artifact: HtmlSurfaceArtifact,
  options: HtmlArtifactValidationOptions = {},
): ContractIssue[] {
  const { artifact: normalized, issues } = normalizeHtmlSurfaceArtifact(artifact);
  if (!normalized) return issues;
  const limits = htmlLimits(options);
  const sourceBytes = byteLength(JSON.stringify(normalized.source));
  if (sourceBytes > limits.maxSourceBytes) {
    issues.push(htmlIssue('html-source-limit', `HTML source exceeds ${limits.maxSourceBytes} bytes`, '/artifact/source'));
  }

  issues.push(...validateHtmlFragmentSource(normalized.source['body.html'], {
    maxDomDepth: limits.maxDomDepth,
    maxDomNodes: limits.maxDomNodes,
    path: '/artifact/source/body.html',
  }));

  const css = normalized.source['main.css'];
  if (css !== undefined) {
    issues.push(...validateCssSource(css, {
      maxCssBytes: limits.maxCssBytes,
      path: '/artifact/source/main.css',
    }));
  }

  const js = normalized.source['main.js'];
  if (js !== undefined) {
    if (!options.allowScript) {
      issues.push(htmlIssue(
        'html-script-not-enabled',
        'HTML main.js is only allowed in the scripted iframe experiment',
        '/artifact/source/main.js',
      ));
    } else {
      issues.push(...validateScriptSource(js, '/artifact/source/main.js'));
    }
  }
  return issues;
}

export function normalizeHtmlSurfacePatch(value: unknown): {
  patch: HtmlSurfacePatch | null;
  issues: ContractIssue[];
} {
  const issues: ContractIssue[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      patch: null,
      issues: [htmlIssue('invalid-html-patch', 'HTML patch must be an object', '/artifact/html-patch')],
    };
  }
  const input = value as Record<string, unknown>;
  const action = input.action;
  const target = input.target;
  if (input.runtime !== 'html') {
    issues.push(htmlIssue('invalid-html-patch-runtime', 'HTML patch runtime must be "html"', '/artifact/html-patch/runtime'));
  }
  if (action !== 'append' && action !== 'replace' && action !== 'update' && action !== 'remove' && action !== 'morph') {
    issues.push(htmlIssue('invalid-html-patch-action', 'HTML patch action must be append, replace, update, remove, or morph', '/artifact/html-patch/action'));
  }
  if (typeof target !== 'string' || !TARGET_ID_RE.test(target)) {
    issues.push(htmlIssue('invalid-html-patch-target', 'HTML patch target must be a stable element id', '/artifact/html-patch/target'));
  }
  const needsHtml = action === 'append' || action === 'replace' || action === 'update' || action === 'morph';
  const html = input.html;
  if (needsHtml && (typeof html !== 'string' || !html.trim())) {
    issues.push(htmlIssue('missing-html-patch-fragment', 'HTML patch action requires a complete html fragment', '/artifact/html-patch/html'));
  }
  if (action === 'remove' && html !== undefined) {
    issues.push(htmlIssue('html-remove-with-fragment', 'HTML remove patch must not include a fragment', '/artifact/html-patch/html'));
  }
  if (issues.some((issue) => issue.severity === 'block')) {
    return { patch: null, issues };
  }
  return {
    patch: {
      runtime: 'html',
      action: action as HtmlPatchAction,
      target: target as string,
      ...(typeof html === 'string' ? { html } : {}),
    },
    issues,
  };
}

export function validateHtmlSurfacePatch(
  patch: HtmlSurfacePatch,
  options: HtmlArtifactValidationOptions = {},
): ContractIssue[] {
  const { patch: normalized, issues } = normalizeHtmlSurfacePatch(patch);
  const rawHtml = normalized?.html ?? (
    patch && typeof patch === 'object' && typeof (patch as { html?: unknown }).html === 'string'
      ? (patch as { html: string }).html
      : undefined
  );
  if (rawHtml !== undefined) {
    issues.push(...validateHtmlFragmentSource(rawHtml, {
      maxDomDepth: options.maxDomDepth ?? DEFAULT_VALIDATION_LIMITS.maxDomDepth,
      maxDomNodes: options.maxDomNodes ?? DEFAULT_VALIDATION_LIMITS.maxDomNodes,
      path: '/artifact/html-patch/html',
    }));
  }
  return issues;
}

export function canonicalizeHtmlFragment(html: string): string {
  return serialize(parseFragment(html));
}

export function createHtmlBundleJsonSchema(options: { allowScript?: boolean } = {}): Record<string, unknown> {
  const sourceProperties: Record<string, unknown> = {
    'body.html': {
      type: 'string',
      description: 'Required HTML body fragment. No scripts, external URLs, inline handlers, forms, or iframes.',
    },
    'main.css': {
      type: 'string',
      description: 'Optional stylesheet. No @import or external url() references.',
    },
  };
  if (options.allowScript) {
    sourceProperties['main.js'] = {
      type: 'string',
      description: 'Optional generated script for the isolated iframe experiment only. No network, storage, parent/top/opener access, workers, eval, or dynamic imports.',
    };
  }
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      schema: {
        type: 'string',
        const: SUMMON_HTML_BUNDLE_SCHEMA,
        enum: [SUMMON_HTML_BUNDLE_SCHEMA],
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
        properties: sourceProperties,
        required: ['body.html'],
      },
    },
    required: ['schema', 'source'],
  };
}

export function createHtmlBundleToolDefinition(options: { allowScript?: boolean } = {}): Record<string, unknown> {
  return {
    name: 'create_summon_html_surface',
    description: 'Create an experimental HTML/CSS surface bundle for Summon. The server owns validation, streaming, and artifact delivery; return only the structured bundle fields.',
    input_schema: createHtmlBundleJsonSchema(options),
  };
}

function copyHtmlSourceFiles(
  input: Record<string, unknown>,
  output: SummonHtmlBundle['source'],
  issues: ContractIssue[],
  pathPrefix: string,
): void {
  for (const [path, contents] of Object.entries(input)) {
    if (!SOURCE_FILES.has(path)) {
      issues.push(htmlIssue(
        'html-bundle-extra-file',
        `HTML bundle source contains unsupported file "${path}"`,
        `${pathPrefix}/${path}`,
      ));
      continue;
    }
    if (typeof contents !== 'string') {
      issues.push(htmlIssue(
        'invalid-html-bundle-source-file',
        `HTML bundle source file "${path}" must be a string`,
        `${pathPrefix}/${path}`,
      ));
      continue;
    }
    if (path === 'body.html') {
      output['body.html'] = contents;
    } else if (path === 'main.css') {
      output['main.css'] = contents;
    } else if (path === 'main.js') {
      output['main.js'] = contents;
    }
  }
}

function copyFlattenedHtmlSourceFiles(
  input: Record<string, unknown>,
  output: SummonHtmlBundle['source'],
): void {
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== 'string') continue;
    if ((key === 'body.html' || COMMON_BODY_FIELDS.has(key)) && !output['body.html']) {
      output['body.html'] = value;
    } else if ((key === 'main.css' || COMMON_CSS_FIELDS.has(key)) && output['main.css'] === undefined) {
      output['main.css'] = value;
    } else if ((key === 'main.js' || COMMON_JS_FIELDS.has(key)) && output['main.js'] === undefined) {
      output['main.js'] = value;
    }
  }
}

function normalizePreview(value: unknown, issues: ContractIssue[]): SummonHtmlPreview | undefined {
  if (value === undefined || value === null) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    issues.push(htmlIssue('invalid-html-preview', 'HTML bundle preview must be an object', '/preview'));
    return undefined;
  }
  const input = value as Record<string, unknown>;
  const kind = typeof input.kind === 'string' ? input.kind.trim() : '';
  if (!kind) {
    issues.push(htmlIssue('invalid-html-preview', 'HTML bundle preview.kind must be a non-empty string', '/preview/kind'));
    return undefined;
  }
  const regions = normalizePreviewRegions(input.regions, issues);
  return {
    kind,
    ...(typeof input.title === 'string' ? { title: input.title } : {}),
    ...(regions.length > 0 ? { regions } : {}),
  };
}

function normalizePreviewRegions(value: unknown, issues: ContractIssue[]): SummonHtmlPreviewRegion[] {
  if (value === undefined || value === null) return [];
  const rawRegions = Array.isArray(value) ? value : [value];
  if (!Array.isArray(value)) {
    issues.push(htmlWarn(
      'coerced-html-preview-regions',
      'HTML bundle preview.regions was not an array; treating it as a single preview region',
      '/preview/regions',
    ));
  }

  const regions: SummonHtmlPreviewRegion[] = [];
  for (const [index, rawRegion] of rawRegions.entries()) {
    const fallback = regionFallback(rawRegion, index);
    if (!rawRegion || typeof rawRegion !== 'object' || Array.isArray(rawRegion)) {
      if (fallback) {
        regions.push(fallback);
        issues.push(htmlWarn(
          'coerced-html-preview-region',
          `HTML bundle preview region ${index} was not an object; treating it as a preview id`,
          `/preview/regions/${index}`,
        ));
      } else {
        issues.push(htmlWarn(
          'ignored-html-preview-region',
          `HTML bundle preview region ${index} was not an object and was ignored`,
          `/preview/regions/${index}`,
        ));
      }
      continue;
    }
    const region = rawRegion as Record<string, unknown>;
    const id = typeof region.id === 'string' ? region.id.trim() : '';
    const role = typeof region.role === 'string' ? region.role.trim() : '';
    if (!id || !role) {
      const fallbackRegion = fallback ?? partialRegionFallback(region, index);
      if (fallbackRegion) {
        regions.push(fallbackRegion);
        issues.push(htmlWarn(
          'coerced-html-preview-region',
          `HTML bundle preview region ${index} was missing id or role; using a generated preview region`,
          `/preview/regions/${index}`,
        ));
      } else {
        issues.push(htmlWarn(
          'ignored-html-preview-region',
          `HTML bundle preview region ${index} was missing id or role and was ignored`,
          `/preview/regions/${index}`,
        ));
      }
      continue;
    }
    regions.push({
      id,
      role,
      ...(typeof region.label === 'string' ? { label: region.label } : {}),
      ...(typeof region.summary === 'string' ? { summary: region.summary } : {}),
    });
  }
  return regions;
}

function partialRegionFallback(region: Record<string, unknown>, index: number): SummonHtmlPreviewRegion | null {
  const id = typeof region.id === 'string' ? region.id.trim() : '';
  const role = typeof region.role === 'string' ? region.role.trim() : '';
  const label = typeof region.label === 'string' ? region.label.trim() : '';
  const summary = typeof region.summary === 'string' ? region.summary.trim() : '';
  const seed = id || label || summary || role;
  if (!seed) return null;
  return {
    id: id || sanitizePreviewRegionId(seed) || `region-${index + 1}`,
    role: role || 'content',
    ...(label ? { label } : {}),
    ...(summary ? { summary } : {}),
  };
}

function regionFallback(value: unknown, index: number): SummonHtmlPreviewRegion | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const id = sanitizePreviewRegionId(trimmed) || `region-${index + 1}`;
  return {
    id,
    role: 'content',
    label: trimmed,
  };
}

function sanitizePreviewRegionId(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  if (/^[a-z]/.test(normalized)) return normalized;
  if (/^[0-9]/.test(normalized)) return `region-${normalized}`.slice(0, 80);
  return '';
}

function validateHtmlFragmentSource(
  html: string,
  options: {
    maxDomDepth: number;
    maxDomNodes: number;
    path: string;
  },
): ContractIssue[] {
  const issues: ContractIssue[] = [];
  let fragment: DefaultTreeAdapterTypes.DocumentFragment;
  try {
    fragment = parseFragment(html, { sourceCodeLocationInfo: false });
  } catch (err) {
    return [htmlIssue('invalid-html-fragment', `HTML fragment could not be parsed: ${err instanceof Error ? err.message : String(err)}`, options.path)];
  }
  let count = 0;
  const walk = (node: DefaultTreeAdapterTypes.Node, depth: number): void => {
    count += 1;
    if (count > options.maxDomNodes) {
      issues.push(htmlIssue('html-dom-limit', `HTML fragment exceeds ${options.maxDomNodes} nodes`, options.path));
      return;
    }
    if (depth > options.maxDomDepth) {
      issues.push(htmlIssue('html-dom-depth-limit', `HTML fragment exceeds depth ${options.maxDomDepth}`, options.path));
      return;
    }
    if (isElementNode(node)) {
      validateElementNode(node, issues, options.path);
    }
    for (const child of childNodes(node)) {
      walk(child, depth + 1);
    }
  };
  walk(fragment, 0);
  return dedupeIssues(issues);
}

function validateElementNode(
  node: DefaultTreeAdapterTypes.Element,
  issues: ContractIssue[],
  path: string,
): void {
  const tag = node.tagName.toLowerCase();
  if (UNSAFE_TAGS.has(tag)) {
    const code = tag === 'script' ? 'static-script' : 'unsafe-tag';
    issues.push(htmlIssue(code, `HTML tag <${tag}> is not allowed in generated HTML`, path));
  }
  for (const attr of node.attrs ?? []) {
    const name = attr.name.toLowerCase();
    if (name.startsWith('on')) {
      issues.push(htmlIssue('inline-handler', `Inline event handler "${name}" is not allowed`, path));
      continue;
    }
    if (!isSupportedAttribute(name)) {
      issues.push(htmlIssue('unsupported-html-attribute', `HTML attribute "${name}" is not supported in generated HTML`, path));
      continue;
    }
    if (URL_ATTRS.has(name)) {
      validateUrlValue(attr.value, `${path}/@${name}`, issues);
    }
    if (SRCSET_ATTRS.has(name)) {
      validateSrcsetValue(attr.value, `${path}/@${name}`, issues);
    }
    if (name === 'style') {
      issues.push(...validateCssSource(`x{${attr.value}}`, {
        maxCssBytes: DEFAULT_VALIDATION_LIMITS.maxCssBytes,
        path: `${path}/@style`,
      }));
    }
  }
  if (STYLE_TAGS.has(tag)) {
    const css = childNodes(node)
      .map((child) => textNodeValue(child))
      .join('');
    issues.push(...validateCssSource(css, {
      maxCssBytes: DEFAULT_VALIDATION_LIMITS.maxCssBytes,
      path,
    }));
  }
  if (RAW_TEXT_TAGS.has(tag) && tag !== 'style' && tag !== 'textarea' && tag !== 'title') {
    issues.push(htmlIssue('unsafe-tag', `Raw text tag <${tag}> is not allowed`, path));
  }
}

function validateCssSource(
  css: string,
  options: {
    maxCssBytes: number;
    path: string;
  },
): ContractIssue[] {
  const issues: ContractIssue[] = [];
  if (byteLength(css) > options.maxCssBytes) {
    issues.push(htmlIssue('html-css-limit', `CSS exceeds ${options.maxCssBytes} bytes`, options.path));
    return issues;
  }
  let root: postcss.Root;
  try {
    root = postcss.parse(css, { from: undefined });
  } catch (err) {
    return [htmlIssue('invalid-css', `CSS could not be parsed: ${err instanceof Error ? err.message : String(err)}`, options.path)];
  }
  root.walkAtRules((rule) => {
    const name = rule.name.toLowerCase();
    if (name === 'import') {
      issues.push(htmlIssue('external-url', '@import is not allowed in generated CSS', options.path));
      return;
    }
    if (!SAFE_AT_RULES.has(name)) {
      issues.push(htmlIssue('unsupported-css-at-rule', `CSS @${rule.name} is not supported in generated CSS`, options.path));
    }
  });
  root.walkDecls((decl) => {
    const prop = decl.prop.toLowerCase();
    if (prop === 'behavior' || prop === '-ms-behavior') {
      issues.push(htmlIssue('unsupported-css-property', `CSS property "${decl.prop}" is not supported`, options.path));
    }
    const parsed = valueParser(decl.value);
    parsed.walk((node) => {
      if (node.type === 'function' && node.value.toLowerCase() === 'url') {
        const url = valueParser.stringify((node as CssValueNode & { nodes?: CssValueNode[] }).nodes ?? []).trim().replace(/^['"]|['"]$/g, '');
        validateUrlValue(url, options.path, issues);
      }
    });
  });
  return dedupeIssues(issues);
}

function validateScriptSource(js: string, path: string): ContractIssue[] {
  const issues: ContractIssue[] = [];
  if (UNSAFE_SCRIPT_RE.test(js)) {
    issues.push(htmlIssue(
      'unsafe-html-script',
      'HTML main.js uses an API outside the scripted iframe experiment allowlist',
      path,
    ));
  }
  return issues;
}

function validateUrlValue(value: string, path: string, issues: ContractIssue[]): void {
  const trimmed = value.trim();
  if (!trimmed) return;
  if (trimmed.startsWith('#')) return;
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('data:font/')) return;
  if (/^(?:https?:|wss?:|ftp:|file:|blob:|\/{2}|\/)/i.test(trimmed)) {
    issues.push(htmlIssue('external-url', `External URL "${preview(trimmed)}" is not allowed`, path));
  }
  if (/^\s*javascript:/i.test(trimmed)) {
    issues.push(htmlIssue('external-url', 'javascript: URLs are not allowed', path));
  }
}

function validateSrcsetValue(value: string, path: string, issues: ContractIssue[]): void {
  for (const candidate of value.split(',')) {
    const url = candidate.trim().split(/\s+/)[0] ?? '';
    validateUrlValue(url, path, issues);
  }
}

function isElementNode(node: DefaultTreeAdapterTypes.Node): node is DefaultTreeAdapterTypes.Element {
  return (node as { nodeName?: unknown }).nodeName === (node as { tagName?: unknown }).tagName &&
    typeof (node as { tagName?: unknown }).tagName === 'string';
}

function childNodes(node: DefaultTreeAdapterTypes.Node): DefaultTreeAdapterTypes.Node[] {
  const children = (node as { childNodes?: DefaultTreeAdapterTypes.Node[] }).childNodes;
  return Array.isArray(children) ? children : [];
}

function textNodeValue(node: DefaultTreeAdapterTypes.Node): string {
  const value = (node as { value?: unknown }).value;
  return typeof value === 'string' ? value : '';
}

function isSupportedAttribute(name: string): boolean {
  return (
    GLOBAL_ATTRS.has(name) ||
    HTML_ATTRS.has(name) ||
    SVG_ATTRS.has(name) ||
    URL_ATTRS.has(name) ||
    SRCSET_ATTRS.has(name) ||
    name.startsWith('aria-') ||
    name.startsWith('data-')
  );
}

function htmlLimits(options: HtmlArtifactValidationOptions): Required<HtmlArtifactValidationOptions> {
  return {
    allowScript: options.allowScript ?? false,
    maxSourceBytes: options.maxSourceBytes ?? DEFAULT_VALIDATION_LIMITS.maxProtocolLineBytes,
    maxCssBytes: options.maxCssBytes ?? DEFAULT_VALIDATION_LIMITS.maxCssBytes,
    maxDomDepth: options.maxDomDepth ?? DEFAULT_VALIDATION_LIMITS.maxDomDepth,
    maxDomNodes: options.maxDomNodes ?? DEFAULT_VALIDATION_LIMITS.maxDomNodes,
  };
}

function htmlIssue(code: string, message: string, path?: string): ContractIssue {
  return contractIssue({
    source: 'html',
    severity: 'block',
    code,
    message,
    path,
  });
}

function htmlWarn(code: string, message: string, path?: string): ContractIssue {
  return contractIssue({
    source: 'html',
    severity: 'warn',
    code,
    message,
    path,
  });
}

function dedupeIssues(issues: ContractIssue[]): ContractIssue[] {
  const seen = new Set<string>();
  const out: ContractIssue[] = [];
  for (const issue of issues) {
    const key = `${issue.source}:${issue.severity}:${issue.code}:${issue.message}:${issue.path ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(issue);
  }
  return out;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function preview(value: string): string {
  return value.length > 80 ? `${value.slice(0, 77)}...` : value;
}
