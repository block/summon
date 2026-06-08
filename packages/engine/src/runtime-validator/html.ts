import type { ContractIssue } from '../contracts.js';
import { normalizeValidationLimits } from '../validation-limits.js';
import {
  scanIntentBindings,
  scanResourceAndAttributeBindings,
} from './binding-rules.js';
import { buildCapabilityMap } from './capabilities.js';
import {
  buildComponentMap,
  scanComponentBindings,
} from './component-rules.js';
import { parseHtmlForValidation } from './html-parser.js';
import {
  block,
  byteLength,
  dedupeIssues,
} from './issues.js';
import {
  scanCss,
  scanElementSafety,
  scanSandboxEmit,
  scanUrlAttributes,
} from './safety-rules.js';
import {
  scanStyleDrift,
  scanTokenReferences,
} from './style-rules.js';
import type { ValidationContext } from './types.js';

export function validateHtmlFragment(
  html: string,
  context: ValidationContext,
): ContractIssue[] {
  const issues: ContractIssue[] = [];
  const capabilityMap = buildCapabilityMap(context);
  const componentMap = buildComponentMap(context);
  const limits = normalizeValidationLimits(context.limits);

  if (byteLength(html) > limits.maxSectionHtmlBytes) {
    issues.push(
      block(
        'section-html-limit',
        `Section HTML exceeds ${limits.maxSectionHtmlBytes} bytes`,
      ),
    );
    return issues;
  }

  const parsed = parseHtmlForValidation(html, limits, issues);

  scanElementSafety(parsed.elements, context, issues);
  scanUrlAttributes(parsed.elements, issues);
  scanCss(parsed.cssSources, limits, issues);
  scanIntentBindings(parsed.elements, capabilityMap, context, issues);
  scanResourceAndAttributeBindings(parsed.tokens, capabilityMap, context, issues);
  scanComponentBindings(parsed.tokens, componentMap, context, issues);
  scanSandboxEmit(html, capabilityMap, context, issues);
  scanTokenReferences(html, context.definedTokens, issues);
  scanStyleDrift(html, issues);

  return dedupeIssues(issues);
}
