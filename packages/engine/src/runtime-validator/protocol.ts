import type { ContractIssue } from '../contracts.js';
import type { ProtocolLine } from '../protocol.js';
import { validateArrowSurfaceArtifact } from '../arrow-artifact.js';
import { normalizeValidationLimits } from '../validation-limits.js';
import { protocolBlock } from './issues.js';
import type { ValidationContext } from './types.js';

const META_PATH_RE = /^\/[a-z][a-z0-9-/]{0,119}$/;
const HOST_OWNED_META_PATHS = new Set(['/surface-policy', '/surface-plan', '/surface-contract']);

export function validateProtocolLine(
  line: ProtocolLine,
  context: ValidationContext,
): ContractIssue[] {
  const issues: ContractIssue[] = [];
  const limits = normalizeValidationLimits(context.limits);

  if (line.op === 'meta') {
    if (!META_PATH_RE.test(line.path)) {
      issues.push(protocolBlock('invalid-meta-path', `Invalid meta path "${line.path}"`, line.path));
    }
    if (HOST_OWNED_META_PATHS.has(line.path)) {
      issues.push(protocolBlock(
        'host-owned-meta',
        `Generated artifacts cannot emit host-owned meta path "${line.path}"`,
        line.path,
      ));
    }
    return issues;
  }

  if (line.op === 'artifact') {
    if (!line.value || typeof line.value !== 'object') {
      issues.push(protocolBlock('invalid-arrow-artifact', 'Artifact line value must be an Arrow artifact object', line.path));
      return issues;
    }
    issues.push(...validateArrowSurfaceArtifact(line.value as never, {
      maxSourceBytes: limits.maxProtocolLineBytes,
      network: context.surfacePlan?.network ?? 'none',
    }));
  }

  return issues;
}
