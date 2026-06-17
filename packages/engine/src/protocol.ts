/**
 * Summon streaming protocol. The model emits one JSON object per line:
 *
 *   {"op":"meta","path":"/status","value":"writing"}
 *   {"op":"event","path":"/surface","value":{"type":"surface.status","status":"drafting"}}
 *   {"op":"artifact","path":"/artifact","value":{"runtime":"arrow","source":{...}}}
 *
 * Preview UI is delivered as non-authoritative surface events. Executable UI is
 * delivered exclusively as complete Arrow artifacts.
 */

export interface MetaLine {
  op: 'meta';
  path: string;
  value?: unknown;
}

export interface ArtifactLine {
  op: 'artifact';
  path: '/artifact';
  value?: unknown;
}

export type SurfaceEvent =
  | {
      type: 'surface.start';
      id: string;
      kind: string;
      title?: string;
    }
  | {
      type: 'region.add';
      id: string;
      parent?: string;
      role: string;
      label?: string;
    }
  | {
      type: 'node.add';
      id: string;
      parent: string;
      kind: string;
      props?: Record<string, unknown>;
    }
  | {
      type: 'node.patch';
      id: string;
      props: Record<string, unknown>;
    }
  | {
      type: 'surface.status';
      status: 'planning' | 'drafting' | 'validating' | 'finalizing';
      text?: string;
    }
  | {
      type: 'surface.finalize';
      artifactExpected: true;
    };

export interface SurfaceEventLine {
  op: 'event';
  path: '/surface';
  value?: unknown;
}

export type ProtocolLine = MetaLine | SurfaceEventLine | ArtifactLine;

export const SUMMON_PROTOCOL_VERSION = 1;

export type ProtocolParseErrorCode =
  | 'empty'
  | 'oversized-line'
  | 'malformed-json'
  | 'invalid-shape'
  | 'invalid-op'
  | 'invalid-event-path'
  | 'invalid-artifact-path';

export class ProtocolParseError extends Error {
  readonly code: ProtocolParseErrorCode;

  constructor(code: ProtocolParseErrorCode, message: string) {
    super(message);
    this.name = 'ProtocolParseError';
    this.code = code;
  }
}

export interface ProtocolParseOptions {
  maxLineBytes?: number;
}

export function parseProtocolLineStrict(
  raw: string,
  options: ProtocolParseOptions = {},
): ProtocolLine {
  const maxLineBytes = Math.max(1, options.maxLineBytes ?? 256 * 1024);
  if (byteLength(raw) > maxLineBytes) {
    throw new ProtocolParseError(
      'oversized-line',
      `Protocol line exceeds ${maxLineBytes} bytes`,
    );
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    throw new ProtocolParseError('empty', 'Protocol line is empty');
  }
  if (!trimmed.startsWith('{')) {
    throw new ProtocolParseError('malformed-json', 'Protocol line must be a JSON object');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new ProtocolParseError('malformed-json', 'Protocol line is not valid JSON');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ProtocolParseError('invalid-shape', 'Protocol line must be a JSON object');
  }
  const p = parsed as Record<string, unknown>;
  if (typeof p.op !== 'string' || typeof p.path !== 'string') {
    throw new ProtocolParseError('invalid-shape', 'Protocol line must include string op and path');
  }

  if (p.op === 'artifact') {
    if (p.path !== '/artifact') {
      throw new ProtocolParseError('invalid-artifact-path', 'Artifact line path must be /artifact');
    }
    return p as unknown as ArtifactLine;
  }
  if (p.op === 'event') {
    if (p.path !== '/surface') {
      throw new ProtocolParseError('invalid-event-path', 'Event line path must be /surface');
    }
    return p as unknown as SurfaceEventLine;
  }
  if (p.op === 'meta') return p as unknown as MetaLine;
  throw new ProtocolParseError('invalid-op', `Unsupported protocol op "${p.op}"`);
}

export function parseProtocolLine(raw: string): ProtocolLine | null {
  try {
    return parseProtocolLineStrict(raw);
  } catch {
    return null;
  }
}

export function isProtocolLine(value: unknown): value is ProtocolLine {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  if (typeof p.op !== 'string' || typeof p.path !== 'string') return false;
  if (p.op === 'artifact') return p.path === '/artifact';
  if (p.op === 'event') return p.path === '/surface';
  return p.op === 'meta';
}

export function isSurfaceEvent(value: unknown): value is SurfaceEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  switch (event.type) {
    case 'surface.start':
      return (
        typeof event.id === 'string' &&
        typeof event.kind === 'string' &&
        (event.title === undefined || typeof event.title === 'string')
      );
    case 'region.add':
      return (
        typeof event.id === 'string' &&
        typeof event.role === 'string' &&
        (event.parent === undefined || typeof event.parent === 'string') &&
        (event.label === undefined || typeof event.label === 'string')
      );
    case 'node.add':
      return (
        typeof event.id === 'string' &&
        typeof event.parent === 'string' &&
        typeof event.kind === 'string' &&
        (event.props === undefined || isPlainRecord(event.props))
      );
    case 'node.patch':
      return (
        typeof event.id === 'string' &&
        isPlainRecord(event.props)
      );
    case 'surface.status':
      return (
        (event.status === 'planning' ||
          event.status === 'drafting' ||
          event.status === 'validating' ||
          event.status === 'finalizing') &&
        (event.text === undefined || typeof event.text === 'string')
      );
    case 'surface.finalize':
      return event.artifactExpected === true;
    default:
      return false;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
