// QuickJS runner: boots a capability-absent VM and pumps protocol messages.
//
// M0 scope (intentionally minimal): isolate untrusted code in QuickJS, give it
// exactly two channels — `__hostSend(json)` out and `__dispatch(message)` in —
// and nothing else. No window, no document, no storage, no network, no timers.
// The host bridge, fetch, and timers are deliberately deferred to later
// milestones; M0 only has to prove the boundary holds.
//
// Execution is time-bounded: every entry into VM execution (boot, dispatch,
// microtask flush) arms an interrupt deadline, so model-authored `while(true)`
// cannot hang the host. A tripped budget surfaces as a protocol `error`
// message; the runner stays alive and destroyable.
//
// QuickJS host runner, reduced to the essentials.

import {
  RELEASE_ASYNC,
  newQuickJSAsyncWASMModule,
} from 'quickjs-emscripten';
import type { HostBridge, HostToVmMessage, VmToHostMessage } from '../protocol.js';

export interface VmRunnerOptions {
  /** Virtual module map. Keys are module specifiers, values are source text. */
  modules: Record<string, string>;
  /** Entry module specifier; its default export is the surface root. */
  entryPath: string;
  /** Called for every message the VM emits via __hostSend. */
  onMessage: (message: VmToHostMessage) => void;
  /** Optional capability bridge: VM tool calls are forwarded here. */
  hostBridge?: HostBridge;
  /**
   * Time budget (ms) for each synchronous slice of VM execution (boot,
   * dispatch, microtask flush after a bridge call). Host awaits (e.g. a slow
   * tool call) do not count: the budget re-arms on each re-entry into the VM.
   */
  dispatchBudgetMs?: number;
  debug?: boolean;
}

export interface VmRunner {
  dispatch(message: HostToVmMessage): Promise<void>;
  destroy(): void;
}

const DEFAULT_DISPATCH_BUDGET_MS = 1000;

// Globals injected during boot that are revoked immediately after the entry
// module finishes importing, so later-running user code cannot reach the raw
// host channel off `globalThis`. Contract: the trusted entry/core module must
// capture `__hostSend` into a module-scoped closure at top level during import;
// the global reference is gone by the time any event handler runs.
const REVOKE_INJECTED_GLOBALS =
  'globalThis.__hostSend = undefined; globalThis.__hostBridge = undefined;';

let quickJsModulePromise: ReturnType<typeof newQuickJSAsyncWASMModule> | null = null;

async function getQuickJsModule() {
  quickJsModulePromise ??= newQuickJSAsyncWASMModule(RELEASE_ASYNC);
  return quickJsModulePromise;
}

function isInterruptError(error: unknown): boolean {
  return error instanceof Error && /interrupted/i.test(error.message);
}

export async function createVmRunner(options: VmRunnerOptions): Promise<VmRunner> {
  const quickJs = await getQuickJsModule();
  const runtime = quickJs.newRuntime();
  runtime.setMemoryLimit(16 * 1024 * 1024);
  runtime.setMaxStackSize(512 * 1024);

  const budgetMs = options.dispatchBudgetMs ?? DEFAULT_DISPATCH_BUDGET_MS;

  // Interrupt deadline. Armed on every entry into VM execution, so the budget
  // bounds each synchronous execution slice; time spent awaiting the host
  // (bridge calls) is not charged to the VM.
  let deadline: number | null = null;
  runtime.setInterruptHandler(() => deadline !== null && Date.now() > deadline);
  const armDeadline = (): void => {
    deadline = Date.now() + budgetMs;
  };

  const context = runtime.newContext();
  let destroyed = false;

  function flushPendingJobs(): void {
    armDeadline();
    while (runtime.hasPendingJob()) {
      context.unwrapResult(runtime.executePendingJobs());
    }
  }

  async function settleHandle(handle: any): Promise<void> {
    const settledResult = context.resolvePromise(handle);
    flushPendingJobs();
    const settledHandle = context.unwrapResult(await settledResult);
    settledHandle.dispose();
    flushPendingJobs();
  }

  async function evalModule(code: string, fileName: string): Promise<void> {
    armDeadline();
    const result = await context.evalCodeAsync(code, fileName, { type: 'module' });
    const handle = context.unwrapResult(result);
    try {
      await settleHandle(handle);
    } finally {
      handle.dispose();
    }
  }

  // The single outbound channel. Untrusted code calls __hostSend(jsonString);
  // we parse to a typed VmToHostMessage and hand it to the host. A malformed
  // message is surfaced as a protocol error — never silently dropped (silent
  // failure at this boundary has already cost one misdiagnosis; see
  // Keep Promise resolution explicit so VM jobs drain before rendering completes.
  const hostSend = context.newFunction('__hostSend', (messageHandle: any) => {
    const message = context.getString(messageHandle);
    try {
      options.onMessage(JSON.parse(message) as VmToHostMessage);
    } catch (error) {
      options.onMessage({
        type: 'error',
        error: `surface-vm: malformed VM message (${error instanceof Error ? error.message : String(error)})`,
      });
    }
  });
  context.setProp(context.global, '__hostSend', hostSend);
  hostSend.dispose();

  // The capability bridge. The VM calls __hostBridge(tool, argsJson) and gets a
  // promise handle back. The host runs the bridge with plain-data args and
  // resolves/rejects with a plain-data result. This is the only inbound
  // authority channel; args and results are JSON-serialized across the boundary
  // so no functions or live objects can cross.
  const pendingBridge = new Set<{ resolve: (h: any) => void; reject: (h: any) => void }>();
  const hostBridge = context.newFunction('__hostBridge', (toolHandle: any, argsHandle: any) => {
    const deferred = context.newPromise();
    pendingBridge.add(deferred);

    // Read handle values SYNCHRONOUSLY: QuickJS frees the argument handles when
    // this function returns, so we cannot defer getString into a later .then.
    let tool: string;
    let args: Record<string, unknown>;
    try {
      tool = context.getString(toolHandle);
      const argsJson = context.getString(argsHandle);
      args = (argsJson ? JSON.parse(argsJson) : {}) as Record<string, unknown>;
    } catch (error) {
      const errHandle = context.newString(error instanceof Error ? error.message : String(error));
      deferred.reject(errHandle);
      errHandle.dispose();
      pendingBridge.delete(deferred);
      if (!destroyed) flushPendingJobs();
      return deferred.handle;
    }

    void Promise.resolve()
      .then(() => {
        if (!options.hostBridge) {
          throw new Error(`No host bridge is configured for tool "${tool}".`);
        }
        return options.hostBridge(tool, args);
      })
      .then((value) => {
        const resultJson = JSON.stringify(value ?? null);
        const resultHandle = context.newString(resultJson);
        deferred.resolve(resultHandle);
        resultHandle.dispose();
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const errHandle = context.newString(message);
        deferred.reject(errHandle);
        errHandle.dispose();
      })
      .finally(() => {
        pendingBridge.delete(deferred);
        // Drain the VM microtask queue so the awaiting surface code resumes.
        // A budget trip here must not become an unhandled rejection.
        if (!destroyed) {
          try {
            flushPendingJobs();
          } catch (error) {
            options.onMessage({
              type: 'error',
              error: isInterruptError(error)
                ? `surface-vm: VM execution exceeded the ${budgetMs}ms dispatch budget and was interrupted`
                : `surface-vm: VM job flush failed (${error instanceof Error ? error.message : String(error)})`,
            });
          }
        }
      });

    return deferred.handle;
  });
  context.setProp(context.global, '__hostBridge', hostBridge);
  hostBridge.dispose();

  // Virtual module loader: only modules we provide resolve. No filesystem, no
  // network fallback — unknown specifiers throw.
  runtime.setModuleLoader((moduleName: string) => {
    const source = options.modules[moduleName];
    if (source === undefined) {
      throw new Error(`Unknown sandbox module "${moduleName}".`);
    }
    return source;
  });

  // Boot: import the entry module (which installs the VM-side dispatch glue and
  // emits the initial render), capture the dispatch function behind a
  // JSON-string wrapper, then revoke injected globals. Capturing a callable
  // handle here means later dispatches are function calls with a string
  // argument — no per-message module compilation, and message data never
  // crosses the boundary as source text.
  await evalModule(
    `import ${JSON.stringify(options.entryPath)};
const __d = globalThis.__dispatch;
globalThis.__dispatchJson = (json) => (typeof __d === 'function' ? __d(JSON.parse(json)) : undefined);
${REVOKE_INJECTED_GLOBALS}`,
    '/__surface_vm/boot.js',
  );
  flushPendingJobs();

  const dispatchFn = context.getProp(context.global, '__dispatchJson');

  const dispatch = async (message: HostToVmMessage): Promise<void> => {
    if (destroyed) return;
    // A dispatch failure (including a tripped execution budget) surfaces as a
    // protocol error message and resolves: consumers fire-and-forget dispatches,
    // so rejecting here would only produce unhandled rejections.
    try {
      const argHandle = context.newString(JSON.stringify(message));
      let callResult: any;
      armDeadline();
      try {
        callResult = context.callFunction(dispatchFn, context.undefined, argHandle);
      } finally {
        argHandle.dispose();
      }
      const handle = context.unwrapResult(callResult) as any;
      try {
        await settleHandle(handle);
      } finally {
        handle.dispose();
      }
    } catch (error) {
      if (destroyed) return;
      const reason = isInterruptError(error)
        ? `surface-vm: VM execution exceeded the ${budgetMs}ms dispatch budget and was interrupted`
        : `surface-vm: dispatch failed (${error instanceof Error ? error.message : String(error)})`;
      options.onMessage({ type: 'error', error: reason });
    }
  };

  return {
    dispatch,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      try {
        dispatchFn.dispose();
      } catch {
        // best effort
      }
      try {
        context.dispose();
      } catch {
        // best effort
      }
      try {
        runtime.dispose();
      } catch {
        // best effort
      }
    },
  };
}
