export type SummonOutputRuntime =
  | 'arrow-control'
  | 'html-static'
  | 'html-stream'
  | 'html-script'
  | 'unsafe-html-raw-stream';

export const DEFAULT_SUMMON_OUTPUT_RUNTIME: SummonOutputRuntime = 'arrow-control';

export type RuntimeFormat = 'arrow' | 'html';
export type RuntimeDelivery = 'bundle' | 'stream';
export type RuntimeTrust = 'sandboxed' | 'iframe-safe' | 'iframe-script' | 'unsafe';

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
  'html-script',
  'unsafe-html-raw-stream',
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
  'html-script': {
    runtime: 'html-script',
    format: 'html',
    delivery: 'bundle',
    trust: 'iframe-script',
    experimental: true,
  },
  'unsafe-html-raw-stream': {
    runtime: 'unsafe-html-raw-stream',
    format: 'html',
    delivery: 'stream',
    trust: 'unsafe',
    experimental: true,
  },
};

export function runtimeProfile(runtime: SummonOutputRuntime | undefined): RuntimeProfile {
  return RUNTIME_PROFILES[runtime ?? DEFAULT_SUMMON_OUTPUT_RUNTIME];
}

export function isHtmlOutputRuntime(runtime: SummonOutputRuntime | undefined): boolean {
  return runtimeProfile(runtime).format === 'html';
}

export function isScriptedHtmlOutputRuntime(runtime: SummonOutputRuntime | undefined): boolean {
  return runtimeProfile(runtime).trust === 'iframe-script';
}
