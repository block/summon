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
  };
}
