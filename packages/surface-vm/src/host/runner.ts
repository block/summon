// QuickJS runner: boots a capability-absent VM and pumps protocol messages.
//
// M0 scope (intentionally minimal): isolate untrusted code in QuickJS, give it
// exactly two channels — `__hostSend(json)` out and `__dispatch(message)` in —
// and nothing else. No window, no document, no storage, no network, no timers.
// The host bridge, fetch, and timers are deliberately deferred to later
// milestones; M0 only has to prove the boundary holds.
//
// Ported from @arrow-js/sandbox's quickjs host (MIT), reduced to essentials.

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
  debug?: boolean;
}

export interface VmRunner {
  dispatch(message: HostToVmMessage): Promise<void>;
  destroy(): void;
}

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

function flushPendingJobs(runtime: any, context: any): void {
  while (runtime.hasPendingJob()) {
    context.unwrapResult(runtime.executePendingJobs());
  }
}

async function settleHandle(runtime: any, context: any, handle: any): Promise<void> {
  const settledResult = context.resolvePromise(handle);
  flushPendingJobs(runtime, context);
  const settledHandle = context.unwrapResult(await settledResult);
  settledHandle.dispose();
  flushPendingJobs(runtime, context);
}

async function evalModule(
  runtime: any,
  context: any,
  code: string,
  fileName: string,
): Promise<void> {
  const result = await context.evalCodeAsync(code, fileName, { type: 'module' });
  const handle = context.unwrapResult(result);
  try {
    await settleHandle(runtime, context, handle);
  } finally {
    handle.dispose();
  }
}

export async function createVmRunner(options: VmRunnerOptions): Promise<VmRunner> {
  const quickJs = await getQuickJsModule();
  const runtime = quickJs.newRuntime();
  runtime.setMemoryLimit(16 * 1024 * 1024);
  runtime.setMaxStackSize(512 * 1024);

  const context = runtime.newContext();
  let destroyed = false;

  // The single outbound channel. Untrusted code calls __hostSend(jsonString);
  // we parse to a typed VmToHostMessage and hand it to the host.
  const hostSend = context.newFunction('__hostSend', (messageHandle: any) => {
    const message = context.getString(messageHandle);
    try {
      options.onMessage(JSON.parse(message) as VmToHostMessage);
    } catch {
      // A malformed message is the VM's problem, not the host's. Ignore.
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
      if (!destroyed) flushPendingJobs(runtime, context);
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
        if (!destroyed) flushPendingJobs(runtime, context);
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
  // emits the initial render), then revoke injected globals.
  await evalModule(
    runtime,
    context,
    `import ${JSON.stringify(options.entryPath)};\n${REVOKE_INJECTED_GLOBALS}`,
    '/__surface_vm/boot.js',
  );
  flushPendingJobs(runtime, context);

  const dispatch = async (message: HostToVmMessage): Promise<void> => {
    if (destroyed) return;
    // The entry module installs globalThis.__dispatch as the inbound handler.
    await evalModule(
      runtime,
      context,
      `await globalThis.__dispatch(${JSON.stringify(message)});`,
      `/__surface_vm/dispatch-${Date.now()}.js`,
    );
    flushPendingJobs(runtime, context);
  };

  return {
    dispatch,
    destroy() {
      if (destroyed) return;
      destroyed = true;
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
