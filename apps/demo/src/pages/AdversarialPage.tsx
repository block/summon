import { useCallback, useMemo, useState } from 'react';
import { SummonSurface } from '@anarchitecture/summon-react';
import { AppNav, LogView, PageHeader, Pane } from '../components/chrome.js';
import { cn } from '../lib/cn.js';
import { logToneClass, pageWidthClass } from '../components/ui.js';
import { ADVERSARIAL_ARTIFACT } from '../adversarial-artifact.js';

type Report = { test: string; status: 'blocked' | 'allowed' | 'info'; detail: string };
type Rejection = { reason: string; raw: unknown };

const expectedHostRejection = new Set([
  'emit-unknown-tool',
  'emit-declared-but-not-granted',
]);
const grantedTools = ['report'];

function rejectionMatches(test: string, rejections: Rejection[]): boolean {
  return rejections.some((rejection) => {
    const raw = rejection.raw as { args?: { test?: string; status?: string }; tool?: string };
    if (test === 'emit-unknown-tool') return raw?.tool === 'exfiltrate';
    if (test === 'emit-declared-but-not-granted') {
      return raw?.tool === 'escalate' && rejection.reason.includes('not granted');
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

  const onToolCall = useCallback((tool: string, args: Record<string, unknown>) => {
    if (tool !== 'report') return;
    setReports((items) => [
      ...items,
      {
        test: String((args as { test?: unknown }).test ?? 'unknown'),
        status: String((args as { status?: unknown }).status ?? 'info') as Report['status'],
        detail: String((args as { detail?: unknown }).detail ?? ''),
      },
    ]);
  }, []);
  const onToolRejected = useCallback((reason: string, raw: unknown) => {
    setRejections((items) => [...items, { reason, raw }]);
  }, []);

  return (
    <>
      <AppNav />
      <PageHeader
        title="Phase 1 adversarial harness"
        lede="Loads a sandbox with a deliberately malicious artifact. Each attempt that fails is a win."
      />
      <div className={cn(pageWidthClass, 'grid grid-cols-2 gap-5 max-[820px]:grid-cols-1')}>
        <Pane title="Inline Arrow sandbox">
          <SummonSurface
            id="sandbox"
            className="h-[320px]"
            title="Summon sandbox"
            artifact={ADVERSARIAL_ARTIFACT}
            grantedTools={grantedTools}
            onToolCall={onToolCall}
            onToolRejected={onToolRejected}
          />
        </Pane>
        <Pane title="Test results">
          <LogView id="results" className="max-h-[320px]">
            {visibleReports.map((report, index) => {
              const verdict = judge(report, rejections);
              const cls = verdict === 'pass' ? 'pass' : verdict === 'fail' ? 'fail' : 'info';
              const mark = verdict === 'pass' ? '✓' : verdict === 'fail' ? '✗' : '·';
              const extra = expectedHostRejection.has(report.test) ? ' (host-rejected)' : '';
              return (
                <div key={`${report.test}-${index}`} className={logToneClass(cls)}>
                  {mark} {report.test} - {report.status}{extra}{report.detail ? `: ${report.detail}` : ''}
                </div>
              );
            })}
            {rejections.length > 0 ? (
              <>
                <div className={logToneClass('info')}>Host-side rejections:</div>
                {rejections.map((rejection, index) => {
                  const raw = rejection.raw as { tool?: string };
                  return (
                    <div key={index} className={logToneClass('info')}>
                      · {rejection.reason}{raw?.tool ? ` tool="${raw.tool}"` : ''}
                    </div>
                  );
                })}
              </>
            ) : null}
          </LogView>
          <div className="border-t border-line bg-surface-muted px-[18px] py-3 text-[13px] text-ink-soft" id="summary">
            {done
              ? counts.fail === 0
                ? <><span className={logToneClass('pass')}>All {counts.pass} tests passed.</span> Sandbox boundary holding.</>
                : <><span className={logToneClass('fail')}>{counts.fail} failed</span>, {counts.pass} passed. Review failures above.</>
              : `${counts.pass + counts.fail} results in, running...`}
          </div>
        </Pane>
      </div>
    </>
  );
}
