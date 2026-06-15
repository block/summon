type ClassValue = string | false | null | undefined;

export function cx(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}

export const labelClass = 'font-mono text-[10px] font-extrabold uppercase leading-none tracking-normal text-gallery-muted';
export const focusRingClass = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gallery-info';

export function statusBadgeClass(state: 'ready' | 'missing' | 'offline' | 'unknown' = 'unknown'): string {
  const tone = state === 'ready'
    ? 'before:bg-gallery-success'
    : state === 'missing' || state === 'offline'
      ? 'text-gallery-warning before:bg-gallery-warning'
      : 'before:bg-gallery-line-strong';

  return cx(
    'inline-flex min-w-0 items-center gap-[7px] overflow-hidden whitespace-nowrap border border-gallery-line bg-transparent px-2.5 py-[7px] font-mono text-[10px] font-bold uppercase leading-none tracking-normal text-gallery-muted text-ellipsis',
    'before:block before:size-1.5 before:flex-none before:rounded-full',
    tone,
  );
}

export function presetCardClass(active: boolean): string {
  return cx(
    'grid min-h-[66px] w-full min-w-0 cursor-pointer grid-cols-[28px_minmax(0,1fr)] gap-2 rounded-[6px] border px-2.5 py-3 text-left text-gallery-ink transition-colors',
    focusRingClass,
    active
      ? 'border-gallery-line-strong bg-gallery-panel'
      : 'border-transparent bg-transparent hover:border-gallery-line hover:bg-transparent',
  );
}

export const presetIndexClass = 'pt-0.5 font-mono text-[11px] font-extrabold leading-tight text-gallery-accent';
export const presetMainClass = 'grid min-w-0 gap-[3px]';
export const presetTitleClass = 'min-w-0 break-words text-lg font-bold leading-[1.02] text-gallery-ink';
export const presetCategoryClass = 'overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] font-extrabold uppercase leading-none tracking-normal text-gallery-soft';
export const presetMetaClass = 'min-w-0 break-words font-mono text-[10.5px] not-italic leading-tight text-gallery-muted';
export const presetClaimClass = 'min-w-0 break-words text-[12.5px] not-italic leading-snug text-gallery-soft';

export const authorityCellClass = 'grid min-w-0 gap-1 border-b border-r border-gallery-line p-2.5 even:border-r-0 max-[1119px]:border-r-0';
export const authorityLabelClass = 'font-mono text-[9.5px] font-extrabold uppercase leading-none tracking-normal text-gallery-muted';
export const authorityValueClass = 'min-w-0 break-words font-mono text-[11.5px] font-bold leading-tight text-gallery-ink';
export const notesKickerClass = 'font-mono text-[10px] font-extrabold uppercase leading-none tracking-normal text-gallery-muted';
export const notesListClass = 'm-0 grid gap-1.5 pl-4';

export function inspectorTabClass(active: boolean): string {
  return cx(
    'min-w-0 cursor-pointer rounded-[6px] border-r border-gallery-line bg-transparent px-1.5 py-2.5 font-mono text-[10px] font-extrabold uppercase leading-none tracking-normal text-gallery-muted last:border-r-0',
    focusRingClass,
    active && 'bg-gallery-accent text-black',
    !active && 'hover:bg-gallery-accent hover:text-black',
  );
}

export function inspectorPanelClass(active: boolean): string {
  return cx('min-w-0 gap-3', active && 'grid');
}

export const contractRowClass = 'grid min-w-0 grid-cols-[86px_minmax(0,1fr)] gap-2.5 border-b border-gallery-line py-[11px]';
export const contractLabelClass = 'text-xs leading-tight text-gallery-muted';
export const contractValueClass = 'min-w-0 break-words font-mono text-xs font-semibold leading-snug text-gallery-ink';

export const eventRowClass = 'min-w-0 break-words bg-transparent px-2.5 py-2 font-mono text-xs leading-snug text-gallery-muted';

export const approvalStackClass = 'fixed bottom-5 right-5 z-[90] grid w-[min(360px,calc(100vw-32px))] gap-2.5';
export const approvalCardClass = 'grid gap-2 rounded-[8px] border border-gallery-line-strong bg-gallery-panel p-3.5 text-gallery-ink';
export const approvalEyebrowClass = labelClass;
export const approvalTitleClass = 'text-[15px] font-bold leading-tight text-gallery-ink';
export const approvalMetaClass = 'm-0 text-xs text-gallery-muted';
export const approvalDetailsClass = 'm-0 max-h-[120px] overflow-auto rounded-[6px] border border-gallery-line bg-gallery-panel-muted p-2 font-mono text-[11px] leading-normal text-gallery-soft whitespace-pre-wrap';
export const approvalActionsClass = 'flex justify-end gap-2';

export function approvalButtonClass(kind: 'approve' | 'deny'): string {
  return cx(
    'h-8 min-w-[76px] cursor-pointer rounded-[6px] border px-3 text-sm font-extrabold',
    focusRingClass,
    kind === 'approve'
      ? 'border-gallery-success bg-gallery-success text-black hover:opacity-90'
      : 'border-gallery-line-strong bg-gallery-panel text-gallery-ink hover:border-gallery-accent',
  );
}

export const hostMetricClass = 'grid h-full content-between rounded-[6px] border p-3.5 font-sans text-[#111827]';
export const hostMetricLabelClass = 'text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#4b5563]';
export const hostMetricValueClass = 'text-[32px] font-bold leading-none';
export const hostMetricDeltaClass = 'text-[13px] font-extrabold not-italic';

export const hostTrendClass = 'h-full rounded-[6px] border border-gallery-line bg-gallery-panel p-3.5 font-sans text-gallery-ink';
export const hostTrendHeaderClass = 'flex justify-between gap-3';
export const hostTrendMetaClass = 'text-xs text-gallery-muted';
export const hostTrendSvgClass = 'mt-1 block h-[72px] w-full';
export const hostTrendCaptionClass = 'm-0 text-xs text-gallery-muted';

export const hostApprovalClass = 'grid h-full content-start gap-2 rounded-[6px] border p-3.5 font-sans text-[#111827]';
export const hostApprovalBadgeClass = 'w-max rounded-none px-2 py-[3px] text-[11px] font-extrabold uppercase text-white';
export const hostApprovalTitleClass = 'text-[17px] font-bold leading-tight';
export const hostApprovalDetailClass = 'm-0 text-xs text-[#4b5563]';
