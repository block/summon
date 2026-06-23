export const GENERATION_FINGERPRINT_SELECTION_PREFIX = 'fingerprint:';

export interface GenerationFingerprintSteeringInput {
  id: string | null | undefined;
  targetPath?: string | null | undefined;
}

export interface GenerationGhostSteeringInput {
  rootId: string | null | undefined;
  targetPath?: string | null | undefined;
  baseDirectionId?: string | null | undefined;
}

export interface GenerationFingerprintSteeringPayload {
  fingerprint: {
    id: string;
    targetPath?: string;
  };
}

export interface GenerationGhostSteeringPayload {
  ghost: {
    rootId: string;
    targetPath?: string;
    baseDirectionId?: string;
  };
}

export type GenerationSteeringPayload =
  | GenerationFingerprintSteeringPayload
  | GenerationGhostSteeringPayload;

function normalizeOptionalString(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function fingerprintSelectionValue(fingerprintId: string): string {
  return `${GENERATION_FINGERPRINT_SELECTION_PREFIX}${fingerprintId}`;
}

export function fingerprintIdFromSelection(selection: string | null | undefined): string | null {
  if (!selection?.startsWith(GENERATION_FINGERPRINT_SELECTION_PREFIX)) return null;
  return selection.slice(GENERATION_FINGERPRINT_SELECTION_PREFIX.length) || null;
}

export function buildFingerprintSteeringPayload(
  input: GenerationFingerprintSteeringInput,
): GenerationFingerprintSteeringPayload | null {
  const id = normalizeOptionalString(input.id);
  if (!id) return null;
  const targetPath = normalizeOptionalString(input.targetPath);
  return {
    fingerprint: {
      id,
      ...(targetPath ? { targetPath } : {}),
    },
  };
}

export function buildGhostSteeringPayload(
  input: GenerationGhostSteeringInput,
): GenerationGhostSteeringPayload | null {
  const rootId = normalizeOptionalString(input.rootId);
  if (!rootId) return null;
  const targetPath = normalizeOptionalString(input.targetPath);
  const baseDirectionId = normalizeOptionalString(input.baseDirectionId);
  return {
    ghost: {
      rootId,
      ...(targetPath ? { targetPath } : {}),
      ...(baseDirectionId ? { baseDirectionId } : {}),
    },
  };
}
