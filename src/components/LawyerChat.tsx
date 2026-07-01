import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Send, Download, FileText, RotateCcw, User as UserIcon, Bot, Paperclip, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SignaturePad } from '@/components/SignaturePad';
import { extractTextFromPDF } from '@/utils/pdfParser';
import { extractTextFromImage } from '@/utils/imageOcr';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const DEFAULT_DAILY_LIMIT = 5;

type Attachment = { name: string; text: string };
type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachment?: Attachment;
};

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

function isImage(file: File) {
  return /^image\//.test(file.type) || /\.(jpe?g|png)$/i.test(file.name);
}

interface SigState { x: number; y: number; dragging: boolean; offsetX: number; offsetY: number }

function DocumentPreview({ text }: { text: string }) {
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

interface LawyerChatProps {
  usedToday: number;
  dailyLimit?: number;
  unlimited?: boolean;
  onUsageChange?: (used: number) => void;
}

export function LawyerChat({ usedToday, dailyLimit = DEFAULT_DAILY_LIMIT, unlimited = false, onUsageChange }: LawyerChatProps) {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingText, setPendingText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const greetings: Record<string, string> = {
    kk: 'Сәлеметсіз бе! Мен сіздің AI-заңгеріңізбін. Мәселеңізді жазыңыз немесе құжатты тіркеңіз — Қазақстан Республикасының заңнамасына сәйкес көмектесемін.',
    ru: 'Здравствуйте! Я — ваш AI-юрист. Опишите вашу ситуацию или прикрепите документ, и я помогу вам в соответствии с законодательством Республики Казахстан.',
    en: "Hello! I'm your AI lawyer. Describe your situation or attach a document and I'll help you under the laws of the Republic of Kazakhstan.",
  };

  useEffect(() => {
    setMessages([{ id: 'sys-greet', role: 'assistant', content: greetings[i18n.language] ?? greetings.ru }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    taRef.current?.focus();
  }, []);

  const handleFile = async (f: File) => {
    if (!/\.(pdf|jpe?g|png)$/i.test(f.name) && !/^(application\/pdf|image\/)/.test(f.type)) {
      toast.error(t('common.error'));
      return;
    }
    setPendingFile(f);
    setExtracting(true);
    try {
      const text = isImage(f) ? await extractTextFromImage(f) : await extractTextFromPDF(f);
      setPendingText(text);
    } catch (e) {
      console.error(e);
      toast.error(t('common.error'));
      setPendingFile(null);
      setPendingText('');
    } finally {
      setExtracting(false);
    }
  };

  const clearPending = () => {
    setPendingFile(null);
    setPendingText('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const send = useCallback(async () => {
    const text = input.trim();
    if ((!text && !pendingFile) || loading || extracting) return;
    if (usedToday >= DAILY_LIMIT) {
      toast.error(t('aiLawyer.limitReached'));
      return;
    }

    const attachment: Attachment | undefined = pendingFile
      ? { name: pendingFile.name, text: pendingText }
      : undefined;

    const displayContent = text || (attachment ? `📄 ${attachment.name}` : '');
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: displayContent,
      attachment,
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    clearPending();
    setLoading(true);
    try {
      const payload = next
        .filter((m) => m.id !== 'sys-greet')
        .map((m) => {
          if (m.role === 'user' && m.attachment) {
            const body = m.content && m.content !== `📄 ${m.attachment.name}` ? m.content : '';
            return {
              role: 'user' as const,
              content: `${body ? body + '\n\n' : ''}[Тіркелген құжат / Attached document: ${m.attachment.name}]\n"""\n${m.attachment.text.slice(0, 12000)}\n"""`,
            };
          }
          return { role: m.role, content: m.content };
        });
      const { data, error } = await supabase.functions.invoke('ai-lawyer', {
        body: { mode: 'chat', messages: payload, language: 'auto' },
      });
      if (error) {
        const ctx: any = (error as any).context;
        if (ctx?.status === 429) toast.error(t('aiLawyer.limitReached'));
        else toast.error(t('common.error'));
        return;
      }
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', content: data.answer ?? '' }]);
      if (typeof data.used === 'number') onUsageChange?.(data.used);
    } catch (e) {
      console.error(e);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
      setTimeout(() => taRef.current?.focus(), 0);
    }
  }, [input, loading, extracting, messages, usedToday, pendingFile, pendingText, t, onUsageChange]);

  const reset = () => {
    setMessages([{ id: 'sys-greet', role: 'assistant', content: greetings[i18n.language] ?? greetings.ru }]);
    setInput('');
    clearPending();
  };

  const remaining = DAILY_LIMIT - usedToday;

  return (
    <Card className="shadow-elevated overflow-hidden flex flex-col">
      <div className="border-b px-4 py-2 flex items-center justify-end bg-background">
        <Button size="sm" variant="ghost" onClick={reset} title={t('lawyerChat.reset')}>
          <RotateCcw className="h-4 w-4 mr-1" /> {t('lawyerChat.reset')}
        </Button>
      </div>

      <div ref={scrollRef} className="h-[60vh] overflow-y-auto p-3 sm:p-5 space-y-5 bg-muted/10">
        {messages.map((m) => {
          const { before, doc, after } = m.role === 'assistant'
            ? extractDocument(m.content)
            : { before: m.content, doc: null, after: '' };
          const isUser = m.role === 'user';
          return (
            <div key={m.id} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
              <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${isUser ? 'bg-primary text-primary-foreground' : 'bg-gold/20 text-gold'}`}>
                {isUser ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div className={`flex-1 max-w-[85%] space-y-2 ${isUser ? 'flex flex-col items-end' : ''}`}>
                {isUser && m.attachment && (
                  <div className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-xl border bg-card">
                    <FileText className="h-4 w-4 text-gold" />
                    <span className="font-medium truncate max-w-[200px]">{m.attachment.name}</span>
                  </div>
                )}
                {before && (
                  <div className={`px-4 py-2.5 rounded-2xl whitespace-pre-wrap text-sm sm:text-base leading-relaxed ${isUser ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-card border rounded-tl-sm'}`}>
                    {before}
                  </div>
                )}
                {doc && (
                  <div className="w-full">
                    <DocumentPreview text={doc} />
                  </div>
                )}
                {after && (
                  <div className="px-4 py-2.5 rounded-2xl bg-card border text-sm sm:text-base whitespace-pre-wrap leading-relaxed">
                    {after}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="flex gap-3 items-center text-muted-foreground text-sm">
            <div className="h-8 w-8 rounded-full bg-gold/20 flex items-center justify-center">
              <Bot className="h-4 w-4 text-gold" />
            </div>
            <Loader2 className="h-4 w-4 animate-spin" /> {t('lawyerChat.typing')}
          </div>
        )}
      </div>

      <div className="border-t bg-background p-3 space-y-2">
        {pendingFile && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/40">
            <FileText className="h-4 w-4 text-gold shrink-0" />
            <span className="text-sm truncate flex-1">{pendingFile.name}</span>
            {extracting ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={clearPending}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 focus-within:ring-2 focus-within:ring-ring/50 transition">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,image/jpeg,image/jpg,image/png"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0"
            onClick={() => fileRef.current?.click()}
            disabled={loading || extracting || !!pendingFile}
            title={t('lawyerChat.attach')}
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={t('lawyerChat.placeholder')}
            rows={1}
            disabled={loading || remaining <= 0}
            className="flex-1 resize-none border-0 focus-visible:ring-0 shadow-none px-1 py-2 min-h-[40px] max-h-40 bg-transparent"
          />
          <Button
            type="button"
            size="icon"
            onClick={send}
            disabled={loading || extracting || (!input.trim() && !pendingFile) || remaining <= 0}
            className="gold-button h-9 w-9 shrink-0 rounded-xl"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground text-center italic">{t('lawyerChat.disclaimer')}</p>
      </div>
    </Card>
  );
}
