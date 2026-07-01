import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Infinity as InfinityIcon } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { LawyerChat } from '@/components/LawyerChat';

const DEFAULT_DAILY_LIMIT = 5;

const AILawyer = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [usedToday, setUsedToday] = useState(0);
  const [dailyLimit, setDailyLimit] = useState<number>(DEFAULT_DAILY_LIMIT);
  const [unlimited, setUnlimited] = useState(false);
  const [unlimitedUntil, setUnlimitedUntil] = useState<string | null>(null);

  const loadAccess = useCallback(async () => {
    if (!user) return;
    const { data: prof } = await supabase
      .from('profiles')
      .select('ai_daily_limit, ai_unlimited_access, ai_unlimited_expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    const p = prof as { ai_daily_limit?: number; ai_unlimited_access?: boolean; ai_unlimited_expires_at?: string | null } | null;
    const limit = typeof p?.ai_daily_limit === 'number' ? p.ai_daily_limit : DEFAULT_DAILY_LIMIT;
    setDailyLimit(limit);
    const exp = p?.ai_unlimited_expires_at ? new Date(p.ai_unlimited_expires_at) : null;
    const unl = !!p?.ai_unlimited_access && (!exp || exp.getTime() > Date.now());
    setUnlimited(unl);
    setUnlimitedUntil(unl && exp ? exp.toISOString() : null);

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('ai_consultations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', since.toISOString());
    setUsedToday(count ?? 0);
  }, [user]);

  useEffect(() => { loadAccess(); }, [loadAccess]);

  // Live-update when admin changes access
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel('ai-access-' + user.id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${user.id}` }, () => {
        loadAccess();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, loadAccess]);

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
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {unlimited ? (
                <Badge variant="secondary" className="gap-1 bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                  <InfinityIcon className="h-3.5 w-3.5" /> Unlimited Access
                </Badge>
              ) : (
                <Badge variant={dailyLimit - usedToday > 0 ? 'secondary' : 'destructive'}>
                  {t('aiLawyer.usage', { used: usedToday, limit: dailyLimit })}
                </Badge>
              )}
              {unlimited && unlimitedUntil && (
                <Badge variant="outline" className="text-xs">
                  до {new Date(unlimitedUntil).toLocaleString('ru-RU')}
                </Badge>
              )}
            </div>
          </div>

          <LawyerChat
            usedToday={usedToday}
            dailyLimit={dailyLimit}
            unlimited={unlimited}
            onUsageChange={setUsedToday}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AILawyer;
