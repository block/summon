import type { GenerationTrace } from '../generationTrace.js';

export function TraceTimeline({ trace }: { trace: GenerationTrace }) {
  return (
    <ol className="m-0 grid list-none gap-3 p-0">
      {trace.timeline.map((item, index) => (
        <li key={`${item.at}-${index}`} className="grid grid-cols-[76px_1fr] gap-3 rounded-2xl border border-line bg-surface p-3 text-sm">
          <time className="font-mono text-[10px] uppercase text-ink-muted">{new Date(item.at).toLocaleTimeString()}</time>
          <div>
            <div className="font-semibold text-ink">{labelKind(item.kind)} · {item.label}</div>
            {item.detail ? <div className="mt-1 text-xs leading-normal text-ink-soft">{item.detail}</div> : null}
          </div>
        </li>
      ))}
      {trace.conformance?.checks.map((check, index) => (
        <li key={`check-${check.name}-${index}`} className="rounded-2xl border border-line bg-surface p-3 text-sm">
          <div className="font-semibold text-ink">{check.name} · {check.verdict}</div>
          <div className="mt-1 font-mono text-[10px] uppercase text-ink-muted">{check.severity}</div>
          <p className="mb-0 mt-2 text-xs leading-normal text-ink-soft">{check.reason}</p>
          {check.evidence ? <p className="mb-0 mt-1 text-xs leading-normal text-ink-muted">Evidence: {check.evidence}</p> : null}
        </li>
      ))}
      {trace.receipt ? <ReceiptSummary receipt={trace.receipt} /> : null}
    </ol>
  );
}

function ReceiptSummary({ receipt }: { receipt: unknown }) {
  const item = receipt && typeof receipt === 'object' && !Array.isArray(receipt) ? receipt as Record<string, unknown> : {};
  const generation = item.generation && typeof item.generation === 'object' ? item.generation as Record<string, unknown> : {};
  const capability = item.capability && typeof item.capability === 'object' ? item.capability as Record<string, unknown> : {};
  const validation = generation.validation && typeof generation.validation === 'object' ? generation.validation as Record<string, unknown> : {};
  return (
    <li className="rounded-2xl border border-line bg-surface p-3 text-sm">
      <div className="font-semibold text-ink">Receipt summary</div>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-ink-soft">
        <dt className="font-semibold">Validation</dt><dd>{String(validation.blocked ?? 0)} blocked · {String(validation.warnings ?? 0)} warnings</dd>
        <dt className="font-semibold">Repairs</dt><dd>{String(generation.repairs ?? 0)}</dd>
        <dt className="font-semibold">Granted tools</dt><dd>{Array.isArray(capability.grantedTools) ? capability.grantedTools.join(', ') || 'none' : 'none'}</dd>
        <dt className="font-semibold">Safety</dt><dd>{Array.isArray(generation.safetyViolations) ? generation.safetyViolations.length : 0} violations</dd>
      </dl>
    </li>
  );
}

function labelKind(kind: GenerationTrace['timeline'][number]['kind']): string {
  switch (kind) {
    case 'status': return 'Phase';
    case 'gather': return 'Gather';
    case 'context': return 'Context';
    case 'tokens': return 'Tokens';
    case 'artifact': return 'Artifact';
    case 'conformance': return 'Conformance';
    case 'receipt': return 'Receipt';
    case 'error': return 'Error';
  }
}
