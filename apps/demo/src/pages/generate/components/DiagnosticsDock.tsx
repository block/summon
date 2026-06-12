import type { Dispatch, SetStateAction } from 'react';
import type { DevtoolsEvent } from '@anarchitecture/summon/devtools';
import type { SurfaceEnvelope } from '@anarchitecture/summon/envelope';
import { LogView } from '../../../components/chrome.js';
import type { ExtraDevtoolsEvent } from '../devtools.js';
import { formatDevtoolsEvent } from '../devtools.js';
import { compactPlanText } from '../surfaceHelpers.js';
import type { LogEntry } from '../types.js';

export function DiagnosticsDock({
  diagnosticsTab,
  setDiagnosticsTab,
  statusText,
  devtoolsTally,
  logs,
  devEvents,
  savedSurfaces,
  replaySurface,
}: {
  diagnosticsTab: 'stream' | 'devtools' | 'history' | 'safety';
  setDiagnosticsTab: Dispatch<SetStateAction<'stream' | 'devtools' | 'history' | 'safety'>>;
  statusText: string;
  devtoolsTally: string;
  logs: LogEntry[];
  devEvents: Array<DevtoolsEvent | ExtraDevtoolsEvent>;
  savedSurfaces: SurfaceEnvelope[];
  replaySurface: (envelope: SurfaceEnvelope) => void;
}) {
  const firstEventAt = devEvents[0]?.at ?? null;

  return (
    <section className="diagnostics-dock" aria-label="Diagnostics">
      <div className="diagnostics-tabs" role="tablist" aria-label="Diagnostics tabs">
        <button id="tab-stream" type="button" className={diagnosticsTab === 'stream' ? 'active' : ''} data-diagnostics-tab="stream" aria-selected={diagnosticsTab === 'stream'} onClick={() => setDiagnosticsTab('stream')}>Stream <span id="stream-tail">{statusText}</span></button>
        <button id="tab-devtools" type="button" className={diagnosticsTab === 'devtools' ? 'active' : ''} data-diagnostics-tab="devtools" aria-selected={diagnosticsTab === 'devtools'} onClick={() => setDiagnosticsTab('devtools')}>Devtools <span id="devtools-tally">{devtoolsTally}</span></button>
        <button id="tab-history" type="button" className={diagnosticsTab === 'history' ? 'active' : ''} data-diagnostics-tab="history" aria-selected={diagnosticsTab === 'history'} onClick={() => setDiagnosticsTab('history')}>History <span id="saved-count">{savedSurfaces.length}</span></button>
        <button id="tab-safety" type="button" className={diagnosticsTab === 'safety' ? 'active' : ''} data-diagnostics-tab="safety" aria-selected={diagnosticsTab === 'safety'} onClick={() => setDiagnosticsTab('safety')}>Safety</button>
      </div>

      <div className="diagnostics-panel active" id="diagnostics-stream" data-diagnostics-panel="stream" hidden={diagnosticsTab !== 'stream'}>
        <LogView id="log">
          {logs.map((entry, index) => <div key={index} className={entry.cls}>{entry.text}</div>)}
        </LogView>
      </div>
      <div className="diagnostics-panel" id="diagnostics-devtools" data-diagnostics-panel="devtools" hidden={diagnosticsTab !== 'devtools'}>
        <LogView id="devtools-log" className="devtools-log">
          {devEvents.map((event, index) => (
            <div key={index} className={`ev ev-${event.kind}`}>
              <span className="ev-time">{firstEventAt === null ? '+0000ms' : `+${(event.at - firstEventAt).toString().padStart(4, ' ')}ms`}</span>
              <span className="ev-kind">{event.kind}</span>
              <span className="ev-summary">{formatDevtoolsEvent(event)}</span>
            </div>
          ))}
        </LogView>
      </div>
      <div className="diagnostics-panel" id="diagnostics-history" data-diagnostics-panel="history" hidden={diagnosticsTab !== 'history'}>
        <div className="saved-surfaces" id="saved-surfaces">
          <div id="saved-list" className="saved-list">
            {savedSurfaces.length === 0 ? (
              <div className="saved-item">
                <div>
                  <div className="saved-item-title">No saved surfaces yet</div>
                  <div className="saved-item-meta">Completed runs appear here.</div>
                </div>
              </div>
            ) : savedSurfaces.map((item) => {
              const complete = item.streamGraph?.health.complete ? 'complete' : 'open';
              return (
                <div key={item.id} className="saved-item">
                  <div>
                    <div className="saved-item-title" title={item.prompt}>{item.prompt}</div>
                    <div className="saved-item-meta">
                      {compactPlanText(item.surfacePlan)} · hostTools={item.grants.intents.length} · validation={item.validationIssues.length} · {complete} · {new Date(item.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <button type="button" onClick={() => replaySurface(item)}>Replay</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="diagnostics-panel" id="diagnostics-safety" data-diagnostics-panel="safety" hidden={diagnosticsTab !== 'safety'}>
        <div className="safety-links" aria-label="Safety checks">
          <a href="/adversarial">Adversarial</a>
          <a href="/strict">Strict input</a>
          <a href="/fatal">Fatal boot</a>
        </div>
      </div>
    </section>
  );
}
