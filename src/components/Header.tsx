import { Scale, Shield } from 'lucide-react';

export function Header() {
  return (
    <header className="navy-gradient text-primary-foreground py-6 shadow-elevated">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <Scale className="h-8 w-8 text-gold" />
            <Shield className="h-6 w-6 text-gold-light" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Возражение на исполнительную надпись
            </h1>
            <p className="text-sm md:text-base text-gold-light mt-1">
              Автоматическое формирование документа по законодательству РК
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
