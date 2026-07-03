import {
  type ProtocolLine,
  type SurfaceEvent,
} from '@anarchitecture/summon/engine';
import type { RunMetrics } from './types.js';

export const RUN_METRICS_META_PATH = '/run-metrics';

export function createRunMetricsAccumulator(): RunMetricsAccumulator {
  return new RunMetricsAccumulator();
}

export class RunMetricsAccumulator {
  private ttfb: number | null = null;
  private ttfp: number | null = null;
  private artifactTti: number | null = null;
  private complete: number | null = null;
  private bytes = 0;
  private repairs = 0;
  private blocked = false;
  private validationCount = 0;
  private safetyViolations = 0;

  markFirstByte(elapsedMs: number): void {
    if (this.ttfb === null) this.ttfb = roundMs(elapsedMs);
  }

  markComplete(elapsedMs: number): void {
    this.complete = roundMs(elapsedMs);
  }

  setBytes(bytes: number): void {
    this.bytes = Math.max(0, Math.floor(bytes));
  }

  observeProtocolLine(line: ProtocolLine, elapsedMs: number): void {
    if (line.op === 'meta' && line.path === RUN_METRICS_META_PATH) {
      this.applyServerMetrics(line.value);
      return;
    }
    if (line.op === 'artifact' && line.path === '/artifact') {
      if (this.artifactTti === null) this.artifactTti = roundMs(elapsedMs);
    }
  }

  observeSurfaceEvent(event: SurfaceEvent, elapsedMs: number): void {
    if (event.type !== 'surface.status') this.markFirstPaint(elapsedMs);
  }

  snapshot(): RunMetrics {
    return {
      runtime: 'surface-document',
      ttfb: this.ttfb,
      ttfp: this.ttfp,
      tti: this.artifactTti,
      complete: this.complete,
      repairs: this.repairs,
      blocked: this.blocked,
      validationCount: this.validationCount,
      safetyViolations: this.safetyViolations,
      bytes: this.bytes,
    };
  }

  private markFirstPaint(elapsedMs: number): void {
    if (this.ttfp === null) this.ttfp = roundMs(elapsedMs);
  }

  private applyServerMetrics(value: unknown): void {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const item = value as Record<string, unknown>;
    if (item.schema !== undefined && item.schema !== 'summon.run-metrics/v1') return;
    this.repairs = readCount(item.repairs, this.repairs);
    this.blocked = typeof item.blocked === 'boolean' ? item.blocked : this.blocked;
    this.validationCount = readCount(item.validationCount, this.validationCount);
    this.safetyViolations = readCount(item.safetyViolations, this.safetyViolations);
  }
}

function readCount(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function roundMs(value: number): number {
  return Math.max(0, Math.round(value));
}
