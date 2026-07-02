const FORBIDDEN_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed']);
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'xlink:href']);
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

export interface HtmlElementTemplateNode {
  kind: 'element';
  tag: string;
  attrs: Record<string, string | boolean>;
  children: HtmlTemplateNode[];
}

export interface HtmlTextTemplateNode {
  kind: 'text';
  text: string;
}

export type HtmlTemplateNode = HtmlElementTemplateNode | HtmlTextTemplateNode;

export interface ParseSurfaceHtmlOptions {
  /** Maximum input size, in UTF-16 code units. */
  maxSourceChars?: number;
  /** Maximum parsed element + text nodes. */
  maxNodes?: number;
  /** Maximum element nesting depth below the root. */
  maxDepth?: number;
}

const DEFAULT_MAX_SOURCE_CHARS = 100_000;
const DEFAULT_MAX_NODES = 2_000;
const DEFAULT_MAX_DEPTH = 64;

interface ParseLimits {
  maxSourceChars: number;
  maxNodes: number;
  maxDepth: number;
  nodes: number;
}

interface StackFrame {
  tag: string;
  children: HtmlTemplateNode[];
}

const NAME_RE = /^[A-Za-z][A-Za-z0-9:-]*$/;
const ATTR_NAME_RE = /^[A-Za-z_:][A-Za-z0-9:_.-]*$/;

export function parseSurfaceHtml(html: string, options: ParseSurfaceHtmlOptions = {}): HtmlTemplateNode[] {
  const limits: ParseLimits = {
    maxSourceChars: options.maxSourceChars ?? DEFAULT_MAX_SOURCE_CHARS,
    maxNodes: options.maxNodes ?? DEFAULT_MAX_NODES,
    maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
    nodes: 0,
  };
  if (html.length > limits.maxSourceChars) {
    throw parseError(`HTML source exceeds ${limits.maxSourceChars} characters`);
  }

  const root: StackFrame = { tag: '#root', children: [] };
  const stack: StackFrame[] = [root];
  let i = 0;

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      appendText(stack, html.slice(i), limits);
      break;
    }
    appendText(stack, html.slice(i, lt), limits);

    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      if (end === -1) throw parseError('Unclosed HTML comment');
      i = end + 3;
      continue;
    }
    if (html.startsWith('</', lt)) {
      const end = html.indexOf('>', lt + 2);
      if (end === -1) throw parseError('Unclosed closing tag');
      const raw = html.slice(lt + 2, end).trim();
      if (!NAME_RE.test(raw)) throw parseError(`Invalid closing tag </${raw}>`);
      const tag = raw.toLowerCase();
      const frame = stack.pop();
      if (!frame || frame.tag !== tag) throw parseError(`Unexpected closing tag </${tag}>`);
      i = end + 1;
      continue;
    }
    if (html.startsWith('<!', lt) || html.startsWith('<?', lt)) {
      throw parseError('Declarations and processing instructions are not supported');
    }

    const parsed = readOpeningTag(html, lt);
    const tag = parsed.tag.toLowerCase();
    if (FORBIDDEN_TAGS.has(tag)) throw parseError(`Forbidden HTML tag <${tag}>`);
    bumpNode(limits);
    const node: HtmlElementTemplateNode = { kind: 'element', tag, attrs: parsed.attrs, children: [] };
    stack[stack.length - 1]!.children.push(node);
    if (!parsed.selfClosing && !VOID_TAGS.has(tag)) {
      if (stack.length > limits.maxDepth) throw parseError(`HTML exceeds maximum depth ${limits.maxDepth}`);
      stack.push({ tag, children: node.children });
    }
    i = parsed.end + 1;
  }

  if (stack.length !== 1) throw parseError(`Unclosed tag <${stack[stack.length - 1]!.tag}>`);
  return root.children;
}

function appendText(stack: StackFrame[], raw: string, limits: ParseLimits): void {
  if (raw.length === 0) return;
  const text = decodeEntities(raw);
  if (text.length > 0) {
    bumpNode(limits);
    stack[stack.length - 1]!.children.push({ kind: 'text', text });
  }
}

function bumpNode(limits: ParseLimits): void {
  limits.nodes += 1;
  if (limits.nodes > limits.maxNodes) throw parseError(`HTML exceeds maximum node count ${limits.maxNodes}`);
}

function readOpeningTag(html: string, start: number): { tag: string; attrs: Record<string, string | boolean>; selfClosing: boolean; end: number } {
  let i = start + 1;
  i = skipWs(html, i);
  const nameStart = i;
  while (i < html.length && /[A-Za-z0-9:-]/.test(html[i]!)) i += 1;
  const tag = html.slice(nameStart, i);
  if (!NAME_RE.test(tag)) throw parseError('Invalid opening tag');

  const attrs: Record<string, string | boolean> = {};
  let selfClosing = false;
  while (i < html.length) {
    i = skipWs(html, i);
    const ch = html[i];
    if (ch === '>') return { tag, attrs, selfClosing, end: i };
    if (ch === '/' && html[i + 1] === '>') {
      selfClosing = true;
      return { tag, attrs, selfClosing, end: i + 1 };
    }
    const parsed = readAttribute(html, i);
    validateAttribute(parsed.name, parsed.value);
    attrs[parsed.name] = parsed.value;
    i = parsed.end;
  }
  throw parseError(`Unclosed tag <${tag}>`);
}

function readAttribute(html: string, start: number): { name: string; value: string | boolean; end: number } {
  let i = start;
  const nameStart = i;
  while (i < html.length && /[^\s=/>]/.test(html[i]!)) i += 1;
  const name = html.slice(nameStart, i).toLowerCase();
  if (!ATTR_NAME_RE.test(name)) throw parseError(`Invalid attribute name "${name}"`);
  i = skipWs(html, i);
  if (html[i] !== '=') return { name, value: true, end: i };
  i = skipWs(html, i + 1);
  const quote = html[i];
  if (quote === '"' || quote === "'") {
    const end = html.indexOf(quote, i + 1);
    if (end === -1) throw parseError(`Unclosed attribute "${name}"`);
    return { name, value: decodeEntities(html.slice(i + 1, end)), end: end + 1 };
  }
  const valueStart = i;
  while (i < html.length && /[^\s>]/.test(html[i]!)) i += 1;
  if (i === valueStart) throw parseError(`Missing value for attribute "${name}"`);
  return { name, value: decodeEntities(html.slice(valueStart, i)), end: i };
}

function validateAttribute(name: string, value: string | boolean): void {
  if (name.startsWith('on')) throw parseError(`Forbidden inline event attribute "${name}"`);
  if (typeof value === 'string' && URL_ATTRS.has(name) && /^\s*javascript:/i.test(value)) {
    throw parseError(`Forbidden javascript: URL in attribute "${name}"`);
  }
}

function skipWs(input: string, i: number): number {
  while (i < input.length && /\s/.test(input[i]!)) i += 1;
  return i;
}

function decodeEntities(input: string): string {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseError(message: string): Error {
  return new Error(`surface-document: ${message}`);
}
