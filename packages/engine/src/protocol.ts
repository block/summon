/**
 * Arrow streaming protocol. The model emits one JSON object per line:
 *
 *   {"op":"meta","path":"/status","value":"writing"}
 *   {"op":"artifact","path":"/artifact","value":{"runtime":"arrow","source":{...}}}
 *
 * Surface UI is delivered exclusively as Arrow artifacts. Section, block, node,
 * and raw HTML stream operations are no longer part of the protocol.
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

export type ProtocolLine = MetaLine | ArtifactLine;

export const SUMMON_PROTOCOL_VERSION = 1;

export type ProtocolParseErrorCode =
  | 'empty'
  | 'oversized-line'
  | 'malformed-json'
  | 'invalid-shape'
  | 'invalid-op'
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
  return p.op === 'meta';
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
