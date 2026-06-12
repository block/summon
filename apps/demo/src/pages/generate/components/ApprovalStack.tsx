import type { ApprovalDecision } from '@anarchitecture/summon';
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
    <div className="approval-stack">
      {approvalCards.map(({ request }) => (
        <section key={request.id} className="approval-card" data-approval-id={request.id}>
          <span>{request.capability}</span>
          <strong>{request.summary}</strong>
          <p>Request {request.id}</p>
          {request.details ? <pre>{formatApprovalDetails(request.details)}</pre> : null}
          <div className="approval-actions">
            <button type="button" onClick={() => {
              logLine('op-error', `approval denied: ${request.id}`);
              settleApproval(request.id, { status: 'denied', reason: 'Demo approval denied' });
            }}>Deny</button>
            <button type="button" className="approval-approve" onClick={() => {
              logLine('op-add', `approval approved: ${request.id}`);
              settleApproval(request.id, 'approved');
            }}>Approve</button>
          </div>
        </section>
      ))}
    </div>
  );
}
