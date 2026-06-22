import type {
  GhostIngestionContract,
  GhostTokenSourceKind,
} from '@summon-internal/engine';

export type { GhostIngestionContract };

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
