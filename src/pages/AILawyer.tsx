import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Upload, Loader2, X, FileText } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { extractTextFromPDF } from '@/utils/pdfParser';
import { extractTextFromImage } from '@/utils/imageOcr';
import { DocumentGenerator } from '@/components/DocumentGenerator';
import { LawyerChat } from '@/components/LawyerChat';

const DAILY_LIMIT = 5;

function isImage(file: File) {
  return /^image\//.test(file.type) || /\.(jpe?g|png)$/i.test(file.name);
}

interface Consultation {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

const AILawyer = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [documentText, setDocumentText] = useState('');
  const [question, setQuestion] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [usedToday, setUsedToday] = useState(0);
  const [history, setHistory] = useState<Consultation[]>([]);

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

    const { data } = await supabase
      .from('ai_consultations')
      .select('id, question, answer, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);
    setHistory((data as Consultation[]) ?? []);
  };

  useEffect(() => { loadUsage(); }, [user]);

  const handleFile = async (f: File) => {
    setFile(f);
    setIsExtracting(true);
    setDocumentText('');
    try {
      const text = isImage(f) ? await extractTextFromImage(f) : await extractTextFromPDF(f);
      setDocumentText(text);
      toast.success(t('common.success'));
    } catch (e) {
      console.error(e);
      toast.error(t('common.error'));
      setFile(null);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmit = async () => {
    if (!documentText.trim() && !question.trim()) {
      toast.error(t('aiLawyer.empty'));
      return;
    }
    if (usedToday >= DAILY_LIMIT) {
      toast.error(t('aiLawyer.limitReached'));
      return;
    }
    setIsLoading(true);
    setAnswer(null);
    try {
      const { data, error } = await supabase.functions.invoke('ai-lawyer', {
        body: { documentText, question, language: i18n.language },
      });
      if (error) {
        const ctx: any = (error as any).context;
        if (ctx?.status === 429) {
          toast.error(t('aiLawyer.limitReached'));
        } else {
          toast.error(t('common.error'));
        }
        return;
      }
      setAnswer(data.answer);
      setUsedToday(data.used);
      loadUsage();
    } catch (e) {
      console.error(e);
      toast.error(t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setDocumentText('');
  };

  const remaining = DAILY_LIMIT - usedToday;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-3 sm:px-4 py-6 sm:py-8 md:py-12">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-2 animate-fade-in">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gold/15 mb-2">
              <Sparkles className="h-6 w-6 text-gold" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground">{t('aiLawyer.title')}</h1>
            <p className="text-sm sm:text-base text-muted-foreground">{t('aiLawyer.subtitle')}</p>
            <Badge variant={remaining > 0 ? 'secondary' : 'destructive'} className="mt-2">
              {t('aiLawyer.usage', { used: usedToday, limit: DAILY_LIMIT })}
            </Badge>
          </div>

          <LawyerChat />

          <Card className="shadow-elevated animate-fade-in">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">{t('aiLawyer.questionLabel')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="ai-file" className="text-sm text-muted-foreground mb-2 block">
                  {t('aiLawyer.uploadHint')}
                </Label>
                {!file ? (
                  <div className="relative">
                    <Input
                      id="ai-file"
                      type="file"
                      accept=".pdf,image/jpeg,image/jpg,image/png"
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                      disabled={isExtracting || isLoading}
                      className="cursor-pointer"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/40">
                    <FileText className="h-4 w-4 text-gold shrink-0" />
                    <span className="text-sm truncate flex-1">{file.name}</span>
                    {isExtracting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Button size="icon" variant="ghost" onClick={clearFile} className="h-7 w-7">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
                {isExtracting && (
                  <p className="text-xs text-muted-foreground mt-1">{t('aiLawyer.extracting')}</p>
                )}
              </div>

              <div>
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={t('aiLawyer.questionPlaceholder')}
                  rows={4}
                  disabled={isLoading}
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={isLoading || isExtracting || remaining <= 0}
                className="w-full gold-button"
                size="lg"
              >
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('aiLawyer.analyzing')}</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" /> {t('aiLawyer.submit')}</>
                )}
              </Button>

              <p className="text-xs text-muted-foreground italic text-center">
                {t('aiLawyer.disclaimer')}
              </p>
            </CardContent>
          </Card>

          {answer && (
            <Card className="shadow-elevated animate-fade-in">
              <CardHeader className="navy-gradient text-primary-foreground">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Sparkles className="h-5 w-5 text-gold" />
                  {t('aiLawyer.answer')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{answer}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}

          <DocumentGenerator onGenerated={loadUsage} />

          {history.length > 0 && (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle className="text-base">{t('aiLawyer.history')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {history.map((h) => (
                  <details key={h.id} className="border rounded-md p-3 group">
                    <summary className="cursor-pointer text-sm font-medium truncate">
                      {h.question}
                    </summary>
                    <div className="prose prose-sm dark:prose-invert max-w-none mt-3 pt-3 border-t">
                      <ReactMarkdown>{h.answer}</ReactMarkdown>
                    </div>
                  </details>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AILawyer;
