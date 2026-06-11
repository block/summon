import Anthropic from '@anthropic-ai/sdk';
import type { ContractPromptBlock } from '@anarchitecture/summon/engine';
import type {
  SummonModelChunk,
  SummonModelRequest,
  SummonRepairRequest,
} from '@anarchitecture/summon-server';

export type ModelProviderId = 'anthropic' | 'openai' | 'gemini';

export interface ProviderUsageSnapshot {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  total_tokens?: number | null;
}

export interface TextCompletionRequest {
  system: string;
  prompt: string;
  maxTokens: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface TextCompletionClient {
  completeText(request: TextCompletionRequest): Promise<string>;
}

export type ModelCatalogStatus = 'stable' | 'preview' | 'latest' | 'legacy';
export type ModelCatalogTier = 'fast' | 'balanced' | 'frontier';
export type AnthropicThinkingMode = 'adaptive' | 'off';
export type ModelEffort = 'low' | 'medium' | 'high';

export interface ModelCatalogEntry {
  id: string;
  label: string;
  status: ModelCatalogStatus;
  tier: ModelCatalogTier;
  maxOutputTokens: number;
  description?: string;
  anthropicThinking?: 'optional' | 'always';
}

export interface ModelProviderControls {
  customModels: boolean;
  maxOutputTokens: {
    min: number;
    max: number;
    default: number;
    presets: number[];
  };
  repairMaxOutputTokens: {
    min: number;
    max: number;
    default: number;
    presets: number[];
  };
  anthropicThinking?: {
    default: AnthropicThinkingMode;
    options: AnthropicThinkingMode[];
  };
  effort?: {
    default: ModelEffort;
    options: ModelEffort[];
  };
}

export interface ModelProviderDefaults {
  generationModel: string;
  utilityModel: string;
  modelOptions: NormalizedModelOptions;
}

export interface ModelProviderInfo {
  id: ModelProviderId;
  name: string;
  configured: boolean;
  model: string;
  utilityModel: string;
  models: ModelCatalogEntry[];
  utilityModels: ModelCatalogEntry[];
  defaults: ModelProviderDefaults;
  controls: ModelProviderControls;
  missingEnv?: string;
}

export interface NormalizedModelOptions {
  maxOutputTokens: number;
  repairMaxOutputTokens: number;
  anthropicThinking?: AnthropicThinkingMode;
  effort?: ModelEffort;
}

export interface ModelSelection {
  generationModel: string;
  utilityModel: string;
  customModel: boolean;
  options: NormalizedModelOptions;
}

export interface ModelProviderAdapter extends ModelProviderInfo, TextCompletionClient {
  streamSurfaceGeneration(
    request: SummonModelRequest,
    onUsage: (usage: ProviderUsageSnapshot) => void,
    selection?: ModelSelection,
  ): AsyncGenerator<SummonModelChunk, void, void>;
  repairSurfaceSection(request: SummonRepairRequest, selection?: ModelSelection): Promise<string>;
  completeText(request: TextCompletionRequest, selection?: ModelSelection): Promise<string>;
  resolveSelection(raw: unknown): { ok: true; selection: ModelSelection } | { ok: false; error: string };
}

export interface ModelProviderRegistry {
  defaultProvider: ModelProviderAdapter | null;
  get(id: ModelProviderId): ModelProviderAdapter;
  info(): ModelProviderInfo[];
  resolve(raw: unknown, selectionRaw?: unknown): {
    ok: true;
    provider: ModelProviderAdapter;
    selection: ModelSelection;
  } | { ok: false; error: string };
}

const PROVIDER_IDS: ModelProviderId[] = ['anthropic', 'openai', 'gemini'];
const DEFAULT_OPENAI_MODEL = 'gpt-5';
const DEFAULT_OPENAI_UTILITY_MODEL = 'gpt-5-mini';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-pro';
const DEFAULT_GEMINI_UTILITY_MODEL = 'gemini-2.5-flash';
const DEFAULT_GENERATION_MAX_TOKENS = 64000;
const DEFAULT_REPAIR_MAX_TOKENS = 12000;
const MIN_OUTPUT_TOKENS = 1000;
const MAX_OUTPUT_TOKENS = 128000;
const MODEL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const EFFORT_OPTIONS: ModelEffort[] = ['low', 'medium', 'high'];
const THINKING_OPTIONS: AnthropicThinkingMode[] = ['adaptive', 'off'];

const ANTHROPIC_MODELS: ModelCatalogEntry[] = [
  {
    id: 'claude-fable-5',
    label: 'Claude Fable 5',
    status: 'latest',
    tier: 'frontier',
    maxOutputTokens: 128000,
    anthropicThinking: 'always',
    description: 'Most capable widely released Claude model.',
  },
  {
    id: 'claude-opus-4-8',
    label: 'Claude Opus 4.8',
    status: 'stable',
    tier: 'frontier',
    maxOutputTokens: 128000,
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    status: 'stable',
    tier: 'balanced',
    maxOutputTokens: 64000,
    anthropicThinking: 'optional',
  },
  {
    id: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    status: 'stable',
    tier: 'fast',
    maxOutputTokens: 64000,
    anthropicThinking: 'optional',
  },
];

const OPENAI_MODELS: ModelCatalogEntry[] = [
  { id: 'gpt-5.5', label: 'GPT-5.5', status: 'latest', tier: 'frontier', maxOutputTokens: 128000 },
  { id: 'gpt-5.4', label: 'GPT-5.4', status: 'stable', tier: 'balanced', maxOutputTokens: 128000 },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', status: 'stable', tier: 'fast', maxOutputTokens: 128000 },
  { id: 'gpt-5.4-nano', label: 'GPT-5.4 nano', status: 'stable', tier: 'fast', maxOutputTokens: 128000 },
  { id: 'gpt-5', label: 'GPT-5', status: 'legacy', tier: 'balanced', maxOutputTokens: 64000 },
  { id: 'gpt-5-mini', label: 'GPT-5 mini', status: 'legacy', tier: 'fast', maxOutputTokens: 64000 },
];

const GEMINI_MODELS: ModelCatalogEntry[] = [
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', status: 'latest', tier: 'fast', maxOutputTokens: 64000 },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', status: 'stable', tier: 'fast', maxOutputTokens: 64000 },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview', status: 'preview', tier: 'frontier', maxOutputTokens: 64000 },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview', status: 'preview', tier: 'fast', maxOutputTokens: 64000 },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', status: 'legacy', tier: 'balanced', maxOutputTokens: 64000 },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', status: 'legacy', tier: 'fast', maxOutputTokens: 64000 },
];

export function createModelProviderRegistry(env: NodeJS.ProcessEnv): ModelProviderRegistry {
  const providers = new Map<ModelProviderId, ModelProviderAdapter>([
    ['anthropic', createAnthropicProvider(env)],
    ['openai', createOpenAIProvider(env)],
    ['gemini', createGeminiProvider(env)],
  ]);

  const requestedDefault = parseProviderId(env.SUMMON_MODEL_PROVIDER);
  const defaultProvider = requestedDefault
    ? providers.get(requestedDefault) ?? null
    : PROVIDER_IDS.map((id) => providers.get(id)).find((provider) => provider?.configured) ?? null;

  return {
    defaultProvider,
    get(id) {
      const provider = providers.get(id);
      if (!provider) throw new Error(`unknown model provider "${id}"`);
      return provider;
    },
    info() {
      return PROVIDER_IDS.map((id) => providers.get(id)!).map(providerInfo);
    },
    resolve(raw, selectionRaw) {
      const providerId = raw === undefined || raw === null || raw === ''
        ? defaultProvider?.id
        : parseProviderId(raw);
      if (!providerId) {
        return {
          ok: false,
          error: `modelProvider must be one of ${PROVIDER_IDS.join(', ')}`,
        };
      }

      const provider = providers.get(providerId);
      if (!provider) {
        return {
          ok: false,
          error: `modelProvider must be one of ${PROVIDER_IDS.join(', ')}`,
        };
      }
      if (!provider.configured) {
        return {
          ok: false,
          error: `${provider.name} is not configured; set ${provider.missingEnv}`,
        };
      }
      const resolvedSelection = provider.resolveSelection(selectionRaw);
      if (!resolvedSelection.ok) return resolvedSelection;
      return { ok: true, provider, selection: resolvedSelection.selection };
    },
  };
}

export function parseProviderId(raw: unknown): ModelProviderId | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toLowerCase();
  return PROVIDER_IDS.includes(normalized as ModelProviderId)
    ? (normalized as ModelProviderId)
    : null;
}

function providerInfo(provider: ModelProviderAdapter): ModelProviderInfo {
  return {
    id: provider.id,
    name: provider.name,
    configured: provider.configured,
    model: provider.model,
    utilityModel: provider.utilityModel,
    models: provider.models,
    utilityModels: provider.utilityModels,
    defaults: provider.defaults,
    controls: provider.controls,
    ...(!provider.configured && provider.missingEnv ? { missingEnv: provider.missingEnv } : {}),
  };
}

function createProviderDefaults(args: {
  env: NodeJS.ProcessEnv;
  generationModel: string;
  utilityModel: string;
  catalog: ModelCatalogEntry[];
  anthropic?: boolean;
}): ModelProviderDefaults {
  const generationModel = args.generationModel;
  const modelMax = maxOutputTokensForModel(args.catalog, generationModel);
  const maxOutputTokens = clampInt(
    Number(args.env.SUMMON_GENERATION_MAX_TOKENS),
    MIN_OUTPUT_TOKENS,
    Math.min(MAX_OUTPUT_TOKENS, modelMax),
    Math.min(DEFAULT_GENERATION_MAX_TOKENS, modelMax),
  );
  const repairMaxOutputTokens = clampInt(
    Number(args.env.SUMMON_REPAIR_MAX_TOKENS),
    MIN_OUTPUT_TOKENS,
    Math.min(MAX_OUTPUT_TOKENS, modelMax),
    Math.min(DEFAULT_REPAIR_MAX_TOKENS, modelMax),
  );
  const options: NormalizedModelOptions = {
    maxOutputTokens,
    repairMaxOutputTokens,
  };
  if (args.anthropic) {
    const thinking = parseThinkingMode(
      args.env.SUMMON_ANTHROPIC_THINKING ?? args.env.ANTHROPIC_THINKING,
      'adaptive',
    );
    options.anthropicThinking = forceThinkingForModel(args.catalog, generationModel, thinking);
    options.effort = parseEffort(
      args.env.SUMMON_ANTHROPIC_EFFORT ?? args.env.ANTHROPIC_EFFORT,
      'medium',
    );
  }
  return {
    generationModel,
    utilityModel: args.utilityModel,
    modelOptions: options,
  };
}

function createProviderControls(defaults: ModelProviderDefaults, anthropic = false): ModelProviderControls {
  return {
    customModels: true,
    maxOutputTokens: {
      min: MIN_OUTPUT_TOKENS,
      max: MAX_OUTPUT_TOKENS,
      default: defaults.modelOptions.maxOutputTokens,
      presets: [8000, 12000, 16000, 32000, 64000],
    },
    repairMaxOutputTokens: {
      min: MIN_OUTPUT_TOKENS,
      max: MAX_OUTPUT_TOKENS,
      default: defaults.modelOptions.repairMaxOutputTokens,
      presets: [4000, 8000, 12000, 16000],
    },
    ...(anthropic
      ? {
          anthropicThinking: {
            default: defaults.modelOptions.anthropicThinking ?? 'adaptive',
            options: THINKING_OPTIONS,
          },
          effort: {
            default: defaults.modelOptions.effort ?? 'medium',
            options: EFFORT_OPTIONS,
          },
        }
      : {}),
  };
}

function createSelectionResolver(args: {
  providerName: string;
  models: ModelCatalogEntry[];
  utilityModels: ModelCatalogEntry[];
  defaults: ModelProviderDefaults;
  anthropic?: boolean;
}): (raw: unknown) => { ok: true; selection: ModelSelection } | { ok: false; error: string } {
  return (raw) => {
    const obj = raw && typeof raw === 'object'
      ? raw as Record<string, unknown>
      : {};
    const customModel = obj.customModel === true;
    const generationModel = resolveModelId({
      providerName: args.providerName,
      role: 'generation',
      raw: obj.generationModel,
      fallback: args.defaults.generationModel,
      catalog: args.models,
      customModel,
    });
    if (!generationModel.ok) return generationModel;

    const utilityModel = resolveModelId({
      providerName: args.providerName,
      role: 'utility',
      raw: obj.utilityModel,
      fallback: args.defaults.utilityModel,
      catalog: args.utilityModels,
      customModel,
    });
    if (!utilityModel.ok) return utilityModel;

    const modelMax = maxOutputTokensForModel(args.models, generationModel.model);
    const rawOptions = obj.modelOptions && typeof obj.modelOptions === 'object'
      ? obj.modelOptions as Record<string, unknown>
      : {};
    const options: NormalizedModelOptions = {
      maxOutputTokens: clampInt(
        rawOptions.maxOutputTokens,
        MIN_OUTPUT_TOKENS,
        Math.min(MAX_OUTPUT_TOKENS, modelMax),
        Math.min(args.defaults.modelOptions.maxOutputTokens, modelMax),
      ),
      repairMaxOutputTokens: clampInt(
        rawOptions.repairMaxOutputTokens,
        MIN_OUTPUT_TOKENS,
        Math.min(MAX_OUTPUT_TOKENS, modelMax),
        Math.min(args.defaults.modelOptions.repairMaxOutputTokens, modelMax),
      ),
    };
    if (args.anthropic) {
      const requestedThinking = parseThinkingMode(
        rawOptions.anthropicThinking,
        args.defaults.modelOptions.anthropicThinking ?? 'adaptive',
      );
      options.anthropicThinking = forceThinkingForModel(args.models, generationModel.model, requestedThinking);
      options.effort = parseEffort(rawOptions.effort, args.defaults.modelOptions.effort ?? 'medium');
    }

    return {
      ok: true,
      selection: {
        generationModel: generationModel.model,
        utilityModel: utilityModel.model,
        customModel: customModel || generationModel.custom || utilityModel.custom,
        options,
      },
    };
  };
}

function resolveModelId(args: {
  providerName: string;
  role: string;
  raw: unknown;
  fallback: string;
  catalog: ModelCatalogEntry[];
  customModel: boolean;
}): { ok: true; model: string; custom: boolean } | { ok: false; error: string } {
  if (args.raw === undefined || args.raw === null || args.raw === '') {
    return { ok: true, model: args.fallback, custom: false };
  }
  if (typeof args.raw !== 'string') {
    return { ok: false, error: `${args.role} model must be a string` };
  }
  const model = args.raw.trim();
  if (!MODEL_ID_RE.test(model)) {
    return { ok: false, error: `${args.role} model id is invalid` };
  }
  if (args.catalog.some((entry) => entry.id === model)) {
    return { ok: true, model, custom: false };
  }
  if (!args.customModel) {
    return {
      ok: false,
      error: `${args.providerName} ${args.role} model "${model}" is not in the catalog; choose Custom model to use it`,
    };
  }
  return { ok: true, model, custom: true };
}

function maxOutputTokensForModel(catalog: ModelCatalogEntry[], model: string): number {
  return catalog.find((entry) => entry.id === model)?.maxOutputTokens ?? DEFAULT_GENERATION_MAX_TOKENS;
}

function forceThinkingForModel(
  catalog: ModelCatalogEntry[],
  model: string,
  thinking: AnthropicThinkingMode,
): AnthropicThinkingMode {
  const entry = catalog.find((item) => item.id === model);
  return entry?.anthropicThinking === 'always' ? 'adaptive' : thinking;
}

function parseThinkingMode(raw: unknown, fallback: AnthropicThinkingMode): AnthropicThinkingMode {
  return raw === 'adaptive' || raw === 'off' ? raw : fallback;
}

function parseEffort(raw: unknown, fallback: ModelEffort): ModelEffort {
  return raw === 'low' || raw === 'medium' || raw === 'high' ? raw : fallback;
}

function createAnthropicProvider(env: NodeJS.ProcessEnv): ModelProviderAdapter {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  const model = env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
  const utilityModel = env.ANTHROPIC_SMALL_MODEL ?? 'claude-haiku-4-5';
  const defaults = createProviderDefaults({
    env,
    generationModel: model,
    utilityModel,
    catalog: ANTHROPIC_MODELS,
    anthropic: true,
  });
  const controls = createProviderControls(defaults, true);
  const resolveSelection = createSelectionResolver({
    providerName: 'Anthropic',
    models: ANTHROPIC_MODELS,
    utilityModels: ANTHROPIC_MODELS,
    defaults,
    anthropic: true,
  });
  const client = apiKey
    ? new Anthropic({
        apiKey,
        ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}),
      })
    : null;

  const ensureClient = () => {
    if (!client) throw new Error('Anthropic is not configured; set ANTHROPIC_API_KEY');
    return client;
  };

  return {
    id: 'anthropic',
    name: 'Anthropic',
    configured: Boolean(client),
    model,
    utilityModel,
    models: ANTHROPIC_MODELS,
    utilityModels: ANTHROPIC_MODELS,
    defaults,
    controls,
    missingEnv: 'ANTHROPIC_API_KEY',
    resolveSelection,
    async *streamSurfaceGeneration(request, onUsage, selection = defaultsToSelection(defaults)) {
      const stream = ensureClient().messages.stream({
        model: selection.generationModel,
        max_tokens: selection.options.maxOutputTokens,
        ...(selection.options.anthropicThinking === 'adaptive'
          ? { thinking: { type: 'adaptive' as const } }
          : {}),
        ...(selection.options.effort
          ? { output_config: { effort: selection.options.effort } }
          : {}),
        system: request.promptBlocks.map(anthropicSystemBlock),
        messages: [{ role: 'user', content: request.prompt }],
      });

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'thinking') {
            yield { type: 'meta', path: '/status', value: 'thinking' };
          } else if (event.content_block.type === 'text') {
            yield { type: 'meta', path: '/status', value: 'writing' };
          }
          continue;
        }
        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            yield { type: 'text', text: event.delta.text };
          } else if (event.delta.type === 'thinking_delta') {
            yield { type: 'meta', path: '/thinking', value: event.delta.thinking };
          }
        }
      }

      const final = await stream.finalMessage();
      onUsage(normalizeAnthropicUsage(final.usage));
    },
    async repairSurfaceSection(request, selection = defaultsToSelection(defaults)) {
      const repairMessage = await ensureClient().messages.create({
        model: selection.generationModel,
        max_tokens: selection.options.repairMaxOutputTokens,
        system: [
          ...request.promptBlocks.map(anthropicSystemBlock),
          {
            type: 'text',
            text: repairModeSystemText(),
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: request.prompt }],
      });
      return extractAnthropicText(repairMessage.content);
    },
    async completeText(request, selection = defaultsToSelection(defaults)) {
      const result = await ensureClient().messages.create({
        model: selection.utilityModel,
        max_tokens: request.maxTokens,
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        system: [
          {
            type: 'text',
            text: request.system,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: request.prompt }],
      });
      return extractAnthropicText(result.content);
    },
  };
}

function createOpenAIProvider(env: NodeJS.ProcessEnv): ModelProviderAdapter {
  const apiKey = env.OPENAI_API_KEY?.trim();
  const baseUrl = trimTrailingSlash(env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1');
  const model = env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
  const utilityModel = env.OPENAI_SMALL_MODEL ?? DEFAULT_OPENAI_UTILITY_MODEL;
  const defaults = createProviderDefaults({
    env,
    generationModel: model,
    utilityModel,
    catalog: OPENAI_MODELS,
  });
  const controls = createProviderControls(defaults);
  const resolveSelection = createSelectionResolver({
    providerName: 'OpenAI',
    models: OPENAI_MODELS,
    utilityModels: OPENAI_MODELS,
    defaults,
  });

  const post = async (path: string, body: unknown, signal?: AbortSignal): Promise<Response> => {
    if (!apiKey) throw new Error('OpenAI is not configured; set OPENAI_API_KEY');
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) {
      throw new Error(`OpenAI API ${response.status}: ${await readErrorBody(response)}`);
    }
    return response;
  };

  const responsesBody = (
    selectedModel: string,
    system: string,
    prompt: string,
    maxTokens: number,
    stream: boolean,
    temperature?: number,
  ) => ({
    model: selectedModel,
    instructions: system,
    input: prompt,
    max_output_tokens: maxTokens,
    stream,
    ...(temperature !== undefined ? { temperature } : {}),
  });

  return {
    id: 'openai',
    name: 'OpenAI',
    configured: Boolean(apiKey),
    model,
    utilityModel,
    models: OPENAI_MODELS,
    utilityModels: OPENAI_MODELS,
    defaults,
    controls,
    missingEnv: 'OPENAI_API_KEY',
    resolveSelection,
    async *streamSurfaceGeneration(request, onUsage, selection = defaultsToSelection(defaults)) {
      const response = await post(
        '/responses',
        responsesBody(
          selection.generationModel,
          promptBlocksToText(request.promptBlocks),
          request.prompt,
          selection.options.maxOutputTokens,
          true,
        ),
        request.signal,
      );

      let hasStatus = false;
      for await (const event of readSseEvents(response.body)) {
        if (!event.data || event.data === '[DONE]') continue;
        const payload = parseJsonObject(event.data);
        if (!payload) continue;

        const type = typeof payload.type === 'string' ? payload.type : event.event;
        const textDelta = openAITextDelta(payload, type);
        if (textDelta) {
          if (!hasStatus) {
            hasStatus = true;
            yield { type: 'meta', path: '/status', value: 'writing' };
          }
          yield { type: 'text', text: textDelta };
          continue;
        }

        const thinkingDelta = openAIThinkingDelta(payload, type);
        if (thinkingDelta) {
          yield { type: 'meta', path: '/status', value: 'thinking' };
          yield { type: 'meta', path: '/thinking', value: thinkingDelta };
          continue;
        }

        const usage = openAIUsage(payload);
        if (usage) onUsage(usage);
      }
    },
    async repairSurfaceSection(request, selection = defaultsToSelection(defaults)) {
      const response = await post(
        '/responses',
        responsesBody(
          selection.generationModel,
          `${promptBlocksToText(request.promptBlocks)}\n\n${repairModeSystemText()}`,
          request.prompt,
          selection.options.repairMaxOutputTokens,
          false,
        ),
        request.signal,
      );
      return extractOpenAIText(await response.json());
    },
    async completeText(request, selection = defaultsToSelection(defaults)) {
      const response = await post(
        '/responses',
        responsesBody(
          selection.utilityModel,
          request.system,
          request.prompt,
          request.maxTokens,
          false,
          request.temperature,
        ),
        request.signal,
      );
      return extractOpenAIText(await response.json());
    },
  };
}

function createGeminiProvider(env: NodeJS.ProcessEnv): ModelProviderAdapter {
  const apiKey = (env.GEMINI_API_KEY ?? env.GOOGLE_API_KEY)?.trim();
  const baseUrl = trimTrailingSlash(env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com');
  const model = env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
  const utilityModel = env.GEMINI_SMALL_MODEL ?? DEFAULT_GEMINI_UTILITY_MODEL;
  const defaults = createProviderDefaults({
    env,
    generationModel: model,
    utilityModel,
    catalog: GEMINI_MODELS,
  });
  const controls = createProviderControls(defaults);
  const resolveSelection = createSelectionResolver({
    providerName: 'Gemini',
    models: GEMINI_MODELS,
    utilityModels: GEMINI_MODELS,
    defaults,
  });

  const post = async (
    selectedModel: string,
    method: 'generateContent' | 'streamGenerateContent',
    body: unknown,
    signal?: AbortSignal,
  ): Promise<Response> => {
    if (!apiKey) throw new Error('Gemini is not configured; set GEMINI_API_KEY');
    const response = await fetch(`${baseUrl}/v1beta/${geminiModelPath(selectedModel)}:${method}${method === 'streamGenerateContent' ? '?alt=sse' : ''}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) {
      throw new Error(`Gemini API ${response.status}: ${await readErrorBody(response)}`);
    }
    return response;
  };

  return {
    id: 'gemini',
    name: 'Gemini',
    configured: Boolean(apiKey),
    model,
    utilityModel,
    models: GEMINI_MODELS,
    utilityModels: GEMINI_MODELS,
    defaults,
    controls,
    missingEnv: 'GEMINI_API_KEY',
    resolveSelection,
    async *streamSurfaceGeneration(request, onUsage, selection = defaultsToSelection(defaults)) {
      const response = await post(
        selection.generationModel,
        'streamGenerateContent',
        geminiBody(promptBlocksToText(request.promptBlocks), request.prompt, selection.options.maxOutputTokens),
        request.signal,
      );

      let hasStatus = false;
      for await (const event of readSseEvents(response.body)) {
        if (!event.data || event.data === '[DONE]') continue;
        const payload = parseJsonObject(event.data);
        if (!payload) continue;
        const text = extractGeminiText(payload);
        if (text) {
          if (!hasStatus) {
            hasStatus = true;
            yield { type: 'meta', path: '/status', value: 'writing' };
          }
          yield { type: 'text', text };
        }
        const usage = geminiUsage(payload);
        if (usage) onUsage(usage);
      }
    },
    async repairSurfaceSection(request, selection = defaultsToSelection(defaults)) {
      const response = await post(
        selection.generationModel,
        'generateContent',
        geminiBody(
          `${promptBlocksToText(request.promptBlocks)}\n\n${repairModeSystemText()}`,
          request.prompt,
          selection.options.repairMaxOutputTokens,
        ),
        request.signal,
      );
      return extractGeminiText(await response.json()).trim();
    },
    async completeText(request, selection = defaultsToSelection(defaults)) {
      const response = await post(
        selection.utilityModel,
        'generateContent',
        geminiBody(request.system, request.prompt, request.maxTokens, request.temperature),
        request.signal,
      );
      return extractGeminiText(await response.json()).trim();
    },
  };
}

function anthropicSystemBlock(block: ContractPromptBlock): Anthropic.TextBlockParam {
  if (block.cache === 'ephemeral') {
    return {
      type: 'text',
      text: block.text,
      cache_control: { type: 'ephemeral' },
    };
  }
  return {
    type: 'text',
    text: block.text,
  };
}

function promptBlocksToText(blocks: ContractPromptBlock[]): string {
  return blocks.map((block) => block.text).join('\n\n');
}

function repairModeSystemText(): string {
  return '## Repair mode\n\nYou are repairing one blocked Summon target. Return exactly one safe replacement `add` JSONL line for the same target path and nothing else.';
}

function extractAnthropicText(content: Anthropic.Message['content']): string {
  return content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('\n')
    .trim();
}

function normalizeAnthropicUsage(usage: Anthropic.Message['usage']): ProviderUsageSnapshot {
  return {
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_read_input_tokens: usage.cache_read_input_tokens,
    cache_creation_input_tokens: usage.cache_creation_input_tokens,
  };
}

async function* readSseEvents(body: ReadableStream<Uint8Array> | null): AsyncGenerator<{ event: string; data: string }, void, void> {
  if (!body) throw new Error('provider returned no response body');
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      yield* drainSseBuffer(() => buffer, (next) => {
        buffer = next;
      });
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      yield parseSseEvent(buffer);
    }
  } finally {
    reader.releaseLock();
  }
}

function* drainSseBuffer(
  getBuffer: () => string,
  setBuffer: (buffer: string) => void,
): Generator<{ event: string; data: string }, void, void> {
  let normalized = getBuffer().replace(/\r\n/g, '\n');
  let boundary = normalized.indexOf('\n\n');
  while (boundary !== -1) {
    const raw = normalized.slice(0, boundary);
    normalized = normalized.slice(boundary + 2);
    if (raw.trim()) yield parseSseEvent(raw);
    boundary = normalized.indexOf('\n\n');
  }
  setBuffer(normalized);
}

function parseSseEvent(raw: string): { event: string; data: string } {
  let event = 'message';
  const data: string[] = [];
  for (const line of raw.replace(/\r\n/g, '\n').split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim();
    } else if (line.startsWith('data:')) {
      data.push(line.slice('data:'.length).trimStart());
    }
  }
  return { event, data: data.join('\n') };
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function openAITextDelta(payload: Record<string, unknown>, type: string): string {
  if (type === 'response.output_text.delta' && typeof payload.delta === 'string') {
    return payload.delta;
  }
  const choices = payload.choices;
  if (Array.isArray(choices)) {
    return choices
      .map((choice) => {
        if (!choice || typeof choice !== 'object') return '';
        const delta = (choice as { delta?: { content?: unknown } }).delta;
        return typeof delta?.content === 'string' ? delta.content : '';
      })
      .join('');
  }
  return '';
}

function openAIThinkingDelta(payload: Record<string, unknown>, type: string): string {
  if (
    (type === 'response.reasoning_summary_text.delta' ||
      type === 'response.reasoning_text.delta') &&
    typeof payload.delta === 'string'
  ) {
    return payload.delta;
  }
  return '';
}

function openAIUsage(payload: Record<string, unknown>): ProviderUsageSnapshot | null {
  const response = payload.response && typeof payload.response === 'object'
    ? payload.response as Record<string, unknown>
    : null;
  const rawUsage = response?.usage ?? payload.usage;
  if (!rawUsage || typeof rawUsage !== 'object') return null;
  const usage = rawUsage as Record<string, unknown>;
  const input = numberValue(usage.input_tokens ?? usage.prompt_tokens);
  const output = numberValue(usage.output_tokens ?? usage.completion_tokens);
  if (input === null && output === null) return null;
  return {
    input_tokens: input ?? 0,
    output_tokens: output ?? 0,
    total_tokens: numberValue(usage.total_tokens),
  };
}

function extractOpenAIText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const obj = payload as Record<string, unknown>;
  if (typeof obj.output_text === 'string') return obj.output_text.trim();
  const output = obj.output;
  if (Array.isArray(output)) {
    return output
      .flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const content = (item as { content?: unknown }).content;
        if (!Array.isArray(content)) return [];
        return content.map((part) => {
          if (!part || typeof part !== 'object') return '';
          const text = (part as { text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        });
      })
      .join('\n')
      .trim();
  }
  const choices = obj.choices;
  if (Array.isArray(choices)) {
    return choices
      .map((choice) => {
        if (!choice || typeof choice !== 'object') return '';
        const message = (choice as { message?: { content?: unknown } }).message;
        return typeof message?.content === 'string' ? message.content : '';
      })
      .join('\n')
      .trim();
  }
  return '';
}

function geminiBody(
  system: string,
  prompt: string,
  maxOutputTokens: number,
  temperature?: number,
): Record<string, unknown> {
  return {
    systemInstruction: {
      parts: [{ text: system }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      maxOutputTokens,
      ...(temperature !== undefined ? { temperature } : {}),
    },
  };
}

function geminiModelPath(model: string): string {
  return model.startsWith('models/') ? model : `models/${encodeURIComponent(model)}`;
}

function extractGeminiText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return '';
  return candidates
    .flatMap((candidate) => {
      if (!candidate || typeof candidate !== 'object') return [];
      const parts = (candidate as { content?: { parts?: unknown } }).content?.parts;
      if (!Array.isArray(parts)) return [];
      return parts.map((part) => {
        if (!part || typeof part !== 'object') return '';
        const text = (part as { text?: unknown }).text;
        return typeof text === 'string' ? text : '';
      });
    })
    .join('');
}

function geminiUsage(payload: Record<string, unknown>): ProviderUsageSnapshot | null {
  const rawUsage = payload.usageMetadata;
  if (!rawUsage || typeof rawUsage !== 'object') return null;
  const usage = rawUsage as Record<string, unknown>;
  return {
    input_tokens: numberValue(usage.promptTokenCount) ?? 0,
    output_tokens: numberValue(usage.candidatesTokenCount) ?? 0,
    total_tokens: numberValue(usage.totalTokenCount),
  };
}

function defaultsToSelection(defaults: ModelProviderDefaults): ModelSelection {
  return {
    generationModel: defaults.generationModel,
    utilityModel: defaults.utilityModel,
    customModel: false,
    options: defaults.modelOptions,
  };
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

async function readErrorBody(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  return text.slice(0, 1000) || response.statusText;
}
