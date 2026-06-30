import type { ContractIssue } from '../contracts.js';
import {
  isSurfaceEvent,
  type ProtocolLine,
} from '../protocol.js';
import { validateArrowSurfaceArtifact } from '../arrow-artifact.js';
import { validateDomjsSurfaceArtifact } from '../domjs-artifact.js';
import {
  validateHtmlSurfaceArtifact,
  validateHtmlSurfacePatch,
} from '../html-artifact.js';
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

  if (line.op === 'event') {
    if (!isSurfaceEvent(line.value)) {
      issues.push(protocolBlock('invalid-surface-event', 'Surface event value is not a valid V2 preview event', line.path));
    }
    return issues;
  }

  if (line.op === 'artifact') {
    if (!line.value || typeof line.value !== 'object') {
      issues.push(protocolBlock('invalid-artifact', 'Artifact line value must be an artifact object', line.path));
      return issues;
    }
    const runtime = (line.value as { runtime?: unknown }).runtime;
    if (runtime === 'arrow') {
      issues.push(...validateArrowSurfaceArtifact(line.value as never, {
        maxSourceBytes: limits.maxProtocolLineBytes,
        network: context.surfacePlan?.network ?? 'none',
      }));
    } else if (runtime === 'html') {
      issues.push(...validateHtmlSurfaceArtifact(line.value as never, {
        allowScript: context.experimentalHtmlScript === true,
        maxSourceBytes: limits.maxProtocolLineBytes,
        maxCssBytes: limits.maxCssBytes,
        maxDomDepth: limits.maxDomDepth,
        maxDomNodes: limits.maxDomNodes,
      }));
    } else if (runtime === 'domjs') {
      issues.push(...validateDomjsSurfaceArtifact(line.value as never, {
        maxSourceBytes: limits.maxProtocolLineBytes,
      }));
    } else {
      issues.push(protocolBlock('invalid-artifact-runtime', 'Artifact runtime must be "arrow" or experimental "html"/"domjs"', line.path));
    }
    return issues;
  }

  if (line.op === 'patch') {
    issues.push(...validateHtmlSurfacePatch(line.value as never, {
      maxDomDepth: limits.maxDomDepth,
      maxDomNodes: limits.maxDomNodes,
    }));
  }

  return issues;
}
