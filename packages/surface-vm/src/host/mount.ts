// mountSurface: wires the QuickJS runner to the host renderer.
//
// VM -> host:  render/patch messages drive the renderer; output/error surface
//              to the caller.
// host -> VM:  real DOM events become plain-data snapshots and dispatch back in.
//
// This is the seam every consumer (Summon's inline-surface, tests, future
// embedders) mounts through. It is intentionally thin: no policy, no bridge yet
// (that arrives in M3). Just the render/event loop.

import { createVmRunner, type VmRunner } from './runner.js';
import { HostRenderer } from './renderer.js';
import type { HostBridge, VmToHostMessage } from '../protocol.js';

export interface MountSurfaceOptions {
  /** Virtual module map: specifier -> source text. */
  modules: Record<string, string>;
  /** Entry module specifier. */
  entryPath: string;
  /** Element to render into. */
  root: Element;
  /** Optional capability bridge for VM tool calls. */
  hostBridge?: HostBridge;
  /** Initial surface state pushed to the VM after mount. */
  initialState?: Record<string, unknown>;
  /** Called when the VM emits an `output` message. */
  onOutput?: (payload: unknown) => void;
  /** Called on VM or renderer error. */
  onError?: (reason: string) => void;
  debug?: boolean;
}

export interface MountedSurface {
  /** Push new surface state to the VM (fires onState listeners inside). */
  pushState(state: Record<string, unknown>): void;
  destroy(): void;
}

export async function mountSurface(options: MountSurfaceOptions): Promise<MountedSurface> {
  const onError = (error: Error | string): void => {
    options.onError?.(error instanceof Error ? error.message : String(error));
  };

  let runner: VmRunner | null = null;

  const renderer = new HostRenderer({
    mountPoint: options.root,
    onEvent: (handlerId, payload) => {
      void runner?.dispatch({ type: 'event', payload: { handlerId, event: payload } });
    },
    onError,
  });

  const onMessage = (message: VmToHostMessage): void => {
    switch (message.type) {
      case 'render':
        renderer.render(message.tree);
        return;
      case 'patch':
        renderer.applyPatches(message.patches);
        return;
      case 'output':
        options.onOutput?.(message.payload);
        return;
      case 'error':
        onError(message.error);
        return;
      case 'ready':
        return;
    }
  };

  runner = await createVmRunner({
    modules: options.modules,
    entryPath: options.entryPath,
    onMessage,
    ...(options.hostBridge ? { hostBridge: options.hostBridge } : {}),
    debug: options.debug,
  });

  if (options.initialState) {
    void runner.dispatch({ type: 'state', state: options.initialState });
  }

  return {
    pushState(state) {
      void runner?.dispatch({ type: 'state', state });
    },
    destroy() {
      renderer.destroy();
      runner?.destroy();
    },
  };
}
