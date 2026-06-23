import type { ContractIssue } from './contracts.js';
import type { ProtocolLine, SurfaceEvent } from './protocol.js';

export interface StreamGraphArtifact {
  revision: number;
  runtime: 'arrow' | 'html';
  bytes: number;
  firstSeenLine?: number;
  lastUpdatedLine?: number;
  lastIssue?: ContractIssue;
}

export interface StreamGraphHealth {
  complete: boolean;
  warningCount: number;
  blockedCount: number;
}

export interface StreamGraphEventSummary {
  count: number;
  firstSeenLine?: number;
  lastUpdatedLine?: number;
  lastType?: SurfaceEvent['type'];
}

export interface StreamGraphPreview {
  events: StreamGraphEventSummary;
  lastStatus?: Extract<SurfaceEvent, { type: 'surface.status' }>['status'];
  lastStatusText?: string;
}

export interface StreamGraphSnapshot {
  artifacts: StreamGraphArtifact[];
  preview: StreamGraphPreview;
  health: StreamGraphHealth;
}

/**
 * Observe the server-owned surface stream as artifact revisions plus validation health.
 */
export class StreamGraph {
  private artifacts: StreamGraphArtifact[] = [];
  private issueKeys = new Set<string>();
  private warningCount = 0;
  private blockedCount = 0;
  private lineCount = 0;
  private preview: StreamGraphPreview = {
    events: {
      count: 0,
    },
  };

  applyLine(line: ProtocolLine): void {
    this.lineCount += 1;

    if (line.op === 'artifact') {
      this.applyArtifact(line.value);
      return;
    }

    if (line.op === 'event') {
      this.applyEvent(line.value);
      return;
    }

    if (line.op === 'patch') {
      return;
    }

    this.applyMeta(line);
  }

  recordIssue(issue: ContractIssue): void {
    const key = issueKey(issue);
    if (!this.issueKeys.has(key)) {
      this.issueKeys.add(key);
      if (issue.severity === 'block') {
        this.blockedCount += 1;
      } else if (issue.severity === 'warn') {
        this.warningCount += 1;
      }
    }

    const latest = this.artifacts.at(-1);
    if (latest) latest.lastIssue = { ...issue };
  }

  snapshot(): StreamGraphSnapshot {
    return {
      artifacts: this.artifacts.map(cloneArtifact),
      preview: clonePreview(this.preview),
      health: {
        complete: this.blockedCount === 0,
        warningCount: this.warningCount,
        blockedCount: this.blockedCount,
      },
    };
  }

  hydrate(snapshot: StreamGraphSnapshot): void {
    this.reset();
    this.artifacts = Array.isArray(snapshot.artifacts)
      ? snapshot.artifacts.map(cloneArtifact)
      : [];
    this.preview = clonePreview(snapshot.preview ?? { events: { count: 0 } });
    this.issueKeys.clear();
    this.lineCount = this.artifacts.reduce(
      (max, artifact) => Math.max(max, artifact.firstSeenLine ?? 0, artifact.lastUpdatedLine ?? 0),
      Math.max(this.preview.events.firstSeenLine ?? 0, this.preview.events.lastUpdatedLine ?? 0),
    );
    this.warningCount = snapshot.health.warningCount;
    this.blockedCount = snapshot.health.blockedCount;
  }

  reset(): void {
    this.artifacts = [];
    this.issueKeys.clear();
    this.warningCount = 0;
    this.blockedCount = 0;
    this.lineCount = 0;
    this.preview = {
      events: {
        count: 0,
      },
    };
  }

  static fromSnapshot(snapshot: StreamGraphSnapshot): StreamGraph {
    const graph = new StreamGraph();
    graph.hydrate(snapshot);
    return graph;
  }

  private applyArtifact(value: unknown): void {
    const latest = this.artifacts.at(-1);
    const next: StreamGraphArtifact = {
      revision: (latest?.revision ?? 0) + 1,
      runtime: artifactRuntime(value),
      bytes: artifactBytes(value),
      firstSeenLine: latest?.firstSeenLine ?? this.lineCount,
      lastUpdatedLine: this.lineCount,
    };
    this.artifacts.push(next);
  }

  private applyEvent(value: unknown): void {
    const event = value as Partial<SurfaceEvent>;
    const events = this.preview.events;
    events.count += 1;
    events.firstSeenLine ??= this.lineCount;
    events.lastUpdatedLine = this.lineCount;
    if (typeof event.type === 'string') events.lastType = event.type as SurfaceEvent['type'];
    if (event.type === 'surface.status') {
      const status = event.status;
      if (
        status === 'planning' ||
        status === 'contract' ||
        status === 'drafting' ||
        status === 'validating' ||
        status === 'rendering' ||
        status === 'finalizing'
      ) {
        this.preview.lastStatus = status;
      }
      this.preview.lastStatusText = typeof event.text === 'string' ? event.text : undefined;
    }
  }

  private applyMeta(line: ProtocolLine & { op: 'meta' }): void {
    if (line.path === '/validation-blocked' && isContractIssue(line.value)) {
      this.recordIssue(line.value);
      return;
    }

    if (line.path === '/validation-observed' && isContractIssue(line.value)) {
      this.recordIssue(line.value);
      return;
    }

    if (line.path === '/validation-summary') {
      this.recordValidationSummary(line.value);
    }
  }

  private recordValidationSummary(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    const summary = value as { blocked?: unknown; warnings?: unknown };
    if (typeof summary.blocked === 'number') {
      this.blockedCount = Math.max(this.blockedCount, summary.blocked);
    }
    if (typeof summary.warnings === 'number') {
      this.warningCount = Math.max(this.warningCount, summary.warnings);
    }
  }
}

function artifactRuntime(value: unknown): StreamGraphArtifact['runtime'] {
  if (value && typeof value === 'object' && (value as { runtime?: unknown }).runtime === 'html') {
    return 'html';
  }
  return 'arrow';
}

function artifactBytes(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return 0;
  }
}

function cloneArtifact(artifact: StreamGraphArtifact): StreamGraphArtifact {
  return {
    ...artifact,
    ...(artifact.lastIssue ? { lastIssue: { ...artifact.lastIssue } } : {}),
  };
}

function clonePreview(preview: StreamGraphPreview): StreamGraphPreview {
  return {
    events: {
      ...preview.events,
    },
    ...(preview.lastStatus ? { lastStatus: preview.lastStatus } : {}),
    ...(preview.lastStatusText ? { lastStatusText: preview.lastStatusText } : {}),
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

function issueKey(issue: ContractIssue): string {
  return [
    issue.source,
    issue.severity,
    issue.code,
    issue.message,
    issue.path ?? '',
  ].join('\0');
}
