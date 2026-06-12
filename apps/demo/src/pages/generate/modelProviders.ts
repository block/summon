import type {
  ModelCatalogEntry,
  ModelOptions,
  ModelProviderControls,
  ModelProviderDefaults,
  ModelProviderInfo,
} from './types.js';

export function parseModelCatalog(raw: unknown): ModelCatalogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): ModelCatalogEntry[] => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Record<string, unknown>;
    if (
      typeof item.id !== 'string' ||
      typeof item.label !== 'string' ||
      typeof item.maxOutputTokens !== 'number'
    ) {
      return [];
    }
    return [{
      id: item.id,
      label: item.label,
      status: item.status === 'preview' || item.status === 'latest' || item.status === 'legacy'
        ? item.status
        : 'stable',
      tier: item.tier === 'frontier' || item.tier === 'balanced' ? item.tier : 'fast',
      maxOutputTokens: item.maxOutputTokens,
      description: typeof item.description === 'string' ? item.description : undefined,
      anthropicThinking: item.anthropicThinking === 'always' || item.anthropicThinking === 'optional'
        ? item.anthropicThinking
        : undefined,
    }];
  });
}

export function parseProviderDefaults(raw: unknown): ModelProviderDefaults | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const item = raw as Record<string, unknown>;
  if (typeof item.generationModel !== 'string' || typeof item.utilityModel !== 'string') return undefined;
  const modelOptions = item.modelOptions && typeof item.modelOptions === 'object'
    ? item.modelOptions as ModelOptions
    : {};
  return {
    generationModel: item.generationModel,
    utilityModel: item.utilityModel,
    modelOptions,
  };
}

function parseTokenControl(raw: unknown): { default: number; presets: number[] } | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.default !== 'number') return null;
  return {
    default: item.default,
    presets: Array.isArray(item.presets)
      ? item.presets.filter((value): value is number => typeof value === 'number')
      : [item.default],
  };
}

export function parseProviderControls(raw: unknown): ModelProviderControls | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const item = raw as Record<string, unknown>;
  const maxOutputTokens = parseTokenControl(item.maxOutputTokens);
  const repairMaxOutputTokens = parseTokenControl(item.repairMaxOutputTokens);
  if (!maxOutputTokens || !repairMaxOutputTokens) return undefined;
  const thinkingOptions = Array.isArray((item.anthropicThinking as Record<string, unknown> | undefined)?.options)
    ? ((item.anthropicThinking as { options?: unknown[] }).options ?? []).filter((value): value is 'adaptive' | 'off' => value === 'adaptive' || value === 'off')
    : [];
  const effortOptions = Array.isArray((item.effort as Record<string, unknown> | undefined)?.options)
    ? ((item.effort as { options?: unknown[] }).options ?? []).filter((value): value is 'low' | 'medium' | 'high' => value === 'low' || value === 'medium' || value === 'high')
    : [];
  return {
    customModels: item.customModels !== false,
    maxOutputTokens,
    repairMaxOutputTokens,
    anthropicThinking: {
      default: (item.anthropicThinking as { default?: unknown } | undefined)?.default === 'off' ? 'off' : 'adaptive',
      options: thinkingOptions.length ? thinkingOptions : ['adaptive', 'off'],
    },
    effort: {
      default: ['low', 'medium', 'high'].includes(String((item.effort as { default?: unknown } | undefined)?.default))
        ? (item.effort as { default: 'low' | 'medium' | 'high' }).default
        : 'medium',
      options: effortOptions.length ? effortOptions : ['low', 'medium', 'high'],
    },
  };
}

export function parseModelProviders(payload: unknown): { defaultProvider: string | null; providers: ModelProviderInfo[] } {
  if (!payload || typeof payload !== 'object') return { defaultProvider: null, providers: [] };
  const item = payload as { defaultProvider?: unknown; providers?: unknown };
  return {
    defaultProvider: typeof item.defaultProvider === 'string' ? item.defaultProvider : null,
    providers: Array.isArray(item.providers)
      ? item.providers.flatMap((provider): ModelProviderInfo[] => {
          if (!provider || typeof provider !== 'object') return [];
          const raw = provider as Record<string, unknown>;
          if (
            typeof raw.id !== 'string' ||
            typeof raw.name !== 'string' ||
            typeof raw.model !== 'string' ||
            typeof raw.utilityModel !== 'string'
          ) {
            return [];
          }
          return [{
            id: raw.id,
            name: raw.name,
            configured: raw.configured === true,
            model: raw.model,
            utilityModel: raw.utilityModel,
            models: parseModelCatalog(raw.models),
            utilityModels: parseModelCatalog(raw.utilityModels),
            defaults: parseProviderDefaults(raw.defaults),
            controls: parseProviderControls(raw.controls),
            missingEnv: typeof raw.missingEnv === 'string' ? raw.missingEnv : undefined,
          }];
        })
      : [],
  };
}

export function fallbackCatalog(id: string, label: string): ModelCatalogEntry[] {
  return [{
    id,
    label,
    status: 'stable',
    tier: 'balanced',
    maxOutputTokens: 64000,
  }];
}
