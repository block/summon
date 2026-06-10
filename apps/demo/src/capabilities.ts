/**
 * Demo capability registry — the demo app owns its intent vocabulary, prompt
 * patterns, and handler implementations in one place. The registry produces
 * both the model-facing CapabilityPack and the PolicyEngine handler map.
 */

import {
  createCapabilityRegistry,
  defineAction,
  defineApprovalAction,
  defineDataResource,
  defineWorkerAction,
  defineWorkerResource,
  type ApprovalDecision,
  type ApprovalRequest,
  type CapabilityDefinition,
  type CapabilityRegistry,
} from '@anarchitecture/summon';
import type { IntentHandler } from '@anarchitecture/summon/policy';
import { z } from 'zod';

const logArgsSchema = z.object({ payload: z.any().optional() }).passthrough();
const counterArgsSchema = z.object({ delta: z.number() });
const chooseArgsSchema = z.object({ option: z.string().trim().min(1) });
const submitArgsSchema = z.record(z.any());
const searchArgsSchema = z.object({ query: z.string().trim().min(1) });
const aiArgsSchema = z.object({ prompt: z.string().trim().min(1) });
const githubLookupArgsSchema = z.object({ username: z.string().trim().min(1) });
const analysisArgsSchema = z.object({ topic: z.string().trim().min(1) });
const publishArgsSchema = z.object({ title: z.string().trim().min(1) });
const searchResultSchema = z.array(
  z.object({
    title: z.string(),
    snippet: z.string(),
    source: z.string(),
  }).passthrough(),
);
const aiResultSchema = z.string();
const analysisResultSchema = z.object({
  topic: z.string(),
  score: z.number(),
  summary: z.string(),
  next: z.array(z.string()),
});
const githubLookupResultSchema = z.object({
  login: z.string(),
  name: z.string().nullable(),
  bio: z.string().nullable(),
  followers: z.number(),
  public_repos: z.number(),
  avatar: z.string().nullable(),
});
const summonArgsSchema = z.object({
  prompt: z.string().trim().min(1),
  title: z.string().trim().optional(),
});

type SearchResult = z.infer<typeof searchResultSchema>;
type SummonArgs = z.infer<typeof summonArgsSchema>;
type PublishArgs = z.infer<typeof publishArgsSchema>;

interface PublishSummaryPlan {
  title: string;
  channel: string;
}

export interface DemoModelSelectionPayload {
  modelProvider?: string | null;
  generationModel?: string;
  utilityModel?: string;
  customModel?: boolean;
  modelOptions?: object;
}

function providerPayload(
  modelProvider: string | null | undefined,
  selection: DemoModelSelectionPayload | undefined,
): DemoModelSelectionPayload {
  return {
    ...(modelProvider ? { modelProvider } : {}),
    ...(selection?.generationModel ? { generationModel: selection.generationModel } : {}),
    ...(selection?.utilityModel ? { utilityModel: selection.utilityModel } : {}),
    ...(selection?.customModel ? { customModel: true } : {}),
    ...(selection?.modelOptions ? { modelOptions: selection.modelOptions } : {}),
  };
}

export interface DemoHandlerOptions {
  onLog?: (message: string) => void;
  onError?: (message: string) => void;
  modelProvider?: () => string | null;
  modelSelection?: () => DemoModelSelectionPayload;
  /**
   * Optional because only the single-prompt generate page owns the DOM and
   * streaming machinery needed to spawn sibling sandboxes.
   */
  onSummon?: IntentHandler<SummonArgs>;
  /**
   * Optional because batch/demo surfaces may run without a visible host
   * approval panel. Browser hosts should render their own approve/deny UI here.
   */
  onApprovalRequest?: (
    request: ApprovalRequest<PublishArgs, PublishSummaryPlan>,
  ) => Promise<ApprovalDecision> | ApprovalDecision;
}

export function createDemoCapabilityRegistry(
  opts: DemoHandlerOptions = {},
): CapabilityRegistry {
  const log = opts.onLog ?? (() => {});
  const errlog = opts.onError ?? opts.onLog ?? (() => {});

  // Per-registry ephemeral state. Each sandbox/tile gets its own registry so
  // counters and choices don't bleed across generated artifacts.
  let counterValue = 0;
  let logCount = 0;
  const chosenOptions: string[] = [];

  const capabilities: CapabilityDefinition<any>[] = [
    defineAction({
      name: 'log',
      description:
        'Record an arbitrary payload on the host. Good for click tracking, "I picked this" captures, generic event logging.',
      argsSchema: logArgsSchema,
      argsSchemaText: '{payload: any}',
      stateShape: '{lastLogged: any, logCount: number}',
      handler: ({ args, push }) => {
        const payload = args.payload ?? args;
        const preview = JSON.stringify(payload).slice(0, 80);
        log(`-> log ${preview}`);
        logCount += 1;
        push({ lastLogged: payload, logCount });
      },
    }),

    defineAction({
      name: 'counter',
      description:
        'Adjust a shared integer by `delta` (can be negative). Host tracks the running total and returns it.',
      argsSchema: counterArgsSchema,
      stateShape: '{count: number}',
      patterns: [
        {
          name: 'Counter (shared integer state)',
          code: `<div>
  <button data-summon-on-click="counter" data-summon-args='{"delta":-1}'>-</button>
  <output data-summon-bind="count">0</output>
  <button data-summon-on-click="counter" data-summon-args='{"delta":1}'>+</button>
</div>`,
        },
      ],
      handler: ({ args, push }) => {
        counterValue += args.delta;
        log(`-> counter ${args.delta > 0 ? '+' : ''}${args.delta} -> ${counterValue}`);
        push({ count: counterValue });
      },
    }),

    defineAction({
      name: 'choose',
      description:
        'Record that the user picked a labeled option. Host keeps the running list of choices and which one was last.',
      argsSchema: chooseArgsSchema,
      stateShape: '{lastChoice: string, chosenOptions: string[]}',
      handler: ({ args, push }) => {
        chosenOptions.push(args.option);
        log(`-> choose "${args.option}" (${chosenOptions.length} total)`);
        push({ lastChoice: args.option, chosenOptions: [...chosenOptions] });
      },
    }),

    defineAction({
      name: 'submit',
      description:
        'Submit a form. Args are the form fields keyed by name. Host validates every field is non-empty; returns field-level errors or a success flag. Use for task forms, quick intake surfaces, onboarding steps.',
      argsSchema: submitArgsSchema,
      argsSchemaText: '{[fieldName: string]: string}',
      stateShape:
        '{submitted: boolean, submittedFields: Record<string, string>, fieldErrors: Record<string, string>, submitError: string | null}',
      patterns: [
        {
          name: 'Form submit (validation)',
          code: `<form data-summon-on-submit="submit">
  <input name="title" placeholder="Title">
  <input name="notes" placeholder="Notes">
  <button>Save</button>
</form>
<p data-summon-show="submitted" style="color:var(--color-success);">Saved.</p>
<p data-summon-show="submitError" data-summon-bind="submitError" style="color:var(--color-danger);"></p>`,
        },
      ],
      handler: ({ args, push }) => {
        const entries = Object.entries(args).map(
          ([k, v]) => [k, typeof v === 'string' ? v : String(v ?? '')] as [string, string],
        );
        if (entries.length === 0) {
          push({ submitError: 'No fields provided', submitted: false });
          return;
        }
        const normalized: Record<string, string> = Object.fromEntries(entries);
        const fieldErrors: Record<string, string> = {};
        for (const [k, v] of entries) {
          if (!v || v.trim() === '') fieldErrors[k] = 'Required';
        }
        if (Object.keys(fieldErrors).length > 0) {
          errlog(`-> submit rejected (${Object.keys(fieldErrors).join(', ')})`);
          push({
            submitted: false,
            submittedFields: normalized,
            fieldErrors,
            submitError: 'Please fill all required fields',
          });
          return;
        }
        log(`-> submit ok (${Object.keys(normalized).join(', ')})`);
        push({ submitted: true, submittedFields: normalized, fieldErrors: {}, submitError: null });
      },
    }),

    defineDataResource({
      name: 'search',
      description:
        'Run a text search. Host returns 4-5 plausible result objects (synthesized; no real index). Use for discovery UIs: recipe finders, place finders, topic explorers, product search.',
      argsSchema: searchArgsSchema,
      resultSchema: searchResultSchema,
      defaultData: [],
      stateKeys: { loading: 'searching', data: 'results', error: 'searchError' },
      triggers: ['submit', 'mount'],
      stateShape:
        '{searching: boolean, query: string, results: Array<{title: string, snippet: string, source: string}> | null, searchError: string | null}',
      patterns: [
        {
          name: 'Search + result list (form submit + foreach + scoped click)',
          code: `<div data-summon-resource="search" data-summon-resource-as="s">
  <form data-summon-resource-trigger="submit">
    <input name="query" placeholder="Search...">
    <button data-summon-attr-disabled="$s.loading">Go</button>
  </form>
  <p data-summon-show="$s.loading">Searching...</p>
  <p data-summon-show="$s.error" data-summon-bind="$s.error" style="color:var(--color-danger);"></p>
  <ul data-summon-foreach="$s.data" data-summon-as="r" data-summon-show="$s.data" style="list-style:none;padding:0;margin:0;">
    <template>
      <li data-summon-on-click="log" data-summon-args='{"payload":{"picked":"$r"}}' style="cursor:pointer;padding:8px 12px;border-bottom:1px solid var(--color-border);">
        <div style="font-weight:600;" data-summon-bind="$r.title"></div>
        <div style="color:var(--color-text-muted);font-size:var(--text-sm);" data-summon-bind="$r.snippet"></div>
      </li>
    </template>
  </ul>
</div>`,
        },
      ],
      onStart: ({ query }) => {
        log(`-> search "${query}"`);
        return { query };
      },
      onError: (msg) => errlog(`search error: ${msg}`),
      fetch: async ({ query }, signal) => {
        const res = await fetch('/api/mock-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            ...providerPayload(opts.modelProvider?.(), opts.modelSelection?.()),
          }),
          signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { results?: unknown };
        const results = Array.isArray(data.results) ? data.results : [];
        log(`  got ${results.length} results`);
        return results as SearchResult;
      },
    }),

    defineDataResource({
      name: 'ai',
      description:
        'Ask the host to generate text in response to a prompt. The host runs a fast LLM (Haiku) and returns the text. Use for brainstorm buttons, "expand this", "rewrite this", draft helpers.',
      argsSchema: aiArgsSchema,
      resultSchema: aiResultSchema,
      defaultData: null,
      stateKeys: { loading: 'aiLoading', data: 'aiResponse', error: 'aiError' },
      triggers: ['submit'],
      stateShape: '{aiLoading: boolean, aiResponse: string | null, aiError: string | null}',
      patterns: [
        {
          name: 'AI brainstorm (form submit + show loading + bind output)',
          code: `<div data-summon-resource="ai" data-summon-resource-as="a">
  <form data-summon-resource-trigger="submit">
    <textarea name="prompt" placeholder="Describe the person..."></textarea>
    <button data-summon-attr-disabled="$a.loading">Brainstorm</button>
  </form>
  <p data-summon-show="$a.loading">Generating...</p>
  <p data-summon-show="$a.error" data-summon-bind="$a.error" style="color:var(--color-danger);"></p>
  <div data-summon-show="$a.data" data-summon-bind="$a.data" style="white-space:pre-wrap;"></div>
</div>`,
        },
      ],
      onStart: ({ prompt }) => {
        const preview = prompt.slice(0, 80).replace(/\s+/g, ' ');
        log(`-> ai "${preview}${prompt.length > 80 ? '...' : ''}"`);
        return {};
      },
      onError: (msg) => errlog(`ai error: ${msg}`),
      fetch: async ({ prompt }, signal) => {
        const res = await fetch('/api/ai-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            ...providerPayload(opts.modelProvider?.(), opts.modelSelection?.()),
          }),
          signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { response?: unknown };
        const response = typeof data.response === 'string' ? data.response : '';
        log(`  got ${response.length} chars`);
        return response;
      },
    }),

    defineDataResource({
      name: 'github_lookup',
      description:
        'Fetch a GitHub user profile by username. Host calls api.github.com and proxies the avatar as a data URL so the sandbox CSP can stay strict. Use for any GitHub user lookup UI: profile card, follower count, repo count.',
      argsSchema: githubLookupArgsSchema,
      resultSchema: githubLookupResultSchema,
      defaultData: null,
      stateKeys: { loading: 'githubLoading', data: 'githubUser', error: 'githubError' },
      triggers: ['submit', 'mount'],
      stateShape:
        '{githubLoading: boolean, githubUser: {login: string, name: string | null, bio: string | null, followers: number, public_repos: number, avatar: string | null} | null, githubError: string | null}',
      patterns: [
        {
          name: 'GitHub lookup (form submit + show wrapper + bind nested fields)',
          code: `<div data-summon-resource="github_lookup" data-summon-resource-as="gh">
  <form data-summon-resource-trigger="submit" style="display:flex;gap:var(--space-2);">
    <input name="username" placeholder="GitHub username, e.g. torvalds">
    <button data-summon-attr-disabled="$gh.loading">Look up</button>
  </form>
  <p data-summon-show="$gh.loading">Looking up...</p>
  <p data-summon-show="$gh.error" data-summon-bind="$gh.error" style="color:var(--color-danger);"></p>
  <div data-summon-show="$gh.data" style="display:flex;gap:var(--space-4);align-items:flex-start;padding:var(--space-4);border:1px solid var(--color-border);border-radius:var(--radius-lg);margin-top:var(--space-4);">
    <img data-summon-attr-src="$gh.data.avatar" alt="" style="width:64px;height:64px;border-radius:50%;">
    <div>
      <div style="font-weight:600;">@<span data-summon-bind="$gh.data.login"></span></div>
      <div data-summon-bind="$gh.data.name"></div>
      <div data-summon-bind="$gh.data.bio" style="color:var(--color-text-muted);font-size:var(--text-sm);"></div>
      <div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-2);">
        <span data-summon-bind="$gh.data.followers"></span> followers · <span data-summon-bind="$gh.data.public_repos"></span> repos
      </div>
    </div>
  </div>
</div>`,
        },
      ],
      onStart: ({ username }) => {
        log(`-> github_lookup "${username}"`);
        return {};
      },
      onError: (msg) => errlog(`github_lookup error: ${msg}`),
      fetch: async ({ username }, signal) => {
        const res = await fetch(
          `https://api.github.com/users/${encodeURIComponent(username)}`,
          { signal },
        );
        if (!res.ok) {
          throw new Error(res.status === 404 ? 'User not found' : `GitHub API ${res.status}`);
        }
        const data = (await res.json()) as {
          login?: string;
          name?: string | null;
          bio?: string | null;
          followers?: number;
          public_repos?: number;
          avatar_url?: string;
        };

        // Proxy the avatar through the host as a data URL so the iframe's
        // strict img-src CSP can stay locked down — the sandbox never
        // reaches the network.
        let avatar: string | null = null;
        if (data.avatar_url) {
          try {
            const imgRes = await fetch(data.avatar_url, { signal });
            if (imgRes.ok) {
              const blob = await imgRes.blob();
              avatar = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(new Error('FileReader failed'));
                reader.readAsDataURL(blob);
              });
            }
          } catch {
            avatar = null;
          }
        }

        log(`  found @${data.login}`);
        return {
          login: data.login ?? username,
          name: data.name ?? null,
          bio: data.bio ?? null,
          followers: data.followers ?? 0,
          public_repos: data.public_repos ?? 0,
          avatar,
        };
      },
    }),

    defineWorkerResource({
      name: 'analysis',
      description:
        'Run host-owned background analysis for a topic. Use when the user asks to analyze, score, calculate, forecast, or compute a small result. The generated UI must show loading, error, and result states.',
      argsSchema: analysisArgsSchema,
      resultSchema: analysisResultSchema,
      defaultData: null,
      stateKeys: { loading: 'analysisLoading', data: 'analysisResult', error: 'analysisError' },
      triggers: ['submit', 'mount'],
      stateShape:
        '{analysisLoading: boolean, analysisResult: {topic: string, score: number, summary: string, next: string[]} | null, analysisError: string | null}',
      patterns: [
        {
          name: 'Worker analysis (background compute + result binding)',
          code: `<div data-summon-resource="analysis" data-summon-resource-as="a">
  <form data-summon-resource-trigger="submit">
    <input name="topic" placeholder="Topic to analyze">
    <button data-summon-attr-disabled="$a.loading">Analyze</button>
  </form>
  <p data-summon-show="$a.loading">Analyzing...</p>
  <p data-summon-show="$a.error" data-summon-bind="$a.error" style="color:var(--color-danger);"></p>
  <article data-summon-show="$a.data">
    <strong data-summon-bind="$a.data.topic"></strong>
    <span data-summon-bind="$a.data.score"></span>
    <p data-summon-bind="$a.data.summary"></p>
    <ul data-summon-foreach="$a.data.next" data-summon-as="step"><template><li data-summon-bind="$step"></li></template></ul>
  </article>
</div>`,
        },
      ],
      onStart: ({ topic }) => {
        log(`-> analysis "${topic}"`);
        return {};
      },
      fetch: async ({ topic }, signal) => {
        await new Promise((resolve, reject) => {
          const timeout = window.setTimeout(resolve, 350);
          signal.addEventListener('abort', () => {
            window.clearTimeout(timeout);
            reject(new DOMException('Aborted', 'AbortError'));
          }, { once: true });
        });
        const score = Math.max(10, Math.min(98, topic.length * 7 % 101));
        return {
          topic,
          score,
          summary: `Host worker analyzed "${topic}" and found a ${score}/100 readiness signal.`,
          next: ['Compare the strongest option', 'Collect one missing input', 'Review before operating'],
        };
      },
    }),

    defineWorkerAction({
      name: 'compute_score',
      description:
        'Run a host-owned worker calculation and push a score into state. Use for simple compute buttons that do not need a data resource list.',
      argsSchema: analysisArgsSchema,
      stateShape: '{computedTopic: string, computedScore: number}',
      handler: async ({ args, push }) => {
        await new Promise((resolve) => window.setTimeout(resolve, 150));
        const computedScore = Math.max(1, Math.min(100, args.topic.length * 9 % 101));
        log(`-> compute_score "${args.topic}" = ${computedScore}`);
        push({ computedTopic: args.topic, computedScore });
      },
    }),

    defineApprovalAction({
      name: 'publish_summary',
      description:
        'Ask the host for approval, then publish a titled summary only if approved. Use when the user explicitly asks to approve, confirm, publish, commit, send, update, or operate.',
      argsSchema: publishArgsSchema,
      stateShape:
        '{published: boolean, publishedTitle: string | null, publishApprovalRequestId: string | null, publishApprovalPending: boolean, publishApprovalApproved: boolean, publishApprovalDenied: boolean, publishApprovalError: string | null}',
      approval: {
        stateKeys: {
          requestId: 'publishApprovalRequestId',
          pending: 'publishApprovalPending',
          approved: 'publishApprovalApproved',
          denied: 'publishApprovalDenied',
          error: 'publishApprovalError',
        },
        prepare: ({ title }) => ({
          summary: `Publish "${title}"`,
          details: { title, channel: 'demo-updates' },
          plan: { title, channel: 'demo-updates' },
        }),
        request: ({ title }, request) => {
          log(`-> approval requested "${title}"`);
          if (request && opts.onApprovalRequest) return opts.onApprovalRequest(request);
          return 'approved';
        },
      },
      handler: ({ args, approval, push }) => {
        const plan = approval?.plan as PublishSummaryPlan | undefined;
        const title = plan?.title ?? args.title;
        log(`-> publish_summary "${title}"`);
        push({ published: true, publishedTitle: title });
      },
    }),
  ];

  if (opts.onSummon) {
    capabilities.push(
      defineAction({
        name: 'summon',
        description:
          'Ask the host to generate a NEW sibling UI in its own iframe with its own state. Use sparingly — only when the user benefits from a deeper, separately-stateful surface (e.g., "summon a prep guide for this recipe", "open this option as its own planner"). The `prompt` is the user-intent description for the new UI; the optional `title` labels the child card. Do NOT use summon for things you can render inline with the existing intents.',
        argsSchema: summonArgsSchema,
        stateShape: '{summonedCount: number, lastSummoned: string | null, summonError: string | null}',
        patterns: [
          {
            name: 'Summon a sibling UI (new iframe, own state)',
            code: `<button
  data-summon-on-click="summon"
  data-summon-args='{"prompt":"a focused 20-minute prep guide for chicken piccata, with timer-style steps","title":"Prep guide"}'
>Open prep guide -></button>
<p data-summon-show="summonError" data-summon-bind="summonError" style="color:var(--color-danger);"></p>`,
          },
        ],
        handler: opts.onSummon,
      }),
    );
  }

  return createCapabilityRegistry(capabilities);
}
