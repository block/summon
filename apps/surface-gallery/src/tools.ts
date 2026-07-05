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
} from '@decentralized-design/summon';
import { z } from 'zod';

export interface GalleryToolOptions {
  onLog?: (message: string) => void;
  onStatePreview?: (state: Record<string, unknown>) => void;
  modelSelection?: () => object;
  onApprovalRequest?: (
    request: ApprovalRequest<any, any>,
  ) => Promise<ApprovalDecision> | ApprovalDecision;
}

const chooseArgsSchema = z.object({ option: z.string().trim().min(1) });
const publishArgsSchema = z.object({ title: z.string().trim().min(1) });
const refundArgsSchema = z.object({ title: z.string().trim().min(1), amount: z.string().trim().optional() });
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
type PublishArgs = z.infer<typeof publishArgsSchema>;
type RefundArgs = z.infer<typeof refundArgsSchema>;

interface PublishSummaryPlan {
  title: string;
  channel: string;
}

interface RefundPlan {
  title: string;
  amount: string;
  rail: string;
}

export function createGalleryToolRegistry(
  toolNames?: readonly string[],
  opts: GalleryToolOptions = {},
): ToolRegistry {
  const allowed = toolNames ? new Set(toolNames) : null;
  return createToolRegistry(
    galleryToolDefinitions(opts).filter((definition) =>
      allowed ? allowed.has(definition.name) : true,
    ),
  );
}

export function allGalleryToolNames(): string[] {
  return galleryToolDefinitions({}).map((definition) => definition.name);
}

function galleryToolDefinitions(opts: GalleryToolOptions): ToolDefinition<any>[] {
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
      stateKeys: { loading: 'searching', data: 'results', error: 'searchError', empty: 'noResults' },
      triggers: ['submit', 'mount'],
      stateShape:
        '{searching: boolean, query: string, results: Array<{title: string, snippet: string, source: string}> | null, searchError: string | null, noResults: boolean}',
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
      controlled: true,
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
          details: { title, channel: 'gallery-updates' },
          plan: { title, channel: 'gallery-updates' },
        }),
        request: ({ title }, request) => {
          log(`approval requested: ${title}`);
          if (request && opts.onApprovalRequest) return opts.onApprovalRequest(request);
          return 'approved';
        },
      },
      handler: ({ args, approval, push }) => {
        const plan = approval?.plan as PublishSummaryPlan | undefined;
        const title = plan?.title ?? args.title;
        log(`published: ${title}`);
        push({ published: true, publishedTitle: title });
      },
    }),
    defineApprovalAction({
      name: 'issue_refund',
      description:
        'Request host approval, then issue a refund only if the host approves. Use for refund, reversal, or customer-remediation flows that must not self-approve.',
      argsSchema: refundArgsSchema,
      stateShape:
        '{refundIssued: boolean, refundTitle: string | null, refundAmount: string | null, refundApprovalRequestId: string | null, refundApprovalPending: boolean, refundApprovalApproved: boolean, refundApprovalDenied: boolean, refundApprovalError: string | null}',
      approval: {
        stateKeys: {
          requestId: 'refundApprovalRequestId',
          pending: 'refundApprovalPending',
          approved: 'refundApprovalApproved',
          denied: 'refundApprovalDenied',
          error: 'refundApprovalError',
        },
        prepare: ({ title, amount }) => ({
          summary: `Issue refund: ${title}`,
          details: { title, amount: amount ?? '$842.15', rail: 'card-presentment' },
          plan: { title, amount: amount ?? '$842.15', rail: 'card-presentment' },
        }),
        request: ({ title }, request) => {
          log(`refund approval requested: ${title}`);
          if (request && opts.onApprovalRequest) return opts.onApprovalRequest(request);
          return 'approved';
        },
      },
      handler: ({ args, approval, push }) => {
        const plan = approval?.plan as RefundPlan | undefined;
        const title = plan?.title ?? args.title;
        const amount = plan?.amount ?? args.amount ?? '$842.15';
        log(`refund issued: ${title} ${amount}`);
        push({ refundIssued: true, refundTitle: title, refundAmount: amount });
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
