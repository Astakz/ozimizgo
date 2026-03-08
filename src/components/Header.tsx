import { Scale, Shield, LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export function Header() {
  const { user, isAdmin, signOut } = useAuth();

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
                Возражение на исполнительную надпись
              </h1>
              <p className="text-xs sm:text-sm text-gold-light mt-0.5 hidden sm:block">
                Автоматическое формирование документа по законодательству РК
              </p>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button asChild variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
                  <Link to="/admin"><Settings className="w-4 h-4 mr-1" /> Админ</Link>
                </Button>
              )}
              <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={signOut}>
                <LogOut className="w-4 h-4 mr-1" /> Выйти
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
