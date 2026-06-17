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

const ARROW_TRIGGER_DOCS: Array<{ trigger: CapabilityTrigger; description: string }> = [
  {
    trigger: 'click',
    description: 'Fires an action or resource when the element is clicked.',
  },
  {
    trigger: 'submit',
    description:
      'Fires an action or resource on submit. Named form controls are collected into args.',
  },
  {
    trigger: 'mount',
    description:
      'Fires once after render. Use only for read-oriented resources that explicitly grant mount.',
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
  const triggerRows = ARROW_TRIGGER_DOCS.map(
    (spec) => `- \`${spec.trigger}\` — ${spec.description} Author this as an Arrow event handler or lifecycle call that invokes the granted intent.`,
  ).join('\n');

  return `### Arrow host bridge

Use Arrow-native interactivity. Import the bridge from \`host-bridge:summon\` inside the generated Arrow entry file:

\`\`\`ts
import { invoke, getState, onState } from "host-bridge:summon";
\`\`\`

#### Triggers

${triggerRows}

#### Host state

- \`await invoke(intentName, args)\` calls a granted host capability and resolves to \`{ ok, state, error? }\`.
- \`await getState()\` reads the latest host-owned state snapshot.
- \`onState((state) => { ... })\` subscribes to host \`pushState()\` updates and returns an unsubscribe function.
- Copy host-owned keys into Arrow \`reactive()\` state before rendering loading, data, error, empty, pending, or done UI.

#### Data resources

Data resources expose host-owned lifecycle keys. Render loading, data, error, and empty states from the named keys supplied by the host. Do not invent fetched rows, profiles, images, or counts before a successful resource result. The PolicyEngine remains the execution boundary.`;
}
