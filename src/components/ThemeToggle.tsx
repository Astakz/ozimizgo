import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const STORAGE_KEY = 'theme';

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
}

interface ThemeToggleProps {
  variant?: 'header' | 'mobile';
}

export function ThemeToggle({ variant = 'header' }: ThemeToggleProps) {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  const isDark = theme === 'dark';

  if (variant === 'mobile') {
    return (
      <Button
        variant="ghost"
        className="justify-start w-full h-12"
        onClick={toggle}
      >
        {isDark ? <Sun className="w-5 h-5 mr-3" /> : <Moon className="w-5 h-5 mr-3" />}
        {isDark ? t('theme.light') : t('theme.dark')}
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-primary-foreground hover:bg-primary-foreground/10"
      onClick={toggle}
      aria-label={isDark ? t('theme.light') : t('theme.dark')}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
