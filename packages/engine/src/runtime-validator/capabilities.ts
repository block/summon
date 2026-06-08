import {
  defaultTriggersForKind,
  type CapabilityTrigger,
} from '../capability-contract.js';
import type { ContractIssue } from '../contracts.js';
import type { SurfaceAuthority } from '../surface-plan.js';
import { block } from './issues.js';
import type { RuntimeCapability, ValidationContext } from './types.js';

export function buildCapabilityMap(context: ValidationContext): Map<string, RuntimeCapability> {
  const out = new Map<string, RuntimeCapability>();

  if (context.capabilities) {
    for (const capability of context.capabilities) {
      const triggers: CapabilityTrigger[] = capability.triggers?.length
        ? capability.triggers
        : defaultTriggersForKind(capability.kind ?? 'action');
      out.set(capability.name, {
        name: capability.name,
        kind: capability.kind ?? 'action',
        triggers: new Set(triggers),
        stateKeys: capability.stateKeys,
        surface: capability.surface,
      });
    }
    return out;
  }

  for (const name of context.allowedIntents ?? []) {
    out.set(name, {
      name,
      kind: 'action',
      triggers: new Set(defaultTriggersForKind('action')),
    });
  }

  return out;
}

export function validateSurfaceCapability(
  capability: RuntimeCapability,
  context: ValidationContext,
  issues: ContractIssue[],
): void {
  const plan = context.surfacePlan;
  if (!plan) return;

  if (plan.runtime === 'static') {
    issues.push(
      block(
        'surface-runtime-exceeded',
        `Static surface cannot use capability "${capability.name}"`,
      ),
    );
  }
  if (plan.runtime === 'worker' && capability.surface?.data !== 'worker') {
    issues.push(
      block(
        'surface-runtime-exceeded',
        `Worker surface can only use worker-backed capabilities; "${capability.name}" is not worker-backed`,
      ),
    );
  }

  const capabilityData = capability.surface?.data ??
    (capability.kind === 'resource' ? 'host-resource' : undefined);
  if (plan.data === 'embedded' && capability.kind === 'resource') {
    issues.push(
      block(
        'surface-data-exceeded',
        `Embedded-data surface cannot use data resource "${capability.name}"`,
      ),
    );
  }
  if (plan.data === 'host-resource' && capabilityData === 'worker') {
    issues.push(
      block(
        'surface-data-exceeded',
        `Host-resource surface cannot use worker-backed capability "${capability.name}"`,
      ),
    );
  }
  if (plan.data === 'worker' && capabilityData !== 'worker') {
    issues.push(
      block(
        'surface-data-exceeded',
        `Worker-data surface can only use worker-backed capabilities; "${capability.name}" is not worker-backed`,
      ),
    );
  }

  const capabilityAuthority = capability.surface?.authority ??
    (capability.kind === 'resource' ? 'read' : 'host-action');
  if (!authorityAllows(plan.authority, capabilityAuthority)) {
    issues.push(
      block(
        'surface-authority-exceeded',
        `Surface authority "${plan.authority}" cannot use "${capability.name}" (${capabilityAuthority})`,
      ),
    );
  }
}

function authorityAllows(plan: SurfaceAuthority, capability: SurfaceAuthority): boolean {
  switch (plan) {
    case 'none':
      return false;
    case 'read':
      return capability === 'read';
    case 'host-action':
      return capability === 'read' || capability === 'host-action';
    case 'approval-gated':
      return capability === 'approval-gated';
  }
}
