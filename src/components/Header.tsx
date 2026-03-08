import { useState } from 'react';
import { Scale, Shield, LogOut, Settings, FileStack, UserCircle, FileText, Menu, Users, Briefcase, MessageCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { NavLink } from '@/components/NavLink';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { NotificationBell } from '@/components/NotificationBell';

const fullAccessNavItems = [
  { to: '/', label: 'Возражение', icon: FileText },
  { to: '/profile', label: 'Профиль', icon: UserCircle },
  { to: '/history', label: 'История', icon: FileStack },
  { to: '/lawyers', label: 'Юристы', icon: Users },
  { to: '/cases', label: 'Дела', icon: Briefcase },
  { to: '/chat', label: 'Чат', icon: MessageCircle },
];

const limitedNavItems = [
  { to: '/lawyers', label: 'Юристы', icon: Users },
  { to: '/profile', label: 'Профиль', icon: UserCircle },
];

const navLinkClass =
  'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10';
const navLinkActiveClass = 'text-primary-foreground bg-primary-foreground/15';

export function Header() {
  const { user, isAdmin, hasFullAccess, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const navItems = hasFullAccess ? fullAccessNavItems : limitedNavItems;
  const allItems = [
    ...navItems,
    ...(isAdmin ? [{ to: '/admin', label: 'Админ', icon: Settings }] : []),
  ];

  const handleSignOut = () => {
    setOpen(false);
    signOut();
  };

  return (
    <header className="navy-gradient text-primary-foreground shadow-elevated sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2 shrink-0">
            <Scale className="h-6 w-6 text-secondary" />
            <Shield className="h-5 w-5 text-secondary hidden sm:block" />
            <span className="font-serif font-bold text-base md:text-lg tracking-tight leading-tight hidden sm:inline">
              Возражение
            </span>
          </NavLink>

          {/* Desktop nav */}
          {user && !isMobile && (
            <nav className="flex items-center gap-1">
              {allItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={navLinkClass}
                  activeClassName={navLinkActiveClass}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
              <NotificationBell />
              <Button
                variant="ghost"
                size="sm"
                className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 ml-1"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4 mr-1" />
                Выйти
              </Button>
            </nav>
          )}

          {/* Mobile hamburger */}
          {user && isMobile && (
            <div className="flex items-center gap-1">
              <NotificationBell />
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-primary-foreground">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
              <SheetContent side="right" className="w-72 navy-gradient border-border/20">
                <SheetHeader>
                  <SheetTitle className="text-primary-foreground flex items-center gap-2">
                    <Scale className="h-5 w-5 text-secondary" />
                    Меню
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 mt-6">
                  {allItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      className="flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
                      activeClassName={navLinkActiveClass}
                      onClick={() => setOpen(false)}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </NavLink>
                  ))}
                  <div className="border-t border-primary-foreground/10 my-3" />
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-destructive-foreground/70 hover:bg-primary-foreground/10 transition-colors w-full text-left"
                  >
                    <LogOut className="h-5 w-5" />
                    Выйти
                  </button>
                </nav>
              </SheetContent>
            </Sheet>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
