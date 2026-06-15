import type { ContractIssue } from '../contracts.js';
import { normalizeValidationLimits } from '../validation-limits.js';
import {
  scanIntentBindings,
  scanResourceAndAttributeBindings,
} from './binding-rules.js';
import { buildCapabilityMap } from './capabilities.js';
import {
  buildComponentMap,
  scanComponentBindings,
} from './component-rules.js';
import { parseHtmlForValidation } from './html-parser.js';
import {
  block,
  byteLength,
  dedupeIssues,
} from './issues.js';
import {
  scanCss,
  scanElementSafety,
  scanSandboxEmit,
  scanUrlAttributes,
} from './safety-rules.js';
import {
  scanStyleDrift,
  scanTokenReferences,
} from './style-rules.js';
import type { ValidationContext } from './types.js';
import type {
  ArtifactCompileResult,
  CompiledArtifactHtml,
  HtmlOpenToken,
} from './types.js';

export const ARTIFACT_COMPILER_VERSION = 'summon-artifact-compiler-v2';

export function validateHtmlFragment(
  html: string,
  context: ValidationContext,
): ContractIssue[] {
  return compileArtifactHtml(html, context).issues;
}

export function compileArtifactHtml(
  html: string,
  context: ValidationContext,
): ArtifactCompileResult {
  const issues: ContractIssue[] = [];
  const capabilityMap = buildCapabilityMap(context);
  const componentMap = buildComponentMap(context);
  const limits = normalizeValidationLimits(context.limits);

  if (byteLength(html) > limits.maxSectionHtmlBytes) {
    issues.push(
      block(
        'section-html-limit',
        `Section HTML exceeds ${limits.maxSectionHtmlBytes} bytes`,
      ),
    );
    return compileResult('' as CompiledArtifactHtml, issues);
  }

  const parsed = parseHtmlForValidation(html, limits, issues);

  scanArtifactPolicy(parsed.elements, context, issues);
  scanElementSafety(parsed.elements, context, issues);
  scanUrlAttributes(parsed.elements, issues);
  scanCss(parsed.cssSources, limits, issues);
  scanIntentBindings(parsed.elements, capabilityMap, context, issues);
  scanResourceAndAttributeBindings(parsed.tokens, capabilityMap, context, issues);
  scanComponentBindings(parsed.tokens, componentMap, context, issues);
  scanSandboxEmit(html, capabilityMap, context, issues);
  scanTokenReferences(parsed.canonicalHtml, context.definedTokens, issues);
  scanStyleDrift(parsed.canonicalHtml, issues);

  return compileResult(parsed.canonicalHtml, dedupeIssues(issues));
}

function compileResult(html: CompiledArtifactHtml, issues: ContractIssue[]): ArtifactCompileResult {
  return {
    html,
    issues,
    compilerVersion: ARTIFACT_COMPILER_VERSION,
  };
}

const ALLOWED_HTML_TAGS = new Set([
  'a',
  'abbr',
  'address',
  'article',
  'aside',
  'b',
  'blockquote',
  'br',
  'button',
  'caption',
  'cite',
  'code',
  'col',
  'colgroup',
  'data',
  'dd',
  'del',
  'details',
  'dfn',
  'dialog',
  'div',
  'dl',
  'dt',
  'em',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'i',
  'img',
  'input',
  'ins',
  'kbd',
  'label',
  'legend',
  'li',
  'main',
  'mark',
  'meter',
  'nav',
  'ol',
  'optgroup',
  'option',
  'output',
  'p',
  'pre',
  'progress',
  'q',
  's',
  'samp',
  'section',
  'select',
  'small',
  'span',
  'strong',
  'style',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'template',
  'textarea',
  'tfoot',
  'th',
  'thead',
  'time',
  'tr',
  'u',
  'ul',
  'var',
]);

const ALLOWED_SVG_TAGS = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'title',
  'desc',
]);

const TAGS_WITH_URL_ATTRS = new Set(['a', 'img', 'svg', 'use']);

const GLOBAL_ATTRS = new Set([
  'class',
  'id',
  'style',
  'title',
  'role',
  'tabindex',
  'hidden',
  'aria-hidden',
  'aria-live',
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
  'aria-expanded',
  'aria-controls',
  'aria-current',
  'aria-selected',
  'aria-disabled',
  'aria-pressed',
]);

const HTML_ATTRS = new Map<string, Set<string>>([
  ['a', new Set(['href', 'target', 'rel'])],
  ['button', new Set(['type', 'name', 'value', 'disabled', 'aria-label'])],
  ['col', new Set(['span'])],
  ['colgroup', new Set(['span'])],
  ['data', new Set(['value'])],
  ['form', new Set(['name', 'autocomplete'])],
  ['img', new Set(['src', 'srcset', 'alt', 'width', 'height', 'loading', 'decoding'])],
  ['input', new Set(['type', 'name', 'value', 'placeholder', 'disabled', 'checked', 'required', 'readonly', 'min', 'max', 'step', 'pattern', 'autocomplete', 'inputmode', 'aria-label'])],
  ['label', new Set(['for'])],
  ['meter', new Set(['value', 'min', 'max', 'low', 'high', 'optimum'])],
  ['option', new Set(['value', 'selected', 'disabled'])],
  ['optgroup', new Set(['label', 'disabled'])],
  ['progress', new Set(['value', 'max'])],
  ['select', new Set(['name', 'disabled', 'required', 'multiple', 'size', 'aria-label'])],
  ['td', new Set(['colspan', 'rowspan', 'headers'])],
  ['textarea', new Set(['name', 'placeholder', 'disabled', 'required', 'readonly', 'rows', 'cols', 'maxlength', 'aria-label'])],
  ['th', new Set(['colspan', 'rowspan', 'headers', 'scope'])],
  ['time', new Set(['datetime'])],
]);

const SVG_ATTRS = new Set([
  'aria-label',
  'cx',
  'cy',
  'd',
  'dx',
  'dy',
  'fill',
  'fill-opacity',
  'height',
  'points',
  'r',
  'rx',
  'ry',
  'stroke',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-opacity',
  'stroke-width',
  'text-anchor',
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

const SUMMON_ATTRS = new Set([
  'data-summon-args',
  'data-summon-as',
  'data-summon-bind',
  'data-summon-block',
  'data-summon-component',
  'data-summon-component-id',
  'data-summon-foreach',
  'data-summon-hide',
  'data-summon-local',
  'data-summon-motion',
  'data-summon-node',
  'data-summon-node-children',
  'data-summon-on-click',
  'data-summon-on-mount',
  'data-summon-on-submit',
  'data-summon-props',
  'data-summon-resource',
  'data-summon-resource-as',
  'data-summon-resource-trigger',
  'data-summon-section',
  'data-summon-set',
  'data-summon-show',
  'data-summon-skeleton',
  'data-summon-toggle',
  'data-summon-transition',
]);

const SAFE_TAG_RE = /^[a-z][a-z0-9]*$/;
const SAFE_CLASS_RE = /^[A-Za-z][\w-]{0,63}$/;
const CONDITION_RE = /^!?\$?[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:\s*(?:==|!=)\s*(?:"[^"]*"|'[^']*'))?$/;
const MOTION_RECIPES = new Set(['rise', 'fade', 'fade-slide', 'pulse', 'pop']);
const TRANSITION_RECIPES = new Set(['rise', 'fade', 'fade-slide', 'pop']);

function scanArtifactPolicy(
  elements: HtmlOpenToken[],
  context: ValidationContext,
  issues: ContractIssue[],
): void {
  if (
    context.scriptPolicy === 'allow' ||
    (context.surfacePlan as { runtime?: string } | undefined)?.runtime === 'scripted'
  ) {
    issues.push(block(
      'surface-script-policy-removed',
      'Generated script surfaces are no longer supported; use declarative data-summon attributes',
    ));
  }
  for (const element of elements) {
    validateAllowedTag(element, issues);
    validateAllowedAttributes(element, issues);
  }
}

function validateAllowedTag(element: HtmlOpenToken, issues: ContractIssue[]): void {
  if (ALLOWED_HTML_TAGS.has(element.tagName) || ALLOWED_SVG_TAGS.has(element.tagName)) return;
  if (element.tagName === 'script') return;
  if (!SAFE_TAG_RE.test(element.tagName) || element.tagName.includes('-')) {
    issues.push(block('unsafe-tag', `Custom element <${element.tagName}> is not allowed`));
    return;
  }
  issues.push(block('unsafe-tag', `HTML tag <${element.tagName}> is not allowed in Summon artifacts`));
}

function validateAllowedAttributes(element: HtmlOpenToken, issues: ContractIssue[]): void {
  for (const [attr, value] of element.attrs) {
    if (/^on[a-z]+$/.test(attr)) continue;
    if (isAllowedSummonAttr(attr)) {
      validateSummonAttr(attr, value, issues);
      continue;
    }
    if (attr.startsWith('data-summon-')) {
      issues.push(block('unknown-summon-attribute', `Unknown Summon attribute "${attr}"`));
      continue;
    }
    if (attr.startsWith('data-')) {
      issues.push(block('unsafe-attribute', `Generated data attribute "${attr}" is not allowed`));
      continue;
    }
    if (GLOBAL_ATTRS.has(attr) || attr.startsWith('aria-')) continue;
    if (ALLOWED_SVG_TAGS.has(element.tagName) && SVG_ATTRS.has(attr)) continue;
    if (HTML_ATTRS.get(element.tagName)?.has(attr)) continue;
    if (TAGS_WITH_URL_ATTRS.has(element.tagName) && (attr === 'href' || attr === 'src')) continue;
    issues.push(block('unsafe-attribute', `Attribute "${attr}" is not allowed on <${element.tagName}>`));
  }
}

function isAllowedSummonAttr(attr: string): boolean {
  return SUMMON_ATTRS.has(attr) ||
    attr.startsWith('data-summon-attr-') ||
    attr.startsWith('data-summon-class-');
}

function validateSummonAttr(attr: string, value: string, issues: ContractIssue[]): void {
  if (attr === 'data-summon-local') {
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        issues.push(block('invalid-local-state', '`data-summon-local` must be a JSON object'));
      }
    } catch {
      issues.push(block('invalid-local-state', '`data-summon-local` must be valid JSON'));
    }
  }
  if (
    attr === 'data-summon-show' ||
    attr === 'data-summon-hide' ||
    attr === 'data-summon-attr-disabled'
  ) {
    validateConditionExpression(attr, value, issues);
  }
  if (attr.startsWith('data-summon-class-')) {
    const className = attr.slice('data-summon-class-'.length);
    if (!SAFE_CLASS_RE.test(className)) {
      issues.push(block('invalid-class-binding', `Class binding "${attr}" has an invalid class name`));
    }
    validateConditionExpression(attr, value, issues);
  }
  if (attr === 'data-summon-motion') {
    for (const part of value.split(';')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const match = trimmed.match(/^(enter|update):([a-z][a-z0-9-]{0,31})$/);
      if (!match) {
        issues.push(block('invalid-motion', '`data-summon-motion` must use enter:<recipe> or update:<recipe> entries'));
        continue;
      }
      const recipe = match[2]!;
      if (!MOTION_RECIPES.has(recipe)) {
        issues.push(block('invalid-motion', `Unknown motion recipe "${recipe}"`));
      }
    }
  }
  if (attr === 'data-summon-transition') {
    const recipe = value.trim();
    if (!/^[a-z][a-z0-9-]{0,31}$/.test(recipe) || !TRANSITION_RECIPES.has(recipe)) {
      issues.push(block('invalid-transition', '`data-summon-transition` must name a supported transition recipe'));
    }
  }
  if (attr === 'data-summon-set' && !/^[A-Za-z_$][\w$]{0,39}\s*=\s*[^=].{0,80}$/.test(value.trim())) {
    issues.push(block('invalid-local-state-action', '`data-summon-set` must use key=value syntax'));
  }
  if (attr === 'data-summon-toggle' && !/^[A-Za-z_$][\w$]{0,39}$/.test(value.trim())) {
    issues.push(block('invalid-local-state-action', '`data-summon-toggle` must name one local state key'));
  }
}

function validateConditionExpression(attr: string, value: string, issues: ContractIssue[]): void {
  const condition = value.trim();
  if (!condition || !CONDITION_RE.test(condition)) {
    issues.push(block(
      'invalid-condition',
      `"${attr}" must be a truthy path, !path, path == "literal", or path != "literal"`,
    ));
  }
}
