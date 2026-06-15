import {
  blockTargetFromPath,
  htmlNodePatchFromLine,
  sectionIdFromSectionPath,
  type HtmlNodePatch,
  type ProtocolLine,
} from './protocol.js';

export interface SectionSnapshotEntry {
  id: string;
  html: string;
}

export interface SectionAccumulatorSnapshot {
  sections: SectionSnapshotEntry[];
}

export type SectionApplyKind = 'screen' | 'section' | 'none';

export interface SectionApplyResult {
  changed: boolean;
  kind: SectionApplyKind;
  sectionId?: string;
  blockId?: string;
  nodeId?: string;
  nodePatch?: HtmlNodePatch;
  orderChanged?: boolean;
  htmlChanged?: boolean;
  blockChanged?: boolean;
  nodeChanged?: boolean;
}

type OpaqueSectionState = {
  kind: 'opaque';
  html: string;
};

type BlockSectionState = {
  kind: 'blocks';
  blockOrder: string[];
  blockMap: Map<string, string>;
};

type HtmlNodeEntry = {
  html: string;
  parentId?: string;
};

type HtmlNodeSectionState = {
  kind: 'nodes';
  nodeOrder: string[];
  nodeMap: Map<string, HtmlNodeEntry>;
};

type SectionState = OpaqueSectionState | BlockSectionState | HtmlNodeSectionState;

/**
 * Applies streaming protocol lines into a mutable section map. Call compose()
 * to produce the HTML payload the host pushes to the sandbox.
 *
 * Sections are variable: the LLM declares structure via `set /screen`
 * (e.g., `{sections: ["hero","itinerary","budget"]}`). If a section is added
 * that wasn't declared, it's appended to the order — forgiving in case the
 * LLM skips the declaration line.
 */
export class SectionAccumulator {
  private sectionMap: Map<string, SectionState> = new Map();
  private sectionOrder: string[] = [];

  /** Returns true if the line changed state (for change detection in render loops). */
  apply(line: ProtocolLine): boolean {
    return this.applyDetailed(line).changed;
  }

  applyDetailed(line: ProtocolLine): SectionApplyResult {
    if (line.op === 'set' && line.path === '/screen') {
      const val = line.value as { sections?: unknown } | undefined;
      if (val && Array.isArray(val.sections)) {
        const next = val.sections.filter((s): s is string => typeof s === 'string');
        if (next.length > 0) {
          const changed = !sameOrder(this.sectionOrder, next);
          this.sectionOrder = next;
          return { changed, kind: 'screen', orderChanged: changed };
        }
      }
      return { changed: false, kind: 'none' };
    }

    if (line.op === 'set' && line.path.startsWith('/section/')) {
      const id = sectionIdFromSectionPath(line.path);
      if (!id) return { changed: false, kind: 'none' };
      const value = line.value as { blocks?: unknown } | undefined;
      if (!value || !Array.isArray(value.blocks)) return { changed: false, kind: 'none' };
      const next = value.blocks.filter((block): block is string => typeof block === 'string');
      if (next.length === 0) return { changed: false, kind: 'none' };

      const prev = this.sectionMap.get(id);
      const prevOrder = prev?.kind === 'blocks' ? prev.blockOrder : [];
      const changed = prev?.kind !== 'blocks' || !sameOrder(prevOrder, next);
      const state = this.ensureBlockSection(id);
      state.blockOrder = next;
      for (const blockId of Array.from(state.blockMap.keys())) {
        if (!next.includes(blockId)) state.blockMap.delete(blockId);
      }
      return {
        changed,
        kind: 'section',
        sectionId: id,
        orderChanged: changed,
      };
    }

    if (line.op === 'add' && line.path.startsWith('/section/')) {
      const nodePatch = htmlNodePatchFromLine(line);
      if (nodePatch) {
        const state = this.ensureNodeSection(nodePatch.sectionId);
        const prev = state.nodeMap.get(nodePatch.nodeId);
        const orderChanged = !state.nodeOrder.includes(nodePatch.nodeId);
        if (orderChanged) state.nodeOrder.push(nodePatch.nodeId);
        const parentChanged = prev?.parentId !== nodePatch.parentId;
        if (prev?.html === nodePatch.html && !orderChanged && !parentChanged) {
          return {
            changed: false,
            kind: 'section',
            sectionId: nodePatch.sectionId,
            nodeId: nodePatch.nodeId,
            nodePatch,
          };
        }
        state.nodeMap.set(nodePatch.nodeId, {
          html: nodePatch.html,
          ...(nodePatch.parentId ? { parentId: nodePatch.parentId } : {}),
        });
        return {
          changed: true,
          kind: 'section',
          sectionId: nodePatch.sectionId,
          nodeId: nodePatch.nodeId,
          nodePatch,
          orderChanged: orderChanged || parentChanged,
          htmlChanged: prev?.html !== nodePatch.html,
          nodeChanged: prev?.html !== nodePatch.html || parentChanged,
        };
      }

      const blockTarget = blockTargetFromPath(line.path);
      if (blockTarget) {
        const html = typeof line.html === 'string' ? line.html : '';
        const state = this.ensureBlockSection(blockTarget.sectionId);
        const prev = state.blockMap.get(blockTarget.blockId);
        const orderChanged = !state.blockOrder.includes(blockTarget.blockId);
        if (orderChanged) state.blockOrder.push(blockTarget.blockId);
        if (prev === html && !orderChanged) {
          return {
            changed: false,
            kind: 'section',
            sectionId: blockTarget.sectionId,
            blockId: blockTarget.blockId,
          };
        }
        state.blockMap.set(blockTarget.blockId, html);
        return {
          changed: true,
          kind: 'section',
          sectionId: blockTarget.sectionId,
          blockId: blockTarget.blockId,
          orderChanged,
          htmlChanged: prev !== html,
          blockChanged: prev !== html,
        };
      }

      const id = sectionIdFromSectionPath(line.path);
      if (!id) return { changed: false, kind: 'none' };
      const html = typeof line.html === 'string' ? line.html : '';
      const prev = this.sectionMap.get(id);
      const prevHtml = prev ? composeSectionInner(prev) : undefined;
      if (prevHtml === html && this.sectionOrder.includes(id)) {
        return { changed: false, kind: 'section', sectionId: id };
      }
      this.sectionMap.set(id, { kind: 'opaque', html });
      const orderChanged = !this.sectionOrder.includes(id);
      if (!this.sectionOrder.includes(id)) {
        this.sectionOrder.push(id);
      }
      return {
        changed: true,
        kind: 'section',
        sectionId: id,
        orderChanged,
        htmlChanged: prevHtml !== html,
      };
    }

    return { changed: false, kind: 'none' };
  }

  compose(): string {
    const parts: string[] = [];
    for (const id of this.sectionOrder) {
      const state = this.sectionMap.get(id);
      if (state === undefined) continue;
      const html = composeSectionInner(state);
      parts.push(`<section data-summon-section="${escapeAttr(id)}">\n${html}\n</section>`);
    }
    return parts.join('\n');
  }

  hasAnySection(): boolean {
    return this.sectionMap.size > 0;
  }

  snapshot(): SectionAccumulatorSnapshot {
    const sections: SectionSnapshotEntry[] = [];
    const seen = new Set<string>();
    for (const id of this.sectionOrder) {
      const state = this.sectionMap.get(id);
      if (state === undefined) continue;
      sections.push({ id, html: composeSectionInner(state) });
      seen.add(id);
    }
    for (const [id, state] of this.sectionMap) {
      if (seen.has(id)) continue;
      sections.push({ id, html: composeSectionInner(state) });
    }
    return { sections };
  }

  hydrate(snapshot: SectionAccumulatorSnapshot): void {
    this.reset();
    for (const section of snapshot.sections) {
      this.sectionOrder.push(section.id);
      this.sectionMap.set(section.id, { kind: 'opaque', html: section.html });
    }
  }

  static fromSnapshot(snapshot: SectionAccumulatorSnapshot): SectionAccumulator {
    const acc = new SectionAccumulator();
    acc.hydrate(snapshot);
    return acc;
  }

  reset(): void {
    this.sectionMap.clear();
    this.sectionOrder = [];
  }

  private ensureBlockSection(id: string): BlockSectionState {
    const existing = this.sectionMap.get(id);
    if (existing?.kind === 'blocks') return existing;
    const state: BlockSectionState = {
      kind: 'blocks',
      blockOrder: [],
      blockMap: new Map(),
    };
    this.sectionMap.set(id, state);
    if (!this.sectionOrder.includes(id)) {
      this.sectionOrder.push(id);
    }
    return state;
  }

  private ensureNodeSection(id: string): HtmlNodeSectionState {
    const existing = this.sectionMap.get(id);
    if (existing?.kind === 'nodes') return existing;
    const state: HtmlNodeSectionState = {
      kind: 'nodes',
      nodeOrder: [],
      nodeMap: new Map(),
    };
    this.sectionMap.set(id, state);
    if (!this.sectionOrder.includes(id)) {
      this.sectionOrder.push(id);
    }
    return state;
  }
}

function sameOrder(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function escapeAttr(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

function composeSectionInner(state: SectionState): string {
  if (state.kind === 'opaque') return state.html;
  if (state.kind === 'nodes') return composeNodeSectionInner(state);
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const id of state.blockOrder) {
    const html = state.blockMap.get(id);
    if (html === undefined) continue;
    seen.add(id);
    parts.push(`<div data-summon-block="${escapeAttr(id)}">\n${html}\n</div>`);
  }
  for (const [id, html] of state.blockMap) {
    if (seen.has(id)) continue;
    parts.push(`<div data-summon-block="${escapeAttr(id)}">\n${html}\n</div>`);
  }
  return parts.join('\n');
}

function composeNodeSectionInner(state: HtmlNodeSectionState): string {
  const parts: string[] = [];
  const visited = new Set<string>();
  for (const id of state.nodeOrder) {
    const entry = state.nodeMap.get(id);
    if (!entry || entry.parentId) continue;
    parts.push(composeNode(id, state, visited));
  }
  for (const id of state.nodeOrder) {
    if (visited.has(id)) continue;
    parts.push(composeNode(id, state, visited));
  }
  return parts.join('\n');
}

function composeNode(
  id: string,
  state: HtmlNodeSectionState,
  visited: Set<string>,
): string {
  if (visited.has(id)) return '';
  visited.add(id);
  const entry = state.nodeMap.get(id);
  if (!entry) return '';
  const children = childIdsFor(id, state)
    .map((childId) => composeNode(childId, state, visited))
    .filter(Boolean)
    .join('\n');
  return children ? injectChildren(entry.html, children) : entry.html;
}

function childIdsFor(parentId: string, state: HtmlNodeSectionState): string[] {
  return state.nodeOrder.filter((id) => state.nodeMap.get(id)?.parentId === parentId);
}

function injectChildren(html: string, children: string): string {
  const slotRange = nodeChildrenSlotRange(html);
  if (slotRange !== null) {
    const slotInner = removeDirectSkeletonChildren(html.slice(slotRange.insertIndex, slotRange.closeIndex));
    const retainedInner = slotInner.trim().length > 0 ? `\n${slotInner}` : '';
    return `${html.slice(0, slotRange.insertIndex)}\n${children}${retainedInner}\n${html.slice(slotRange.closeIndex)}`;
  }
  const tagName = rootTagName(html);
  if (!tagName) return `${html}\n${children}`;
  const closeRe = new RegExp(`</${escapeRegExp(tagName)}\\s*>\\s*$`, 'i');
  const match = html.match(closeRe);
  if (!match || match.index === undefined) return `${html}\n${children}`;
  return `${html.slice(0, match.index)}\n${children}\n${html.slice(match.index)}`;
}

function nodeChildrenSlotRange(html: string): { insertIndex: number; closeIndex: number } | null {
  const slotOpenRe = /<\s*([a-zA-Z][\w:-]*)\b(?=[^>]*\sdata-summon-node-children(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)[^>]*>/i;
  const match = slotOpenRe.exec(html);
  if (!match || match.index === undefined) return null;
  const tagName = match[1]?.toLowerCase();
  if (!tagName || /\/\s*>$/.test(match[0])) return null;
  const insertIndex = match.index + match[0].length;
  const closeIndex = matchingCloseTagIndex(html, tagName, insertIndex);
  return closeIndex === null ? null : { insertIndex, closeIndex };
}

function matchingCloseTagIndex(
  html: string,
  tagName: string,
  startIndex: number,
): number | null {
  const tagRe = new RegExp(`<\\s*(/?)\\s*${escapeRegExp(tagName)}\\b[^>]*>`, 'ig');
  tagRe.lastIndex = startIndex;
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html))) {
    if (match[1] === '/') {
      depth -= 1;
      if (depth === 0) return match.index;
      continue;
    }
    if (!/\/\s*>$/.test(match[0])) depth += 1;
  }
  return null;
}

function removeDirectSkeletonChildren(html: string): string {
  const ranges = directSkeletonChildRanges(html);
  if (ranges.length === 0) return html;
  let out = '';
  let cursor = 0;
  for (const [start, end] of ranges) {
    out += html.slice(cursor, start);
    cursor = end;
  }
  return out + html.slice(cursor);
}

function directSkeletonChildRanges(html: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const tagRe = /<!--[\s\S]*?-->|<![^>]*>|<\/?[a-zA-Z][\w:-]*(?:\s+[^<>]*?)?\s*\/?>/g;
  let depth = 0;
  let topStart = -1;
  let topSkeleton = false;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html))) {
    const rawTag = match[0]!;
    if (rawTag.startsWith('<!--') || rawTag.startsWith('<!')) continue;
    const tagName = rawTag.match(/^<\s*\/?\s*([a-zA-Z][\w:-]*)/)?.[1]?.toLowerCase();
    if (!tagName) continue;
    const closing = /^<\s*\//.test(rawTag);
    if (closing) {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && topSkeleton) {
          ranges.push([topStart, match.index + rawTag.length]);
        }
      }
      continue;
    }
    const selfClosing = /\/\s*>$/.test(rawTag) || VOID_TAGS.has(tagName);
    if (depth === 0) {
      const skeleton = hasAttr(rawTag, 'data-summon-skeleton');
      if (selfClosing) {
        if (skeleton) ranges.push([match.index, match.index + rawTag.length]);
        continue;
      }
      topStart = match.index;
      topSkeleton = skeleton;
      depth = 1;
      continue;
    }
    if (!selfClosing) depth += 1;
  }
  return ranges;
}

function hasAttr(rawTag: string, attr: string): boolean {
  return new RegExp(`\\s${escapeRegExp(attr)}(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?(?=\\s|/?>)`, 'i').test(rawTag);
}

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

function rootTagName(html: string): string | null {
  return html.trim().match(/^<\s*([a-zA-Z][\w:-]*)\b/)?.[1]?.toLowerCase() ?? null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
