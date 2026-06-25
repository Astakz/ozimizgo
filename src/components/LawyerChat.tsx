import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Loader2, Send, Download, FileText, RotateCcw, User as UserIcon, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SignaturePad } from '@/components/SignaturePad';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const DAILY_LIMIT = 5;

type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string };

const DOC_START = '===DOCUMENT_START===';
const DOC_END = '===DOCUMENT_END===';

function extractDocument(text: string): { before: string; doc: string | null; after: string } {
  const i = text.indexOf(DOC_START);
  const j = text.indexOf(DOC_END);
  if (i === -1 || j === -1 || j < i) return { before: text, doc: null, after: '' };
  return {
    before: text.slice(0, i).trim(),
    doc: text.slice(i + DOC_START.length, j).trim(),
    after: text.slice(j + DOC_END.length).trim(),
  };
}

interface SigState { x: number; y: number; dragging: boolean; offsetX: number; offsetY: number }

function DocumentPreview({ text, language }: { text: string; language: string }) {
  const { t } = useTranslation();
  const [signature, setSignature] = useState<string | null>(null);
  const [sig, setSig] = useState<SigState>({ x: 60, y: 0, dragging: false, offsetX: 0, offsetY: 0 });
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sheetH, setSheetH] = useState(0);

  useEffect(() => {
    if (!sheetRef.current) return;
    const ro = new ResizeObserver(() => {
      if (sheetRef.current) setSheetH(sheetRef.current.clientHeight);
    });
    ro.observe(sheetRef.current);
    setSheetH(sheetRef.current.clientHeight);
    return () => ro.disconnect();
  }, [text]);

  // Initial signature position: lower part of doc
  useEffect(() => {
    if (signature && sheetH > 0 && sig.y === 0) {
      setSig((s) => ({ ...s, y: Math.max(0, sheetH - 140) }));
    }
  }, [signature, sheetH, sig.y]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!sheetRef.current || !signature) return;
    const rect = sheetRef.current.getBoundingClientRect();
    setSig((s) => ({
      ...s,
      dragging: true,
      offsetX: e.clientX - rect.left - s.x,
      offsetY: e.clientY - rect.top - s.y,
    }));
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!sig.dragging || !sheetRef.current) return;
    const rect = sheetRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width - 180, e.clientX - rect.left - sig.offsetX));
    const y = Math.max(0, Math.min(rect.height - 60, e.clientY - rect.top - sig.offsetY));
    setSig((s) => ({ ...s, x, y }));
  };
  const onPointerUp = () => setSig((s) => ({ ...s, dragging: false }));

  const downloadPDF = async () => {
    if (!sheetRef.current) return;
    try {
      const canvas = await html2canvas(sheetRef.current, {
        scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
      });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = 210, pageH = 297;
      const imgW = pageW;
      const imgH = (canvas.height * pageW) / canvas.width;
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      if (imgH <= pageH) {
        pdf.addImage(imgData, 'JPEG', 0, 0, imgW, imgH);
      } else {
        let left = imgH; let pos = 0; let page = 0;
        while (left > 0) {
          if (page > 0) pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, pos, imgW, imgH);
          left -= pageH; pos -= pageH; page++;
        }
      }
      pdf.save(`document-${Date.now()}.pdf`);
      toast.success(t('common.success'));
    } catch (e) {
      console.error(e);
      toast.error(t('common.error'));
    }
  };

  const downloadDOC = () => {
    const sigImg = signature
      ? `<div style="position:absolute;left:${sig.x}px;top:${sig.y}px;"><img src="${signature}" style="max-height:60px;"/></div>`
      : '';
    const escaped = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Document</title>
<style>body{font-family:'Times New Roman',serif;font-size:14pt;line-height:1.8;padding:2cm;position:relative;}pre{white-space:pre-wrap;font-family:inherit;margin:0;}</style>
</head><body><div style="position:relative;">${sigImg}<pre>${escaped}</pre></div></body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `document-${Date.now()}.doc`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(t('common.success'));
  };

  return (
    <Card className="border-gold/40 shadow-elevated">
      <CardContent className="p-3 sm:p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-gold" />
            <span className="font-semibold">{t('lawyerChat.readyDoc')}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={downloadDOC}>
              <Download className="h-4 w-4 mr-1" /> DOC
            </Button>
            <Button size="sm" className="gold-button" onClick={downloadPDF}>
              <Download className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t('lawyerChat.sigHint')}</p>
          <SignaturePad onSignatureChange={(s) => { setSignature(s); if (!s) setSig((st) => ({ ...st, y: 0 })); }} />
        </div>

        <div className="overflow-auto bg-muted/30 rounded-md p-2">
          <div
            ref={sheetRef}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="relative bg-white text-black mx-auto"
            style={{
              width: 'min(100%, 794px)',
              minHeight: '600px',
              padding: '40px 56px',
              fontFamily: '"Times New Roman", Times, serif',
              fontSize: '14pt',
              lineHeight: 1.8,
              whiteSpace: 'pre-wrap',
              boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            }}
          >
            {text}
            {signature && (
              <img
                src={signature}
                alt="signature"
                onPointerDown={onPointerDown}
                draggable={false}
                style={{
                  position: 'absolute',
                  left: sig.x,
                  top: sig.y,
                  maxHeight: 60,
                  cursor: sig.dragging ? 'grabbing' : 'grab',
                  touchAction: 'none',
                  userSelect: 'none',
                }}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function LawyerChat() {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [usedToday, setUsedToday] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const greetings: Record<string, string> = {
    kk: 'Сәлеметсіз бе! Мен — сіздің AI-заңгеріңізбін. Қандай заңдық мәселе бойынша көмек қажет? Қысқаша өз жағдайыңызды баяндап жіберіңізші.',
    ru: 'Здравствуйте! Я — ваш AI-юрист. По какому правовому вопросу вам нужна помощь? Опишите, пожалуйста, кратко свою ситуацию.',
    en: "Hello! I'm your AI lawyer. What legal matter can I help you with? Please briefly describe your situation.",
  };

  useEffect(() => {
    setMessages([{ id: 'sys-greet', role: 'assistant', content: greetings[i18n.language] ?? greetings.kk }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (usedToday >= DAILY_LIMIT) {
      toast.error(t('aiLawyer.limitReached'));
      return;
    }
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const payload = next
        .filter((m) => m.id !== 'sys-greet')
        .map((m) => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke('ai-lawyer', {
        body: { mode: 'chat', messages: payload, language: i18n.language },
      });
      if (error) {
        const ctx: any = (error as any).context;
        if (ctx?.status === 429) toast.error(t('aiLawyer.limitReached'));
        else toast.error(t('common.error'));
        return;
      }
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', content: data.answer ?? '' }]);
      if (typeof data.used === 'number') setUsedToday(data.used);
    } catch (e) {
      console.error(e);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, usedToday, i18n.language, t]);

  const reset = () => {
    setMessages([{ id: 'sys-greet', role: 'assistant', content: greetings[i18n.language] ?? greetings.kk }]);
    setInput('');
  };

  const remaining = DAILY_LIMIT - usedToday;

  return (
    <Card className="shadow-elevated overflow-hidden">
      <div className="navy-gradient text-primary-foreground p-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gold" />
          <span className="font-semibold">{t('lawyerChat.title')}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={remaining > 0 ? 'secondary' : 'destructive'}>
            {t('aiLawyer.usage', { used: usedToday, limit: DAILY_LIMIT })}
          </Badge>
          <Button size="icon" variant="ghost" onClick={reset} className="text-primary-foreground hover:bg-white/10 h-8 w-8" title={t('lawyerChat.reset')}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="max-h-[60vh] overflow-y-auto p-3 sm:p-4 space-y-4 bg-muted/20">
        {messages.map((m) => {
          const { before, doc, after } = m.role === 'assistant'
            ? extractDocument(m.content)
            : { before: m.content, doc: null, after: '' };
          const isUser = m.role === 'user';
          return (
            <div key={m.id} className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
              <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${isUser ? 'bg-primary text-primary-foreground' : 'bg-gold/20 text-gold'}`}>
                {isUser ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div className={`flex-1 max-w-[85%] ${isUser ? 'flex flex-col items-end' : ''}`}>
                {before && (
                  <div className={`px-3 py-2 rounded-2xl whitespace-pre-wrap text-sm sm:text-base ${isUser ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-card border rounded-tl-sm'}`}>
                    {before}
                  </div>
                )}
                {doc && (
                  <div className="mt-3 w-full">
                    <DocumentPreview text={doc} language={i18n.language} />
                  </div>
                )}
                {after && (
                  <div className="mt-2 px-3 py-2 rounded-2xl bg-card border text-sm sm:text-base whitespace-pre-wrap">
                    {after}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="flex gap-2 items-center text-muted-foreground text-sm">
            <div className="h-8 w-8 rounded-full bg-gold/20 flex items-center justify-center">
              <Bot className="h-4 w-4 text-gold" />
            </div>
            <Loader2 className="h-4 w-4 animate-spin" /> {t('lawyerChat.typing')}
          </div>
        )}
      </div>

      <div className="border-t p-3 bg-background">
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={t('lawyerChat.placeholder')}
            rows={2}
            disabled={loading || remaining <= 0}
            className="flex-1 resize-none"
          />
          <Button onClick={send} disabled={loading || !input.trim() || remaining <= 0} className="gold-button h-auto py-3">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 italic">{t('lawyerChat.disclaimer')}</p>
      </div>
    </Card>
  );
}
