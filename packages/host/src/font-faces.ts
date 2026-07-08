/**
 * Host-owned @font-face installation.
 *
 * Fonts are host design material, the same trust class as `tokensSource` —
 * the model never authors them. Two mechanics force this module's shape:
 *
 * 1. `@font-face` is document-scoped. Declared inside a shadow root it loads
 *    nothing (CSSWG resolution; all major engines), so faces must be
 *    installed into `document.head` while font *usage* (`font-family` via
 *    tokens) stays inside the surface's shadow root.
 * 2. `fontFacesSource` is trusted by contract, but hosts will pipe
 *    fingerprint-bundle content into it. Sanitizing to @font-face blocks only
 *    keeps a sloppy or compromised bundle from smuggling document-level CSS
 *    (selectors, imports, other at-rules) through the font channel — the one
 *    injection path this feature would otherwise create.
 *
 * Installation is deduplicated and refcounted by content hash, not surface
 * id: two live surfaces sharing a fingerprint share one style element, and
 * disposal removes it only when the last user is gone.
 */

const FONT_STYLE_ATTR = 'data-summon-font-faces';

interface FontFaceRegistryEntry {
  element: HTMLStyleElement;
  refCount: number;
}

/** Per-document registries so SSR/multi-document hosts do not cross wires. */
const registries = new WeakMap<Document, Map<string, FontFaceRegistryEntry>>();

/**
 * Extract only the `@font-face { ... }` blocks from a stylesheet. Everything
 * else — selectors, `@import`, `@media`, nested at-rules — is dropped.
 * Comments are stripped first so a commented-out brace cannot desync block
 * matching. Returns the blocks joined, or '' when none survive.
 */
export function sanitizeFontFacesCss(source: string): string {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks: string[] = [];
  const re = /@font-face\s*\{/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(stripped)) !== null) {
    const open = match.index + match[0].length - 1;
    const close = matchBrace(stripped, open);
    if (close === -1) break;
    const body = stripped.slice(open + 1, close);
    // A font-face body contains declarations only; a brace inside means a
    // nested construct we did not model — drop the block rather than guess.
    if (body.includes('{')) {
      re.lastIndex = close + 1;
      continue;
    }
    blocks.push(`@font-face {${body}}`);
    re.lastIndex = close + 1;
  }
  return blocks.join('\n');
}

function matchBrace(text: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    const char = text[i];
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Stable content hash (djb2) for dedup keys; not security-bearing. */
function hashContent(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

export interface InstalledFontFaces {
  /** Dedup key; identical sanitized CSS shares one style element. */
  key: string;
  /** Decrement the refcount; removes the style element at zero. Idempotent. */
  release(): void;
}

/**
 * Install sanitized @font-face CSS into the document head. Returns null when
 * nothing survives sanitization. Safe to call repeatedly with the same CSS —
 * subsequent installs share the element and bump the refcount.
 */
export function installFontFaces(
  source: string | null | undefined,
  doc: Document = document,
): InstalledFontFaces | null {
  const sanitized = source ? sanitizeFontFacesCss(source) : '';
  if (!sanitized) return null;

  let registry = registries.get(doc);
  if (!registry) {
    registry = new Map();
    registries.set(doc, registry);
  }

  const key = hashContent(sanitized);
  let entry = registry.get(key);
  if (entry && entry.element.isConnected) {
    entry.refCount += 1;
  } else {
    const element = doc.createElement('style');
    element.setAttribute(FONT_STYLE_ATTR, key);
    element.textContent = sanitized;
    doc.head.append(element);
    entry = { element, refCount: 1 };
    registry.set(key, entry);
  }

  let released = false;
  return {
    key,
    release() {
      if (released) return;
      released = true;
      const current = registry!.get(key);
      if (!current) return;
      current.refCount -= 1;
      if (current.refCount <= 0) {
        current.element.remove();
        registry!.delete(key);
      }
    },
  };
}
