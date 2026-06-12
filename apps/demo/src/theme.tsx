import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { cn } from './lib/cn.js';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const storageKey = 'summon.dev.theme';
const darkModeQuery = '(prefers-color-scheme: dark)';
const themePreferences: ThemePreference[] = ['light', 'dark', 'system'];

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function getStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = window.localStorage.getItem(storageKey);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia(darkModeQuery).matches ? 'dark' : 'light';
}

function resolveTheme(preference: ThemePreference, systemTheme: ResolvedTheme): ResolvedTheme {
  return preference === 'system' ? systemTheme : preference;
}

function themeLabel(theme: ThemePreference, resolvedTheme: ResolvedTheme): string {
  if (theme === 'system') return `System theme (${resolvedTheme})`;
  return theme === 'light' ? 'Light theme' : 'Dark theme';
}

function applyTheme(preference: ThemePreference, resolvedTheme: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = preference;
  root.dataset.colorMode = resolvedTheme;
  root.classList.toggle('dark', resolvedTheme === 'dark');
  root.style.colorScheme = resolvedTheme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => getStoredPreference());
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());
  const resolvedTheme = resolveTheme(preference, systemTheme);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    try {
      window.localStorage.setItem(storageKey, nextPreference);
    } catch {
      // Theme choice is still applied for the current tab.
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia(darkModeQuery);
    const onChange = () => setSystemTheme(media.matches ? 'dark' : 'light');
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey || !isThemePreference(event.newValue)) return;
      setPreferenceState(event.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    applyTheme(preference, resolvedTheme);
  }, [preference, resolvedTheme]);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}

function ThemeIcon({ theme }: { theme: ThemePreference }) {
  if (theme === 'light') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2.3M12 19.2v2.3M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.3M19.2 12h2.3M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
      </svg>
    );
  }

  if (theme === 'dark') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.5 14.4A8.5 8.5 0 0 1 9.6 3.5a7 7 0 1 0 10.9 10.9Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="5" width="16" height="12" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

export function ThemeToggle() {
  const { preference, resolvedTheme, setPreference } = useTheme();

  return (
    <div
      className="fixed right-4 top-4 z-50 inline-flex rounded-full border border-line bg-surface-raised p-1 shadow-card max-[820px]:right-3 max-[820px]:top-3"
      role="group"
      aria-label="Theme"
      data-theme-toggle
      data-resolved-theme={resolvedTheme}
    >
      {themePreferences.map((theme) => {
        const active = preference === theme;
        const label = themeLabel(theme, resolvedTheme);
        return (
          <button
            key={theme}
            type="button"
            className={cn(
              'inline-flex size-8 items-center justify-center rounded-full border border-transparent transition-[background-color,border-color,color,opacity] duration-150 focus:outline-none focus:ring-3 focus:ring-[var(--focus-ring)]',
              active
                ? 'bg-ink text-ink-inverse'
                : 'text-ink-soft hover:border-line hover:bg-surface-muted hover:text-ink',
            )}
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={() => setPreference(theme)}
          >
            <ThemeIcon theme={theme} />
          </button>
        );
      })}
    </div>
  );
}
