import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../lib/cn.js';
import { elevatedPanelClass, panelHeaderClass, pageWidthClass, StatusText } from './ui.js';

export interface AppNavProps {
  active?: 'generate' | 'batch';
}

const navItems = [
  { id: 'generate', label: 'Generate', href: '/generate' },
  { id: 'batch', label: 'Batch', href: '/batch' },
] as const;

const navItemBaseClass =
  'inline-flex h-[30px] items-center rounded-card border border-transparent px-3 text-xs font-semibold transition-colors';

export function AppNav({ active }: AppNavProps) {
  return (
    <nav className={cn(pageWidthClass, 'mb-11 flex min-h-[30px] flex-wrap items-center gap-1 max-[820px]:mb-[30px]')}>
      <NavLink
        className="mr-0.5 inline-flex h-[30px] items-center rounded-card px-0 pr-3.5 text-[15px] font-bold text-ink transition-opacity hover:opacity-60"
        to="/"
      >
        summon
      </NavLink>
      {navItems.map((item) => (
        <NavLink
          key={item.id}
          className={({ isActive }) => {
            const selected = active === item.id || isActive;
            return cn(
              navItemBaseClass,
              selected
                ? 'bg-ink text-ink-inverse hover:bg-ink hover:text-ink-inverse'
                : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
            );
          }}
          to={item.href}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export interface PageHeaderProps {
  title: string;
  lede?: ReactNode;
  className?: string;
  aside?: ReactNode;
}

export function PageHeader({ title, lede, className, aside }: PageHeaderProps) {
  return (
    <header className={cn(pageWidthClass, 'mb-11 flex min-h-0 items-start justify-between gap-5 max-[820px]:mb-[30px] max-[820px]:block', className)}>
      <div className="min-w-0">
        <h1 className="m-0 mb-2.5 text-[72px] font-bold leading-[0.92] tracking-normal text-ink max-[820px]:text-[54px]">{title}</h1>
        {lede ? <p className="m-0 max-w-[58ch] text-[15px] leading-[1.55] text-ink-soft">{lede}</p> : null}
      </div>
      {aside}
    </header>
  );
}

export interface PaneProps {
  title: string;
  status?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Pane({ title, status, children, className }: PaneProps) {
  return (
    <div className={cn(elevatedPanelClass, 'flex min-w-0 flex-col', className)}>
      <header className={panelHeaderClass}>
        {title}
        {status ? <StatusText>{status}</StatusText> : null}
      </header>
      {children}
    </div>
  );
}

export function LogView({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children?: ReactNode;
}) {
  return <div id={id} className={cn('overflow-auto px-[18px] py-3.5 font-mono text-xs leading-[1.7] text-ink-soft', className)}>{children}</div>;
}

export function StatusPill({ id, children }: { id?: string; children: ReactNode }) {
  return <StatusText id={id}>{children}</StatusText>;
}

export function ModeGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      className="inline-flex rounded-full border border-line bg-surface p-[3px] [&_input]:sr-only [&_label]:cursor-pointer [&_span]:block [&_span]:rounded-full [&_span]:px-3 [&_span]:py-1 [&_span]:text-xs [&_span]:font-medium [&_span]:text-ink-soft [&_span]:transition-colors [&_label:hover_span]:text-ink [&_input:checked+span]:bg-ink [&_input:checked+span]:font-semibold [&_input:checked+span]:text-ink-inverse"
      title={title}
    >
      {children}
    </div>
  );
}
