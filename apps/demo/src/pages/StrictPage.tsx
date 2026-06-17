import { AppNav, PageHeader, Pane } from '../components/chrome.js';
import { pageWidthClass } from '../components/ui.js';
import { cn } from '../lib/cn.js';

export function StrictPage() {
  return (
    <>
      <AppNav />
      <PageHeader
        title="Strict input demo retired"
        lede="Summon V2 removed host-rendered component islands and strict input overlays. Generated UI now renders directly inside the inline Arrow sandbox, while privileged work stays behind host tools."
      />
      <div className={cn(pageWidthClass, 'grid gap-5')}>
        <Pane title="V2 runtime shape">
          <div className="grid gap-3 px-[18px] py-4 text-sm leading-6 text-ink-soft">
            <p className="m-0">
              This route used to demonstrate a contained surface with a host-owned overlay input. That architecture is no
              longer part of the public runtime.
            </p>
            <p className="m-0">
              Use the Generate page for the current model: semantic preview events stream into a trusted host renderer,
              then the final validated Arrow artifact replaces the preview and may call only granted host tools.
            </p>
          </div>
        </Pane>
      </div>
    </>
  );
}
