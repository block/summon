declare module '@arrow-js/sandbox' {
  export type SandboxEvents = {
    output?: (payload: unknown) => void;
  };

  export type SandboxOptions = {
    source: Record<string, string>;
    shadowDOM?: boolean;
    onError?: (error: unknown) => void;
  };

  export function sandbox(
    options: SandboxOptions,
    events?: SandboxEvents,
    hostBridge?: Record<string, Record<string, unknown>>,
  ): (root: HTMLElement) => void | (() => void);
}
