export type ToolKind = 'action' | 'resource';
export type ToolTrigger = 'click' | 'submit' | 'mount';

export interface ToolStateKeys {
  loading?: string;
  data?: string;
  error?: string;
  empty?: string;
}

export interface ResourceStateKeys extends Required<Pick<ToolStateKeys, 'loading' | 'data' | 'error'>> {
  empty?: string;
}

export interface ActionStateKeys {
  pending: string;
  done: string;
  error: string;
}

const SURFACE_DOCUMENT_TRIGGER_DOCS: Array<{ trigger: ToolTrigger; description: string }> = [
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

export function defaultTriggersForKind(kind: ToolKind = 'action'): ToolTrigger[] {
  return kind === 'resource' ? ['submit', 'mount'] : ['click', 'submit'];
}

export function hasCompleteResourceStateKeys(
  keys: ToolStateKeys | undefined,
): keys is ResourceStateKeys {
  return Boolean(keys?.loading && keys.data && keys.error);
}

export function formatToolProtocolContract(): string {
  const triggerRows = SURFACE_DOCUMENT_TRIGGER_DOCS.map(
    (spec) => `- \`${spec.trigger}\` — ${spec.description} Author this in \`main.js\` using scoped DOM events or lifecycle code that invokes the granted tool.`,
  ).join('\n');

  return `### Surface Document host bridge

Use Surface Document interactivity. Import the bridge from \`host-bridge:summon\` inside optional \`main.js\`:

\`\`\`js
import { callTool, getState, onState } from "host-bridge:summon";
\`\`\`

#### Triggers

${triggerRows}

#### Host state

- \`await callTool(toolName, args)\` calls a granted host tool and resolves to \`{ ok, state, error? }\`.
- \`await getState()\` reads the latest host-owned state snapshot.
- \`onState((state) => { ... })\` subscribes to host \`pushState()\` updates and returns an unsubscribe function.
- Copy host-owned values into local \`state()\` when rendering loading, data, error, empty, pending, or done UI.

#### Data resources

Data resources expose host-owned lifecycle keys. Render loading, data, error, and empty states from the named keys supplied by the host. Do not invent fetched rows, profiles, images, or counts before a successful resource result. The PolicyEngine remains the execution boundary.`;
}
