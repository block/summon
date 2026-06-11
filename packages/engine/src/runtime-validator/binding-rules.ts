import {
  hasCompleteResourceStateKeys,
  type CapabilityTrigger,
} from '../capability-contract.js';
import type { ContractIssue } from '../contracts.js';
import { validateSurfaceCapability } from './capabilities.js';
import { block, warn } from './issues.js';
import type {
  HtmlOpenToken,
  HtmlTraversalToken,
  ResourceScope,
  ResourceUsage,
  RuntimeCapability,
  TagFrame,
  ValidationContext,
} from './types.js';

const RESOURCE_ALIAS_RE = /^[A-Za-z_$][\w$]{0,39}$/;
const SAFE_ATTR_BINDINGS = new Set([
  'src',
  'alt',
  'title',
  'aria-label',
  'value',
  'placeholder',
  'disabled',
]);

export function scanIntentBindings(
  elements: HtmlOpenToken[],
  capabilityMap: Map<string, RuntimeCapability>,
  context: ValidationContext,
  issues: ContractIssue[],
): void {
  const actionUsages = actionUsageMap(capabilityMap);
  for (const element of elements) {
    for (const trigger of ['click', 'submit', 'mount'] as const) {
      const intent = element.attrs.get(`data-summon-on-${trigger}`)?.trim();
      if (intent === undefined) continue;
      const capability = capabilityMap.get(intent);
      if (!intent || !capability) {
        issues.push(block('unknown-intent', `Intent "${intent || '(empty)'}" is not granted`));
        continue;
      }
      if (!capability.triggers.has(trigger)) {
        issues.push(
          block(
            'intent-trigger-not-granted',
            `Intent "${intent}" is not granted for ${trigger}`,
          ),
        );
      }
      validateSurfaceCapability(capability, context, issues);
      const usage = actionUsages.get(capability.name);
      if (usage) usage.hasTrigger = true;
    }
    recordActionStateUsage(element.attrs, actionUsages);
  }
  warnForActionStateQuality(actionUsages, issues);
}

export function scanResourceAndAttributeBindings(
  tokens: HtmlTraversalToken[],
  capabilityMap: Map<string, RuntimeCapability>,
  context: ValidationContext,
  issues: ContractIssue[],
): void {
  const stack: TagFrame[] = [];
  const resourceUsages: ResourceUsage[] = [];
  for (const token of tokens) {
    if (token.kind === 'close') {
      popTag(stack, token.tagName);
      continue;
    }

    const { attrs, tagName } = token;
    const parentResource = nearestResource(stack);
    const declaredResource = attrs.get('data-summon-resource')?.trim();
    const aliasAttr = attrs.get('data-summon-resource-as')?.trim();
    let resource = parentResource;

    if (declaredResource !== undefined) {
      resource = undefined;
      const capability = capabilityMap.get(declaredResource);
      if (!declaredResource || !capability) {
        issues.push(block('unknown-resource', `Resource "${declaredResource || '(empty)'}" is not granted`));
      } else if (capability.kind !== 'resource') {
        issues.push(block('non-resource-capability', `Capability "${declaredResource}" is not a resource`));
      } else if (!hasCompleteResourceStateKeys(capability.stateKeys)) {
        issues.push(
          block(
            'resource-state-keys-incomplete',
            `Resource "${declaredResource}" must declare loading, data, and error state keys`,
          ),
        );
      }

      const alias = aliasAttr || declaredResource;
      if (!RESOURCE_ALIAS_RE.test(alias)) {
        issues.push(block('invalid-resource-alias', `Invalid resource alias "${alias}"`));
      }

      if (capability && capability.kind === 'resource') {
        validateSurfaceCapability(capability, context, issues);
        const usage = hasCompleteResourceStateKeys(capability.stateKeys)
          ? {
              name: declaredResource,
              alias,
              hasTrigger: false,
              hasLoadingBinding: false,
              hasErrorBinding: false,
              hasDataBinding: false,
              hasEmptyState: Boolean(capability.stateKeys.empty),
              hasEmptyBinding: false,
            }
          : undefined;
        if (usage) resourceUsages.push(usage);
        resource = { name: declaredResource, alias, capability, usage };
      }
    } else if (aliasAttr !== undefined) {
      issues.push(
        block(
          'resource-alias-without-resource',
          '`data-summon-resource-as` requires `data-summon-resource`',
        ),
      );
    }

    validateArgs(attrs, issues);
    validateSafeAttributeBindings(attrs, tagName, issues);
    validateResourceTrigger(attrs, tagName, resource, parentResource, attrs.has('data-summon-resource'), issues);
    recordResourceUsage(attrs, resource ?? parentResource);

    if (!token.selfClosing) {
      stack.push({ tagName, resource });
    }
  }
  warnForResourceQuality(resourceUsages, issues);
}

function popTag(stack: TagFrame[], tagName: string): void {
  for (let i = stack.length - 1; i >= 0; i--) {
    const frame = stack.pop();
    if (frame?.tagName === tagName) return;
  }
}

function nearestResource(stack: TagFrame[]): ResourceScope | undefined {
  for (let i = stack.length - 1; i >= 0; i--) {
    const resource = stack[i]?.resource;
    if (resource) return resource;
  }
  return undefined;
}

function validateArgs(attrs: Map<string, string>, issues: ContractIssue[]): void {
  if (!attrs.has('data-summon-args')) return;
  const raw = attrs.get('data-summon-args') ?? '';
  if (!raw.trim()) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    issues.push(block('invalid-args-json', '`data-summon-args` must be valid JSON'));
    return;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    issues.push(block('invalid-args-json', '`data-summon-args` must be a JSON object'));
  }
}

function validateSafeAttributeBindings(
  attrs: Map<string, string>,
  tagName: string,
  issues: ContractIssue[],
): void {
  for (const attr of attrs.keys()) {
    if (!attr.startsWith('data-summon-attr-')) continue;
    const target = attr.slice('data-summon-attr-'.length);
    if (!SAFE_ATTR_BINDINGS.has(target)) {
      issues.push(block('unsafe-attr-binding', `Attribute binding "${attr}" is not allowed`));
      continue;
    }
    if (target === 'src' && tagName !== 'img') {
      issues.push(block('bad-attr-binding-placement', '`data-summon-attr-src` is only allowed on <img>'));
    }
  }
}

function validateResourceTrigger(
  attrs: Map<string, string>,
  tagName: string,
  resource: ResourceScope | undefined,
  parentResource: ResourceScope | undefined,
  declaredResource: boolean,
  issues: ContractIssue[],
): void {
  if (!attrs.has('data-summon-resource-trigger')) return;
  const trigger = attrs.get('data-summon-resource-trigger')?.trim() as CapabilityTrigger | undefined;
  if (hasLegacyTrigger(attrs)) {
    issues.push(
      block(
        'mixed-resource-legacy-trigger',
        'Do not mix `data-summon-resource-trigger` with `data-summon-on-*` on the same element',
      ),
    );
  }
  if (trigger !== 'click' && trigger !== 'submit' && trigger !== 'mount') {
    issues.push(
      block(
        'invalid-resource-trigger',
        '`data-summon-resource-trigger` must be one of click, submit, or mount',
      ),
    );
    return;
  }

  const effectiveResource = resource ?? parentResource;
  if (!effectiveResource) {
    issues.push(
      block(
        'resource-trigger-without-resource',
        '`data-summon-resource-trigger` must be inside a `data-summon-resource` scope',
      ),
    );
    return;
  }

  if (trigger === 'submit' && tagName !== 'form') {
    issues.push(block('bad-resource-trigger-placement', 'Resource submit triggers must be on <form>'));
  }
  if (trigger === 'mount' && !declaredResource) {
    issues.push(
      block(
        'bad-resource-trigger-placement',
        'Resource mount triggers must be on the `data-summon-resource` root',
      ),
    );
  }
  if (!effectiveResource.capability.triggers.has(trigger)) {
    issues.push(
      block(
        'intent-trigger-not-granted',
        `Resource "${effectiveResource.name}" is not granted for ${trigger}`,
      ),
    );
  }
}

function recordResourceUsage(
  attrs: Map<string, string>,
  resource: ResourceScope | undefined,
): void {
  const usage = resource?.usage;
  if (!usage) return;
  if (attrs.has('data-summon-resource-trigger')) usage.hasTrigger = true;

  for (const [attr, value] of attrs) {
    if (!isBindingAttribute(attr)) continue;
    if (isVisibleStateBinding(attr) && referencesResourceSlot(value, usage.alias, 'loading')) {
      usage.hasLoadingBinding = true;
    }
    if (isVisibleStateBinding(attr) && referencesResourceSlot(value, usage.alias, 'error')) {
      usage.hasErrorBinding = true;
    }
    if (isDataResultBinding(attr) && referencesResourceSlot(value, usage.alias, 'data')) {
      usage.hasDataBinding = true;
    }
    if (
      usage.hasEmptyState &&
      isVisibleStateBinding(attr) &&
      referencesResourceSlot(value, usage.alias, 'empty')
    ) {
      usage.hasEmptyBinding = true;
    }
  }
}

function isBindingAttribute(attr: string): boolean {
  return (
    attr === 'data-summon-bind' ||
    attr === 'data-summon-show' ||
    attr === 'data-summon-hide' ||
    attr === 'data-summon-foreach' ||
    attr.startsWith('data-summon-attr-')
  );
}

function isVisibleStateBinding(attr: string): boolean {
  return attr === 'data-summon-bind' || attr === 'data-summon-show';
}

function isDataResultBinding(attr: string): boolean {
  return (
    attr === 'data-summon-bind' ||
    attr === 'data-summon-show' ||
    attr === 'data-summon-foreach' ||
    attr.startsWith('data-summon-attr-')
  );
}

function referencesResourceSlot(
  value: string,
  alias: string,
  slot: 'loading' | 'data' | 'error' | 'empty',
): boolean {
  const path = `$${alias}.${slot}`;
  return value.trim() === path || value.trim().startsWith(`${path}.`);
}

function referencesStateKey(value: string, key: string): boolean {
  const trimmed = value.trim();
  return trimmed === key || trimmed.startsWith(`${key}.`);
}

function warnForResourceQuality(
  resourceUsages: ResourceUsage[],
  issues: ContractIssue[],
): void {
  for (const usage of resourceUsages) {
    if (!usage.hasTrigger) continue;
    const aliasPath = `$${usage.alias}`;
    if (!usage.hasLoadingBinding) {
      issues.push(
        warn(
          'resource-loading-not-rendered',
          `Data resource "${usage.name}" has no visible loading binding under ${aliasPath}.loading`,
        ),
      );
    }
    if (!usage.hasErrorBinding) {
      issues.push(
        warn(
          'resource-error-not-rendered',
          `Data resource "${usage.name}" has no visible error binding under ${aliasPath}.error`,
        ),
      );
    }
    if (!usage.hasDataBinding) {
      issues.push(
        warn(
          'resource-data-not-rendered',
          `Data resource "${usage.name}" has no data binding or foreach under ${aliasPath}.data`,
        ),
      );
    }
    if (usage.hasEmptyState && !usage.hasEmptyBinding) {
      issues.push(
        warn(
          'resource-empty-not-rendered',
          `Data resource "${usage.name}" has no visible empty binding under ${aliasPath}.empty`,
        ),
      );
    }
  }
}

interface ActionUsage {
  name: string;
  pending: string;
  error: string;
  hasTrigger: boolean;
  hasPendingBinding: boolean;
  hasErrorBinding: boolean;
}

function actionUsageMap(capabilityMap: Map<string, RuntimeCapability>): Map<string, ActionUsage> {
  const out = new Map<string, ActionUsage>();
  for (const capability of capabilityMap.values()) {
    if (capability.kind !== 'action' || !capability.actionStateKeys) continue;
    out.set(capability.name, {
      name: capability.name,
      pending: capability.actionStateKeys.pending,
      error: capability.actionStateKeys.error,
      hasTrigger: false,
      hasPendingBinding: false,
      hasErrorBinding: false,
    });
  }
  return out;
}

function recordActionStateUsage(
  attrs: Map<string, string>,
  actionUsages: Map<string, ActionUsage>,
): void {
  if (actionUsages.size === 0) return;
  for (const [attr, value] of attrs) {
    if (!isBindingAttribute(attr)) continue;
    for (const usage of actionUsages.values()) {
      if (
        (attr === 'data-summon-attr-disabled' || isVisibleStateBinding(attr)) &&
        referencesStateKey(value, usage.pending)
      ) {
        usage.hasPendingBinding = true;
      }
      if (isVisibleStateBinding(attr) && referencesStateKey(value, usage.error)) {
        usage.hasErrorBinding = true;
      }
    }
  }
}

function warnForActionStateQuality(
  actionUsages: Map<string, ActionUsage>,
  issues: ContractIssue[],
): void {
  for (const usage of actionUsages.values()) {
    if (!usage.hasTrigger) continue;
    if (!usage.hasPendingBinding) {
      issues.push(
        warn(
          'action-pending-not-rendered',
          `Controlled action "${usage.name}" has no disabled or visible pending binding for ${usage.pending}`,
        ),
      );
    }
    if (!usage.hasErrorBinding) {
      issues.push(
        warn(
          'action-error-not-rendered',
          `Controlled action "${usage.name}" has no visible error binding for ${usage.error}`,
        ),
      );
    }
  }
}

function hasLegacyTrigger(attrs: Map<string, string>): boolean {
  return (
    attrs.has('data-summon-on-click') ||
    attrs.has('data-summon-on-submit') ||
    attrs.has('data-summon-on-mount')
  );
}
