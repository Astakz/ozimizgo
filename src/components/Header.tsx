import { useState } from 'react';
import { Scale, Shield, LogOut, Settings, FileStack, UserCircle, FilePlus, Menu, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  const { t } = useTranslation();
  const { user, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const navItems = [
    { to: '/', label: t('nav.objection'), icon: FilePlus },
    { to: '/ai-lawyer', label: t('nav.aiLawyer'), icon: Sparkles },
    { to: '/profile', label: t('nav.profile'), icon: UserCircle },
    { to: '/history', label: t('nav.history'), icon: FileStack },
  ];

  return (
    <header className="navy-gradient text-primary-foreground py-4 md:py-6 shadow-elevated">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-1 md:gap-2 shrink-0">
              <Scale className="h-6 w-6 md:h-8 md:w-8 text-gold" />
              <Shield className="h-5 w-5 md:h-6 md:w-6 text-gold-light hidden sm:block" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight leading-tight">
                {t('header.title')}
              </h1>
              <p className="text-xs sm:text-sm text-gold-light mt-0.5 hidden sm:block">
                {t('header.subtitle')}
              </p>
            </div>
          </div>

          {user && (
            <>
              {/* Desktop nav */}
              <nav className="hidden md:flex items-center gap-2">
                {navItems.map(item => (
                  <Button
                    key={item.to}
                    asChild
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "text-primary-foreground hover:bg-primary-foreground/10",
                      location.pathname === item.to && "bg-primary-foreground/15"
                    )}
                  >
                    <Link to={item.to}>
                      <item.icon className="w-4 h-4 mr-1" /> {item.label}
                    </Link>
                  </Button>
                ))}
                {isAdmin && (
                  <Button asChild variant="ghost" size="sm" className={cn("text-primary-foreground hover:bg-primary-foreground/10", location.pathname === '/admin' && "bg-primary-foreground/15")}>
                    <Link to="/admin"><Settings className="w-4 h-4 mr-1" /> {t('nav.admin')}</Link>
                  </Button>
                )}
                <LanguageSwitcher variant="header" />
                <ThemeToggle variant="header" />
                <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={signOut}>
                  <LogOut className="w-4 h-4 mr-1" /> {t('nav.logout')}
                </Button>
              </nav>

              {/* Mobile hamburger */}
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden text-primary-foreground hover:bg-primary-foreground/10">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px] bg-background">
                  <SheetHeader>
                    <SheetTitle className="text-left">{t('nav.menu')}</SheetTitle>
                  </SheetHeader>
                  <nav className="flex flex-col gap-1 mt-6">
                    {navItems.map(item => (
                      <Button
                        key={item.to}
                        asChild
                        variant={location.pathname === item.to ? 'secondary' : 'ghost'}
                        className="justify-start w-full h-12"
                        onClick={() => setOpen(false)}
                      >
                        <Link to={item.to}>
                          <item.icon className="w-5 h-5 mr-3" /> {item.label}
                        </Link>
                      </Button>
                    ))}
                    {isAdmin && (
                      <Button
                        asChild
                        variant={location.pathname === '/admin' ? 'secondary' : 'ghost'}
                        className="justify-start w-full h-12"
                        onClick={() => setOpen(false)}
                      >
                        <Link to="/admin"><Settings className="w-5 h-5 mr-3" /> {t('nav.admin')}</Link>
                      </Button>
                    )}
                    <div className="border-t my-3" />
                    <LanguageSwitcher variant="mobile" />
                    <ThemeToggle variant="mobile" />
                    <div className="border-t my-3" />
                    <Button
                      variant="ghost"
                      className="justify-start w-full h-12 text-destructive hover:text-destructive"
                      onClick={() => { setOpen(false); signOut(); }}
                    >
                      <LogOut className="w-5 h-5 mr-3" /> {t('nav.logout')}
                    </Button>
                  </nav>
                </SheetContent>
              </Sheet>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
