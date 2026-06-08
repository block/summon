import type {
  ComponentExample,
  ComponentPack,
  ComponentSizing,
  ComponentSurface,
} from '@summon/engine';

/**
 * Validate a component pack sent by the client. The server remains renderer
 * agnostic: it accepts component metadata for prompt/validation contracts, caps
 * sizes to protect prompt budget, and ignores malformed entries.
 */
export function parseComponentPack(raw: unknown): ComponentPack | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const rawComponents = obj.components;
  if (!Array.isArray(rawComponents)) return null;

  const components: ComponentPack['components'] = [];
  for (const rawComponent of rawComponents) {
    if (!rawComponent || typeof rawComponent !== 'object') continue;
    const c = rawComponent as Record<string, unknown>;
    if (typeof c.name !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(c.name)) continue;
    if (typeof c.description !== 'string' || typeof c.propsSchema !== 'string') continue;
    components.push({
      name: c.name,
      description: c.description.slice(0, 500),
      propsSchema: c.propsSchema.slice(0, 600),
      ...parseComponentSurface(c.surface),
      ...parseComponentExamples(c.examples),
      ...parseComponentSizing(c.sizing),
    });
    if (components.length >= 24) break;
  }

  return components.length > 0 ? { components } : null;
}

function parseComponentSurface(raw: unknown): { surface?: ComponentSurface } {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  const surface: ComponentSurface = {};
  if (obj.data === 'embedded' || obj.data === 'host-resource' || obj.data === 'worker') {
    surface.data = obj.data;
  }
  if (
    obj.authority === 'none' ||
    obj.authority === 'read' ||
    obj.authority === 'host-action' ||
    obj.authority === 'approval-gated'
  ) {
    surface.authority = obj.authority;
  }
  return Object.keys(surface).length > 0 ? { surface } : {};
}

function parseComponentExamples(raw: unknown): { examples?: ComponentExample[] } {
  if (!Array.isArray(raw)) return {};
  const examples: ComponentExample[] = [];
  for (const rawExample of raw) {
    if (!rawExample || typeof rawExample !== 'object') continue;
    const e = rawExample as Record<string, unknown>;
    if (typeof e.name !== 'string' || typeof e.code !== 'string') continue;
    examples.push({
      name: e.name.slice(0, 100),
      code: e.code.slice(0, 3000),
    });
    if (examples.length >= 8) break;
  }
  return examples.length > 0 ? { examples } : {};
}

function parseComponentSizing(raw: unknown): { sizing?: ComponentSizing } {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  const sizing: ComponentSizing = {};
  if (typeof obj.width === 'string') sizing.width = obj.width.slice(0, 80);
  if (typeof obj.height === 'string') sizing.height = obj.height.slice(0, 80);
  if (typeof obj.description === 'string') sizing.description = obj.description.slice(0, 240);
  return Object.keys(sizing).length > 0 ? { sizing } : {};
}
