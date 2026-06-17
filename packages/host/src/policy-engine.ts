/**
 * Policy engine: the trusted surface that tools hit after passing the bridge's
 * vocabulary check. Handlers are host-authored — this is where network I/O,
 * credential access, and state mutation live. The sandbox never sees any of it.
 */

import type { EventStore } from '@summon-internal/devtools';
import type { ZodType } from 'zod';
import type { ApprovalRequest } from './tool-registry.js';

export interface ToolContext<T = Record<string, unknown>> {
  /**
   * Args the sandbox emitted. For bare-function handlers this is the raw
   * untrusted bag — validate before use. For handlers registered via
   * `defineToolHandler(schema, run)`, this is the schema-parsed value with `T`'s
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

export type ToolHandler<T = Record<string, unknown>> = (
  ctx: ToolContext<T>,
) => Promise<void> | void;

/**
 * Schema-bound tool entry. Created via {@link defineToolHandler}. When dispatch
 * sees one of these, it runs `args` through `schema.safeParse` first and only
 * calls `run` with the parsed value. Parse failures route to `onHandlerError`
 * with a structured Zod error and the run is skipped.
 */
export interface TypedToolHandlerEntry<T> {
  schema: ZodType<T>;
  run: ToolHandler<T>;
}

export type ToolHandlerEntry<T = Record<string, unknown>> =
  | ToolHandler<T>
  | TypedToolHandlerEntry<T>;

/**
 * Sugar for declaring a typed, schema-validated tool. Preserves `T` from the
 * schema through to the handler so `ctx.args` is correctly typed at the call
 * site.
 *
 *     defineToolHandler(z.object({ q: z.string().min(1) }), async ({ args, push }) => {
 *       // args: { q: string }
 *     });
 */
export function defineToolHandler<T>(
  schema: ZodType<T>,
  run: ToolHandler<T>,
): TypedToolHandlerEntry<T> {
  return { schema, run };
}

function isTypedEntry<T>(entry: ToolHandlerEntry<T>): entry is TypedToolHandlerEntry<T> {
  return typeof entry === 'object' && entry !== null && 'schema' in entry;
}

/**
 * Error thrown into `onHandlerError` when a typed tool's args fail schema
 * validation. The original ZodError lives on `.cause` for callers that want
 * structured details (path, expected type, etc.).
 */
export class ToolArgsError extends Error {
  readonly tool: string;
  constructor(tool: string, cause: unknown) {
    super(`tool "${tool}" args failed schema validation`);
    this.name = 'ToolArgsError';
    this.tool = tool;
    this.cause = cause;
  }
}

export interface PolicyEngineOptions {
  /**
   * Handlers may be bare functions (legacy, untyped) or schema-bound entries
   * created by {@link defineToolHandler}. The two shapes coexist; migrate
   * incrementally. The `unknown` generic preserves the union without forcing
   * every entry to share a single arg type.
   */
  handlers: Record<string, ToolHandlerEntry<any>>;
  /** Called with the new merged state every time a handler pushes. */
  onStateChange: (state: Record<string, unknown>) => void;
  /** Optional — receives unhandled handler exceptions and schema rejections. */
  onHandlerError?: (tool: string, error: Error) => void;
  /** Initial state. Pushed to the sandbox once it is ready. */
  initialState?: Record<string, unknown>;
  /**
   * Optional devtools event store. When set, the engine pushes
   * tool-dispatched/settled and state-pushed events. Behavior is identical
   * when omitted.
   */
  events?: EventStore;
}

export interface PolicyDispatchResult {
  ok: boolean;
  state: Record<string, unknown>;
  error?: string;
}

export class PolicyEngine {
  private state: Record<string, unknown>;
  private readonly handlers: Record<string, ToolHandlerEntry<any>>;
  private readonly onStateChange: (state: Record<string, unknown>) => void;
  private readonly onHandlerError?: (tool: string, error: Error) => void;
  private readonly events?: EventStore;
  private dispatchSeq = 0;

  constructor(options: PolicyEngineOptions) {
    this.state = { ...(options.initialState ?? {}) };
    this.handlers = { ...options.handlers };
    this.onStateChange = options.onStateChange;
    this.onHandlerError = options.onHandlerError;
    this.events = options.events;
  }

  /** Full tool vocabulary — wire this into the Artifact.tools list. */
  get tools(): string[] {
    return Object.keys(this.handlers);
  }

  getState(): Record<string, unknown> {
    return { ...this.state };
  }

  /**
   * Merge a patch into current state and notify. Tool handlers receive this
   * as `ctx.push`; host code can also call it directly to push state changes
   * that did not originate from a sandbox tool — server-sent events, timers,
   * external webhooks, cross-tab broadcasts.
   */
  pushState(patch: Record<string, unknown>): void {
    this.state = { ...this.state, ...patch };
    const next = this.getState();
    this.events?.push({ kind: 'state-pushed', at: Date.now(), patch, next });
    this.onStateChange(next);
  }

  async dispatch(tool: string, args: Record<string, unknown>): Promise<PolicyDispatchResult> {
    const entry = this.handlers[tool];
    if (!entry) {
      // The bridge should have rejected this already; defensive.
      const error = new Error(`No handler for tool "${tool}"`);
      this.onHandlerError?.(tool, error);
      return { ok: false, state: this.getState(), error: error.message };
    }

    const id = `${Date.now()}-${++this.dispatchSeq}`;
    const startedAt = Date.now();
    this.events?.push({ kind: 'tool-dispatched', at: startedAt, id, tool, args });
    const push = (patch: Record<string, unknown>) => this.pushState(patch);

    const settle = (ok: boolean, error?: string) => {
      this.events?.push({
        kind: 'tool-settled',
        at: Date.now(),
        id,
        tool,
        ok,
        error,
        durationMs: Date.now() - startedAt,
      });
    };

    try {
      if (isTypedEntry(entry)) {
        const parsed = entry.schema.safeParse(args);
        if (!parsed.success) {
          const err = new ToolArgsError(tool, parsed.error);
          settle(false, err.message);
          this.onHandlerError?.(tool, err);
          return { ok: false, state: this.getState(), error: err.message };
        }
        await entry.run({ args: parsed.data, push });
      } else {
        await entry({ args, push });
      }
      settle(true);
      return { ok: true, state: this.getState() };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      settle(false, error.message);
      this.onHandlerError?.(tool, error);
      return { ok: false, state: this.getState(), error: error.message };
    }
  }
}
