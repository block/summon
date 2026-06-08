import {
  type CapabilityPack,
  type CapabilityPattern,
  type CapabilityStateKeys,
  type CapabilitySurface,
  type CapabilityTrigger,
  type IntentSpec,
} from '@anarchitecture/summon';

/**
 * Validate a capability pack sent by the client. The server is intent-agnostic
 * — it accepts whatever the client declares, capping sizes to protect the
 * prompt budget. If the shape is invalid, returns null (generates without
 * capabilities), rather than rejecting the whole request.
 */
export function parseCapabilityPack(raw: unknown): CapabilityPack | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const rawIntents = obj.intents;
  if (!Array.isArray(rawIntents)) return null;
  const intents: IntentSpec[] = [];
  for (const r of rawIntents) {
    if (!r || typeof r !== 'object') continue;
    const i = r as Record<string, unknown>;
    if (typeof i.name !== 'string' || !i.name || !/^[a-z][a-z0-9_]{0,39}$/i.test(i.name)) continue;
    const kind = i.kind === 'resource' ? 'resource' : i.kind === 'action' ? 'action' : undefined;
    const intent: IntentSpec = {
      name: i.name,
      description: String(i.description ?? '').slice(0, 500),
      argsSchema: String(i.argsSchema ?? '{}').slice(0, 200),
      stateShape: String(i.stateShape ?? '{}').slice(0, 400),
      ...(kind ? { kind } : {}),
      ...parseCapabilityTriggers(i.triggers),
      ...parseCapabilityStateKeys(i.stateKeys),
      ...parseCapabilitySurface(i.surface),
    };
    if (typeof i.resultSchema === 'string') {
      intent.resultSchema = i.resultSchema.slice(0, 400);
    }
    if (typeof i.defaultDataShape === 'string') {
      intent.defaultDataShape = i.defaultDataShape.slice(0, 400);
    }
    if (Object.prototype.hasOwnProperty.call(i, 'defaultData') && isSmallJsonValue(i.defaultData, 2000)) {
      intent.defaultData = i.defaultData;
    }
    intents.push(intent);
    if (intents.length >= 32) break;
  }
  if (intents.length === 0) return null;

  const rawPatterns = obj.patterns;
  const patterns: CapabilityPattern[] = [];
  if (Array.isArray(rawPatterns)) {
    for (const r of rawPatterns) {
      if (!r || typeof r !== 'object') continue;
      const p = r as Record<string, unknown>;
      if (typeof p.name !== 'string' || typeof p.code !== 'string') continue;
      patterns.push({ name: p.name.slice(0, 100), code: p.code.slice(0, 4000) });
      if (patterns.length >= 12) break;
    }
  }

  return { intents, patterns: patterns.length > 0 ? patterns : undefined };
}

function isSmallJsonValue(value: unknown, maxChars: number): boolean {
  try {
    return JSON.stringify(value).length <= maxChars;
  } catch {
    return false;
  }
}

function parseCapabilityTriggers(raw: unknown): { triggers?: CapabilityTrigger[] } {
  if (!Array.isArray(raw)) return {};
  const allowed = new Set<CapabilityTrigger>(['click', 'submit', 'mount']);
  const triggers = raw.filter(
    (trigger): trigger is CapabilityTrigger =>
      typeof trigger === 'string' && allowed.has(trigger as CapabilityTrigger),
  );
  return triggers.length > 0 ? { triggers: Array.from(new Set(triggers)) } : {};
}

function parseCapabilityStateKeys(raw: unknown): { stateKeys?: CapabilityStateKeys } {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  const stateKeys: CapabilityStateKeys = {};
  for (const key of ['loading', 'data', 'error'] as const) {
    const value = obj[key];
    if (typeof value === 'string' && /^[a-zA-Z_$][\w$.-]{0,79}$/.test(value)) {
      stateKeys[key] = value;
    }
  }
  return Object.keys(stateKeys).length > 0 ? { stateKeys } : {};
}

function parseCapabilitySurface(raw: unknown): { surface?: CapabilitySurface } {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  const surface: CapabilitySurface = {};
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
