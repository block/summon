import type { Dispatch, SetStateAction } from 'react';
import type { DevtoolsEvent } from '@anarchitecture/summon/devtools';
import type { SurfaceEnvelope } from '@anarchitecture/summon/envelope';
import { LogView } from '../../../components/chrome.js';
import { buttonClass, devtoolsEventKindClass, logToneClass, pageWidthClass, panelClass } from '../../../components/ui.js';
import { cn } from '../../../lib/cn.js';
import type { ExtraDevtoolsEvent } from '../devtools.js';
import { formatDevtoolsEvent } from '../devtools.js';
import { compactPlanText } from '../surfaceHelpers.js';
import type { DiagnosticsTab, LogEntry, TimingEntry } from '../types.js';

export function DiagnosticsDock({
  diagnosticsTab,
  setDiagnosticsTab,
  statusText,
  devtoolsTally,
  logs,
  devEvents,
  timingEntries,
  savedSurfaces,
  replaySurface,
  embedded = false,
}: {
  diagnosticsTab: DiagnosticsTab;
  setDiagnosticsTab: Dispatch<SetStateAction<DiagnosticsTab>>;
  statusText: string;
  devtoolsTally: string;
  logs: LogEntry[];
  devEvents: Array<DevtoolsEvent | ExtraDevtoolsEvent>;
  timingEntries: TimingEntry[];
  savedSurfaces: SurfaceEnvelope[];
  replaySurface: (envelope: SurfaceEnvelope) => void;
  embedded?: boolean;
}) {
  const firstEventAt = devEvents[0]?.at ?? null;
  const tabClass = (active: boolean) => buttonClass({ variant: active ? 'primary' : 'ghost', size: 'xs', className: 'rounded-card' });

  return (
    <section className={cn(embedded ? 'overflow-hidden bg-surface' : cn(pageWidthClass, panelClass, 'mt-9 overflow-hidden'))} aria-label="Diagnostics">
      <div className="flex flex-wrap gap-1.5 border-b border-line bg-surface p-2.5" role="tablist" aria-label="Diagnostics tabs">
        <button id="tab-stream" type="button" className={tabClass(diagnosticsTab === 'stream')} data-diagnostics-tab="stream" aria-selected={diagnosticsTab === 'stream'} onClick={() => setDiagnosticsTab('stream')}>Stream <span id="stream-tail" className="ml-1.5 font-mono text-[10px] font-medium opacity-75">{statusText}</span></button>
        <button id="tab-devtools" type="button" className={tabClass(diagnosticsTab === 'devtools')} data-diagnostics-tab="devtools" aria-selected={diagnosticsTab === 'devtools'} onClick={() => setDiagnosticsTab('devtools')}>Devtools <span id="devtools-tally" className="ml-1.5 font-mono text-[10px] font-medium opacity-75">{devtoolsTally}</span></button>
        <button id="tab-timing" type="button" className={tabClass(diagnosticsTab === 'timing')} data-diagnostics-tab="timing" aria-selected={diagnosticsTab === 'timing'} onClick={() => setDiagnosticsTab('timing')}>Timing <span id="timing-count" className="ml-1.5 font-mono text-[10px] font-medium opacity-75">{timingEntries.length}</span></button>
        <button id="tab-history" type="button" className={tabClass(diagnosticsTab === 'history')} data-diagnostics-tab="history" aria-selected={diagnosticsTab === 'history'} onClick={() => setDiagnosticsTab('history')}>History <span id="saved-count" className="ml-1.5 font-mono text-[10px] font-medium opacity-75">{savedSurfaces.length}</span></button>
        <button id="tab-safety" type="button" className={tabClass(diagnosticsTab === 'safety')} data-diagnostics-tab="safety" aria-selected={diagnosticsTab === 'safety'} onClick={() => setDiagnosticsTab('safety')}>Safety</button>
      </div>

      <div className="bg-surface" id="diagnostics-stream" data-diagnostics-panel="stream" hidden={diagnosticsTab !== 'stream'}>
        <LogView id="log">
          {logs.map((entry, index) => <div key={index} className={logToneClass(entry.cls)}>{entry.text}</div>)}
        </LogView>
      </div>
      <div className="bg-surface" id="diagnostics-devtools" data-diagnostics-panel="devtools" hidden={diagnosticsTab !== 'devtools'}>
        <LogView id="devtools-log">
          {devEvents.map((event, index) => (
            <div key={index} className="grid grid-cols-[56px_140px_1fr] gap-3 py-0.5">
              <span className="text-ink-muted">{firstEventAt === null ? '+0000ms' : `+${(event.at - firstEventAt).toString().padStart(4, ' ')}ms`}</span>
              <span className={cn('font-semibold', devtoolsEventKindClass(event.kind))}>{event.kind}</span>
              <span>{formatDevtoolsEvent(event)}</span>
            </div>
          ))}
        </LogView>
      </div>
      <div className="bg-surface" id="diagnostics-timing" data-diagnostics-panel="timing" hidden={diagnosticsTab !== 'timing'}>
        {timingEntries.length === 0 ? (
          <div className="border-b border-line px-3.5 py-3 text-[13px] text-ink-muted">No timing entries yet</div>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full border-collapse text-left font-mono text-[11px]">
              <thead className="sticky top-0 bg-surface-muted text-ink-muted">
                <tr>
                  <th className="border-b border-line px-3 py-2 font-semibold">Phase</th>
                  <th className="border-b border-line px-3 py-2 font-semibold">Source</th>
                  <th className="border-b border-line px-3 py-2 font-semibold">Elapsed</th>
                  <th className="border-b border-line px-3 py-2 font-semibold">Duration</th>
                  <th className="border-b border-line px-3 py-2 font-semibold">Label</th>
                </tr>
              </thead>
              <tbody id="timing-rows">
                {timingEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-line last:border-b-0">
                    <td className="px-3 py-2 text-ink">{entry.phase}</td>
                    <td className={cn('px-3 py-2 font-semibold', entry.source === 'server' ? 'text-good' : 'text-ink-soft')}>{entry.source}</td>
                    <td className="px-3 py-2 text-ink">{formatMs(entry.elapsedMs)}</td>
                    <td className="px-3 py-2 text-ink-muted">{entry.durationMs === undefined ? '-' : formatMs(entry.durationMs)}</td>
                    <td className="px-3 py-2 text-ink-soft">{entry.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="bg-surface" id="diagnostics-history" data-diagnostics-panel="history" hidden={diagnosticsTab !== 'history'}>
        <div id="saved-surfaces">
          <div id="saved-list" className="grid">
            {savedSurfaces.length === 0 ? (
              <div className="grid grid-cols-[1fr_auto] items-center gap-2.5 border-b border-line bg-surface px-3.5 py-2.5 last:border-b-0">
                <div>
                  <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-ink">No saved surfaces yet</div>
                  <div className="mt-0.5 font-mono text-[10px] text-ink-muted">Completed runs appear here.</div>
                </div>
              </div>
            ) : savedSurfaces.map((item) => {
              const complete = item.streamGraph?.health.complete ? 'complete' : 'open';
              return (
                <div key={item.id} className="grid grid-cols-[1fr_auto] items-center gap-2.5 border-b border-line bg-surface px-3.5 py-2.5 last:border-b-0">
                  <div>
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-ink" title={item.prompt}>{item.prompt}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-ink-muted">
                      {compactPlanText(item.surfacePlan)} · hostTools={item.grants.tools.length} · validation={item.validationIssues.length} · {complete} · {new Date(item.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <button type="button" className={buttonClass({ variant: 'ghost', size: 'xs', className: 'rounded-card' })} onClick={() => replaySurface(item)}>Replay</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="bg-surface" id="diagnostics-safety" data-diagnostics-panel="safety" hidden={diagnosticsTab !== 'safety'}>
        <div className="flex flex-wrap items-center gap-1.5 p-3.5" aria-label="Safety checks">
          <a className={buttonClass({ variant: 'chip', size: 'xs', className: 'rounded-card no-underline' })} href="/adversarial">Arrow boundary</a>
          <a className={buttonClass({ variant: 'chip', size: 'xs', className: 'rounded-card no-underline' })} href="/strict">Overlay notes</a>
          <a className={buttonClass({ variant: 'chip', size: 'xs', className: 'rounded-card no-underline' })} href="/fatal">Boot notes</a>
        </div>
      </div>
    </section>
  );
}

function formatMs(value: number): string {
  return `${Math.round(value).toLocaleString()} ms`;
}
