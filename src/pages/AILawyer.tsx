import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { LawyerChat } from '@/components/LawyerChat';

const DAILY_LIMIT = 5;

const AILawyer = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [usedToday, setUsedToday] = useState(0);

  const loadUsage = async () => {
    if (!user) return;
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('ai_consultations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', since.toISOString());
    setUsedToday(count ?? 0);
  };

  useEffect(() => { loadUsage(); /* eslint-disable-next-line */ }, [user]);

  const remaining = DAILY_LIMIT - usedToday;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-3 sm:px-4 py-6 sm:py-8 md:py-10">
        <div className="max-w-3xl mx-auto space-y-5">
          <div className="text-center space-y-2 animate-fade-in">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gold/15 mb-2">
              <Sparkles className="h-6 w-6 text-gold" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground">{t('aiLawyer.title')}</h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">{t('aiLawyer.subtitle')}</p>
            <Badge variant={remaining > 0 ? 'secondary' : 'destructive'} className="mt-2">
              {t('aiLawyer.usage', { used: usedToday, limit: DAILY_LIMIT })}
            </Badge>
          </div>

          <LawyerChat usedToday={usedToday} onUsageChange={setUsedToday} />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AILawyer;
