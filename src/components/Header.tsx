import { Scale, Shield } from 'lucide-react';

export function Header() {
  return (
    <header className="navy-gradient text-primary-foreground py-4 md:py-6 shadow-elevated">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-2 md:gap-4">
          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            <Scale className="h-6 w-6 md:h-8 md:w-8 text-gold" />
            <Shield className="h-5 w-5 md:h-6 md:w-6 text-gold-light hidden sm:block" />
          </div>
          <div className="text-center">
            <h1 className="text-lg sm:text-xl md:text-3xl font-bold tracking-tight leading-tight">
              Возражение на исполнительную надпись
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-gold-light mt-0.5 md:mt-1">
              Автоматическое формирование документа по законодательству РК
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
