import type { ReactNode } from 'react';

export interface AppNavProps {
  active?: 'generate' | 'batch' | 'fragment-compare';
}

const navItems = [
  { id: 'generate', label: 'Generate', href: '/generate.html' },
  { id: 'batch', label: 'Batch', href: '/batch.html' },
  { id: 'fragment-compare', label: 'Fragment compare', href: '/fragment-compare.html' },
] as const;

export function AppNav({ active }: AppNavProps) {
  return (
    <nav className="summon-nav">
      <a className="summon-brand" href="/">summon</a>
      {navItems.map((item) => (
        <a key={item.id} className={active === item.id ? 'active' : undefined} href={item.href}>
          {item.label}
        </a>
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

export function LogView({ id, className }: { id: string; className?: string }) {
  return <div id={id} className={['log', className].filter(Boolean).join(' ')} />;
}

export function StatusPill({ id, children }: { id?: string; children: ReactNode }) {
  return <span id={id} className="status">{children}</span>;
}

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export function ToolbarButton({
  id,
  children,
  disabled,
  type = 'button',
}: {
  id?: string;
  children: ReactNode;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return <button id={id} type={type} disabled={disabled}>{children}</button>;
}

export function SandboxFrame({
  id,
  title,
  className,
}: {
  id: string;
  title: string;
  className?: string;
}) {
  return <iframe id={id} className={className} title={title} />;
}

export function ModeGroup({ title, children }: { title: string; children: ReactNode }) {
  return <div className="mode-group" title={title}>{children}</div>;
}
