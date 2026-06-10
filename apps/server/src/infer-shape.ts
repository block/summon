import type { TextCompletionClient } from './model-providers.js';

/**
 * The fixed enum of response shapes a generation can be classified into. Maps
 * 1:1 to the shape exemplars a direction may carry — picking a shape selects
 * the matching exemplar to ship in the per-direction prompt block.
 *
 * Shapes that don't have a dedicated exemplar (plan/itinerary, reflection)
 * collapse onto the closest match: "plan" → article, "reflection" → card.
 * The classifier emits null when ambiguous; the caller then ships all shape
 * exemplars (current behavior) instead of guessing wrong.
 */
export type ResponseShape = 'article' | 'card' | 'comparison' | 'tracker';

/**
 * Use a utility model to pick the response shape that best fits a prompt. The
 * caller passes the result into buildDirectionBlock so only the matching
 * shape exemplar ships in the per-direction prompt — saving cache write +
 * sharpening the model's anchor.
 *
 * Returns null on timeout, parse failure, or low-confidence ambiguity. The
 * caller should treat null as "ship all shapes" (legacy behavior).
 */
export async function inferShape(
  client: TextCompletionClient,
  prompt: string,
  timeoutMs = 1500
): Promise<ResponseShape | null> {
  const systemText = `Classify a generative-UI prompt into the response shape that best fits the user's intent.

Shapes:
- article — long-form explainer, walkthrough, plan/itinerary. Lead is body copy under a heading.
- card — focused single-block summary, recommendation, status readout, weekly digest.
- comparison — side-by-side options, decision support, A vs B, pros/cons.
- tracker — dashboard, dominant number with breakdown, progress, stats grid.

Respond with ONLY a single JSON object on one line. No markdown fences, no prose. Shape:
{"shape":"article"} or {"shape":"card"} or {"shape":"comparison"} or {"shape":"tracker"} or {"shape":null}

Use null ONLY when the prompt genuinely fits none of the above OR when two shapes are equally plausible. When in doubt between two shapes, pick the more specific one (comparison > article, tracker > card).`;

  try {
    const callPromise = client.completeText({
      system: systemText,
      prompt,
      maxTokens: 100,
    });

    const result = await Promise.race([
      callPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);

    if (!result) return null;

    const raw = result.trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;

    let parsed: { shape?: unknown };
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return null;
    }

    const shape = parsed.shape;
    if (shape === 'article' || shape === 'card' || shape === 'comparison' || shape === 'tracker') {
      return shape;
    }
    return null;
  } catch (err) {
    console.error('[infer-shape] error:', err instanceof Error ? err.message : err);
    return null;
  }
}
