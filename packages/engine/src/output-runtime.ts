export type SummonOutputRuntime =
  | 'arrow-control'
  | 'html-static'
  | 'html-stream'
  | 'html-script';

export const DEFAULT_SUMMON_OUTPUT_RUNTIME: SummonOutputRuntime = 'arrow-control';

export function isHtmlOutputRuntime(runtime: SummonOutputRuntime | undefined): boolean {
  return runtime === 'html-static' ||
    runtime === 'html-stream' ||
    runtime === 'html-script';
}

export function isScriptedHtmlOutputRuntime(runtime: SummonOutputRuntime | undefined): boolean {
  return runtime === 'html-script';
}
