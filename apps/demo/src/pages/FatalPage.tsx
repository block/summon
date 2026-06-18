import { AppNav, PageHeader, Pane } from '../components/chrome.js';
import { pageWidthClass } from '../components/ui.js';
import { cn } from '../lib/cn.js';

export function FatalPage() {
  return (
    <>
      <AppNav />
      <PageHeader
        title="Retired boot notes"
        lede="The iframe bootstrap checks are retired. Runtime errors now surface through the inline Arrow surface handle and Devtools events."
      />
      <div className={cn(pageWidthClass, 'grid gap-5')}>
        <Pane title="Current safety boundary">
          <div className="grid gap-3 px-[18px] py-4 text-sm leading-6 text-ink-soft">
            <p className="m-0">
              This route used to validate CSP and frame sandbox boot cases. The active smoke path now lives in the
              inline Arrow sandbox tests.
            </p>
            <p className="m-0">
              The replacement smoke path is Arrow VM isolation plus the host bridge allowlist: no ambient browser access,
              no ungranted tools, and protocol events that never execute generated code.
            </p>
          </div>
        </Pane>
      </div>
    </>
  );
}
