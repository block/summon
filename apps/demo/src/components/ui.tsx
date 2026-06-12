import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export const pageWidthClass = 'mx-auto w-[min(100%,var(--dev-page-width))]';

export const fieldLabelClass =
  'mb-1.5 block text-[11px] font-semibold uppercase tracking-normal text-ink-muted';

export const eyebrowClass =
  'font-mono text-[10px] font-semibold uppercase tracking-normal text-ink-muted';

export const panelClass =
  'overflow-hidden rounded-card border border-line bg-surface shadow-none';

export const elevatedPanelClass = cn(panelClass, 'shadow-card');

export const panelHeaderClass =
  'flex items-center justify-between gap-3 border-b border-line bg-surface-muted px-3.5 py-3 font-mono text-[10px] font-semibold uppercase tracking-normal text-ink-muted';

const controlBaseClass =
  'min-w-0 rounded-control border border-line-input bg-black text-sm text-ink transition-[border-color,box-shadow,background-color,color] duration-150 focus:border-line-strong focus:outline-none focus:ring-3 focus:ring-white/10 disabled:cursor-not-allowed disabled:opacity-45';

export const inputClass = cn(controlBaseClass, 'px-3.5 py-3');
export const compactInputClass = cn(controlBaseClass, 'h-[30px] px-3.5 py-0 text-xs font-medium');
export const textareaClass = cn(controlBaseClass, 'min-h-[88px] resize-y px-3.5 py-3');
export const selectClass = cn(controlBaseClass, 'cursor-pointer appearance-none px-3.5 py-3 pr-8');
export const compactSelectClass = cn(selectClass, 'h-[30px] py-0 text-xs font-medium');

export type ButtonVariant = 'primary' | 'secondary' | 'chip' | 'ghost';
export type ButtonSize = 'default' | 'sm' | 'xs' | 'icon-xs';

const buttonBaseClass =
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold tracking-normal transition-[background-color,border-color,color,opacity,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-40';

export function buttonClass({
  variant = 'primary',
  size = 'default',
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(
    buttonBaseClass,
    variant === 'primary' && 'border border-transparent bg-ink text-black hover:bg-white/85',
    variant === 'secondary' && 'border border-line-input bg-surface text-ink-soft hover:border-line-hover hover:bg-surface-muted hover:text-ink',
    variant === 'chip' && 'border border-transparent bg-surface-muted text-ink hover:border-line-hover hover:bg-surface',
    variant === 'ghost' && 'border border-line-input bg-transparent text-ink-soft hover:border-line-hover hover:bg-surface-muted hover:text-ink',
    size === 'default' && 'h-11 px-6 text-sm',
    size === 'sm' && 'h-9 px-4 text-[13px]',
    size === 'xs' && 'h-7 px-3 text-xs',
    size === 'icon-xs' && 'h-7 w-7 px-0 text-xs',
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button className={buttonClass({ variant, size, className })} {...props} />;
}

export function FieldLabel({ className, ...props }: ComponentProps<'span'>) {
  return <span className={cn(fieldLabelClass, className)} {...props} />;
}

export function StatusText({ className, children, ...props }: ComponentProps<'span'>) {
  return (
    <span className={cn('font-mono text-[11px] font-medium normal-case tracking-normal text-ink-muted', className)} {...props}>
      {children}
    </span>
  );
}

export function modeOptionClass(active: boolean): string {
  return cn(
    'rounded-full px-3 py-1 text-xs font-medium text-ink-soft transition-colors duration-150 hover:text-ink',
    active && 'bg-ink font-semibold text-black hover:text-black',
  );
}

export function logToneClass(tone?: string): string {
  const tones = new Set((tone ?? '').split(/\s+/).filter(Boolean));
  return cn(
    tones.has('pass') || tones.has('op-add') ? 'font-semibold text-good' : null,
    tones.has('fail') || tones.has('op-error') ? 'font-semibold text-danger' : null,
    tones.has('op-set') ? 'text-info' : null,
    tones.has('op-meta') ? 'text-ink-muted' : null,
    tones.has('raw') ? 'text-line-hover' : null,
    tones.has('info') || tones.size === 0 ? 'text-ink-soft' : null,
  );
}

export function statusToneClass(status?: string): string {
  if (!status) return 'text-ink-muted';
  if (status === 'streaming') return 'font-semibold text-info';
  if (status === 'done' || status.startsWith('done')) return 'font-semibold text-good';
  if (status === 'error' || status.startsWith('error') || status === 'aborted') return 'font-semibold text-danger';
  return 'text-ink-muted';
}

export function devtoolsEventKindClass(kind: string): string {
  if (kind === 'sandbox-spawned' || kind === 'sandbox-ready') return 'text-good';
  if (kind === 'sandbox-fatal' || kind === 'sandbox-disposed' || kind === 'intent-rejected' || kind === 'protocol-parse-error') {
    return 'text-danger';
  }
  if (kind === 'intent-emitted' || kind === 'intent-dispatched' || kind === 'state-pushed') return 'text-info';
  if (kind === 'intent-settled') return 'text-ink-soft';
  return 'text-ink-muted';
}

export function DetailsShell({ className, children, ...props }: ComponentProps<'div'> & { children: ReactNode }) {
  return (
    <div className={cn('rounded-card border border-line bg-surface', className)} {...props}>
      {children}
    </div>
  );
}
