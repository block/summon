export type SummonOutputRuntime =
  | 'arrow-control'
  | 'html-static'
  | 'html-stream'
  | 'domjs-control';

export const DEFAULT_SUMMON_OUTPUT_RUNTIME: SummonOutputRuntime = 'arrow-control';

export type RuntimeFormat = 'arrow' | 'html' | 'domjs';
export type RuntimeDelivery = 'bundle' | 'stream';
export type RuntimeTrust = 'sandboxed' | 'iframe-safe';

export interface RuntimeProfile {
  runtime: SummonOutputRuntime;
  format: RuntimeFormat;
  delivery: RuntimeDelivery;
  trust: RuntimeTrust;
  experimental: boolean;
}

export const SUMMON_OUTPUT_RUNTIME_VALUES = [
  'arrow-control',
  'html-static',
  'html-stream',
  'domjs-control',
] as const satisfies readonly SummonOutputRuntime[];

export const RUNTIME_PROFILES: Record<SummonOutputRuntime, RuntimeProfile> = {
  'arrow-control': {
    runtime: 'arrow-control',
    format: 'arrow',
    delivery: 'bundle',
    trust: 'sandboxed',
    experimental: false,
  },
  'html-static': {
    runtime: 'html-static',
    format: 'html',
    delivery: 'bundle',
    trust: 'iframe-safe',
    experimental: true,
  },
  'html-stream': {
    runtime: 'html-stream',
    format: 'html',
    delivery: 'stream',
    trust: 'iframe-safe',
    experimental: true,
  },
  // domjs: HTML/JS authoring, but executed in the surface-vm capability sandbox
  // (not an iframe). format is its own 'domjs' so it is never treated as
  // iframe-safe html, while trust is 'sandboxed' like arrow.
  'domjs-control': {
    runtime: 'domjs-control',
    format: 'domjs',
    delivery: 'bundle',
    trust: 'sandboxed',
    experimental: true,
  },
};

export function runtimeProfile(runtime: SummonOutputRuntime | undefined): RuntimeProfile {
  return RUNTIME_PROFILES[runtime ?? DEFAULT_SUMMON_OUTPUT_RUNTIME];
}

export function isHtmlOutputRuntime(runtime: SummonOutputRuntime | undefined): boolean {
  return runtimeProfile(runtime).format === 'html';
}
