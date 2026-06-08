import type { ContractIssue } from './contracts.js';
import type { ProtocolLine } from './protocol.js';
import type { RepairFeedbackMetaValue } from './protocol-hardener.js';

export interface StreamGraphSection {
  id: string;
  declared: boolean;
  present: boolean;
  revision: number;
  bytes: number;
  firstDeclaredLine?: number;
  firstSeenLine?: number;
  lastUpdatedLine?: number;
  lastIssue?: ContractIssue;
}

export interface StreamGraphEdge {
  from: 'screen';
  to: string;
  order: number;
}

export interface StreamGraphHealth {
  complete: boolean;
  missingDeclared: string[];
  undeclaredPresent: string[];
  skippedCount: number;
  blockedCount: number;
  repairedCount: number;
}

export interface StreamGraphSnapshot {
  sections: StreamGraphSection[];
  edges: StreamGraphEdge[];
  health: StreamGraphHealth;
}

const SECTION_PREFIX = '/section/';

const SKIPPED_ISSUE_CODES = new Set([
  'malformed-jsonl',
  'invalid-meta-path',
  'invalid-set-path',
  'invalid-screen-value',
  'invalid-section-count',
  'invalid-section-id',
  'duplicate-section-id',
  'invalid-add-path',
  'invalid-section-path',
  'invalid-section-html',
  'layout-disallowed',
  'section-not-targeted',
  'undeclared-section',
  'synthetic-section-limit',
]);

/**
 * Observe the streaming protocol as a graph of screen -> section edges.
 *
 * This class intentionally does not render, validate, repair, or mutate the
 * section HTML stream. It records structural state and health for diagnostics.
 */
export class StreamGraph {
  private sections = new Map<string, StreamGraphSection>();
  private edges: StreamGraphEdge[] = [];
  private skippedCount = 0;
  private blockedCount = 0;
  private repairedCount = 0;
  private lineCount = 0;

  applyLine(line: ProtocolLine): void {
    this.lineCount += 1;

    if (line.op === 'set' && line.path === '/screen') {
      this.applyScreen(line.value);
      return;
    }

    if (line.op === 'add' && line.path.startsWith(SECTION_PREFIX)) {
      this.applySection(line.path.slice(SECTION_PREFIX.length), line.html ?? '');
      return;
    }

    if (line.op === 'meta') {
      this.applyMeta(line);
    }
  }

  recordIssue(issue: ContractIssue): void {
    if (issue.severity === 'block') {
      this.blockedCount += 1;
    } else if (SKIPPED_ISSUE_CODES.has(issue.code)) {
      this.skippedCount += 1;
    }

    const sectionId = sectionIdFromPath(issue.path);
    if (sectionId) {
      this.ensureSection(sectionId).lastIssue = issue;
    }
  }

  recordRepairFeedback(feedback: RepairFeedbackMetaValue): void {
    if (feedback.status === 'blocked') this.blockedCount += 1;
    if (feedback.status === 'skipped') this.skippedCount += 1;
    if (feedback.status === 'repaired') this.repairedCount += 1;

    const sectionId = sectionIdFromPath(feedback.target);
    const issue = feedback.issues[0];
    if (sectionId && issue) {
      this.ensureSection(sectionId).lastIssue = issue;
    }
  }

  snapshot(): StreamGraphSnapshot {
    const health = this.health();
    return {
      sections: this.orderedSections().map((section) => cloneSection(section)),
      edges: this.edges.map((edge) => ({ ...edge })),
      health,
    };
  }

  hydrate(snapshot: StreamGraphSnapshot): void {
    this.reset();
    this.edges = snapshot.edges.map((edge) => ({ ...edge }));
    for (const section of snapshot.sections) {
      this.sections.set(section.id, cloneSection(section));
      this.lineCount = Math.max(
        this.lineCount,
        section.firstDeclaredLine ?? 0,
        section.firstSeenLine ?? 0,
        section.lastUpdatedLine ?? 0,
      );
    }
    this.skippedCount = snapshot.health.skippedCount;
    this.blockedCount = snapshot.health.blockedCount;
    this.repairedCount = snapshot.health.repairedCount;
  }

  reset(): void {
    this.sections.clear();
    this.edges = [];
    this.skippedCount = 0;
    this.blockedCount = 0;
    this.repairedCount = 0;
    this.lineCount = 0;
  }

  static fromSnapshot(snapshot: StreamGraphSnapshot): StreamGraph {
    const graph = new StreamGraph();
    graph.hydrate(snapshot);
    return graph;
  }

  private applyScreen(value: unknown): void {
    const sections = screenSections(value);
    if (sections.length === 0) return;

    for (const section of this.sections.values()) {
      section.declared = false;
    }

    this.edges = sections.map((id, order) => {
      const section = this.ensureSection(id);
      section.declared = true;
      if (section.firstDeclaredLine === undefined) {
        section.firstDeclaredLine = this.lineCount;
      }
      return { from: 'screen' as const, to: id, order };
    });
  }

  private applySection(id: string, html: string): void {
    if (!id) return;
    const section = this.ensureSection(id);
    section.present = true;
    section.revision += 1;
    section.bytes = html.length;
    if (section.firstSeenLine === undefined) {
      section.firstSeenLine = this.lineCount;
    }
    section.lastUpdatedLine = this.lineCount;
  }

  private applyMeta(line: ProtocolLine & { op: 'meta' }): void {
    if (line.path === '/protocol-skip') {
      this.skippedCount += 1;
      const value = line.value as { path?: unknown; code?: unknown; message?: unknown } | undefined;
      const path = typeof value?.path === 'string' ? value.path : undefined;
      const sectionId = sectionIdFromPath(path);
      if (sectionId) {
        this.ensureSection(sectionId).lastIssue = {
          source: 'protocol',
          severity: 'warn',
          code: typeof value?.code === 'string' ? value.code : 'protocol-skip',
          message: typeof value?.message === 'string' ? value.message : 'Protocol line skipped',
          path,
        };
      }
      return;
    }

    if (line.path === '/validation-blocked' && isContractIssue(line.value)) {
      this.recordIssue(line.value);
      return;
    }

    if (line.path === '/repair-feedback' && isRepairFeedback(line.value)) {
      this.recordRepairFeedback(line.value);
      return;
    }

    if (line.path === '/repair-summary') {
      const value = line.value as { repaired?: unknown } | undefined;
      if (typeof value?.repaired === 'number') {
        this.repairedCount = Math.max(this.repairedCount, value.repaired);
      }
      return;
    }

    if (line.path === '/validation-summary') {
      this.recordValidationSummary(line.value);
    }
  }

  private recordValidationSummary(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    const summary = value as { blocked?: unknown; codes?: unknown };
    if (typeof summary.blocked === 'number') {
      this.blockedCount = Math.max(this.blockedCount, summary.blocked);
    }
    if (!summary.codes || typeof summary.codes !== 'object') return;
    let skipped = 0;
    for (const [code, count] of Object.entries(summary.codes as Record<string, unknown>)) {
      if (!SKIPPED_ISSUE_CODES.has(code) || typeof count !== 'number') continue;
      skipped += count;
    }
    this.skippedCount = Math.max(this.skippedCount, skipped);
  }

  private health(): StreamGraphHealth {
    const missingDeclared: string[] = [];
    const undeclaredPresent: string[] = [];
    for (const section of this.orderedSections()) {
      if (section.declared && !section.present) missingDeclared.push(section.id);
      if (!section.declared && section.present) undeclaredPresent.push(section.id);
    }
    return {
      complete: missingDeclared.length === 0 && undeclaredPresent.length === 0,
      missingDeclared,
      undeclaredPresent,
      skippedCount: this.skippedCount,
      blockedCount: this.blockedCount,
      repairedCount: this.repairedCount,
    };
  }

  private orderedSections(): StreamGraphSection[] {
    const out: StreamGraphSection[] = [];
    const seen = new Set<string>();
    for (const edge of this.edges) {
      const section = this.sections.get(edge.to);
      if (!section) continue;
      out.push(section);
      seen.add(section.id);
    }
    for (const section of this.sections.values()) {
      if (seen.has(section.id)) continue;
      out.push(section);
    }
    return out;
  }

  private ensureSection(id: string): StreamGraphSection {
    const existing = this.sections.get(id);
    if (existing) return existing;
    const section: StreamGraphSection = {
      id,
      declared: false,
      present: false,
      revision: 0,
      bytes: 0,
    };
    this.sections.set(id, section);
    return section;
  }
}

function screenSections(value: unknown): string[] {
  const obj = value as { sections?: unknown } | undefined;
  return Array.isArray(obj?.sections)
    ? obj.sections.filter((section): section is string => typeof section === 'string')
    : [];
}

function sectionIdFromPath(path: unknown): string | null {
  if (typeof path !== 'string' || !path.startsWith(SECTION_PREFIX)) return null;
  const id = path.slice(SECTION_PREFIX.length);
  return id || null;
}

function cloneSection(section: StreamGraphSection): StreamGraphSection {
  return {
    ...section,
    ...(section.lastIssue ? { lastIssue: { ...section.lastIssue } } : {}),
  };
}

function isContractIssue(value: unknown): value is ContractIssue {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Partial<ContractIssue>;
  return (
    typeof obj.source === 'string' &&
    (obj.severity === 'block' || obj.severity === 'warn') &&
    typeof obj.code === 'string' &&
    typeof obj.message === 'string'
  );
}

function isRepairFeedback(value: unknown): value is RepairFeedbackMetaValue {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Partial<RepairFeedbackMetaValue>;
  return (
    obj.schemaId === 'summon.repair-feedback.v2' &&
    typeof obj.status === 'string' &&
    Array.isArray(obj.issues)
  );
}
