export interface ValidationLimits {
  maxProtocolLineBytes: number;
  maxSections: number;
  maxSectionHtmlBytes: number;
  maxDomDepth: number;
  maxDomNodes: number;
  maxCssBytes: number;
  maxRepairAttempts: number;
}

export const DEFAULT_VALIDATION_LIMITS: ValidationLimits = {
  maxProtocolLineBytes: 256 * 1024,
  maxSections: 5,
  maxSectionHtmlBytes: 120 * 1024,
  maxDomDepth: 80,
  maxDomNodes: 5000,
  maxCssBytes: 64 * 1024,
  maxRepairAttempts: 3,
};

export function normalizeValidationLimits(
  overrides: Partial<ValidationLimits> | undefined,
): ValidationLimits {
  if (!overrides) return DEFAULT_VALIDATION_LIMITS;
  return {
    maxProtocolLineBytes: positiveInt(
      overrides.maxProtocolLineBytes,
      DEFAULT_VALIDATION_LIMITS.maxProtocolLineBytes,
    ),
    maxSections: positiveInt(overrides.maxSections, DEFAULT_VALIDATION_LIMITS.maxSections),
    maxSectionHtmlBytes: positiveInt(
      overrides.maxSectionHtmlBytes,
      DEFAULT_VALIDATION_LIMITS.maxSectionHtmlBytes,
    ),
    maxDomDepth: positiveInt(overrides.maxDomDepth, DEFAULT_VALIDATION_LIMITS.maxDomDepth),
    maxDomNodes: positiveInt(overrides.maxDomNodes, DEFAULT_VALIDATION_LIMITS.maxDomNodes),
    maxCssBytes: positiveInt(overrides.maxCssBytes, DEFAULT_VALIDATION_LIMITS.maxCssBytes),
    maxRepairAttempts: positiveInt(
      overrides.maxRepairAttempts,
      DEFAULT_VALIDATION_LIMITS.maxRepairAttempts,
    ),
  };
}

function positiveInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value));
}
