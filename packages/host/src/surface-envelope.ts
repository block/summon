import type {
  ContractIssue,
  ProtocolLine,
  StreamGraphSnapshot,
  SurfacePlan,
  ValidationCapability,
  ValidationComponent,
} from '@summon/engine';
import {
  isProtocolLine,
  normalizeSurfacePlan,
  surfacePlanScriptPolicy,
  validateHtmlFragment,
  validateProtocolLine,
} from '@summon/engine';

export const SUMMON_SURFACE_ENVELOPE_VERSION = 1;

export interface SurfaceEnvelope {
  version: 1;
  id: string;
  createdAt: string;
  prompt: string;
  surfacePlan: SurfacePlan;
  protocolLines: ProtocolLine[];
  html: string;
  validationIssues: ContractIssue[];
  streamGraph: StreamGraphSnapshot | null;
  grants: {
    intents: string[];
    capabilities?: ValidationCapability[];
    components?: ValidationComponent[];
  };
  metadata: {
    directionId?: string | null;
    layoutId?: string | null;
    shape?: string | null;
    mode?: 'static' | 'interactive';
  };
  tokenCss?: string | null;
  runtimeVersion: string;
}

export interface CreateSurfaceEnvelopeInput {
  id?: string;
  createdAt?: string | Date;
  prompt: string;
  surfacePlan: SurfacePlan;
  protocolLines: ProtocolLine[];
  html: string;
  validationIssues?: ContractIssue[];
  streamGraph?: StreamGraphSnapshot | null;
  grants: {
    intents: string[];
    capabilities?: ValidationCapability[];
    components?: ValidationComponent[];
  };
  metadata?: SurfaceEnvelope['metadata'];
  tokenCss?: string | null;
  runtimeVersion?: string;
}

export function createSurfaceEnvelope(input: CreateSurfaceEnvelopeInput): SurfaceEnvelope {
  const createdAt = input.createdAt instanceof Date
    ? input.createdAt.toISOString()
    : input.createdAt ?? new Date().toISOString();
  return {
    version: 1,
    id: input.id ?? newEnvelopeId(),
    createdAt,
    prompt: input.prompt,
    surfacePlan: input.surfacePlan,
    protocolLines: input.protocolLines.map((line) => ({ ...line })),
    html: input.html,
    validationIssues: input.validationIssues ?? [],
    streamGraph: input.streamGraph ?? null,
    grants: {
      intents: [...input.grants.intents],
      capabilities: input.grants.capabilities?.map((capability) => ({ ...capability })),
      components: input.grants.components?.map((component) => ({ ...component })),
    },
    metadata: input.metadata ?? {},
    tokenCss: input.tokenCss ?? null,
    runtimeVersion: input.runtimeVersion ?? 'summon-surface-envelope-v1',
  };
}

export function parseSurfaceEnvelope(raw: string | unknown): SurfaceEnvelope | null {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!isSurfaceEnvelope(parsed)) return null;
  return createSurfaceEnvelope(parsed);
}

export function isSurfaceEnvelope(value: unknown): value is SurfaceEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  if (input.version !== SUMMON_SURFACE_ENVELOPE_VERSION) return false;
  if (typeof input.id !== 'string' || !input.id) return false;
  if (typeof input.createdAt !== 'string' || Number.isNaN(Date.parse(input.createdAt))) return false;
  if (typeof input.prompt !== 'string') return false;
  if (typeof input.html !== 'string') return false;
  if (typeof input.runtimeVersion !== 'string' || !input.runtimeVersion) return false;

  const surfacePlan = normalizeSurfacePlan(input.surfacePlan);
  if (!surfacePlan) return false;

  if (!Array.isArray(input.protocolLines) || !input.protocolLines.every(isProtocolLine)) {
    return false;
  }
  if (!Array.isArray(input.validationIssues) || !input.validationIssues.every(isContractIssue)) {
    return false;
  }
  if (!isStreamGraphSnapshot(input.streamGraph)) return false;
  if (!isGrants(input.grants)) return false;
  if (!isMetadata(input.metadata)) return false;
  if (input.tokenCss !== undefined && input.tokenCss !== null && typeof input.tokenCss !== 'string') {
    return false;
  }

  const grants = input.grants as SurfaceEnvelope['grants'];
  const metadata = input.metadata as SurfaceEnvelope['metadata'];
  const validationContext = {
    mode: metadata.mode ?? (surfacePlan.runtime === 'static' ? 'static' as const : 'interactive' as const),
    scriptPolicy: surfacePlanScriptPolicy(surfacePlan),
    capabilities: grants.capabilities,
    components: grants.components,
    allowedIntents: grants.intents,
    surfacePlan,
  };
  for (const line of input.protocolLines as ProtocolLine[]) {
    const issues = validateProtocolLine(line, validationContext);
    if (issues.some((issue) => issue.severity === 'block')) return false;
  }
  const htmlIssues = validateHtmlFragment(input.html, validationContext);
  if (htmlIssues.some((issue) => issue.severity === 'block')) return false;

  return true;
}

function newEnvelopeId(): string {
  const cryptoLike = globalThis.crypto as Crypto | undefined;
  if (cryptoLike?.randomUUID) return cryptoLike.randomUUID();
  return `surface-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function isContractIssue(value: unknown): value is ContractIssue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const issue = value as Record<string, unknown>;
  return (
    typeof issue.source === 'string' &&
    (issue.severity === 'block' || issue.severity === 'warn') &&
    typeof issue.code === 'string' &&
    typeof issue.message === 'string' &&
    (issue.path === undefined || typeof issue.path === 'string') &&
    (issue.hint === undefined || typeof issue.hint === 'string')
  );
}

function isStreamGraphSnapshot(value: unknown): value is StreamGraphSnapshot | null {
  if (value === null) return true;
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isGrants(value: unknown): value is SurfaceEnvelope['grants'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const grants = value as Record<string, unknown>;
  return (
    Array.isArray(grants.intents) &&
    grants.intents.every((intent) => typeof intent === 'string') &&
    (
      grants.capabilities === undefined ||
      (
        Array.isArray(grants.capabilities) &&
        grants.capabilities.every(isValidationCapability)
      )
    ) &&
    (
      grants.components === undefined ||
      (
        Array.isArray(grants.components) &&
        grants.components.every(isValidationComponent)
      )
    )
  );
}

function isValidationCapability(value: unknown): value is ValidationCapability {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const capability = value as Record<string, unknown>;
  return typeof capability.name === 'string' && capability.name.length > 0;
}

function isValidationComponent(value: unknown): value is ValidationComponent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const component = value as Record<string, unknown>;
  return typeof component.name === 'string' && component.name.length > 0;
}

function isMetadata(value: unknown): value is SurfaceEnvelope['metadata'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const metadata = value as Record<string, unknown>;
  return (
    (metadata.directionId === undefined || metadata.directionId === null || typeof metadata.directionId === 'string') &&
    (metadata.layoutId === undefined || metadata.layoutId === null || typeof metadata.layoutId === 'string') &&
    (metadata.shape === undefined || metadata.shape === null || typeof metadata.shape === 'string') &&
    (metadata.mode === undefined || metadata.mode === 'static' || metadata.mode === 'interactive')
  );
}
