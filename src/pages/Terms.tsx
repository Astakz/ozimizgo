import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText } from 'lucide-react';

const Terms = () => {
  const { t } = useTranslation();

  const sections = t('terms.sections', { returnObjects: true }) as Array<{
    title: string;
    items: string[];
  }>;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="navy-gradient text-primary-foreground py-4 md:py-6 shadow-elevated">
        <div className="container mx-auto px-4 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
            <Link to="/" aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <FileText className="h-6 w-6 text-gold" />
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight">
            {t('terms.title')}
          </h1>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-3 sm:px-4 py-6 sm:py-10">
        <div className="max-w-3xl mx-auto">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-2xl">{t('terms.title')}</CardTitle>
              <CardDescription>{t('terms.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {sections.map((section, idx) => (
                <section key={idx} className="space-y-2">
                  <h2 className="text-lg font-semibold text-foreground">
                    {idx + 1}. {section.title}
                  </h2>
                  <ul className="space-y-1.5 text-sm sm:text-base text-muted-foreground leading-relaxed">
                    {section.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
              <p className="text-xs text-muted-foreground pt-4 border-t">
                {t('terms.lastUpdated')}: 28.04.2026
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Terms;
