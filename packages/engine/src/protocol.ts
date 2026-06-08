/**
 * Streaming protocol. The LLM emits one JSON object per line; the accumulator
 * applies them to build up a section map that the host pushes into the sandbox.
 *
 *   {"op":"add","path":"/section/header","html":"<h1>..."}
 *   {"op":"set","path":"/screen","value":{"sections":["header","content","footer"]}}
 *   {"op":"meta","path":"/template","value":"stack"}
 *
 * "add" sets a section's HTML (overwrite on repeat).
 * "set /screen" declares section order (host uses a default if not emitted).
 * "meta" lines are informational; ignored by the accumulator.
 */

export interface AddLine {
  op: 'add';
  path: string;
  html?: string;
}

export interface SetLine {
  op: 'set';
  path: string;
  value?: unknown;
}

export interface MetaLine {
  op: 'meta';
  path: string;
  value?: unknown;
}

export type ProtocolLine = AddLine | SetLine | MetaLine;

export const SUMMON_PROTOCOL_VERSION = 1;

export type ProtocolParseErrorCode =
  | 'empty'
  | 'oversized-line'
  | 'malformed-json'
  | 'invalid-shape'
  | 'invalid-op'
  | 'invalid-add-html';

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

  if (p.op === 'add') {
    if (p.html !== undefined && typeof p.html !== 'string') {
      throw new ProtocolParseError('invalid-add-html', 'Add line html must be a string');
    }
    return p as unknown as AddLine;
  }
  if (p.op === 'set') return p as unknown as SetLine;
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
  if (p.op === 'add') return p.html === undefined || typeof p.html === 'string';
  return p.op === 'set' || p.op === 'meta';
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
