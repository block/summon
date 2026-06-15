declare module 'react' {
  export type ReactNode = unknown;
  export type ComponentType<P = unknown> = (props: P) => ReactNode;
  export interface CSSProperties {
    [key: string]: string | number | undefined;
  }
  export interface RefObject<T> {
    current: T | null;
  }
  export type RefCallback<T> = (instance: T | null) => void;
  export type Ref<T> = RefCallback<T> | RefObject<T> | null;
  export type ForwardedRef<T> = Ref<T>;
  export function createElement(
    type: string | ComponentType<any>,
    props: Record<string, unknown> | null,
    ...children: ReactNode[]
  ): unknown;
  export function forwardRef<T, P = object>(
    render: (props: P, ref: ForwardedRef<T>) => ReactNode,
  ): ComponentType<P & { ref?: Ref<T> }>;
  export function useImperativeHandle<T, R extends T>(
    ref: Ref<T> | undefined,
    init: () => R,
    deps?: readonly unknown[],
  ): void;
  export function useEffect(
    effect: () => void | (() => void),
    deps?: readonly unknown[],
  ): void;
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  export function useRef<T>(initialValue: T | null): RefObject<T>;
}

declare module 'react-dom/client' {
  export interface Root {
    render(children: unknown): void;
    unmount(): void;
  }
  export function createRoot(container: Element | DocumentFragment): Root;
}
