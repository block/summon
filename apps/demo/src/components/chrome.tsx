import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

export interface AppNavProps {
  active?: 'generate' | 'batch' | 'fragment-compare';
}

const navItems = [
  { id: 'generate', label: 'Generate', href: '/generate' },
  { id: 'batch', label: 'Batch', href: '/batch' },
  { id: 'fragment-compare', label: 'Fragment compare', href: '/fragment-compare' },
] as const;

export function AppNav({ active }: AppNavProps) {
  return (
    <nav className="summon-nav">
      <NavLink className="summon-brand" to="/">summon</NavLink>
      {navItems.map((item) => (
        <NavLink
          key={item.id}
          className={({ isActive }) => (active === item.id || isActive ? 'active' : undefined)}
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
    <header className={['dev-header', className].filter(Boolean).join(' ')}>
      <div>
        <h1 className="page-title">{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
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
    <div className={['pane', className].filter(Boolean).join(' ')}>
      <header>
        {title}
        {status ? <span className="status">{status}</span> : null}
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
  return <div id={id} className={['log', className].filter(Boolean).join(' ')}>{children}</div>;
}

export function StatusPill({ id, children }: { id?: string; children: ReactNode }) {
  return <span id={id} className="status">{children}</span>;
}

export function ModeGroup({ title, children }: { title: string; children: ReactNode }) {
  return <div className="mode-group" title={title}>{children}</div>;
}
