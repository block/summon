import { AppNav, PageHeader, Pane } from '../components/chrome.js';
import { pageWidthClass } from '../components/ui.js';
import { cn } from '../lib/cn.js';

export function StrictPage() {
  return (
    <>
      <AppNav />
      <PageHeader
        title="Retired overlay notes"
        lede="The old strict-input overlay path is retired. Generated UI now runs directly inside the inline Arrow sandbox, while privileged work stays behind host tools."
      />
      <div className={cn(pageWidthClass, 'grid gap-5')}>
        <Pane title="Current runtime shape">
          <div className="grid gap-3 px-[18px] py-4 text-sm leading-6 text-ink-soft">
            <p className="m-0">
              This route used to demonstrate a host-owned overlay input layered around a contained surface. That
              architecture is no longer part of the Arrow-only runtime.
            </p>
            <p className="m-0">
              Use the Generate page for the current path: structured Arrow bundles are validated, accepted artifacts
              mount in the inline sandbox, and generated code may call only granted host tools.
            </p>
          </div>
        </Pane>
      </div>
    </>
  );
}
