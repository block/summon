import type { ContractIssue } from '../contracts.js';
import type { ValidationLimits } from '../validation-limits.js';
import { block } from './issues.js';
import type {
  HtmlOpenToken,
  HtmlTraversalToken,
  ParsedHtmlFragment,
} from './types.js';

const HTML_TOKEN_RE =
  /<!--[\s\S]*?-->|<![^>]*>|<\/?[a-zA-Z][\w:-]*(?:\s+[^<>]*?)?\s*\/?>/g;
const HTML_TAG_NAME_RE = /^<\s*\/?\s*([a-zA-Z][\w:-]*)/;
const HTML_ATTR_RE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

export function parseHtmlForValidation(
  html: string,
  limits: ValidationLimits,
  issues: ContractIssue[],
): ParsedHtmlFragment {
  const tokens: HtmlTraversalToken[] = [];
  const elements: HtmlOpenToken[] = [];
  const cssSources: string[] = [];
  const stack: string[] = [];
  let nodeCount = 0;
  let reportedDepth = false;
  let reportedNodes = false;
  let match: RegExpExecArray | null;

  HTML_TOKEN_RE.lastIndex = 0;
  while ((match = HTML_TOKEN_RE.exec(html)) !== null) {
    const rawTag = match[0]!;
    if (rawTag.startsWith('<!--') || rawTag.startsWith('<!')) continue;
    const tagName = rawTag.match(HTML_TAG_NAME_RE)?.[1]?.toLowerCase();
    if (!tagName) continue;
    const closing = /^<\s*\//.test(rawTag);

    if (closing) {
      tokens.push({ kind: 'close', tagName });
      popName(stack, tagName);
      continue;
    }

    nodeCount += 1;
    if (!reportedNodes && nodeCount > limits.maxDomNodes) {
      reportedNodes = true;
      issues.push(block('dom-node-limit', `HTML exceeds ${limits.maxDomNodes} nodes`));
    }
    const depth = stack.length + 1;
    if (!reportedDepth && depth > limits.maxDomDepth) {
      reportedDepth = true;
      issues.push(block('dom-depth-limit', `HTML exceeds DOM depth ${limits.maxDomDepth}`));
    }

    const attrs = parseHtmlAttrs(rawTag);
    const selfClosing = /\/\s*>$/.test(rawTag) || VOID_TAGS.has(tagName);
    const token: HtmlOpenToken = { kind: 'open', tagName, attrs, selfClosing };
    tokens.push(token);
    elements.push(token);
    const styleAttr = attrs.get('style');
    if (styleAttr) cssSources.push(styleAttr);
    if (tagName === 'style') {
      const closeIndex = html.toLowerCase().indexOf('</style', HTML_TOKEN_RE.lastIndex);
      if (closeIndex >= 0) cssSources.push(html.slice(HTML_TOKEN_RE.lastIndex, closeIndex));
    }
    if (!selfClosing) stack.push(tagName);
  }

  return { tokens, elements, cssSources };
}

function parseHtmlAttrs(rawTag: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const tagName = rawTag.match(HTML_TAG_NAME_RE)?.[1];
  if (!tagName) return attrs;
  const source = rawTag
    .slice(rawTag.indexOf(tagName) + tagName.length, rawTag.lastIndexOf('>'))
    .replace(/\/\s*$/, '');
  let match: RegExpExecArray | null;
  HTML_ATTR_RE.lastIndex = 0;
  while ((match = HTML_ATTR_RE.exec(source)) !== null) {
    const name = match[1]?.toLowerCase();
    if (!name) continue;
    attrs.set(name, match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attrs;
}

function popName(stack: string[], tagName: string): void {
  for (let i = stack.length - 1; i >= 0; i--) {
    const frame = stack.pop();
    if (frame === tagName) return;
  }
}
