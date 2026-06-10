/**
 * Policy engine: the trusted surface that intents hit after passing the bridge's
 * vocabulary check. Handlers are host-authored — this is where network I/O,
 * credential access, and state mutation live. The sandbox never sees any of it.
 */

import type { EventStore } from '@summon-internal/devtools';
import type { ZodType } from 'zod';
import type { ApprovalRequest } from './capability-registry.js';

export interface IntentContext<T = Record<string, unknown>> {
  /**
   * Args the sandbox emitted. For bare-function handlers this is the raw
   * untrusted bag — validate before use. For handlers registered via
   * `defineIntent(schema, run)`, this is the schema-parsed value with `T`'s
   * type, so the handler body can trust the shape.
   */
  args: T;
  /** Merge a patch into the current state. The full merged state is pushed to the sandbox. */
  push: (patch: Record<string, unknown>) => void;
  /**
   * Present only for approved approval-gated actions. The host prepared this
   * request before the user approved it, so handlers can execute the frozen
   * plan instead of recomputing from generated args.
   */
  approval?: ApprovalRequest<T, unknown>;
}

export type IntentHandler<T = Record<string, unknown>> = (
  ctx: IntentContext<T>,
) => Promise<void> | void;

/**
 * Schema-bound intent entry. Created via {@link defineIntent}. When dispatch
 * sees one of these, it runs `args` through `schema.safeParse` first and only
 * calls `run` with the parsed value. Parse failures route to `onHandlerError`
 * with a structured Zod error and the run is skipped.
 */
export interface TypedIntentEntry<T> {
  schema: ZodType<T>;
  run: IntentHandler<T>;
}

export type IntentEntry<T = Record<string, unknown>> =
  | IntentHandler<T>
  | TypedIntentEntry<T>;

/**
 * Sugar for declaring a typed, schema-validated intent. Preserves `T` from the
 * schema through to the handler so `ctx.args` is correctly typed at the call
 * site.
 *
 *     defineIntent(z.object({ q: z.string().min(1) }), async ({ args, push }) => {
 *       // args: { q: string }
 *     });
 */
export function defineIntent<T>(
  schema: ZodType<T>,
  run: IntentHandler<T>,
): TypedIntentEntry<T> {
  return { schema, run };
}

function isTypedEntry<T>(entry: IntentEntry<T>): entry is TypedIntentEntry<T> {
  return typeof entry === 'object' && entry !== null && 'schema' in entry;
}

/**
 * Error thrown into `onHandlerError` when a typed intent's args fail schema
 * validation. The original ZodError lives on `.cause` for callers that want
 * structured details (path, expected type, etc.).
 */
export class IntentArgsError extends Error {
  readonly intent: string;
  constructor(intent: string, cause: unknown) {
    super(`intent "${intent}" args failed schema validation`);
    this.name = 'IntentArgsError';
    this.intent = intent;
    this.cause = cause;
  }
}

export interface PolicyEngineOptions {
  /**
   * Handlers may be bare functions (legacy, untyped) or schema-bound entries
   * created by {@link defineIntent}. The two shapes coexist; migrate
   * incrementally. The `unknown` generic preserves the union without forcing
   * every entry to share a single arg type.
   */
  handlers: Record<string, IntentEntry<any>>;
  /** Called with the new merged state every time a handler pushes. */
  onStateChange: (state: Record<string, unknown>) => void;
  /** Optional — receives unhandled handler exceptions and schema rejections. */
  onHandlerError?: (intent: string, error: Error) => void;
  /** Initial state. Pushed to the sandbox once it is ready. */
  initialState?: Record<string, unknown>;
  /**
   * Optional devtools event store. When set, the engine pushes
   * intent-dispatched/settled and state-pushed events. Behavior is identical
   * when omitted.
   */
  events?: EventStore;
}

export class PolicyEngine {
  private state: Record<string, unknown>;
  private readonly handlers: Record<string, IntentEntry<any>>;
  private readonly onStateChange: (state: Record<string, unknown>) => void;
  private readonly onHandlerError?: (intent: string, error: Error) => void;
  private readonly events?: EventStore;
  private dispatchSeq = 0;

  constructor(options: PolicyEngineOptions) {
    this.state = { ...(options.initialState ?? {}) };
    this.handlers = { ...options.handlers };
    this.onStateChange = options.onStateChange;
    this.onHandlerError = options.onHandlerError;
    this.events = options.events;
  }

  /** Full intent vocabulary — wire this into the Artifact.intents list. */
  get intents(): string[] {
    return Object.keys(this.handlers);
  }

  getState(): Record<string, unknown> {
    return { ...this.state };
  }

  /**
   * Merge a patch into current state and notify. Intent handlers receive this
   * as `ctx.push`; host code can also call it directly to push state changes
   * that did not originate from a sandbox intent — server-sent events, timers,
   * external webhooks, cross-tab broadcasts.
   */
  pushState(patch: Record<string, unknown>): void {
    this.state = { ...this.state, ...patch };
    const next = this.getState();
    this.events?.push({ kind: 'state-pushed', at: Date.now(), patch, next });
    this.onStateChange(next);
  }

  async dispatch(intent: string, args: Record<string, unknown>): Promise<void> {
    const entry = this.handlers[intent];
    if (!entry) {
      // The bridge should have rejected this already; defensive.
      this.onHandlerError?.(intent, new Error(`No handler for intent "${intent}"`));
      return;
    }

    const id = `${Date.now()}-${++this.dispatchSeq}`;
    const startedAt = Date.now();
    this.events?.push({ kind: 'intent-dispatched', at: startedAt, id, intent, args });
    const push = (patch: Record<string, unknown>) => this.pushState(patch);

    const settle = (ok: boolean, error?: string) => {
      this.events?.push({
        kind: 'intent-settled',
        at: Date.now(),
        id,
        intent,
        ok,
        error,
        durationMs: Date.now() - startedAt,
      });
    };

    try {
      if (isTypedEntry(entry)) {
        const parsed = entry.schema.safeParse(args);
        if (!parsed.success) {
          const err = new IntentArgsError(intent, parsed.error);
          settle(false, err.message);
          this.onHandlerError?.(intent, err);
          return;
        }
        await entry.run({ args: parsed.data, push });
      } else {
        await entry({ args, push });
      }
      settle(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      settle(false, error.message);
      this.onHandlerError?.(intent, error);
    }
  }
}
