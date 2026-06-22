import type { GhostIngestionContract } from '@summon-internal/engine';

export function ghostIngestionContractMeta(contract: GhostIngestionContract) {
  return {
    schema: contract.schema,
    product: contract.product,
    source: contract.source,
    selectedRefs: contract.relay.selectedRefs,
    inventory: contract.fingerprint.inventory,
    antiPatterns: contract.fingerprint.antiPatterns,
    style: contract.style,
    validation: {
      requiredSignals: contract.validation.requiredSignals.map(signalMeta),
      forbiddenSignals: contract.validation.forbiddenSignals.map(signalMeta),
      activeChecks: contract.validation.activeChecks,
    },
  };
}

function signalMeta(signal: GhostIngestionContract['validation']['requiredSignals'][number]) {
  return {
    id: signal.id,
    kind: signal.kind,
    label: signal.label,
    terms: signal.terms,
    severity: signal.severity,
    sourceRef: signal.sourceRef,
  };
}
