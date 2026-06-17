import type { DevtoolsEvent } from '@anarchitecture/summon/devtools';
import type { ProtocolLine, SurfaceContractView, SurfacePlan } from '@anarchitecture/summon/engine';
import type { SurfaceStreamResult } from '@anarchitecture/summon/browser';
import { planText } from './surfaceHelpers.js';

export type ExtraDevtoolsEvent =
  | { kind: 'protocol-line'; at: number; line: ProtocolLine }
  | { kind: 'protocol-parse-error'; at: number; raw: string }
  | { kind: 'stream-lifecycle'; at: number; phase: 'start' | 'end'; ok?: boolean }
  | { kind: 'stream-graph'; at: number; health: SurfaceStreamResult['streamGraph']['health']; artifacts: SurfaceStreamResult['streamGraph']['artifacts'] }
  | { kind: 'surface-plan'; at: number; plan: SurfacePlan }
  | { kind: 'surface-contract'; at: number; contract: SurfaceContractView };

export function formatDevtoolsEvent(ev: DevtoolsEvent | ExtraDevtoolsEvent): string {
  switch (ev.kind) {
    case 'surface-mounted':
      return `${ev.surfaceId.slice(0, 8)}... allowed=[${ev.grantedTools.join(',') || '-'}]`;
    case 'surface-disposed':
      return `${ev.surfaceId.slice(0, 8)}...`;
    case 'surface-runtime-error':
      return `${ev.surfaceId.slice(0, 8)}... ${ev.reason}`;
    case 'surface-preview-event':
      return `${ev.surfaceId.slice(0, 8)}... ${JSON.stringify(ev.event).slice(0, 80)}`;
    case 'tool-called':
      return `host tool ${ev.tool} ${JSON.stringify(ev.args).slice(0, 80)}`;
    case 'tool-rejected':
      return `${ev.reason}`;
    case 'tool-dispatched':
      return `host dispatch ${ev.tool} #${ev.id.slice(-6)}`;
    case 'tool-settled':
      return `host settled ${ev.tool} #${ev.id.slice(-6)} ${ev.ok ? 'ok' : `fail: ${ev.error ?? ''}`} (${ev.durationMs}ms)`;
    case 'state-pushed':
      return Object.keys(ev.patch).join(', ') || 'empty';
    case 'render':
      return `${ev.bytes.toLocaleString()} B`;
    case 'rendered':
      return `revision ${ev.revision}`;
    case 'protocol-line':
      return `${ev.line.op} ${ev.line.path}`;
    case 'protocol-parse-error':
      return ev.raw.slice(0, 80);
    case 'stream-lifecycle':
      return ev.phase === 'start' ? 'start' : `end ok=${ev.ok}`;
    case 'stream-graph':
      return `artifacts=${ev.artifacts.length} skipped=${ev.health.skippedCount} blocked=${ev.health.blockedCount}`;
    case 'surface-plan':
      return planText(ev.plan as SurfacePlan);
    case 'surface-contract':
      return `${ev.contract.tools?.length ?? 0} tools`;
  }
}

export function displayEventKind(kind: string): string {
  switch (kind) {
    case 'tool-called':
      return 'host tool';
    case 'tool-rejected':
      return 'request rejected';
    case 'tool-dispatched':
      return 'host dispatch';
    case 'tool-settled':
      return 'host settled';
    case 'stream-graph':
      return 'stream diagnostics';
    case 'surface-mounted':
      return 'surface mounted';
    case 'surface-preview-event':
      return 'surface preview';
    case 'surface-runtime-error':
      return 'runtime error';
    case 'surface-disposed':
      return 'surface disposed';
    default:
      return kind.replace(/^(surface|protocol|stream)-/, '').replace(/-/g, ' ');
  }
}
