import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import {
  createComponentIslandRegistry,
  createComponentRegistry,
  defineComponent,
  type ComponentIslandError,
} from '../src/index.ts';

interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

class FakeElement {
  dataset: Record<string, string> = {};
  style: Record<string, string> = { position: '' };
  children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  scrollLeft = 0;
  scrollTop = 0;
  computedPosition = 'static';

  constructor(private rect: RectLike = { left: 0, top: 0, width: 0, height: 0 }) {}

  appendChild(child: FakeElement): FakeElement {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  remove(): void {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }

  getBoundingClientRect(): RectLike {
    return this.rect;
  }

  setRect(rect: RectLike): void {
    this.rect = rect;
  }
}

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed = new Set<unknown>();
  disconnected = false;

  constructor(private readonly callback: () => void) {
    FakeResizeObserver.instances.push(this);
  }

  observe(target: unknown): void {
    this.observed.add(target);
  }

  unobserve(target: unknown): void {
    this.observed.delete(target);
  }

  disconnect(): void {
    this.disconnected = true;
    this.observed.clear();
  }

  trigger(): void {
    this.callback();
  }
}

function withFakeDom<T>(fn: (dom: {
  body: FakeElement;
  createElement: (rect?: RectLike) => FakeElement;
  listenerCount: () => number;
}) => T): T {
  const previous = {
    document: (globalThis as any).document,
    window: (globalThis as any).window,
    ResizeObserver: (globalThis as any).ResizeObserver,
    getComputedStyle: (globalThis as any).getComputedStyle,
  };
  const body = new FakeElement({ left: 0, top: 0, width: 1000, height: 800 });
  const listeners = new Set<string>();
  const createElement = (rect?: RectLike) => new FakeElement(rect);
  (globalThis as any).document = {
    body,
    createElement: () => createElement(),
  };
  (globalThis as any).window = {
    scrollX: 100,
    scrollY: 200,
    addEventListener: (name: string) => listeners.add(name),
    removeEventListener: (name: string) => listeners.delete(name),
  };
  FakeResizeObserver.instances = [];
  (globalThis as any).ResizeObserver = FakeResizeObserver;
  (globalThis as any).getComputedStyle = (el: FakeElement) => ({
    position: el.computedPosition,
  });

  try {
    return fn({
      body,
      createElement,
      listenerCount: () => listeners.size,
    });
  } finally {
    (globalThis as any).document = previous.document;
    (globalThis as any).window = previous.window;
    (globalThis as any).ResizeObserver = previous.ResizeObserver;
    (globalThis as any).getComputedStyle = previous.getComputedStyle;
  }
}

function metricRegistry(calls: string[] = []) {
  return createComponentRegistry([
    defineComponent({
      name: 'MetricCard',
      description: 'Displays a KPI.',
      propsSchema: z.object({ label: z.string() }),
      render: ({ props, componentId }) => calls.push(`render:${componentId}:${props.label}`),
      destroy: ({ componentId }) => calls.push(`destroy:${componentId}`),
    }),
  ]);
}

test('component islands position overlays in document coordinates for body container', () => {
  withFakeDom(({ body, createElement }) => {
    const iframe = createElement({ left: 10, top: 20, width: 300, height: 200 }) as unknown as HTMLIFrameElement;
    const calls: string[] = [];
    const islands = createComponentIslandRegistry({
      outerIframe: iframe,
      registry: metricRegistry(calls),
    });

    islands.sync([
      {
        id: 'metric',
        name: 'MetricCard',
        props: { label: 'Revenue' },
        bounds: { x: 5, y: 6, width: 50, height: 40 },
      },
    ], { sandboxId: 'sandbox' });

    const overlayRoot = body.children[0]!;
    const wrapper = overlayRoot.children[0]!;
    assert.equal(wrapper.style.left, '115px');
    assert.equal(wrapper.style.top, '226px');
    assert.equal(wrapper.style.width, '50px');
    assert.equal(wrapper.style.height, '40px');
    assert.deepEqual(calls, ['render:metric:Revenue']);
  });
});

test('component islands position overlays relative to custom host containers and restore static position', () => {
  withFakeDom(({ createElement, listenerCount }) => {
    const container = createElement({ left: 30, top: 40, width: 500, height: 400 });
    container.scrollLeft = 7;
    container.scrollTop = 8;
    const iframe = createElement({ left: 130, top: 240, width: 300, height: 200 }) as unknown as HTMLIFrameElement;
    const calls: string[] = [];
    const islands = createComponentIslandRegistry({
      outerIframe: iframe,
      hostContainer: container as unknown as HTMLElement,
      registry: metricRegistry(calls),
    });

    assert.equal(container.style.position, 'relative');
    islands.sync([
      {
        id: 'metric',
        name: 'MetricCard',
        props: { label: 'Revenue' },
        bounds: { x: 10, y: 11, width: 50, height: 40 },
      },
    ], { sandboxId: 'sandbox' });

    const overlayRoot = container.children[0]!;
    const wrapper = overlayRoot.children[0]!;
    assert.equal(wrapper.style.left, '117px');
    assert.equal(wrapper.style.top, '219px');
    assert.equal(listenerCount(), 2);

    islands.destroy();
    assert.equal(container.children.length, 0);
    assert.equal(container.style.position, '');
    assert.equal(FakeResizeObserver.instances[0]!.disconnected, true);
    assert.equal(listenerCount(), 0);
    assert.deepEqual(calls, ['render:metric:Revenue', 'destroy:metric']);
  });
});

test('component islands reject invalid bounds with typed diagnostics', () => {
  withFakeDom(({ createElement }) => {
    const iframe = createElement({ left: 0, top: 0, width: 100, height: 100 }) as unknown as HTMLIFrameElement;
    const errors: ComponentIslandError[] = [];
    const islands = createComponentIslandRegistry({
      outerIframe: iframe,
      registry: metricRegistry(),
      onError: (error) => errors.push(error),
    });

    islands.sync([
      {
        id: 'metric',
        name: 'MetricCard',
        props: { label: 'Revenue' },
        bounds: { x: 0, y: 0, width: 200, height: 20 },
      },
    ], { sandboxId: 'sandbox' });

    assert.equal(errors.length, 1);
    assert.equal(errors[0]!.code, 'bounds-invalid');
    assert.equal(errors[0]!.componentId, 'metric');
  });
});

test('component islands reject unknown components and invalid props with typed diagnostics', () => {
  withFakeDom(({ createElement }) => {
    const iframe = createElement({ left: 0, top: 0, width: 300, height: 200 }) as unknown as HTMLIFrameElement;
    const errors: ComponentIslandError[] = [];
    const islands = createComponentIslandRegistry({
      outerIframe: iframe,
      registry: metricRegistry(),
      onError: (error) => errors.push(error),
    });

    islands.sync([
      {
        id: 'missing',
        name: 'MissingCard',
        props: { label: 'Revenue' },
        bounds: { x: 0, y: 0, width: 100, height: 80 },
      },
      {
        id: 'invalid',
        name: 'MetricCard',
        props: { label: 42 },
        bounds: { x: 120, y: 0, width: 100, height: 80 },
      },
    ], { sandboxId: 'sandbox' });

    assert.deepEqual(errors.map((error) => error.code), [
      'unknown-component',
      'props-invalid',
    ]);
  });
});
