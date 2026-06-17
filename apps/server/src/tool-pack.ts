import {
  type ToolPack,
  type ToolPattern,
  type ToolStateKeys,
  type ToolSurface,
  type ToolTrigger,
  type ToolSpec,
} from '@anarchitecture/summon';

/**
 * Validate a tool pack sent by the client. The server is tool-agnostic
 * — it accepts whatever the client declares, capping sizes to protect the
 * prompt budget. If the shape is invalid, returns null (generates without
 * tools), rather than rejecting the whole request.
 */
export function parseToolPack(raw: unknown): ToolPack | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const rawTools = obj.tools;
  if (!Array.isArray(rawTools)) return null;
  const tools: ToolSpec[] = [];
  for (const r of rawTools) {
    if (!r || typeof r !== 'object') continue;
    const i = r as Record<string, unknown>;
    if (typeof i.name !== 'string' || !i.name || !/^[a-z][a-z0-9_]{0,39}$/i.test(i.name)) continue;
    const kind = i.kind === 'resource' ? 'resource' : i.kind === 'action' ? 'action' : undefined;
    const tool: ToolSpec = {
      name: i.name,
      description: String(i.description ?? '').slice(0, 500),
      argsSchema: String(i.argsSchema ?? '{}').slice(0, 200),
      stateShape: String(i.stateShape ?? '{}').slice(0, 400),
      ...(kind ? { kind } : {}),
      ...parseToolTriggers(i.triggers),
      ...parseToolStateKeys(i.stateKeys),
      ...parseToolSurface(i.surface),
    };
    if (typeof i.resultSchema === 'string') {
      tool.resultSchema = i.resultSchema.slice(0, 400);
    }
    if (typeof i.defaultDataShape === 'string') {
      tool.defaultDataShape = i.defaultDataShape.slice(0, 400);
    }
    if (Object.prototype.hasOwnProperty.call(i, 'defaultData') && isSmallJsonValue(i.defaultData, 2000)) {
      tool.defaultData = i.defaultData;
    }
    tools.push(tool);
    if (tools.length >= 32) break;
  }
  if (tools.length === 0) return null;

  const rawPatterns = obj.patterns;
  const patterns: ToolPattern[] = [];
  if (Array.isArray(rawPatterns)) {
    for (const r of rawPatterns) {
      if (!r || typeof r !== 'object') continue;
      const p = r as Record<string, unknown>;
      if (typeof p.name !== 'string' || typeof p.code !== 'string') continue;
      patterns.push({
        name: p.name.slice(0, 100),
        code: p.code.slice(0, 4000),
        ...(typeof p.tool === 'string' && p.tool ? { tool: p.tool.slice(0, 40) } : {}),
      });
      if (patterns.length >= 12) break;
    }
  }

  return { tools, patterns: patterns.length > 0 ? patterns : undefined };
}

function isSmallJsonValue(value: unknown, maxChars: number): boolean {
  try {
    return JSON.stringify(value).length <= maxChars;
  } catch {
    return false;
  }
}

function parseToolTriggers(raw: unknown): { triggers?: ToolTrigger[] } {
  if (!Array.isArray(raw)) return {};
  const allowed = new Set<ToolTrigger>(['click', 'submit', 'mount']);
  const triggers = raw.filter(
    (trigger): trigger is ToolTrigger =>
      typeof trigger === 'string' && allowed.has(trigger as ToolTrigger),
  );
  return triggers.length > 0 ? { triggers: Array.from(new Set(triggers)) } : {};
}

function parseToolStateKeys(raw: unknown): { stateKeys?: ToolStateKeys } {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  const stateKeys: ToolStateKeys = {};
  for (const key of ['loading', 'data', 'error'] as const) {
    const value = obj[key];
    if (typeof value === 'string' && /^[a-zA-Z_$][\w$.-]{0,79}$/.test(value)) {
      stateKeys[key] = value;
    }
  }
  return Object.keys(stateKeys).length > 0 ? { stateKeys } : {};
}

function parseToolSurface(raw: unknown): { surface?: ToolSurface } {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  const surface: ToolSurface = {};
  if (obj.data === 'host-resource' || obj.data === 'worker') {
    surface.data = obj.data;
  }
  if (
    obj.authority === 'read' ||
    obj.authority === 'host-action' ||
    obj.authority === 'approval-gated'
  ) {
    surface.authority = obj.authority;
  }
  return Object.keys(surface).length > 0 ? { surface } : {};
}
