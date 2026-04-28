import { Scale, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="navy-gradient text-primary-foreground py-4 sm:py-6 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col gap-3 sm:gap-4 md:flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 sm:h-5 sm:w-5 text-gold shrink-0" />
            <span className="text-xs sm:text-sm text-center sm:text-left">{t('footer.legal')}</span>
          </div>
          <Link
            to="/terms"
            className="text-xs sm:text-sm text-gold-light hover:text-gold underline-offset-4 hover:underline transition-colors"
          >
            {t('terms.link')}
          </Link>
          <div className="flex items-center gap-2 text-xs text-gold-light">
            <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
            <span className="text-center sm:text-left">{t('footer.law')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
