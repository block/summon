import {
  contractIssue,
  type ContractIssue,
  type GhostFidelitySignal,
  type GhostRuntimeCheck,
} from '@summon-internal/engine';
import type {
  GhostFidelityResult,
  GhostFidelitySignalResult,
  GhostFidelityValidation,
  GhostFidelityValidationInput,
  GhostRuntimeCheckResult,
} from './types.js';
import { normalizeFidelityText } from './util.js';

export function validateGhostFidelity(input: GhostFidelityValidationInput): GhostFidelityValidation {
  const ghost = input.ghost;
  if (!ghost) return { issues: [], summary: null };

  const entry = input.source['main.ts'] ?? input.source['main.js'] ?? '';
  const css = input.source['main.css'] ?? '';
  const combined = `${entry}\n${css}`;
  const searchable = normalizeFidelityText(combined);
  const issues: ContractIssue[] = [];

  if (!/<main\b/i.test(entry)) {
    issues.push(contractIssue({
      source: 'system',
      severity: 'block',
      code: 'ghost-fidelity-missing-shell',
      message: 'Ghost-driven Summon artifacts must use a composed root <main> shell from the fingerprint visual grammar.',
      path: '/artifact/source/main',
      hint: 'Recompose the artifact around a fingerprint-specific outer <main> shell before rendering sections or controls.',
    }));
  }

  if (!input.source['main.css'] || css.trim().length < 240) {
    issues.push(contractIssue({
      source: 'system',
      severity: 'block',
      code: 'ghost-fidelity-visual-underfit',
      message: 'Ghost-driven Summon artifacts must include substantial fingerprint-specific CSS; this artifact is visually underfit.',
      path: '/artifact/source/main.css',
      hint: 'Add composed CSS for the selected fingerprint shell, hierarchy, spacing rhythm, typography, surface treatment, and responsive layout.',
    }));
  }

  const genericCardGrid = /\b(cards?|card-grid|grid-cards)\b/i.test(combined) &&
    !/\b(evidence|criterion|criteria|ruled|folio|broadsheet|ledger|shell|spread|note|field)\b/i.test(combined);
  if (genericCardGrid) {
    issues.push(contractIssue({
      source: 'system',
      severity: 'block',
      code: 'ghost-fidelity-generic-card-grid',
      message: 'The artifact appears to use a generic card layout instead of a fingerprint-specific composition shell.',
      path: '/artifact/source',
      hint: 'Replace generic cards with the Ghost fingerprint composition pattern: ruled evidence, editorial spread, staged notes, ledger rows, or another named fingerprint shell as appropriate.',
    }));
  }

  const ingestion = ghost.ingestion ?? null;
  if (!ingestion) return { issues, summary: null };

  const requiredResults: GhostFidelitySignalResult[] = [];
  let compositionSignals = 0;
  let compositionMatches = 0;
  let tokenSignals = 0;
  let tokenMatches = 0;
  let inventorySignals = 0;
  let inventoryMatches = 0;
  for (const signal of ingestion.validation.requiredSignals) {
    const result = evaluateRequiredSignal(signal, searchable);
    requiredResults.push(result);
    if (signal.kind === 'composition') {
      compositionSignals += 1;
      if (result.matchedTerms.length > 0) compositionMatches += 1;
    }
    if (signal.kind === 'token') {
      tokenSignals += 1;
      if (result.matchedTerms.length > 0) tokenMatches += 1;
    }
    if (signal.kind === 'inventory') {
      inventorySignals += 1;
      if (result.matchedTerms.length > 0) inventoryMatches += 1;
    }
    if (result.status !== 'pass') {
      issues.push(contractIssue({
        source: 'system',
        severity: signal.kind === 'composition' ? 'warn' : signal.severity,
        code: `ghost-fidelity-required-${signal.kind}`,
        message: signal.message ?? `Ghost fidelity signal missing: ${signal.label}`,
        path: '/artifact/source',
        hint: signal.hint ?? `Add visible artifact evidence for ${signal.sourceRef ?? signal.label}: ${result.missingTerms.join(', ')}`,
      }));
    }
  }

  const compositionBlocked = compositionSignals > 0 && compositionMatches === 0;
  if (compositionBlocked) {
    issues.push(contractIssue({
      source: 'system',
      severity: 'block',
      code: 'ghost-fidelity-no-composition-evidence',
      message: 'Ghost-driven artifact has no detectable evidence of any selected fingerprint composition pattern.',
      path: '/artifact/source',
      hint: 'Recompose around a selected Ghost composition shell and include visible vocabulary from the fingerprint pattern in structure, class names, copy, or CSS comments.',
    }));
  }

  const forbiddenResults: GhostFidelitySignalResult[] = [];
  for (const signal of ingestion.validation.forbiddenSignals) {
    const result = evaluateForbiddenSignal(signal, searchable);
    forbiddenResults.push(result);
    if (result.status !== 'pass') {
      issues.push(contractIssue({
        source: 'system',
        severity: signal.severity,
        code: 'ghost-fidelity-forbidden-anti-pattern',
        message: signal.message ?? `Ghost anti-pattern present: ${signal.label}`,
        path: '/artifact/source',
        hint: signal.hint ?? `Remove anti-pattern evidence: ${result.matchedTerms.join(', ')}`,
      }));
    }
  }

  const activeCheckResults: GhostRuntimeCheckResult[] = [];
  for (const check of ingestion.validation.activeChecks) {
    const result = evaluateGhostRuntimeCheck(check, combined, searchable);
    activeCheckResults.push(result);
    if (result.status !== 'pass') {
      issues.push(contractIssue({
        source: 'system',
        severity: check.severity,
        code: 'ghost-fidelity-active-check',
        message: `Ghost active check failed (${check.id}): ${check.title}`,
        path: '/artifact/source',
        hint: check.repair ?? `Satisfy Ghost check ${check.id}: ${check.detector.pattern}`,
      }));
    }
  }

  const summary: GhostFidelityResult = {
    schema: 'summon.ghost-fidelity/v1',
    status: issues.some((issue) => issue.severity === 'block')
      ? 'block'
      : issues.some((issue) => issue.severity === 'warn')
        ? 'warn'
        : 'pass',
    requiredSignals: requiredResults,
    forbiddenSignals: forbiddenResults,
    activeChecks: activeCheckResults,
    aggregates: {
      compositionSignals: { total: compositionSignals, matched: compositionMatches, blocked: compositionBlocked },
      tokenSignals: { total: tokenSignals, matched: tokenMatches },
      inventorySignals: { total: inventorySignals, matched: inventoryMatches },
    },
  };

  return { issues, summary };
}

function evaluateRequiredSignal(signal: GhostFidelitySignal, searchable: string): GhostFidelitySignalResult {
  const matchedTerms = signal.terms.filter((term) => termMatches(term, searchable));
  const missingTerms = signal.terms.filter((term) => !termMatches(term, searchable));
  const threshold = signal.kind === 'token' || signal.kind === 'inventory' ? 1 : Math.min(2, signal.terms.length);
  const pass = matchedTerms.length >= threshold;
  return {
    id: signal.id,
    kind: signal.kind,
    sourceRef: signal.sourceRef,
    label: signal.label,
    status: pass ? 'pass' : signal.severity === 'block' ? 'block' : 'warn',
    severity: signal.severity,
    matchedTerms,
    missingTerms,
  };
}

function evaluateForbiddenSignal(signal: GhostFidelitySignal, searchable: string): GhostFidelitySignalResult {
  const matchedTerms = signal.terms.filter((term) => termMatches(term, searchable));
  const missingTerms = signal.terms.filter((term) => !termMatches(term, searchable));
  const threshold = Math.min(2, signal.terms.length);
  const blocked = matchedTerms.length >= threshold;
  return {
    id: signal.id,
    kind: signal.kind,
    sourceRef: signal.sourceRef,
    label: signal.label,
    status: blocked ? signal.severity === 'block' ? 'block' : 'warn' : 'pass',
    severity: signal.severity,
    matchedTerms,
    missingTerms,
  };
}

function evaluateGhostRuntimeCheck(
  check: GhostRuntimeCheck,
  combined: string,
  searchable: string,
): GhostRuntimeCheckResult {
  const expectation = check.expectation ?? 'present';
  let found = false;
  let matched: string | undefined;
  if (check.detector.type === 'regex') {
    try {
      const match = combined.match(new RegExp(check.detector.pattern, 'i'));
      found = Boolean(match);
      matched = match?.[0];
    } catch {
      found = searchable.includes(normalizeFidelityText(check.detector.pattern));
      matched = found ? check.detector.pattern : undefined;
    }
  } else {
    found = searchable.includes(normalizeFidelityText(check.detector.pattern));
    matched = found ? check.detector.pattern : undefined;
  }
  const passed = expectation === 'absent' ? !found : found;
  return {
    id: check.id,
    title: check.title,
    status: passed ? 'pass' : check.severity === 'block' ? 'block' : 'warn',
    severity: check.severity,
    matched,
    message: passed ? undefined : `${expectation === 'absent' ? 'Forbidden' : 'Required'} Ghost check pattern ${expectation === 'absent' ? 'was present' : 'was missing'}: ${check.detector.pattern}`,
  };
}

function termMatches(term: string, searchable: string): boolean {
  const normalized = normalizeFidelityText(term.startsWith('--') ? term : term.replace(/^--/, ''));
  if (!normalized.trim()) return false;
  const tokenNeedle = term.startsWith('--') ? term.toLowerCase() : normalized;
  return searchable.includes(normalized) || searchable.includes(tokenNeedle);
}
