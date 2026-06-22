import type { GhostIngestionContract } from '@summon-internal/engine';
import { buildRuntimeChecks } from './checks.js';
import { buildGhostContractPrompt, buildGhostValidationPrompt } from './prompt.js';
import {
  buildForbiddenSignals,
  buildRequiredSignals,
  customTokenNames,
  definedTokenNames,
  extractInventoryContract,
  extractRawAntiPatterns,
  isAvoidanceLine,
  nodeSummary,
} from './signals.js';
import type { GhostCompileInput } from './types.js';
import { uniqueStrings } from './util.js';

export function compileGhostIngestionContract(input: GhostCompileInput): GhostIngestionContract {
  const entrypoint = input.entrypoint;
  const prose = entrypoint.selected.prose.map(nodeSummary);
  const composition = entrypoint.selected.composition.map(nodeSummary);
  const checks = entrypoint.selected.checks.map(nodeSummary);
  const inventory = extractInventoryContract(input.raw.inventory, entrypoint.selected.exemplars.map(nodeSummary));
  const antiPatterns = uniqueStrings([
    ...entrypoint.actionContract.avoid,
    ...prose.flatMap((node) => node.details.filter(isAvoidanceLine)),
    ...composition.flatMap((node) => node.details.filter(isAvoidanceLine)),
    ...extractRawAntiPatterns(input.raw),
  ]).slice(0, 24);
  const tokenNames = definedTokenNames(input.tokenSource.css);
  const requiredSignals = buildRequiredSignals({ prose, composition, inventory, tokenNames });
  const forbiddenSignals = buildForbiddenSignals(antiPatterns);
  const activeChecks = buildRuntimeChecks(input.raw.checks);

  return {
    schema: 'summon.ghost-ingestion/v1',
    product: input.product,
    source: {
      kind: input.source,
      id: input.sourceId,
      targetPath: input.targetPath,
      memoryDir: input.memoryDir,
    },
    relay: {
      taskContract: entrypoint.actionContract,
      selectedRefs: {
        prose: prose.map((node) => node.ref),
        composition: composition.map((node) => node.ref),
        inventory: inventory.refs,
        checks: checks.map((node) => node.ref),
      },
      suggestedReads: entrypoint.suggestedReads,
      omissions: entrypoint.omissions,
    },
    fingerprint: {
      identity: entrypoint.identity,
      prose,
      composition,
      inventory,
      checks,
      antiPatterns,
    },
    style: {
      tokenSource: input.tokenSource.kind,
      source: input.tokenSource.source,
      definedTokens: tokenNames,
      customTokens: customTokenNames(tokenNames),
      warnings: input.tokenSource.warnings,
    },
    promptBlocks: [
      { id: 'contract', text: buildGhostContractPrompt({ prose, composition, inventory, checks, antiPatterns, tokenNames, entrypoint }) },
      { id: 'validation', text: buildGhostValidationPrompt({ requiredSignals, forbiddenSignals, activeChecks }) },
    ],
    validation: {
      requiredSignals,
      forbiddenSignals,
      activeChecks,
    },
  };
}
