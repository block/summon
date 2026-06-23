import type {
  SurfacePreviewNode,
  SurfacePreviewSnapshot,
} from '@anarchitecture/summon/browser';
import type {
  SummonLayout,
  SurfaceEvent,
  SurfaceContractView,
  SurfacePlan,
} from '@anarchitecture/summon/engine';

export interface GenerationPreviewSection {
  id: string;
  label: string;
  summary?: string;
  role?: string;
  source: 'layout' | 'stream';
}

export interface GenerationPreviewModel {
  phase: string;
  title: string;
  kind: string;
  sections: GenerationPreviewSection[];
  chips: string[];
  bytes: number;
  artifactSeen: boolean;
  rendered: boolean;
}

export interface BuildGenerationPreviewInput {
  prompt: string;
  status: string;
  statusText: string;
  bytes: number;
  artifactRevision: number;
  rendered: boolean;
  surfacePlan: SurfacePlan | null;
  contractView: SurfaceContractView | null;
  layout: SummonLayout | null;
  previewSnapshot: SurfacePreviewSnapshot | null;
  toolNames: readonly string[];
}

export function buildGenerationPreview(
  input: BuildGenerationPreviewInput,
): GenerationPreviewModel {
  const plan = input.contractView?.surface.plan ?? input.surfacePlan;
  const layout = input.contractView?.layout ?? input.layout;
  const layoutSections = sectionsFromLayout(layout);
  const streamSections = sectionsFromSnapshot(input.previewSnapshot);
  const sections = mergeSections({
    layout: layoutSections,
    stream: streamSections,
  });

  return {
    phase: phaseText(input),
    title: input.previewSnapshot?.surface?.title ?? titleFromPrompt(input.prompt),
    kind:
      input.previewSnapshot?.surface?.kind ??
      plan?.purpose ??
      input.contractView?.surface.mode ??
      'surface',
    sections,
    chips: chipsFor({
      plan,
      contractView: input.contractView,
      toolNames: input.toolNames,
      artifactSeen: input.artifactRevision > 0,
      rendered: input.rendered,
    }),
    bytes: input.bytes,
    artifactSeen: input.artifactRevision > 0,
    rendered: input.rendered,
  };
}

export function reduceSurfacePreviewSnapshot(
  current: SurfacePreviewSnapshot | null,
  event: SurfaceEvent,
): SurfacePreviewSnapshot {
  let surface = current?.surface ? { ...current.surface } : null;
  let status = current?.status ? { ...current.status } : undefined;
  let finalized = current?.finalized ?? false;
  const nodes = new Map<string, SurfacePreviewNode>(
    (current?.nodes ?? []).map((node) => [
      node.id,
      {
        ...node,
        props: { ...node.props },
      },
    ]),
  );

  if (event.type === 'surface.start') {
    surface = {
      id: event.id,
      kind: event.kind,
      ...(event.title ? { title: event.title } : {}),
    };
  } else if (event.type === 'surface.status') {
    status = {
      status: event.status,
      ...(event.text ? { text: event.text } : {}),
    };
  } else if (event.type === 'region.add') {
    const node: SurfacePreviewNode = {
      id: event.id,
      kind: 'region',
      role: event.role,
      props: {},
    };
    if (event.parent) node.parent = event.parent;
    if (event.label) node.label = event.label;
    nodes.set(event.id, node);
  } else if (event.type === 'node.add') {
    nodes.set(event.id, {
      id: event.id,
      parent: event.parent,
      kind: event.kind,
      props: { ...(event.props ?? {}) },
    });
  } else if (event.type === 'node.patch') {
    const existing = nodes.get(event.id);
    if (existing) {
      existing.props = { ...existing.props, ...event.props };
    }
  } else if (event.type === 'surface.finalize') {
    finalized = true;
  }

  return {
    surface,
    ...(status ? { status } : {}),
    nodes: Array.from(nodes.values()),
    finalized,
  };
}

function sectionsFromLayout(
  layout: SummonLayout | NonNullable<SurfaceContractView['layout']> | null,
): GenerationPreviewSection[] {
  return (layout?.slots ?? []).map((slot) => ({
    id: `layout:${slot.id}`,
    label: labelFromId(slot.id),
    summary: slot.purpose,
    role: slot.id,
    source: 'layout' as const,
  }));
}

function sectionsFromSnapshot(
  snapshot: SurfacePreviewSnapshot | null,
): GenerationPreviewSection[] {
  if (!snapshot) return [];
  const nodes = snapshot.nodes;
  const summaries = new Map<string, string>();

  for (const node of nodes) {
    if (node.kind !== 'text') continue;
    const text = node.props.text;
    if (node.parent && typeof text === 'string' && text.trim()) {
      summaries.set(node.parent, text.trim());
    }
  }

  return nodes
    .filter((node) => {
      if (node.kind !== 'region') return false;
      if (node.id === 'progress' || node.role === 'status') return false;
      return true;
    })
    .map((node) => ({
      id: `stream:${node.id}`,
      label: node.label ?? labelFromId(node.role ?? node.id),
      summary: summaries.get(node.id),
      role: node.role,
      source: 'stream' as const,
    }));
}

function mergeSections({
  layout,
  stream,
}: {
  layout: GenerationPreviewSection[];
  stream: GenerationPreviewSection[];
}): GenerationPreviewSection[] {
  if (layout.length > 0 && stream.length > 0) {
    const merged = layout.map((section, index) => {
      const streamed = stream[index];
      return streamed
        ? {
            ...section,
            label: streamed.label,
            summary: streamed.summary ?? section.summary,
            role: streamed.role ?? section.role,
            source: 'stream' as const,
          }
        : section;
    });
    return [...merged, ...stream.slice(layout.length)].slice(0, 4);
  }

  if (stream.length > 0) return stream.slice(0, 4);
  return [];
}

function chipsFor({
  plan,
  contractView,
  toolNames,
  artifactSeen,
  rendered,
}: {
  plan: SurfacePlan | null;
  contractView: SurfaceContractView | null;
  toolNames: readonly string[];
  artifactSeen: boolean;
  rendered: boolean;
}): string[] {
  const chips: string[] = [];
  const mode = contractView?.surface.mode;
  chips.push(mode === 'static' || plan?.authority === 'none' ? 'static' : 'interactive');
  if (plan?.data === 'host-resource') chips.push('host data');
  if (plan?.authority === 'host-action') chips.push('host action');

  const names = contractView?.tools.map((tool) => tool.name) ?? toolNames;
  for (const name of names) {
    if (chips.length >= 4) break;
    chips.push(name);
  }
  if (chips.length < 4 && rendered) chips.push('mounted');
  if (chips.length < 4 && artifactSeen && !rendered) chips.push('mounting');

  return Array.from(new Set(chips)).slice(0, 4);
}

function phaseText(input: BuildGenerationPreviewInput): string {
  if (input.rendered) return 'Surface mounted';
  if (input.artifactRevision > 0) return 'Mounting accepted surface';
  const previewStatus = input.previewSnapshot?.status;
  if (previewStatus?.text) return previewStatus.text;
  if (previewStatus?.status) return phaseLabel(previewStatus.status);
  if (input.statusText) return input.statusText;
  return phaseLabel(input.status);
}

function phaseLabel(value: string): string {
  switch (value) {
    case 'planning':
      return 'Reading intent';
    case 'contract':
      return 'Selecting safe tools';
    case 'drafting':
      return 'Composing surface';
    case 'validating':
      return 'Checking sandbox contract';
    case 'rendering':
      return 'Mounting Arrow UI';
    case 'finalizing':
      return 'Finalizing surface';
    case 'streaming':
      return 'Starting generation';
    default:
      return labelFromId(value || 'summoning');
  }
}

function titleFromPrompt(prompt: string): string {
  const compact = prompt.replace(/\s+/g, ' ').trim();
  if (!compact) return 'Building surface';
  const title = compact.replace(/^(build|create|make|draft|show|generate)\s+(me\s+)?/i, '');
  const normalized = title.charAt(0).toUpperCase() + title.slice(1);
  return normalized.length > 58 ? `${normalized.slice(0, 55)}...` : normalized;
}

function labelFromId(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
