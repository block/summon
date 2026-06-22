import type { GhostRuntimeCheck } from '@summon-internal/engine';
import { recordArrayValue, recordValue, stringValue } from './util.js';

export function buildRuntimeChecks(raw: Record<string, unknown> | undefined): GhostRuntimeCheck[] {
  return recordArrayValue(raw?.checks)
    .filter((check) => check.status === 'active')
    .flatMap((check): GhostRuntimeCheck[] => {
      const detector = recordValue(check.detector);
      const detectorType = typeof detector?.type === 'string' ? detector.type : '';
      const rawPattern = typeof detector?.pattern === 'string'
        ? detector.pattern
        : typeof detector?.value === 'string'
          ? detector.value
          : '';
      if (!rawPattern) return [];
      const severity = check.severity === 'nit' ? 'warn' : 'block';
      const expectation = detectorType.startsWith('forbidden') || detectorType.startsWith('banned') ? 'absent' : 'present';
      const type = detectorType.includes('regex') ? 'regex' : 'includes';
      return [{
        id: stringValue(check.id, 'ghost-check'),
        title: stringValue(check.title, stringValue(check.id, 'Ghost check')),
        severity,
        detector: { type, pattern: rawPattern },
        expectation,
        sourceRef: `check:${stringValue(check.id, 'ghost-check')}`,
        repair: typeof check.repair === 'string' ? check.repair : undefined,
      }];
    })
    .slice(0, 24);
}
