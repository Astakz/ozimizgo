import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

type LangCode = 'kk' | 'ru' | 'en';

const LANGUAGES: { code: LangCode; label: string; native: string; flag: string }[] = [
  { code: 'kk', label: 'Kazakh', native: 'Қазақша', flag: '🇰🇿' },
  { code: 'ru', label: 'Russian', native: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', native: 'English', flag: '🇺🇸' },
];

const STORAGE_KEY = 'i18nextLng';

function normalize(code?: string | null): LangCode {
  if (!code) return 'ru';
  const base = code.toLowerCase().split('-')[0];
  if (base === 'kk' || base === 'kz') return 'kk';
  if (base === 'en') return 'en';
  if (base === 'ru') return 'ru';
  return 'ru';
}

interface Props {
  variant?: 'header' | 'mobile';
}

export function LanguageSwitcher({ variant = 'header' }: Props) {
  const { i18n, t } = useTranslation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const current = LANGUAGES.find(l => l.code === normalize(i18n.language)) ?? LANGUAGES[1];

  // First-visit auto-detect + hydrate from profile when signed in
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        const detected = normalize(navigator.language);
        await i18n.changeLanguage(detected);
        localStorage.setItem(STORAGE_KEY, detected);
      }
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('language')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!cancelled && data?.language) {
          const lang = normalize(data.language);
          if (lang !== normalize(i18n.language)) {
            await i18n.changeLanguage(lang);
            localStorage.setItem(STORAGE_KEY, lang);
          }
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const change = async (code: LangCode) => {
    await i18n.changeLanguage(code);
    localStorage.setItem(STORAGE_KEY, code);
    document.documentElement.lang = code;
    setOpen(false);
    if (user) {
      supabase.from('profiles').update({ language: code }).eq('user_id', user.id).then(() => {});
    }
  };

  const OptionsList = (
    <div className="flex flex-col gap-1">
      {LANGUAGES.map(lang => {
        const active = lang.code === current.code;
        return (
          <button
            key={lang.code}
            onClick={() => change(lang.code)}
            className={cn(
              'flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl text-left transition-all duration-200',
              'hover:bg-accent active:scale-[0.98]',
              active && 'bg-accent'
            )}
          >
            <span className="text-2xl leading-none">{lang.flag}</span>
            <div className="flex-1 min-w-0">
              <div className={cn('font-medium text-base', active && 'text-primary')}>
                {lang.native}
              </div>
              <div className="text-xs text-muted-foreground">{lang.label}</div>
            </div>
            {active && <Check className="w-5 h-5 text-primary shrink-0" />}
          </button>
        );
      })}
    </div>
  );

  // Mobile in-sheet variant (inside hamburger menu) — inline list
  if (variant === 'mobile') {
    return (
      <div className="px-1 py-2">
        <div className="flex items-center gap-2 px-3 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <Globe className="w-3.5 h-3.5" />
          {t('language.title', 'Язык')}
        </div>
        {OptionsList}
      </div>
    );
  }

  // Header trigger button (unified)
  const Trigger = (
    <Button
      variant="ghost"
      size="sm"
      className="text-primary-foreground hover:bg-primary-foreground/10 gap-1.5 rounded-full h-9 px-3"
    >
      <Globe className="w-4 h-4" />
      <span className="text-xs font-medium hidden sm:inline">{current.native}</span>
      <span className="text-base sm:hidden leading-none">{current.flag}</span>
      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
    </Button>
  );

  // Mobile → Bottom Sheet
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{Trigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-t p-6 pb-8 max-h-[80vh]"
        >
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <Globe className="w-5 h-5" />
              {t('language.title', 'Язык')}
            </SheetTitle>
          </SheetHeader>
          {OptionsList}
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop / tablet → Dropdown
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{Trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-64 p-2 rounded-2xl shadow-xl border animate-scale-in"
      >
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <Globe className="w-3.5 h-3.5" />
          {t('language.title', 'Язык')}
        </div>
        {LANGUAGES.map(lang => {
          const active = lang.code === current.code;
          return (
            <DropdownMenuItem
              key={lang.code}
              onSelect={(e) => { e.preventDefault(); change(lang.code); }}
              className={cn(
                'flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer focus:bg-accent',
                active && 'bg-accent'
              )}
            >
              <span className="text-xl leading-none">{lang.flag}</span>
              <div className="flex-1 min-w-0">
                <div className={cn('font-medium text-sm', active && 'text-primary')}>
                  {lang.native}
                </div>
                <div className="text-[11px] text-muted-foreground">{lang.label}</div>
              </div>
              {active && <Check className="w-4 h-4 text-primary shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
