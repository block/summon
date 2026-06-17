import type { ApprovalDecision } from '@anarchitecture/summon';
import { Button } from '../../../components/ui.js';
import { formatApprovalDetails } from '../surfaceHelpers.js';
import type { ApprovalCard } from '../types.js';

export function ApprovalStack({
  approvalCards,
  logLine,
  settleApproval,
}: {
  approvalCards: ApprovalCard[];
  logLine: (cls: string, text: string) => void;
  settleApproval: (id: string, decision: ApprovalDecision) => void;
}) {
  if (approvalCards.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[80] grid w-[min(360px,calc(100vw-32px))] gap-2.5">
      {approvalCards.map(({ request }) => (
        <section key={request.id} className="grid gap-2 rounded-card border border-line-strong bg-surface p-3.5 shadow-elevated" data-approval-id={request.id}>
          <span className="font-mono text-[10px] font-bold uppercase tracking-normal text-ink-muted">{request.tool}</span>
          <strong className="text-[15px] leading-tight text-ink">{request.summary}</strong>
          <p className="m-0 text-xs text-ink-soft">Request {request.id}</p>
          {request.details ? <pre className="m-0 max-h-[120px] overflow-auto rounded-control border border-line bg-surface-muted p-2 font-mono text-[11px] leading-snug text-ink-soft whitespace-pre-wrap">{formatApprovalDetails(request.details)}</pre> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" className="min-w-[76px] rounded-control" onClick={() => {
              logLine('op-error', `approval denied: ${request.id}`);
              settleApproval(request.id, { status: 'denied', reason: 'Demo approval denied' });
            }}>Deny</Button>
            <Button type="button" size="sm" className="min-w-[76px] rounded-control" onClick={() => {
              logLine('op-add', `approval approved: ${request.id}`);
              settleApproval(request.id, 'approved');
            }}>Approve</Button>
          </div>
        </section>
      ))}
    </div>
  );
}
