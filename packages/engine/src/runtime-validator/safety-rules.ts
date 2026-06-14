import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import type { ScriptPolicy } from '../prompt.js';
import type { ContractIssue } from '../contracts.js';
import type { ValidationLimits } from '../validation-limits.js';
import { validateSurfaceCapability } from './capabilities.js';
import { block, byteLength } from './issues.js';
import type {
  HtmlOpenToken,
  RuntimeCapability,
  ValidationContext,
} from './types.js';

const UNSAFE_TAGS = new Set([
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'base',
  'frame',
  'frameset',
  'portal',
]);
const URL_ATTRS = new Set(['src', 'href', 'action', 'poster', 'srcset']);
const EMIT_LITERAL_RE = /\bsandbox\.emit\s*\(\s*(['"])([a-zA-Z][a-zA-Z0-9_]{0,39})\1/g;
const ALLOWED_AT_RULES = new Set([
  'media',
  'container',
  'supports',
  'keyframes',
  '-webkit-keyframes',
]);

export function scanElementSafety(
  elements: HtmlOpenToken[],
  context: ValidationContext,
  issues: ContractIssue[],
): void {
  if (elements.some((element) => UNSAFE_TAGS.has(element.tagName))) {
    issues.push(block('unsafe-tag', 'HTML contains a tag that is not allowed in Summon artifacts'));
  }
  const hasScriptTag = elements.some((element) => element.tagName === 'script');
  if (context.mode === 'static' && hasScriptTag) {
    issues.push(block('static-script', 'Static generations cannot include script tags'));
  } else if (effectiveScriptPolicy(context) === 'forbid' && hasScriptTag) {
    issues.push(block('script-not-granted', 'This generation is declarative-only; script tags are not granted'));
  }
  if (elements.some((element) => hasInlineHandler(element.attrs))) {
    issues.push(block('inline-handler', 'Inline event-handler attributes are not allowed'));
  }
}

export function scanUrlAttributes(elements: HtmlOpenToken[], issues: ContractIssue[]): void {
  for (const element of elements) {
    for (const [attr, rawValue] of element.attrs) {
      if (!URL_ATTRS.has(attr)) continue;
      const value = rawValue.trim();
      if (!value) continue;
      if (attr === 'srcset') {
        for (const part of value.split(',')) {
          const candidate = part.trim().split(/\s+/, 1)[0] ?? '';
          if (isBlockedUrl(candidate, true)) {
            issues.push(block('external-url', `External asset URL is not allowed: ${candidate}`));
          }
        }
        continue;
      }
      const isAsset = attr !== 'href';
      if (isBlockedUrl(value, isAsset)) {
        issues.push(block('external-url', `External URL is not allowed: ${value}`));
      }
    }
  }
}

export function scanCss(
  cssSources: string[],
  limits: ValidationLimits,
  issues: ContractIssue[],
): void {
  for (const css of cssSources) {
    if (!css.trim()) continue;
    if (byteLength(css) > limits.maxCssBytes) {
      issues.push(block('css-size-limit', `Inline CSS exceeds ${limits.maxCssBytes} bytes`));
      continue;
    }
    let root: postcss.Root;
    try {
      root = postcss.parse(css);
    } catch {
      issues.push(block('invalid-css', 'Inline CSS could not be parsed'));
      continue;
    }
    root.walkAtRules((rule) => {
      const name = rule.name.toLowerCase();
      if (name === 'import') {
        issues.push(block('css-import', 'External CSS imports are not allowed'));
      } else if (!ALLOWED_AT_RULES.has(name)) {
        issues.push(block('css-at-rule', `CSS @${rule.name} rules are not allowed`));
      }
      scanCssValue(rule.params, issues);
    });
    root.walkDecls((decl) => {
      scanCssValue(decl.value, issues);
    });
  }
}

export function scanSandboxEmit(
  html: string,
  capabilityMap: Map<string, RuntimeCapability>,
  context: ValidationContext,
  issues: ContractIssue[],
): void {
  let match: RegExpExecArray | null;
  EMIT_LITERAL_RE.lastIndex = 0;
  while ((match = EMIT_LITERAL_RE.exec(html)) !== null) {
    const intent = match[2]!;
    const capability = capabilityMap.get(intent);
    if (!capability) {
      issues.push(block('unknown-intent', `Intent "${intent}" is not granted`));
    } else {
      validateSurfaceCapability(capability, context, issues);
    }
  }
}

function effectiveScriptPolicy(_context: ValidationContext): ScriptPolicy {
  return 'forbid';
}

function hasInlineHandler(attrs: Map<string, string>): boolean {
  for (const attr of attrs.keys()) {
    if (/^on[a-z]+$/.test(attr)) return true;
  }
  return false;
}

export function isBlockedUrl(value: string, isAsset: boolean): boolean {
  const url = value.trim().toLowerCase();
  if (!url || url.startsWith('#')) return false;
  if (url.startsWith('data:')) return false;
  if (url.startsWith('javascript:')) return true;
  if (/^[a-z][a-z0-9+.-]*:/.test(url)) return true;
  if (url.startsWith('//')) return true;
  return isAsset;
}

function scanCssValue(value: string, issues: ContractIssue[]): void {
  const parsed = valueParser(value);
  parsed.walk((node) => {
    if (node.type !== 'function') return;
    if (cssIdent(node.value) !== 'url') return;
    const raw = valueParser.stringify(node.nodes).trim().replace(/^['"]|['"]$/g, '');
    const decoded = cssIdent(raw).trim();
    if (isBlockedUrl(decoded, true)) {
      issues.push(block('external-url', `External CSS asset URL is not allowed: ${decoded}`));
    }
  });
}

function cssIdent(value: string): string {
  return value
    .replace(/\\([0-9a-fA-F]{1,6}\s?|.)/g, (_, escaped: string) => {
      const hex = escaped.trim();
      if (/^[0-9a-fA-F]+$/.test(hex)) {
        return String.fromCodePoint(Number.parseInt(hex, 16));
      }
      return escaped;
    })
    .toLowerCase();
}
