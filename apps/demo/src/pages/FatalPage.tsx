import { AppNav, PageHeader, Pane } from '../components/chrome.js';
import { pageWidthClass } from '../components/ui.js';
import { cn } from '../lib/cn.js';

export function FatalPage() {
  return (
    <>
      <AppNav />
      <PageHeader
        title="Bootstrap self-test retired"
        lede="Summon V2 no longer builds srcdoc bootstraps or postMessage readiness checks. Runtime errors now come from the inline Arrow surface handle."
      />
      <div className={cn(pageWidthClass, 'grid gap-5')}>
        <Pane title="Current safety boundary">
          <div className="grid gap-3 px-[18px] py-4 text-sm leading-6 text-ink-soft">
            <p className="m-0">
              The old fatal-page cases validated CSP and frame sandbox flags. Those checks were removed with the frame
              runtime.
            </p>
            <p className="m-0">
              The replacement smoke path is Arrow VM isolation plus the host bridge allowlist: no ambient browser access,
              no ungranted tools, and preview events that never execute generated code.
            </p>
          </div>
        </Pane>
      </div>
    </>
  );
}
