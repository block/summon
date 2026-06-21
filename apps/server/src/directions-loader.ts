import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compileDirectionContract,
  coerceOpts,
  type DirectionOpts,
} from '@anarchitecture/summon/engine';

export const PREFERRED_DEFAULT_DIRECTION_ID = 'workbench';

export interface DirectionExemplar {
  name: string;
  content: string;
  /** atom = vocabulary primitive, ship verbatim ("use this exact markup, swap content only").
   *  shape = composition, ship as a per-shape anchor. */
  kind: 'atom' | 'shape';
  /** Set on shape exemplars — the response shape this exemplar represents
   *  (`article`, `card`, `comparison`, `tracker`, …). Used to ship only the
   *  matching exemplar when the classifier picks a shape. */
  shape?: string;
}

export interface Direction {
  id: string;
  name: string;
  description: string;
  prompt: string;
  tokensCss: string;
  exemplars: DirectionExemplar[];
  opts: DirectionOpts;
  /** Opportunistic spacing slots actually defined (e.g., `space-8`, `space-12`). */
  liveOpportunistic: string[];
  /** Optional provenance for expression-derived directions. Informational only. */
  sourceExpression?: DirectionSourceExpression;
}

export interface DirectionSourceExpression {
  id?: string;
  path?: string;
  commit?: string;
  hash?: string;
}

interface DirectionMeta {
  name?: string;
  description?: string;
  opts?: unknown;
  sourceExpression?: unknown;
}

function readMeta(dir: string): DirectionMeta {
  const metaPath = join(dir, 'meta.json');
  if (!existsSync(metaPath)) return {};
  try {
    const raw = readFileSync(metaPath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as DirectionMeta;
  } catch {
    // fall through
  }
  return {};
}

function readExemplars(dir: string): DirectionExemplar[] {
  const exDir = join(dir, 'exemplars');
  if (!existsSync(exDir)) return [];
  return readdirSync(exDir)
    .filter((f) => f.endsWith('.html'))
    .sort()
    .map((f) => {
      const content = readFileSync(join(exDir, f), 'utf-8');
      const meta = parseExemplarMeta(content);
      return {
        name: f.replace(/\.html$/, ''),
        content,
        kind: meta.kind,
        shape: meta.shape,
      } satisfies DirectionExemplar;
    });
}

function readSourceExpression(raw: unknown): DirectionSourceExpression | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const out: DirectionSourceExpression = {};
  for (const key of ['id', 'path', 'commit', 'hash'] as const) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) {
      out[key] = value.trim().slice(0, 300);
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Parses the optional `<!-- summon: kind=...; shape=... -->` pragma comment.
 * Untagged exemplars default to `kind: 'shape'` with no specific shape — they
 * ship as catch-all anchors (the legacy behavior).
 */
function parseExemplarMeta(content: string): { kind: 'atom' | 'shape'; shape?: string } {
  const head = content.slice(0, 400);
  const m = /<!--\s*summon:\s*([^>]+?)\s*-->/.exec(head);
  if (!m) return { kind: 'shape' };
  const fields = new Map<string, string>();
  for (const part of m[1]!.split(';')) {
    const [k, v] = part.split('=').map((s) => s.trim());
    if (k && v !== undefined) fields.set(k, v);
  }
  const kind = fields.get('kind') === 'atom' ? 'atom' : 'shape';
  const shape = fields.get('shape');
  return { kind, shape };
}

/**
 * Enumerates `apps/server/directions/<id>/` and loads each. A direction must
 * have prompt.md and tokens.css; meta.json and exemplars/ are optional.
 */
export function loadDirections(): Direction[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = join(here, '..', 'directions');
  if (!existsSync(root)) return [];

  const entries = readdirSync(root)
    .filter((id) => {
      const full = join(root, id);
      return statSync(full).isDirectory();
    })
    .sort(compareDirectionIds);

  const directions: Direction[] = [];
  for (const id of entries) {
    const dir = join(root, id);
    const promptPath = join(dir, 'prompt.md');
    const tokensPath = join(dir, 'tokens.css');
    if (!existsSync(promptPath) || !existsSync(tokensPath)) {
      console.warn(`[directions] skipping "${id}" — missing prompt.md or tokens.css`);
      continue;
    }
    const meta = readMeta(dir);
    const tokensCss = readFileSync(tokensPath, 'utf-8');
    const prompt = readFileSync(promptPath, 'utf-8');
    const exemplars = readExemplars(dir);
    const opts = coerceOpts(meta.opts);
    const contract = compileDirectionContract({
      id,
      prompt,
      tokensCss,
      exemplars,
      opts,
    });
    const blocking = contract.issues.filter((issue) => issue.severity === 'block');
    const warnings = contract.issues.filter((issue) => issue.severity === 'warn');
    if (blocking.length > 0) {
      console.warn(
        `[directions] skipping "${id}" — token contract violations:\n  ${blocking.map((issue) => issue.message).join('\n  ')}`
      );
      continue;
    }
    if (warnings.length > 0) {
      console.warn(
        `[directions] "${id}" warnings:\n  ${warnings.map((issue) => issue.message).join('\n  ')}`
      );
    }
    const sourceExpression = readSourceExpression(meta.sourceExpression);
    directions.push({
      id,
      name: meta.name ?? (id.charAt(0).toUpperCase() + id.slice(1)),
      description: meta.description ?? '',
      prompt,
      tokensCss,
      exemplars,
      opts,
      liveOpportunistic: contract.tokenContract.liveOpportunistic,
      sourceExpression,
    });
  }
  return directions;
}

export function defaultDirectionId(directions: readonly Direction[]): string | undefined {
  return directions.find((direction) => direction.id === PREFERRED_DEFAULT_DIRECTION_ID)?.id
    ?? directions[0]?.id;
}

function compareDirectionIds(a: string, b: string): number {
  if (a === PREFERRED_DEFAULT_DIRECTION_ID) return -1;
  if (b === PREFERRED_DEFAULT_DIRECTION_ID) return 1;
  return a.localeCompare(b);
}
