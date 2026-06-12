import { useCallback, useMemo, useState } from 'react';
import { SummonSurface } from '@anarchitecture/summon-react';
import { AppNav, LogView, Pane } from '../components/chrome.js';
import { ADVERSARIAL_BODY_HTML } from '../adversarial-artifact.js';

type Report = { test: string; status: 'blocked' | 'allowed' | 'info'; detail: string };
type Rejection = { reason: string; raw: unknown };

const expectedHostRejection = new Set([
  'emit-unknown-intent',
  'emit-declared-but-not-granted',
]);
const artifactIntents = ['report', 'escalate'];
const grantedIntents = ['report'];

function rejectionMatches(test: string, rejections: Rejection[]): boolean {
  return rejections.some((rejection) => {
    const raw = rejection.raw as { args?: { test?: string; status?: string }; intent?: string };
    if (test === 'emit-unknown-intent') return raw?.intent === 'exfiltrate';
    if (test === 'emit-declared-but-not-granted') {
      return raw?.intent === 'escalate' && rejection.reason.includes('not granted');
    }
    return false;
  });
}

function judge(report: Report, rejections: Rejection[]): 'pass' | 'fail' | 'info' {
  if (report.status === 'info') return 'info';
  if (expectedHostRejection.has(report.test)) {
    return rejectionMatches(report.test, rejections) ? 'pass' : 'fail';
  }
  return report.status === 'blocked' ? 'pass' : 'fail';
}

export function AdversarialPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [rejections, setRejections] = useState<Rejection[]>([]);

  const visibleReports = reports.filter((report) => report.test !== '__DONE__');
  const done = reports.some((report) => report.test === '__DONE__');
  const counts = useMemo(() => {
    let pass = 0;
    let fail = 0;
    for (const report of visibleReports) {
      const verdict = judge(report, rejections);
      if (verdict === 'pass') pass += 1;
      if (verdict === 'fail') fail += 1;
    }
    return { pass, fail };
  }, [rejections, visibleReports]);

  const onIntent = useCallback((intent: string, args: Record<string, unknown>) => {
    if (intent !== 'report') return;
    setReports((items) => [
      ...items,
      {
        test: String((args as { test?: unknown }).test ?? 'unknown'),
        status: String((args as { status?: unknown }).status ?? 'info') as Report['status'],
        detail: String((args as { detail?: unknown }).detail ?? ''),
      },
    ]);
  }, []);
  const onIntentRejected = useCallback((reason: string, raw: unknown) => {
    setRejections((items) => [...items, { reason, raw }]);
  }, []);

  return (
    <>
      <AppNav />
      <h1 className="page-title">Phase 1 adversarial harness</h1>
      <p className="lede">Loads a sandbox with a deliberately malicious artifact. Each attempt that fails is a win.</p>
      <div className="layout cols-2">
        <Pane title="Sandbox iframe">
          <SummonSurface
            id="sandbox"
            className="h-320"
            title="Summon sandbox"
            html={ADVERSARIAL_BODY_HTML}
            artifactIntents={artifactIntents}
            grantedIntents={grantedIntents}
            onIntent={onIntent}
            onIntentRejected={onIntentRejected}
          />
        </Pane>
        <Pane title="Test results">
          <LogView id="results" className="h-320">
            {visibleReports.map((report, index) => {
              const verdict = judge(report, rejections);
              const cls = verdict === 'pass' ? 'pass' : verdict === 'fail' ? 'fail' : 'info';
              const mark = verdict === 'pass' ? '✓' : verdict === 'fail' ? '✗' : '·';
              const extra = expectedHostRejection.has(report.test) ? ' (host-rejected)' : '';
              return (
                <div key={`${report.test}-${index}`} className={cls}>
                  {mark} {report.test} - {report.status}{extra}{report.detail ? `: ${report.detail}` : ''}
                </div>
              );
            })}
            {rejections.length > 0 ? (
              <>
                <div className="info adversarial-rejection-heading">Host-side rejections:</div>
                {rejections.map((rejection, index) => {
                  const raw = rejection.raw as { intent?: string };
                  return (
                    <div key={index} className="info">
                      · {rejection.reason}{raw?.intent ? ` intent="${raw.intent}"` : ''}
                    </div>
                  );
                })}
              </>
            ) : null}
          </LogView>
          <div className="summary" id="summary">
            {done
              ? counts.fail === 0
                ? <><span className="pass">All {counts.pass} tests passed.</span> Sandbox boundary holding.</>
                : <><span className="fail">{counts.fail} failed</span>, {counts.pass} passed. Review failures above.</>
              : `${counts.pass + counts.fail} results in, running...`}
          </div>
        </Pane>
      </div>
    </>
  );
}
