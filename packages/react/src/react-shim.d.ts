declare module 'react' {
  export type ReactNode = unknown;
  export type ComponentType<P = unknown> = (props: P) => ReactNode;
  export interface CSSProperties {
    [key: string]: string | number | undefined;
  }
  export interface RefObject<T> {
    current: T | null;
  }
  export function createElement(
    type: string | ComponentType<any>,
    props: Record<string, unknown> | null,
    ...children: ReactNode[]
  ): unknown;
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
