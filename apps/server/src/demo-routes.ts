import type Anthropic from '@anthropic-ai/sdk';
import type { Express } from 'express';

/**
 * Backing services for the demo capability pack.
 *
 * These routes are intentionally outside main.ts so the generation server's
 * core route stays separate from the dev/demo intent implementations. A real
 * Summon host would define its own backing services next to its own capability
 * pack rather than reuse these.
 */
export function registerDemoRoutes(app: Express, anthropic: Anthropic): void {
  /**
   * Mock search — generates plausible-but-fictional results via Claude Haiku.
   * Not a real search index; this demonstrates "sandbox emits intent -> host
   * calls a backing service" without letting the sandbox reach the network.
   */
  app.post('/api/mock-search', async (req, res) => {
    const query =
      typeof req.body?.query === 'string' ? req.body.query.trim().slice(0, 200) : '';
    if (!query) {
      res.status(400).json({ error: 'query required' });
      return;
    }
    try {
      const result = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 800,
        system:
          'Generate 4-5 realistic-but-fictional search results for the given query. Return ONLY a JSON array, no markdown fences, no prose. Shape: [{"title": "...", "snippet": "...", "source": "..."}]. Titles: 4-10 words, specific and plausible. Snippets: 1-2 sentences, 20-40 words, useful-sounding. Sources: realistic domain names like "nytimes.com", "seriouseats.com", "theverge.com". Vary the tone across results.',
        messages: [{ role: 'user', content: query }],
      });
      const block = result.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
      const raw = block?.text ?? '[]';
      // Haiku often wraps JSON in ```json fences. Strip them, plus any leading prose.
      const cleaned = raw
        .replace(/^[\s\S]*?```(?:json)?\s*/i, '')
        .replace(/\s*```[\s\S]*$/, '')
        .trim();
      const toParse = cleaned.startsWith('[') || cleaned.startsWith('{') ? cleaned : raw.trim();
      let results: unknown;
      try {
        results = JSON.parse(toParse);
      } catch {
        // Last resort: extract the first JSON array we can find.
        const match = toParse.match(/\[[\s\S]*\]/);
        results = match ? JSON.parse(match[0]) : [];
      }
      res.json({ query, results });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[mock-search] error:', msg);
      res.status(500).json({ error: msg });
    }
  });

  /**
   * Generic LLM call — generated UI can ask the host to produce text for it.
   * Enables "brainstorm this", "rewrite that", "draft a ..." demo patterns.
   */
  app.post('/api/ai-call', async (req, res) => {
    const prompt =
      typeof req.body?.prompt === 'string' ? req.body.prompt.trim().slice(0, 2000) : '';
    if (!prompt) {
      res.status(400).json({ error: 'prompt required' });
      return;
    }
    try {
      const result = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1000,
        system:
          'Respond directly to the user. No preambles ("Here is..."), no sign-offs. Keep output tight - the UI will display it. If the user asked for a list, return a numbered list. If they asked for a single answer, give one. Match the format to the ask.',
        messages: [{ role: 'user', content: prompt }],
      });
      const block = result.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
      res.json({ prompt, response: block?.text ?? '' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[ai-call] error:', msg);
      res.status(500).json({ error: msg });
    }
  });

  /**
   * Generates a fresh sample ask for the Generate page's "Random" button.
   */
  app.post('/api/random-prompt', async (_req, res) => {
    try {
      const result = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 200,
        // Nudges variety run-to-run; Haiku at temp 0 produces near-identical text.
        temperature: 1,
        system:
          'You generate ONE realistic user request for a demo of an AI that builds little UIs from natural language.\n\n' +
          'HARD RULES:\n' +
          '- Output exactly one request. No preamble, no quotes, no list.\n' +
          '- 1-2 sentences, lowercase, conversational, like the user is texting an assistant.\n' +
          '- Phrase it as INTENT - what the user wants to do, see, decide, plan, track, understand, or a mini-app for a real situation.\n' +
          '- NEVER describe a UI. No "a form with...", no "show buttons that...", no "input fields for...". Describe the goal; the AI figures out the shape.\n' +
          '- Be specific. Concrete numbers, names, contexts. Not "help me plan a trip" but "help me plan a 4-day Tokyo trip in October on a $1500 budget".\n' +
          '- Vary the domain run-to-run: planning, decisions, tracking, learning, drafting, comparing, brainstorming, picking, reflecting, money, relationships, work, hobbies, home life.\n' +
          '- Vary the verb. Avoid always starting with "help me".',
        messages: [{ role: 'user', content: 'generate one' }],
      });
      const block = result.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
      const text = (block?.text ?? '').trim().replace(/^["']|["']$/g, '');
      if (!text) {
        res.status(502).json({ error: 'empty response' });
        return;
      }
      res.json({ prompt: text });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[random-prompt] error:', msg);
      res.status(500).json({ error: msg });
    }
  });
}
