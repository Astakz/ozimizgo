import { Scale, AlertCircle } from 'lucide-react';

export function Footer() {
  return (
    <footer className="navy-gradient text-primary-foreground py-4 sm:py-6 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col gap-3 sm:gap-4 md:flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 sm:h-5 sm:w-5 text-gold shrink-0" />
            <span className="text-xs sm:text-sm text-center sm:text-left">Юридический инструмент для граждан РК</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gold-light">
            <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
            <span className="text-center sm:text-left">Ст.92-1 Закона РК «О нотариате»</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
