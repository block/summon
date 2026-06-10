import {
  createCapabilityRegistry,
  defineAction,
  defineApprovalAction,
  defineDataResource,
  defineWorkerAction,
  defineWorkerResource,
  type CapabilityDefinition,
  type CapabilityRegistry,
} from '@anarchitecture/summon';
import { z } from 'zod';

export interface GalleryCapabilityOptions {
  onLog?: (message: string) => void;
  onStatePreview?: (state: Record<string, unknown>) => void;
  modelSelection?: () => object;
}

const chooseArgsSchema = z.object({ option: z.string().trim().min(1) });
const publishArgsSchema = z.object({ title: z.string().trim().min(1) });
const searchArgsSchema = z.object({ query: z.string().trim().min(1) });
const analysisArgsSchema = z.object({ topic: z.string().trim().min(1) });
const searchResultSchema = z.array(
  z.object({
    title: z.string(),
    snippet: z.string(),
    source: z.string(),
  }).passthrough(),
);
const analysisResultSchema = z.object({
  topic: z.string(),
  score: z.number(),
  summary: z.string(),
  next: z.array(z.string()),
});

type SearchResult = z.infer<typeof searchResultSchema>;

export function createGalleryCapabilityRegistry(
  capabilityNames?: readonly string[],
  opts: GalleryCapabilityOptions = {},
): CapabilityRegistry {
  const allowed = capabilityNames ? new Set(capabilityNames) : null;
  return createCapabilityRegistry(
    galleryCapabilityDefinitions(opts).filter((definition) =>
      allowed ? allowed.has(definition.name) : true,
    ),
  );
}

export function allGalleryCapabilityNames(): string[] {
  return galleryCapabilityDefinitions({}).map((definition) => definition.name);
}

function galleryCapabilityDefinitions(opts: GalleryCapabilityOptions): CapabilityDefinition<any>[] {
  const log = opts.onLog ?? (() => {});
  const statePreview = opts.onStatePreview ?? (() => {});
  const choices: string[] = [];

  return [
    defineDataResource({
      name: 'search',
      description:
        'Run a host-owned text search and return 4-5 result objects. Use for recipe finders, docs search, product lookup, or any discovery surface. Render loading, error, and data states.',
      argsSchema: searchArgsSchema,
      resultSchema: searchResultSchema,
      defaultData: [],
      stateKeys: { loading: 'searching', data: 'results', error: 'searchError' },
      triggers: ['submit', 'mount'],
      stateShape:
        '{searching: boolean, query: string, results: Array<{title: string, snippet: string, source: string}> | null, searchError: string | null}',
      patterns: [
        {
          name: 'Search resource',
          code: `<div data-summon-resource="search" data-summon-resource-as="s">
  <form data-summon-resource-trigger="submit">
    <input name="query" placeholder="Search dinner ideas">
    <button data-summon-attr-disabled="$s.loading">Search</button>
  </form>
  <p data-summon-show="$s.loading">Searching...</p>
  <p data-summon-show="$s.error" data-summon-bind="$s.error"></p>
  <ul data-summon-show="$s.data" data-summon-foreach="$s.data" data-summon-as="result">
    <template>
      <li>
        <strong data-summon-bind="$result.title"></strong>
        <p data-summon-bind="$result.snippet"></p>
      </li>
    </template>
  </ul>
</div>`,
        },
      ],
      onStart: ({ query }) => {
        log(`search: ${query}`);
        statePreview({ query });
        return { query };
      },
      onError: (message) => log(`search error: ${message}`),
      fetch: async ({ query }, signal) => {
        const response = await fetch('/api/mock-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, ...(opts.modelSelection?.() ?? {}) }),
          signal,
        });
        if (!response.ok) throw new Error(`Search service unavailable (${response.status})`);
        const body = (await response.json()) as { results?: unknown };
        const results = Array.isArray(body.results) ? body.results : [];
        log(`search returned ${results.length} results`);
        return results as SearchResult;
      },
    }),
    defineAction({
      name: 'choose',
      description:
        'Save the option the user chose. Args must include an option label. Use for generated comparison, picker, or review surfaces.',
      argsSchema: chooseArgsSchema,
      stateShape: '{lastChoice: string, chosenOptions: string[]}',
      patterns: [
        {
          name: 'Save a choice',
          code: `<button data-summon-on-click="choose" data-summon-args='{"option":"Balanced path"}'>Save this option</button>
<p data-summon-show="lastChoice">Saved: <span data-summon-bind="lastChoice"></span></p>`,
        },
      ],
      handler: ({ args, push }) => {
        choices.push(args.option);
        log(`choose: ${args.option}`);
        push({ lastChoice: args.option, chosenOptions: [...choices] });
      },
    }),
    defineApprovalAction({
      name: 'publish_summary',
      description:
        'Request host approval, then publish a titled summary only if the host approves. Use for publish, send, update, commit, or operate flows.',
      argsSchema: publishArgsSchema,
      stateShape:
        '{published: boolean, publishedTitle: string | null, publishApprovalPending: boolean, publishApprovalApproved: boolean, publishApprovalDenied: boolean, publishApprovalError: string | null}',
      approval: {
        request: ({ title }) => {
          log(`approval requested: ${title}`);
          return window.confirm(`Approve publishing "${title}"?`)
            ? 'approved'
            : { status: 'denied', reason: 'Host denied approval' };
        },
      },
      handler: ({ args, push }) => {
        log(`published: ${args.title}`);
        push({ published: true, publishedTitle: args.title });
      },
    }),
    defineWorkerResource({
      name: 'analysis',
      description:
        'Run a host-owned background analysis for a topic. Use for risk, readiness, forecasting, scoring, or compute-style surfaces. Render loading, error, and result states.',
      argsSchema: analysisArgsSchema,
      resultSchema: analysisResultSchema,
      defaultData: null,
      stateKeys: { loading: 'analysisLoading', data: 'analysisResult', error: 'analysisError' },
      triggers: ['submit', 'mount'],
      stateShape:
        '{analysisLoading: boolean, analysisResult: {topic: string, score: number, summary: string, next: string[]} | null, analysisError: string | null}',
      patterns: [
        {
          name: 'Background analysis',
          code: `<div data-summon-resource="analysis" data-summon-resource-as="a">
  <form data-summon-resource-trigger="submit">
    <input name="topic" placeholder="Topic">
    <button data-summon-attr-disabled="$a.loading">Analyze</button>
  </form>
  <p data-summon-show="$a.loading">Analyzing...</p>
  <article data-summon-show="$a.data">
    <strong data-summon-bind="$a.data.topic"></strong>
    <span data-summon-bind="$a.data.score"></span>
    <p data-summon-bind="$a.data.summary"></p>
  </article>
</div>`,
        },
      ],
      onStart: ({ topic }) => {
        log(`analysis: ${topic}`);
        return {};
      },
      fetch: async ({ topic }, signal) => {
        await delay(350, signal);
        const score = Math.max(12, Math.min(96, (topic.length * 11) % 101));
        return {
          topic,
          score,
          summary: `Host worker analyzed "${topic}" and produced a ${score}/100 readiness signal.`,
          next: ['Clarify the riskiest assumption', 'Pick one reversible next step', 'Review before operating'],
        };
      },
    }),
    defineWorkerAction({
      name: 'compute_score',
      description:
        'Run a small host-owned worker calculation and push a computed score into state.',
      argsSchema: analysisArgsSchema,
      stateShape: '{computedTopic: string, computedScore: number}',
      handler: async ({ args, push }) => {
        await delay(180);
        const computedScore = Math.max(1, Math.min(100, (args.topic.length * 9) % 101));
        log(`compute_score: ${args.topic} = ${computedScore}`);
        push({ computedTopic: args.topic, computedScore });
      },
    }),
  ];
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timeout);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}
