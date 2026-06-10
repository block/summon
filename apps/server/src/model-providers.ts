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

export interface ModelProviderInfo {
  id: ModelProviderId;
  name: string;
  configured: boolean;
  model: string;
  utilityModel: string;
  missingEnv?: string;
}

export interface ModelProviderAdapter extends ModelProviderInfo, TextCompletionClient {
  streamSurfaceGeneration(
    request: SummonModelRequest,
    onUsage: (usage: ProviderUsageSnapshot) => void,
  ): AsyncGenerator<SummonModelChunk, void, void>;
  repairSurfaceSection(request: SummonRepairRequest): Promise<string>;
}

export interface ModelProviderRegistry {
  defaultProvider: ModelProviderAdapter | null;
  get(id: ModelProviderId): ModelProviderAdapter;
  info(): ModelProviderInfo[];
  resolve(raw: unknown): { ok: true; provider: ModelProviderAdapter } | { ok: false; error: string };
}

const PROVIDER_IDS: ModelProviderId[] = ['anthropic', 'openai', 'gemini'];
const DEFAULT_OPENAI_MODEL = 'gpt-5';
const DEFAULT_OPENAI_UTILITY_MODEL = 'gpt-5-mini';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-pro';
const DEFAULT_GEMINI_UTILITY_MODEL = 'gemini-2.5-flash';

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
    resolve(raw) {
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
      return { ok: true, provider };
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
    ...(!provider.configured && provider.missingEnv ? { missingEnv: provider.missingEnv } : {}),
  };
}

function createAnthropicProvider(env: NodeJS.ProcessEnv): ModelProviderAdapter {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  const model = env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
  const utilityModel = env.ANTHROPIC_SMALL_MODEL ?? 'claude-haiku-4-5';
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
    missingEnv: 'ANTHROPIC_API_KEY',
    async *streamSurfaceGeneration(request, onUsage) {
      const stream = ensureClient().messages.stream({
        model,
        max_tokens: 64000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
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
    async repairSurfaceSection(request) {
      const repairMessage = await ensureClient().messages.create({
        model,
        max_tokens: 12000,
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
    async completeText(request) {
      const result = await ensureClient().messages.create({
        model: utilityModel,
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
    missingEnv: 'OPENAI_API_KEY',
    async *streamSurfaceGeneration(request, onUsage) {
      const response = await post(
        '/responses',
        responsesBody(
          model,
          promptBlocksToText(request.promptBlocks),
          request.prompt,
          64000,
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
    async repairSurfaceSection(request) {
      const response = await post(
        '/responses',
        responsesBody(
          model,
          `${promptBlocksToText(request.promptBlocks)}\n\n${repairModeSystemText()}`,
          request.prompt,
          12000,
          false,
        ),
        request.signal,
      );
      return extractOpenAIText(await response.json());
    },
    async completeText(request) {
      const response = await post(
        '/responses',
        responsesBody(
          utilityModel,
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
    missingEnv: 'GEMINI_API_KEY',
    async *streamSurfaceGeneration(request, onUsage) {
      const response = await post(
        model,
        'streamGenerateContent',
        geminiBody(promptBlocksToText(request.promptBlocks), request.prompt, 64000),
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
    async repairSurfaceSection(request) {
      const response = await post(
        model,
        'generateContent',
        geminiBody(
          `${promptBlocksToText(request.promptBlocks)}\n\n${repairModeSystemText()}`,
          request.prompt,
          12000,
        ),
        request.signal,
      );
      return extractGeminiText(await response.json()).trim();
    },
    async completeText(request) {
      const response = await post(
        utilityModel,
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
  return '## Repair mode\n\nYou are repairing one blocked Summon section. Return exactly one safe replacement `add /section/<same-id>` JSONL line and nothing else.';
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

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

async function readErrorBody(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  return text.slice(0, 1000) || response.statusText;
}
