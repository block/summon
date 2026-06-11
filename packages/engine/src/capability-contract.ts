export type CapabilityKind = 'action' | 'resource';
export type CapabilityTrigger = 'click' | 'submit' | 'mount';

export interface CapabilityStateKeys {
  loading?: string;
  data?: string;
  error?: string;
  empty?: string;
}

export interface ResourceStateKeys extends Required<Pick<CapabilityStateKeys, 'loading' | 'data' | 'error'>> {
  empty?: string;
}

export interface ActionStateKeys {
  pending: string;
  done: string;
  error: string;
}

export interface CapabilityTriggerSpec {
  trigger: CapabilityTrigger;
  legacyAttribute: `data-summon-on-${CapabilityTrigger}`;
  resourceTriggerValue: CapabilityTrigger;
  placement: string;
  description: string;
  args: string;
}

export interface CapabilityBindingSpec {
  attribute: string;
  value: string;
  description: string;
}

export const CAPABILITY_TRIGGER_SPECS: CapabilityTriggerSpec[] = [
  {
    trigger: 'click',
    legacyAttribute: 'data-summon-on-click',
    resourceTriggerValue: 'click',
    placement: 'Any clickable element.',
    description: 'Fires an action or resource when the element is clicked.',
    args: 'Optional `data-summon-args` JSON. Foreach/resource scoped `$name` values are interpolated.',
  },
  {
    trigger: 'submit',
    legacyAttribute: 'data-summon-on-submit',
    resourceTriggerValue: 'submit',
    placement: 'A `<form>` element.',
    description:
      'Fires an action or resource on submit. Named form controls are collected into args.',
    args: 'Optional `data-summon-args` JSON provides base args; collected form fields win conflicts.',
  },
  {
    trigger: 'mount',
    legacyAttribute: 'data-summon-on-mount',
    resourceTriggerValue: 'mount',
    placement: 'A mounted element; for resources, place it on the resource root.',
    description:
      'Fires once after render. Use only for read-oriented resources that explicitly grant mount.',
    args: 'Optional `data-summon-args` JSON. The same args key is emitted once per section render identity.',
  },
];

export const CAPABILITY_BINDING_SPECS: CapabilityBindingSpec[] = [
  {
    attribute: 'data-summon-resource',
    value: '<resource-name>',
    description:
      'Declares a resource scope. Descendants may bind `$alias.loading`, `$alias.data`, `$alias.error`, and optional `$alias.empty`.',
  },
  {
    attribute: 'data-summon-resource-as',
    value: '<alias>',
    description:
      'Optional resource alias. Defaults to the resource name. Aliases are render-time conveniences only.',
  },
  {
    attribute: 'data-summon-resource-trigger',
    value: 'click | submit | mount',
    description:
      'Emits the enclosing resource using the selected trigger. Still sends the normal `SUMMON_INTENT` event.',
  },
  {
    attribute: 'data-summon-bind',
    value: '<state-key | dotted-path | $scope.path>',
    description:
      'Mirrors state into text content. Resource aliases and foreach scopes are supported.',
  },
  {
    attribute: 'data-summon-show',
    value: '<state-key | dotted-path | $scope.path>',
    description: 'Shows the element only when the resolved value is truthy.',
  },
  {
    attribute: 'data-summon-hide',
    value: '<state-key | dotted-path | $scope.path>',
    description: 'Hides the element when the resolved value is truthy.',
  },
  {
    attribute: 'data-summon-foreach',
    value: '<array-key | $resource.data>',
    description:
      'Stamps the single `<template>` child once per array item. Use `data-summon-as` to name the item scope.',
  },
  {
    attribute: 'data-summon-as',
    value: '<scope-name>',
    description: 'Names a foreach item scope such as `$row`.',
  },
  {
    attribute: 'data-summon-args',
    value: '<valid JSON object>',
    description:
      'Base args for click/submit/mount triggers. String leaves like `"$row.id"` or `"$search.data"` are interpolated.',
  },
  {
    attribute: 'data-summon-attr-src',
    value: '<state-key | dotted-path | $scope.path>',
    description: 'Safely binds an image `src`. Only data URLs or empty values are applied.',
  },
  {
    attribute: 'data-summon-attr-alt',
    value: '<state-key | dotted-path | $scope.path>',
    description: 'Safely binds `alt` text.',
  },
  {
    attribute: 'data-summon-attr-title',
    value: '<state-key | dotted-path | $scope.path>',
    description: 'Safely binds `title` text.',
  },
  {
    attribute: 'data-summon-attr-aria-label',
    value: '<state-key | dotted-path | $scope.path>',
    description: 'Safely binds `aria-label` text.',
  },
  {
    attribute: 'data-summon-attr-value',
    value: '<state-key | dotted-path | $scope.path>',
    description: 'Safely binds a form control `value`.',
  },
  {
    attribute: 'data-summon-attr-placeholder',
    value: '<state-key | dotted-path | $scope.path>',
    description: 'Safely binds `placeholder` text.',
  },
  {
    attribute: 'data-summon-attr-disabled',
    value: '<state-key | dotted-path | $scope.path>',
    description: 'Safely binds boolean `disabled`.',
  },
];

export function defaultTriggersForKind(kind: CapabilityKind = 'action'): CapabilityTrigger[] {
  return kind === 'resource' ? ['submit', 'mount'] : ['click', 'submit'];
}

export function hasCompleteResourceStateKeys(
  keys: CapabilityStateKeys | undefined,
): keys is ResourceStateKeys {
  return Boolean(keys?.loading && keys.data && keys.error);
}

export function formatCapabilityProtocolContract(): string {
  const triggerRows = CAPABILITY_TRIGGER_SPECS.map(
    (spec) =>
      `- \`${spec.legacyAttribute}="<intent>"\` or \`data-summon-resource-trigger="${spec.resourceTriggerValue}"\` — ${spec.description} ${spec.placement} ${spec.args}`,
  ).join('\n');

  const bindingRows = CAPABILITY_BINDING_SPECS.map(
    (spec) => `- \`${spec.attribute}="${spec.value}"\` — ${spec.description}`,
  ).join('\n');

  return `### Declarative attributes

These are the paved road for interactivity. Use them first; they cover the dominant patterns: emit intents, show/hide state, mirror state into text or safe attributes, iterate collections, and bind resource lifecycle state.

#### Triggers

${triggerRows}

#### Bindings

${bindingRows}

#### Data resource scopes

Data resources expose host-owned lifecycle state. Wrap a data resource UI in \`data-summon-resource="<name>"\`, optionally rename it with \`data-summon-resource-as="<alias>"\`, then bind \`$alias.loading\`, \`$alias.data\`, \`$alias.error\`, and optional \`$alias.empty\`. A resource trigger always emits the resource's intent name; the PolicyEngine remains the execution boundary.

Example:

\`\`\`html
<div data-summon-resource="search" data-summon-resource-as="s">
  <form data-summon-resource-trigger="submit">
    <input name="query" placeholder="Search...">
    <button data-summon-attr-disabled="$s.loading">Go</button>
  </form>
  <p data-summon-show="$s.loading">Searching...</p>
  <p data-summon-show="$s.error" data-summon-bind="$s.error"></p>
  <ul data-summon-show="$s.data" data-summon-foreach="$s.data" data-summon-as="r">
    <template>
      <li>
        <strong data-summon-bind="$r.title"></strong>
        <span data-summon-bind="$r.snippet"></span>
      </li>
    </template>
  </ul>
</div>
\`\`\``;
}
