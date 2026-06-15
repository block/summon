import {
  parseFragment,
  serialize,
  type DefaultTreeAdapterTypes,
} from 'parse5';
import type { ContractIssue } from '../contracts.js';
import type { ValidationLimits } from '../validation-limits.js';
import { block } from './issues.js';
import type {
  CompiledArtifactHtml,
  HtmlOpenToken,
  HtmlTraversalToken,
  ParsedHtmlFragment,
} from './types.js';

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
  let fragment: DefaultTreeAdapterTypes.DocumentFragment;
  try {
    fragment = parseFragment(html);
  } catch {
    issues.push(block('invalid-html', 'HTML could not be parsed'));
    return {
      tokens: [],
      elements: [],
      cssSources: [],
      canonicalHtml: '' as CompiledArtifactHtml,
    };
  }

  const tokens: HtmlTraversalToken[] = [];
  const elements: HtmlOpenToken[] = [];
  const cssSources: string[] = [];
  let nodeCount = 0;
  let reportedDepth = false;
  let reportedNodes = false;

  const visitChildren = (parent: DefaultTreeAdapterTypes.ParentNode, depth: number): void => {
    const children = childNodesFor(parent);
    for (const child of children) {
      if (!isElement(child)) continue;
      const tagName = child.tagName.toLowerCase();
      nodeCount += 1;
      if (!reportedNodes && nodeCount > limits.maxDomNodes) {
        reportedNodes = true;
        issues.push(block('dom-node-limit', `HTML exceeds ${limits.maxDomNodes} nodes`));
      }
      if (!reportedDepth && depth + 1 > limits.maxDomDepth) {
        reportedDepth = true;
        issues.push(block('dom-depth-limit', `HTML exceeds DOM depth ${limits.maxDomDepth}`));
      }

      const attrs = attrsFor(child);
      const selfClosing = VOID_TAGS.has(tagName);
      const token: HtmlOpenToken = { kind: 'open', tagName, attrs, selfClosing };
      tokens.push(token);
      elements.push(token);

      const styleAttr = attrs.get('style');
      if (styleAttr) cssSources.push(styleAttr);
      if (tagName === 'style') {
        cssSources.push(textContent(child));
      }

      if (!selfClosing) {
        visitChildren(child, depth + 1);
        tokens.push({ kind: 'close', tagName });
      }
    }
  };

  visitChildren(fragment, 0);

  return {
    tokens,
    elements,
    cssSources,
    canonicalHtml: serialize(fragment) as CompiledArtifactHtml,
  };
}

function childNodesFor(parent: DefaultTreeAdapterTypes.ParentNode): DefaultTreeAdapterTypes.ChildNode[] {
  if (isTemplate(parent)) return parent.content.childNodes;
  return parent.childNodes;
}

function attrsFor(element: DefaultTreeAdapterTypes.Element): Map<string, string> {
  const attrs = new Map<string, string>();
  for (const attr of element.attrs) {
    attrs.set(attr.name.toLowerCase(), attr.value);
  }
  return attrs;
}

function textContent(parent: DefaultTreeAdapterTypes.ParentNode): string {
  let out = '';
  for (const child of childNodesFor(parent)) {
    if (isText(child)) out += child.value;
    if (isElement(child)) out += textContent(child);
  }
  return out;
}

function isElement(node: DefaultTreeAdapterTypes.ChildNode): node is DefaultTreeAdapterTypes.Element {
  return 'tagName' in node;
}

function isText(node: DefaultTreeAdapterTypes.ChildNode): node is DefaultTreeAdapterTypes.TextNode {
  return node.nodeName === '#text';
}

function isTemplate(node: DefaultTreeAdapterTypes.ParentNode): node is DefaultTreeAdapterTypes.Template {
  return 'tagName' in node && node.tagName.toLowerCase() === 'template' && 'content' in node;
}
