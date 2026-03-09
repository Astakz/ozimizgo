import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const languages = [
  { code: 'kk', label: 'Қазақша' },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
] as const;

export function LanguageSwitcher({ variant = 'header' }: { variant?: 'header' | 'mobile' }) {
  const { i18n } = useTranslation();
  const current = languages.find(l => l.code === i18n.language) || languages[1];

  if (variant === 'mobile') {
    return (
      <div className="flex gap-1">
        {languages.map(lang => (
          <Button
            key={lang.code}
            variant={i18n.language === lang.code ? 'secondary' : 'ghost'}
            size="sm"
            className="flex-1 text-xs"
            onClick={() => i18n.changeLanguage(lang.code)}
          >
            {lang.label}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10 gap-1.5">
          <Globe className="w-4 h-4" />
          <span className="text-xs">{current.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map(lang => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={i18n.language === lang.code ? 'bg-accent' : ''}
          >
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
