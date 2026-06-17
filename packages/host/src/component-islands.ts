import type { EventStore } from '@summon-internal/devtools';
import type {
  ComponentIslandBounds,
  ComponentIslandDescriptor,
} from './types.js';
import type {
  ComponentRegistry,
  ComponentRenderContext,
} from './component-registry.js';

export interface ComponentIslandSyncContext {
  sandboxId: string;
  callTool?: (tool: string, args?: Record<string, unknown>) => void;
}

export interface ComponentIslandRegistryOptions {
  outerIframe: HTMLIFrameElement;
  hostContainer?: HTMLElement;
  registry: ComponentRegistry;
  events?: EventStore;
  onError?: (error: ComponentIslandError) => void;
}

export type ComponentIslandErrorCode =
  | 'bounds-invalid'
  | 'unknown-component'
  | 'props-invalid'
  | 'registry-missing';

export interface ComponentIslandError {
  code: ComponentIslandErrorCode;
  componentId?: string;
  componentName?: string;
  sandboxId?: string;
  reason: string;
}

export interface ComponentIslandRegistry {
  sync(components: ComponentIslandDescriptor[], context?: Partial<ComponentIslandSyncContext>): void;
  reposition(): void;
  destroy(): void;
}

interface MountedIsland {
  id: string;
  name: string;
  wrapper: HTMLDivElement;
  bounds: ComponentIslandBounds;
  sandboxId: string;
  callTool: (tool: string, args?: Record<string, unknown>) => void;
}

export function createComponentIslandRegistry(
  opts: ComponentIslandRegistryOptions,
): ComponentIslandRegistry {
  const container = opts.hostContainer ?? document.body;
  const usesBodyCoordinates = container === document.body;
  const mounted = new Map<string, MountedIsland>();
  const initialInlinePosition = container.style.position;
  let changedContainerPosition = false;

  if (!usesBodyCoordinates && getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
    changedContainerPosition = true;
  }

  const overlayRoot = document.createElement('div');
  overlayRoot.dataset.summonComponentOverlayRoot = 'true';
  overlayRoot.style.position = 'absolute';
  overlayRoot.style.left = '0';
  overlayRoot.style.top = '0';
  overlayRoot.style.width = '0';
  overlayRoot.style.height = '0';
  overlayRoot.style.zIndex = '9998';
  overlayRoot.style.pointerEvents = 'none';
  overlayRoot.style.overflow = 'visible';
  container.appendChild(overlayRoot);

  function emitError(error: ComponentIslandError): void {
    opts.events?.push({
      kind: 'component-error',
      at: Date.now(),
      code: error.code,
      sandboxId: error.sandboxId,
      componentId: error.componentId,
      componentName: error.componentName,
      reason: error.reason,
    });
    opts.onError?.(error);
  }

  function clipBounds(bounds: ComponentIslandBounds): ComponentIslandBounds | null {
    const iframeRect = opts.outerIframe.getBoundingClientRect();
    if (
      !Number.isFinite(bounds.x) ||
      !Number.isFinite(bounds.y) ||
      !Number.isFinite(bounds.width) ||
      !Number.isFinite(bounds.height) ||
      bounds.width <= 0 ||
      bounds.height <= 0
    ) {
      return null;
    }
    if (bounds.width > iframeRect.width || bounds.height > iframeRect.height) {
      return null;
    }

    const left = Math.max(0, bounds.x);
    const top = Math.max(0, bounds.y);
    const right = Math.min(iframeRect.width, bounds.x + bounds.width);
    const bottom = Math.min(iframeRect.height, bounds.y + bounds.height);
    const width = right - left;
    const height = bottom - top;
    if (width <= 0 || height <= 0) return null;
    return { x: left, y: top, width, height };
  }

  function position(island: MountedIsland): void {
    const iframeRect = opts.outerIframe.getBoundingClientRect();
    const clipped = clipBounds(island.bounds);
    if (!clipped) return;
    const origin = overlayOrigin(iframeRect);
    island.wrapper.style.left = `${origin.x + clipped.x}px`;
    island.wrapper.style.top = `${origin.y + clipped.y}px`;
    island.wrapper.style.width = `${clipped.width}px`;
    island.wrapper.style.height = `${clipped.height}px`;
  }

  function overlayOrigin(iframeRect: DOMRect): { x: number; y: number } {
    if (usesBodyCoordinates) {
      return {
        x: iframeRect.left + window.scrollX,
        y: iframeRect.top + window.scrollY,
      };
    }
    const containerRect = container.getBoundingClientRect();
    return {
      x: iframeRect.left - containerRect.left + container.scrollLeft,
      y: iframeRect.top - containerRect.top + container.scrollTop,
    };
  }

  function render(island: MountedIsland, props: unknown): void {
    opts.registry.render(island.name, {
      container: island.wrapper,
      props,
      componentId: island.id,
      sandboxId: island.sandboxId,
      callTool: island.callTool,
    } as ComponentRenderContext);
  }

  function unmount(id: string): void {
    const island = mounted.get(id);
    if (!island) return;
    opts.registry.destroy(island.name, {
      container: island.wrapper,
      componentId: island.id,
      sandboxId: island.sandboxId,
      callTool: island.callTool,
    });
    island.wrapper.remove();
    mounted.delete(id);
  }

  function sync(
    components: ComponentIslandDescriptor[],
    context: Partial<ComponentIslandSyncContext> = {},
  ): void {
    const seen = new Set<string>();
    const sandboxId = context.sandboxId ?? '';
    const callTool = context.callTool ?? (() => {});

    for (const component of components) {
      seen.add(component.id);
      const clipped = clipBounds(component.bounds);
      if (!clipped) {
        emitError({
          code: 'bounds-invalid',
          sandboxId,
          componentId: component.id,
          componentName: component.name,
          reason: 'component bounds are empty, offscreen, or larger than the iframe',
        });
        unmount(component.id);
        continue;
      }

      const parsed = opts.registry.validateProps(component.name, component.props);
      if (!parsed.ok) {
        emitError({
          code: parsed.error?.startsWith('unknown component') ? 'unknown-component' : 'props-invalid',
          sandboxId,
          componentId: component.id,
          componentName: component.name,
          reason: parsed.error ?? 'component props failed validation',
        });
        unmount(component.id);
        continue;
      }

      let island = mounted.get(component.id);
      if (island && island.name !== component.name) {
        unmount(component.id);
        island = undefined;
      }

      if (!island) {
        const wrapper = document.createElement('div');
        wrapper.dataset.summonComponentId = component.id;
        wrapper.dataset.summonComponent = component.name;
        wrapper.style.position = 'absolute';
        wrapper.style.zIndex = '9998';
        wrapper.style.pointerEvents = 'auto';
        wrapper.style.overflow = 'hidden';
        overlayRoot.appendChild(wrapper);
        island = {
          id: component.id,
          name: component.name,
          wrapper,
          bounds: clipped,
          sandboxId,
          callTool,
        };
        mounted.set(component.id, island);
      }

      island.bounds = clipped;
      island.sandboxId = sandboxId;
      island.callTool = callTool;
      position(island);
      render(island, parsed.data);
    }

    for (const id of Array.from(mounted.keys())) {
      if (!seen.has(id)) unmount(id);
    }
  }

  function reposition(): void {
    for (const island of mounted.values()) position(island);
  }

  const resizeObserver = new ResizeObserver(reposition);
  resizeObserver.observe(opts.outerIframe);
  window.addEventListener('scroll', reposition, { passive: true });
  window.addEventListener('resize', reposition);

  function destroy(): void {
    resizeObserver.disconnect();
    window.removeEventListener('scroll', reposition);
    window.removeEventListener('resize', reposition);
    for (const id of Array.from(mounted.keys())) unmount(id);
    overlayRoot.remove();
    if (changedContainerPosition && container.style.position === 'relative') {
      container.style.position = initialInlinePosition;
    }
  }

  return { sync, reposition, destroy };
}
