import type {
  ArrowSurfaceArtifact,
  ContractIssue,
  ProtocolLine,
  StreamGraphSnapshot,
  SurfacePlan,
  ValidationTool,
} from '@summon-internal/engine';
import {
  isArrowSurfaceArtifact,
  isProtocolLine,
  normalizeSurfacePlan,
  validateProtocolLine,
} from '@summon-internal/engine';

export const SUMMON_SURFACE_ENVELOPE_VERSION = 4;

export interface SurfaceEnvelope {
  version: 4;
  id: string;
  createdAt: string;
  prompt: string;
  surfacePlan: SurfacePlan;
  artifact: ArrowSurfaceArtifact;
  protocolLines: ProtocolLine[];
  validationIssues: ContractIssue[];
  streamGraph: StreamGraphSnapshot | null;
  grants: {
    tools: string[];
    validationTools?: ValidationTool[];
  };
  metadata: {
    directionId?: string | null;
    layoutId?: string | null;
    shape?: string | null;
    mode?: 'static' | 'interactive';
    validationMode?: 'observe';
  };
  tokenCss?: string | null;
  runtimeVersion: string;
}

export interface CreateSurfaceEnvelopeInput {
  id?: string;
  createdAt?: string | Date;
  prompt: string;
  surfacePlan: SurfacePlan;
  artifact: ArrowSurfaceArtifact;
  protocolLines: ProtocolLine[];
  validationIssues?: ContractIssue[];
  streamGraph?: StreamGraphSnapshot | null;
  grants: {
    tools: string[];
    validationTools?: ValidationTool[];
  };
  metadata?: SurfaceEnvelope['metadata'];
  tokenCss?: string | null;
  runtimeVersion?: string;
}

export function createSurfaceEnvelope(input: CreateSurfaceEnvelopeInput): SurfaceEnvelope {
  const createdAt = input.createdAt instanceof Date
    ? input.createdAt.toISOString()
    : input.createdAt ?? new Date().toISOString();
  const validationContext = validationContextForEnvelope(input);
  const observeValidation = input.metadata?.validationMode === 'observe';
  const protocolIssues: ContractIssue[] = [];
  const protocolLines = input.protocolLines.map((line) => {
    if (!observeValidation) {
      for (const issue of validateProtocolLine(line, validationContext)) {
        protocolIssues.push(issue);
      }
    }
    return { ...line };
  });
  return {
    version: SUMMON_SURFACE_ENVELOPE_VERSION,
    id: input.id ?? newEnvelopeId(),
    createdAt,
    prompt: input.prompt,
    surfacePlan: input.surfacePlan,
    artifact: input.artifact,
    protocolLines,
    validationIssues: [...(input.validationIssues ?? []), ...protocolIssues],
    streamGraph: input.streamGraph ?? null,
    grants: {
      tools: [...input.grants.tools],
      validationTools: input.grants.validationTools?.map((tool) => ({ ...tool })),
    },
    metadata: input.metadata ?? {},
    tokenCss: input.tokenCss ?? null,
    runtimeVersion: input.runtimeVersion ?? 'summon-surface-envelope-v4',
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
  if (isSurfaceEnvelope(parsed)) {
    return parsed;
  }
  return null;
}

export function isSurfaceEnvelope(value: unknown): value is SurfaceEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  if (input.version !== SUMMON_SURFACE_ENVELOPE_VERSION) return false;
  if (typeof input.id !== 'string' || !input.id) return false;
  if (typeof input.createdAt !== 'string' || Number.isNaN(Date.parse(input.createdAt))) return false;
  if (typeof input.prompt !== 'string') return false;
  if (!isArrowSurfaceArtifact(input.artifact)) return false;
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

  const validationContext = validationContextForEnvelope(input as unknown as CreateSurfaceEnvelopeInput);
  const observeValidation = (input.metadata as SurfaceEnvelope['metadata']).validationMode === 'observe';
  for (const line of input.protocolLines as ProtocolLine[]) {
    const issues = validateProtocolLine(line, validationContext);
    if (issues.some((issue) => issue.severity === 'block')) {
      if (!observeValidation) return false;
      const savedIssues = input.validationIssues as ContractIssue[];
      if (!issues.every((issue) => savedIssues.some((saved) => sameIssue(saved, issue)))) {
        return false;
      }
    }
  }

  return true;
}

function validationContextForEnvelope(input: {
  surfacePlan: SurfacePlan;
  grants: SurfaceEnvelope['grants'];
  metadata?: SurfaceEnvelope['metadata'];
}) {
  return {
    mode: input.metadata?.mode ?? (input.grants.tools.length === 0 ? 'static' as const : 'interactive' as const),
    tools: input.grants.validationTools,
    allowedTools: input.grants.tools,
    surfacePlan: input.surfacePlan,
  };
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
    Array.isArray(grants.tools) &&
    grants.tools.every((tool) => typeof tool === 'string') &&
    (
      grants.validationTools === undefined ||
      (
        Array.isArray(grants.validationTools) &&
        grants.validationTools.every(isValidationTool)
      )
    )
  );
}

function isValidationTool(value: unknown): value is ValidationTool {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const tool = value as Record<string, unknown>;
  return typeof tool.name === 'string' && tool.name.length > 0;
}

function isMetadata(value: unknown): value is SurfaceEnvelope['metadata'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const metadata = value as Record<string, unknown>;
  return (
    (metadata.directionId === undefined || metadata.directionId === null || typeof metadata.directionId === 'string') &&
    (metadata.layoutId === undefined || metadata.layoutId === null || typeof metadata.layoutId === 'string') &&
    (metadata.shape === undefined || metadata.shape === null || typeof metadata.shape === 'string') &&
    (metadata.mode === undefined || metadata.mode === 'static' || metadata.mode === 'interactive') &&
    (metadata.validationMode === undefined || metadata.validationMode === 'observe')
  );
}

function sameIssue(a: ContractIssue, b: ContractIssue): boolean {
  return (
    a.source === b.source &&
    a.severity === b.severity &&
    a.code === b.code &&
    a.message === b.message &&
    a.path === b.path
  );
}
