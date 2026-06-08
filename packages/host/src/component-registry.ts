import type {
  CompiledComponentContract,
  ComponentExample,
  ComponentPack,
  ComponentSizing,
  ComponentSurface,
} from '@summon/engine';
import { compileComponentContract } from '@summon/engine';
import type { ZodType, ZodTypeAny } from 'zod';
import { formatZodSchema } from './capability-registry.js';

export interface ComponentRenderContext<T = unknown> {
  container: HTMLElement;
  props: T;
  componentId: string;
  sandboxId: string;
  emitIntent: (intent: string, args?: Record<string, unknown>) => void;
}

export type ComponentRenderer<T = unknown> = (ctx: ComponentRenderContext<T>) => void;
export type ComponentDestroyer<T = unknown> = (ctx: Omit<ComponentRenderContext<T>, 'props'>) => void;

export interface ComponentDefinition<T = unknown> {
  name: string;
  description: string;
  propsSchema: ZodType<T>;
  /** Optional override for prompt-facing schema text when Zod introspection is too lossy. */
  propsSchemaText?: string;
  surface?: ComponentSurface;
  examples?: ComponentExample[];
  sizing?: ComponentSizing;
  render?: ComponentRenderer<T>;
  destroy?: ComponentDestroyer<T>;
}

export interface ComponentPropsParseResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface ComponentRegistry {
  toContract(): CompiledComponentContract;
  components(): string[];
  validateProps(name: string, props: unknown): ComponentPropsParseResult;
  render(name: string, context: ComponentRenderContext): void;
  destroy(name: string, context: Omit<ComponentRenderContext, 'props'>): void;
  without(names: string[]): ComponentRegistry;
}

export function defineComponent<T>(
  definition: ComponentDefinition<T>,
): ComponentDefinition<T> {
  return {
    ...definition,
    surface: normalizeComponentSurface(definition.surface),
  };
}

export function createComponentRegistry(
  definitions: ComponentDefinition<any>[],
): ComponentRegistry {
  assertUniqueComponentNames(definitions);
  return new StaticComponentRegistry(definitions);
}

class StaticComponentRegistry implements ComponentRegistry {
  constructor(private readonly definitions: ComponentDefinition<any>[]) {}

  toContract(): CompiledComponentContract {
    const pack: ComponentPack = {
      components: this.definitions.map((definition) => ({
        name: definition.name,
        description: definition.description,
        propsSchema: definition.propsSchemaText ?? formatZodSchema(definition.propsSchema as ZodTypeAny),
        surface: normalizeComponentSurface(definition.surface),
        ...(definition.examples?.length ? { examples: definition.examples } : {}),
        ...(definition.sizing ? { sizing: definition.sizing } : {}),
      })),
    };
    return compileComponentContract(pack);
  }

  components(): string[] {
    return this.definitions.map((definition) => definition.name);
  }

  validateProps(name: string, props: unknown): ComponentPropsParseResult {
    const definition = this.find(name);
    if (!definition) {
      return { ok: false, error: `unknown component "${name}"` };
    }
    const parsed = definition.propsSchema.safeParse(props);
    if (!parsed.success) {
      return { ok: false, error: `component "${name}" props failed schema validation` };
    }
    return { ok: true, data: parsed.data };
  }

  render(name: string, context: ComponentRenderContext): void {
    const definition = this.find(name);
    if (!definition?.render) return;
    definition.render(context);
  }

  destroy(name: string, context: Omit<ComponentRenderContext, 'props'>): void {
    const definition = this.find(name);
    definition?.destroy?.(context);
  }

  without(names: string[]): ComponentRegistry {
    const excluded = new Set(names);
    return new StaticComponentRegistry(
      this.definitions.filter((definition) => !excluded.has(definition.name)),
    );
  }

  private find(name: string): ComponentDefinition<any> | undefined {
    return this.definitions.find((definition) => definition.name === name);
  }
}

function normalizeComponentSurface(surface: ComponentSurface | undefined): ComponentSurface {
  return {
    data: surface?.data ?? 'embedded',
    authority: surface?.authority ?? 'none',
  };
}

function assertUniqueComponentNames(definitions: ComponentDefinition<any>[]): void {
  const seen = new Set<string>();
  for (const definition of definitions) {
    if (seen.has(definition.name)) {
      throw new Error(`Duplicate component "${definition.name}"`);
    }
    seen.add(definition.name);
  }
}
