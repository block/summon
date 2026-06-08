/**
 * Strict-tier input registry — host-controlled overlays for sensitive input.
 *
 * Architecture: a generative outer sandbox describes WHERE a sensitive field
 * should appear (via a placeholder div + bounds), but it never renders the
 * input itself. The host sees a `mount_strict_input` intent, computes screen
 * coordinates from the outer iframe's bounding rect plus the sandbox-reported
 * bounds, and absolute-positions a host-trusted element on top.
 *
 * Security property: the strict element lives in the host's DOM, not the
 * sandbox's. The sandbox is a null-origin cross-origin child — it cannot read
 * keystrokes, query the strict DOM, or intercept input events. The sandbox
 * sees only what the host chooses to push back as state (presence flags,
 * tokenized results, last-4 digits, etc).
 *
 * What the sandbox can do wrong: lie about bounds. That's a layout / UX bug,
 * not a data-leak vector — the strict surface stays host-controlled regardless
 * of how the placeholder is positioned.
 *
 * MVP scope: bounds are reported once at mount and tracked against host-side
 * scroll/resize. Iframe-internal scroll is not yet propagated; size sandboxes
 * so their content does not scroll, or have the artifact re-emit on change.
 */

export interface StrictInputBounds {
  /** Sandbox-relative left, in CSS px. */
  x: number;
  /** Sandbox-relative top, in CSS px. */
  y: number;
  width: number;
  height: number;
}

export interface StrictInputController {
  /** The DOM element to overlay. Host owns it; outer sandbox never sees it. */
  element: HTMLElement;
  /** Whether the user has entered enough to consider the input "filled." */
  isFilled(): boolean;
  /** Convert the in-memory value into a host-trusted result object (token, masked summary, …). */
  tokenize(): Promise<Record<string, unknown>>;
  /** Tear down listeners, zero out memory, drop DOM references. */
  destroy(): void;
}

export interface StrictInputFactoryArgs {
  slot: string;
  /** Called when the controller's filled state changes (true/false). */
  onChange: (filled: boolean) => void;
}

/** Factory builds a controller for a kind. The host registers one factory per kind. */
export type StrictInputFactory = (args: StrictInputFactoryArgs) => StrictInputController;

export interface StrictInputRegistryOptions {
  /** The outer sandbox iframe; bounds are computed relative to it. */
  outerIframe: HTMLIFrameElement;
  /**
   * Where overlay elements are inserted. Use `document.body` (default). Must
   * be an element that doesn't establish an ancestor-clipping `overflow: hidden`
   * or the overlay will be clipped when the outer iframe is near the edge.
   */
  hostContainer?: HTMLElement;
  /** Map of kind name → factory. Unknown kinds are rejected at mount. */
  kinds: Record<string, StrictInputFactory>;
  /** Called whenever a slot's filled state changes. Wire to PolicyEngine.pushState. */
  onChange?: (slot: string, state: { filled: boolean }) => void;
  /** Called when a slot is tokenized (after submit). Wire to PolicyEngine.pushState. */
  onSubmit?: (slot: string, result: Record<string, unknown>) => void;
  /** Called when a mount/submit/unmount call fails validation. */
  onError?: (slot: string, reason: string) => void;
}

export interface StrictInputRegistry {
  mount(args: { slot: string; kind: string; bounds: StrictInputBounds }): void;
  submit(args: { slot: string }): Promise<void>;
  unmount(args: { slot: string }): void;
  /** Tear down all overlays and listeners. */
  destroy(): void;
}

interface MountedSlot {
  slot: string;
  kind: string;
  bounds: StrictInputBounds;
  controller: StrictInputController;
  wrapper: HTMLDivElement;
}

export function createStrictInputRegistry(
  opts: StrictInputRegistryOptions
): StrictInputRegistry {
  const container = opts.hostContainer ?? document.body;
  const slots = new Map<string, MountedSlot>();

  function reposition(mount: MountedSlot): void {
    const rect = opts.outerIframe.getBoundingClientRect();
    const left = rect.left + window.scrollX + mount.bounds.x;
    const top = rect.top + window.scrollY + mount.bounds.y;
    mount.wrapper.style.left = `${left}px`;
    mount.wrapper.style.top = `${top}px`;
    mount.wrapper.style.width = `${mount.bounds.width}px`;
    mount.wrapper.style.height = `${mount.bounds.height}px`;
  }

  function repositionAll(): void {
    for (const mount of slots.values()) reposition(mount);
  }

  // Track outer iframe size + page scroll/resize and reposition overlays in lockstep.
  // Iframe-internal scroll is not yet handled — see file header note.
  const resizeObserver = new ResizeObserver(repositionAll);
  resizeObserver.observe(opts.outerIframe);
  window.addEventListener('scroll', repositionAll, { passive: true });
  window.addEventListener('resize', repositionAll);

  function mount(args: { slot: string; kind: string; bounds: StrictInputBounds }): void {
    if (slots.has(args.slot)) {
      // Re-mount: tear the old one down first. Common after artifact re-renders.
      unmountInternal(args.slot);
    }
    const factory = opts.kinds[args.kind];
    if (!factory) {
      opts.onError?.(args.slot, `unknown kind "${args.kind}"`);
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.dataset.summonStrictSlot = args.slot;
    wrapper.style.position = 'absolute';
    wrapper.style.zIndex = '9999';
    wrapper.style.pointerEvents = 'auto';

    const controller = factory({
      slot: args.slot,
      onChange: (filled) => opts.onChange?.(args.slot, { filled }),
    });
    wrapper.appendChild(controller.element);

    const mounted: MountedSlot = {
      slot: args.slot,
      kind: args.kind,
      bounds: args.bounds,
      controller,
      wrapper,
    };
    slots.set(args.slot, mounted);
    container.appendChild(wrapper);
    reposition(mounted);
  }

  async function submit(args: { slot: string }): Promise<void> {
    const mount = slots.get(args.slot);
    if (!mount) {
      opts.onError?.(args.slot, 'submit on unmounted slot');
      return;
    }
    if (!mount.controller.isFilled()) {
      opts.onError?.(args.slot, 'submit on empty input');
      return;
    }
    try {
      const result = await mount.controller.tokenize();
      opts.onSubmit?.(args.slot, result);
    } catch (err) {
      opts.onError?.(args.slot, err instanceof Error ? err.message : String(err));
    }
  }

  function unmountInternal(slot: string): void {
    const mount = slots.get(slot);
    if (!mount) return;
    mount.controller.destroy();
    mount.wrapper.remove();
    slots.delete(slot);
  }

  function unmount(args: { slot: string }): void {
    if (!slots.has(args.slot)) {
      opts.onError?.(args.slot, 'unmount on unknown slot');
      return;
    }
    unmountInternal(args.slot);
  }

  function destroy(): void {
    resizeObserver.disconnect();
    window.removeEventListener('scroll', repositionAll);
    window.removeEventListener('resize', repositionAll);
    for (const slot of Array.from(slots.keys())) unmountInternal(slot);
  }

  return { mount, submit, unmount, destroy };
}
