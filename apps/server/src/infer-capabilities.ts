import Anthropic from '@anthropic-ai/sdk';
import type { CapabilityPack } from '@anarchitecture/summon';

export interface InferenceResult {
  /** Narrowed pack — never wider than the ceiling. Null when mode is static. */
  pack: CapabilityPack | null;
  mode: 'static' | 'interactive';
}

/**
 * Use Claude Haiku to decide whether a prompt needs interactivity, and if so
 * which subset of the ceiling pack's intents it actually requires. Returns
 * null on timeout or error so the caller can fall through to the regex.
 *
 * The classifier is constrained: it can only NARROW the intent list, never
 * add intents the host didn't declare. This preserves the strict-tier
 * contract — a host that locked its pack to a single intent stays locked.
 *
 * The system prompt is cache-controlled per pack, so the typical request
 * hits the prompt cache. Even cached, observed Haiku latency is ~700ms p50
 * and ~1.5s p90, so the default timeout is generous; set lower if you'd
 * rather trade classification accuracy for TTFT under contention.
 */
export async function inferPack(
  client: Anthropic,
  prompt: string,
  ceiling: CapabilityPack,
  timeoutMs = 2000
): Promise<InferenceResult | null> {
  if (ceiling.intents.length === 0) {
    return { pack: null, mode: 'static' };
  }

  const intentList = ceiling.intents
    .map((i) => `- ${i.name} [${i.kind === 'resource' ? 'data resource' : 'action'}]: ${i.description || '(no description)'}`)
    .join('\n');

  const systemText = `Decide whether a UI generation prompt needs interactivity, and if so which action intents and data resources from a fixed flat list it actually requires.

Available actions and data resources:
${intentList}

Respond with ONLY a single JSON object on one line. No markdown fences, no prose. Shape:
{"mode":"static","intents":[]}
or
{"mode":"interactive","intents":["intent_name", ...]}

Use "static" when the prompt asks for content (cards, articles, recommendations, comparisons, dashboards, summaries) without user interaction. Use "interactive" when the prompt clearly asks for the user to act — pick, submit, filter, toggle, search, vote, track, etc. Also use "interactive" when the UI needs host-owned data from a listed data resource.

When interactive, include ONLY the names the prompt actually needs. A picker prompt usually needs the "choose" action alone, not "submit". A search prompt needs the "search" data resource. Never include names that aren't in the available list above.`;

  try {
    const callPromise = client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      system: [
        {
          type: 'text',
          text: systemText,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: prompt }],
    });

    const result = await Promise.race([
      callPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);

    if (!result) return null;

    const block = result.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    const raw = (block?.text ?? '').trim();

    // Tolerate fenced JSON or leading prose.
    const cleaned = raw
      .replace(/^[\s\S]*?```(?:json)?\s*/i, '')
      .replace(/\s*```[\s\S]*$/, '')
      .trim();
    const candidate = cleaned.startsWith('{') ? cleaned : raw;
    const match = candidate.match(/\{[\s\S]*\}/);
    const json = match ? match[0] : null;
    if (!json) return null;

    let parsed: { mode?: unknown; intents?: unknown };
    try {
      parsed = JSON.parse(json);
    } catch {
      return null;
    }

    const mode = parsed.mode === 'interactive' ? 'interactive' : 'static';
    if (mode === 'static') return { pack: null, mode };

    const requested = Array.isArray(parsed.intents)
      ? new Set(parsed.intents.filter((x): x is string => typeof x === 'string'))
      : new Set<string>();
    const narrowed = ceiling.intents.filter((i) => requested.has(i.name));

    if (narrowed.length === 0) {
      // Haiku said interactive but produced no usable intents — treat as
      // ambiguous and let the caller fall through to the regex.
      return null;
    }

    return {
      mode,
      pack: { intents: narrowed, patterns: ceiling.patterns },
    };
  } catch (err) {
    console.error('[infer-capabilities] error:', err instanceof Error ? err.message : err);
    return null;
  }
}
