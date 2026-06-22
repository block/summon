import type {
  ContractIssue,
  ContractIssueSeverity,
  GhostFidelitySignal,
  GhostFidelitySignalKind,
  GhostGenerationContext,
  GhostIngestionContract,
  GhostRuntimeCheck,
  GhostTokenSourceKind,
} from '@summon-internal/engine';

export type {
  GhostFidelitySignal,
  GhostFidelitySignalKind,
  GhostIngestionContract,
  GhostRuntimeCheck,
};

export interface RawGhostFingerprintBundle {
  manifest?: Record<string, unknown>;
  prose?: Record<string, unknown>;
  inventory?: Record<string, unknown>;
  composition?: Record<string, unknown>;
  checks?: Record<string, unknown>;
  intent?: string | null;
}

export interface GhostRelayNode {
  ref: string;
  summary: string;
  details: string[];
}

export interface GhostRelayEntrypointLike {
  identity: {
    product: string;
    audience: string[];
    goals: string[];
    antiGoals: string[];
    tradeoffs: string[];
    tone: string[];
  };
  actionContract: {
    preserve: string[];
    inspect: Array<{ path: string; reason: string }>;
    avoid: string[];
    validate: string[];
  };
  selected: {
    prose: GhostRelayNode[];
    composition: GhostRelayNode[];
    exemplars: GhostRelayNode[];
    checks: GhostRelayNode[];
  };
  suggestedReads: Array<{ path: string; reason: string }>;
  omissions: Array<{ label: string; omitted: number; source: string }>;
}

export interface GhostCompileInput {
  source: 'root' | 'catalog';
  sourceId: string;
  product: string;
  targetPath: string | null;
  memoryDir?: string | null;
  entrypoint: GhostRelayEntrypointLike;
  tokenSource: {
    kind: GhostTokenSourceKind;
    source: string;
    css: string;
    warnings: string[];
  };
  raw: RawGhostFingerprintBundle;
}

export interface GhostFidelitySignalResult {
  id: string;
  kind: GhostFidelitySignalKind;
  sourceRef?: string;
  label: string;
  status: 'pass' | 'warn' | 'block';
  severity: ContractIssueSeverity;
  matchedTerms: string[];
  missingTerms: string[];
}

export interface GhostRuntimeCheckResult {
  id: string;
  title: string;
  status: 'pass' | 'warn' | 'block';
  severity: ContractIssueSeverity;
  matched?: string;
  message?: string;
}

export interface GhostFidelityResult {
  schema: 'summon.ghost-fidelity/v1';
  status: 'pass' | 'warn' | 'block';
  requiredSignals: GhostFidelitySignalResult[];
  forbiddenSignals: GhostFidelitySignalResult[];
  activeChecks: GhostRuntimeCheckResult[];
  aggregates: {
    compositionSignals: { total: number; matched: number; blocked: boolean };
    tokenSignals: { total: number; matched: number };
    inventorySignals: { total: number; matched: number };
  };
}

export interface GhostFidelityValidation {
  issues: ContractIssue[];
  summary: GhostFidelityResult | null;
}

export interface GhostFidelityValidationInput {
  source: Record<string, string>;
  ghost: GhostGenerationContext | null;
}
