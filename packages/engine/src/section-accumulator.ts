import type { ProtocolLine } from './protocol.js';

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
  orderChanged?: boolean;
  htmlChanged?: boolean;
}

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
  private sectionMap: Map<string, string> = new Map();
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

    if (line.op === 'add' && line.path.startsWith('/section/')) {
      const id = line.path.slice('/section/'.length);
      if (!id) return { changed: false, kind: 'none' };
      const html = typeof line.html === 'string' ? line.html : '';
      const prev = this.sectionMap.get(id);
      if (prev === html && this.sectionOrder.includes(id)) {
        return { changed: false, kind: 'section', sectionId: id };
      }
      this.sectionMap.set(id, html);
      const orderChanged = !this.sectionOrder.includes(id);
      if (!this.sectionOrder.includes(id)) {
        this.sectionOrder.push(id);
      }
      return {
        changed: true,
        kind: 'section',
        sectionId: id,
        orderChanged,
        htmlChanged: prev !== html,
      };
    }

    return { changed: false, kind: 'none' };
  }

  compose(): string {
    const parts: string[] = [];
    for (const id of this.sectionOrder) {
      const html = this.sectionMap.get(id);
      if (html === undefined) continue;
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
      const html = this.sectionMap.get(id);
      if (html === undefined) continue;
      sections.push({ id, html });
      seen.add(id);
    }
    for (const [id, html] of this.sectionMap) {
      if (seen.has(id)) continue;
      sections.push({ id, html });
    }
    return { sections };
  }

  hydrate(snapshot: SectionAccumulatorSnapshot): void {
    this.reset();
    for (const section of snapshot.sections) {
      this.sectionOrder.push(section.id);
      this.sectionMap.set(section.id, section.html);
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
