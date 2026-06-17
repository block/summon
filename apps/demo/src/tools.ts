/**
 * Demo tool registry — the demo app owns its tool vocabulary, prompt
 * patterns, and handler implementations in one place. The registry produces
 * both the model-facing ToolPack and the PolicyEngine handler map.
 */

import {
  createToolRegistry,
  defineAction,
  defineApprovalAction,
  defineDataResource,
  defineWorkerAction,
  defineWorkerResource,
  type ApprovalDecision,
  type ApprovalRequest,
  type ToolDefinition,
  type ToolRegistry,
} from '@anarchitecture/summon';
import type { ToolHandler } from '@anarchitecture/summon/policy';
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
  onSummon?: ToolHandler<SummonArgs>;
  /**
   * Optional because batch/demo surfaces may run without a visible host
   * approval panel. Browser hosts should render their own approve/deny UI here.
   */
  onApprovalRequest?: (
    request: ApprovalRequest<PublishArgs, PublishSummaryPlan>,
  ) => Promise<ApprovalDecision> | ApprovalDecision;
}

export function createDemoToolRegistry(
  opts: DemoHandlerOptions = {},
): ToolRegistry {
  const log = opts.onLog ?? (() => {});
  const errlog = opts.onError ?? opts.onLog ?? (() => {});

  // Per-registry ephemeral state. Each sandbox/tile gets its own registry so
  // counters and choices don't bleed across generated artifacts.
  let counterValue = 0;
  let logCount = 0;
  const chosenOptions: string[] = [];

  const tools: ToolDefinition<any>[] = [
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
          code: `import { html, reactive } from "@arrow-js/core";
import { callTool, onState } from "host-bridge:summon";

const state = reactive({ count: 0 });
onState((hostState) => {
  state.count = Number(hostState.count ?? state.count);
});

async function adjust(delta: number) {
  const result = await callTool("counter", { delta });
  if (result.ok) state.count = Number(result.state.count ?? state.count);
}

export default html\`
  <button @click="\${() => adjust(-1)}">-</button>
  <output>\${() => state.count}</output>
  <button @click="\${() => adjust(1)}">+</button>
\`;`,
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
          code: `import { html, reactive } from "@arrow-js/core";
import { callTool, onState } from "host-bridge:summon";

const state = reactive({ submitted: false, submitError: "" });
onState((hostState) => {
  state.submitted = Boolean(hostState.submitted);
  state.submitError = String(hostState.submitError ?? "");
});

async function save(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const fields = Object.fromEntries(new FormData(form).entries());
  const result = await callTool("submit", fields);
  state.submitted = Boolean(result.state.submitted);
  state.submitError = String(result.state.submitError ?? result.error ?? "");
}

export default html\`
  <form @submit="\${save}">
    <input name="title" placeholder="Title">
    <input name="notes" placeholder="Notes">
    <button>Save</button>
  </form>
  <p>\${() => state.submitted ? "Saved." : ""}</p>
  <p>\${() => state.submitError}</p>
\`;`,
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
          code: `import { html, reactive } from "@arrow-js/core";
import { callTool, onState } from "host-bridge:summon";

const state = reactive({ searching: false, results: [] as Array<{ title: string; snippet: string }>, searchError: "" });
onState((hostState) => {
  state.searching = Boolean(hostState.searching);
  state.results = Array.isArray(hostState.results) ? hostState.results : [];
  state.searchError = String(hostState.searchError ?? "");
});

async function search(event: SubmitEvent) {
  event.preventDefault();
  const query = String(new FormData(event.currentTarget as HTMLFormElement).get("query") ?? "");
  await callTool("search", { query });
}

async function pick(result: { title: string; snippet: string }) {
  await callTool("log", { payload: { picked: result } });
}

export default html\`
  <form @submit="\${search}">
    <input name="query" placeholder="Search...">
    <button class="\${() => state.searching ? "loading" : ""}">\${() => state.searching ? "Searching..." : "Go"}</button>
  </form>
  <p>\${() => state.searchError}</p>
  <ul>
    \${() => state.results.map((result) => html\`
      <li @click="\${() => pick(result)}">
        <strong>\${result.title}</strong>
        <span>\${result.snippet}</span>
      </li>
    \`)}
  </ul>
\`;`,
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
          code: `import { html, reactive } from "@arrow-js/core";
import { callTool, onState } from "host-bridge:summon";

const state = reactive({ aiLoading: false, aiResponse: "", aiError: "" });
onState((hostState) => {
  state.aiLoading = Boolean(hostState.aiLoading);
  state.aiResponse = String(hostState.aiResponse ?? "");
  state.aiError = String(hostState.aiError ?? "");
});

async function brainstorm(event: SubmitEvent) {
  event.preventDefault();
  const prompt = String(new FormData(event.currentTarget as HTMLFormElement).get("prompt") ?? "");
  await callTool("ai", { prompt });
}

export default html\`
  <form @submit="\${brainstorm}">
    <textarea name="prompt" placeholder="Describe the person..."></textarea>
    <button class="\${() => state.aiLoading ? "loading" : ""}">\${() => state.aiLoading ? "Generating..." : "Brainstorm"}</button>
  </form>
  <p>\${() => state.aiError}</p>
  <div>\${() => state.aiResponse}</div>
\`;`,
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
          code: `import { html, reactive } from "@arrow-js/core";
import { callTool, onState } from "host-bridge:summon";

const state = reactive({ githubLoading: false, githubUser: null as null | Record<string, unknown>, githubError: "" });
onState((hostState) => {
  state.githubLoading = Boolean(hostState.githubLoading);
  state.githubUser = hostState.githubUser && typeof hostState.githubUser === "object" ? hostState.githubUser as Record<string, unknown> : null;
  state.githubError = String(hostState.githubError ?? "");
});

async function lookup(event: SubmitEvent) {
  event.preventDefault();
  const username = String(new FormData(event.currentTarget as HTMLFormElement).get("username") ?? "");
  await callTool("github_lookup", { username });
}

export default html\`
  <form @submit="\${lookup}">
    <input name="username" placeholder="GitHub username, e.g. torvalds">
    <button class="\${() => state.githubLoading ? "loading" : ""}">\${() => state.githubLoading ? "Looking up..." : "Look up"}</button>
  </form>
  <p>\${() => state.githubError}</p>
  \${() => state.githubUser ? html\`
    <article>
      <img src="\${String(state.githubUser.avatar ?? "")}" alt="">
      <strong>@\${String(state.githubUser.login ?? "")}</strong>
      <p>\${String(state.githubUser.bio ?? "")}</p>
    </article>
  \` : ""}
\`;`,
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

        // Proxy the avatar through the host as a data URL so the generated
        // Arrow surface never reaches the network directly.
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
          code: `import { html, reactive } from "@arrow-js/core";
import { callTool, onState } from "host-bridge:summon";

const state = reactive({ analysisLoading: false, analysisResult: null as null | { topic: string; score: number; summary: string; next: string[] }, analysisError: "" });
onState((hostState) => {
  state.analysisLoading = Boolean(hostState.analysisLoading);
  state.analysisResult = hostState.analysisResult as typeof state.analysisResult;
  state.analysisError = String(hostState.analysisError ?? "");
});

async function analyze(event: SubmitEvent) {
  event.preventDefault();
  const topic = String(new FormData(event.currentTarget as HTMLFormElement).get("topic") ?? "");
  await callTool("analysis", { topic });
}

export default html\`
  <form @submit="\${analyze}">
    <input name="topic" placeholder="Topic to analyze">
    <button class="\${() => state.analysisLoading ? "loading" : ""}">\${() => state.analysisLoading ? "Analyzing..." : "Analyze"}</button>
  </form>
  <p>\${() => state.analysisError}</p>
  \${() => state.analysisResult ? html\`
    <article>
      <strong>\${state.analysisResult.topic}</strong>
      <span>\${state.analysisResult.score}</span>
      <p>\${state.analysisResult.summary}</p>
      <ul>\${state.analysisResult.next.map((step) => html\`<li>\${step}</li>\`)}</ul>
    </article>
  \` : ""}
\`;`,
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
    tools.push(
      defineAction({
        name: 'summon',
        description:
          'Ask the host to generate a NEW sibling UI in its own inline Arrow root with its own state. Use sparingly — only when the user benefits from a deeper, separately-stateful surface (e.g., "summon a prep guide for this recipe", "open this option as its own planner"). The `prompt` is the user-tool description for the new UI; the optional `title` labels the child card. Do NOT use summon for things you can render inline with the existing tools.',
        argsSchema: summonArgsSchema,
        stateShape: '{summonedCount: number, lastSummoned: string | null, summonError: string | null}',
        patterns: [
          {
            name: 'Summon a sibling UI (new inline root, own state)',
            code: `import { html, reactive } from "@arrow-js/core";
import { callTool, onState } from "host-bridge:summon";

const state = reactive({ summonError: "" });
onState((hostState) => {
  state.summonError = String(hostState.summonError ?? "");
});

async function openPrepGuide() {
  await callTool("summon", {
    prompt: "a focused 20-minute prep guide for chicken piccata, with timer-style steps",
    title: "Prep guide",
  });
}

export default html\`
  <button @click="\${openPrepGuide}">Open prep guide -></button>
  <p>\${() => state.summonError}</p>
\`;`,
          },
        ],
        handler: opts.onSummon,
      }),
    );
  }

  return createToolRegistry(tools);
}
