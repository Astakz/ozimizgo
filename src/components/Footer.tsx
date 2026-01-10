import { Scale, AlertCircle } from 'lucide-react';

export function Footer() {
  return (
    <footer className="navy-gradient text-primary-foreground py-6 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-gold" />
            <span className="text-sm">Юридический инструмент для граждан РК</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gold-light">
            <AlertCircle className="h-4 w-4" />
            <span>Документ формируется на основании ст.92-1 Закона РК «О нотариате»</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
