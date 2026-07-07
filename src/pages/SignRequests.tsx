import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  FileText, Copy, Download, ExternalLink, Trash2, Loader2, PenLine, Link as LinkIcon,
  Plus, MessageCircle, Mail, Clock, CheckCircle2, FileClock,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

interface SigReq {
  id: string;
  title: string;
  status: string;
  token: string;
  file_size: number;
  page_count: number;
  original_file_path: string;
  signed_file_path: string | null;
  expires_at: string | null;
  created_at: string;
  signed_at: string | null;
  opened_at: string | null;
  signer_name: string | null;
}

function statusInfo(status: string, expiresAt: string | null) {
  const expired = expiresAt && new Date(expiresAt) < new Date() && status !== 'signed';
  if (expired) return { label: 'Просрочен', color: 'bg-slate-200 text-slate-700', icon: Clock };
  if (status === 'signed') return { label: 'Подписан', color: 'bg-green-100 text-green-700', icon: CheckCircle2 };
  if (status === 'sent') return { label: 'Ожидает подписи', color: 'bg-amber-100 text-amber-700', icon: FileClock };
  return { label: 'Черновик', color: 'bg-slate-100 text-slate-600', icon: FileText };
}

export default function SignRequests() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<SigReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [share, setShare] = useState<{ url: string; title: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('signature_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { toast.error('Не удалось загрузить'); console.error(error); }
    else setItems((data || []) as any);
    setLoading(false);
  };
  useEffect(() => { if (user) load(); }, [user]);

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/sign/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Ссылка скопирована');
  };

  const openShare = (r: SigReq) => {
    setShare({ url: `${window.location.origin}/sign/${r.token}`, title: r.title });
  };

  const downloadSigned = async (r: SigReq) => {
    if (!r.signed_file_path) { toast.error('Документ ещё не подписан'); return; }
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(r.signed_file_path, 300);
    if (error || !data?.signedUrl) { toast.error('Не удалось скачать'); return; }
    const a = document.createElement('a');
    a.href = data.signedUrl; a.download = `${r.title}.pdf`; a.target = '_blank';
    document.body.appendChild(a); a.click(); a.remove();
  };

  const remove = async (r: SigReq) => {
    if (!confirm('Удалить документ и ссылку?')) return;
    const { error } = await supabase.from('signature_requests').delete().eq('id', r.id);
    if (error) { toast.error('Не удалось удалить'); return; }
    setItems((s) => s.filter((x) => x.id !== r.id));
    toast.success('Удалено');
  };

  const openLink = (r: SigReq) => window.open(`/sign/${r.token}`, '_blank');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-3 sm:px-6 py-6 sm:py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-2">
              <PenLine className="w-3.5 h-3.5" /> E-Signature
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">Мои документы на подпись</h1>
            <p className="text-muted-foreground text-sm mt-1">Все отправленные ссылки, статусы и подписанные документы</p>
          </div>
          <Button onClick={() => navigate('/sign-builder')} className="rounded-2xl h-11 shadow-md">
            <Plus className="w-4 h-4 mr-1" /> Новый документ
          </Button>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <Card className="p-10 rounded-3xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Пока пусто</h3>
            <p className="text-muted-foreground text-sm mb-4">Загрузите документ и создайте ссылку для подписания</p>
            <Button onClick={() => navigate('/sign-builder')} className="rounded-2xl">
              <Plus className="w-4 h-4 mr-1" /> Отправить первый документ
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((r) => {
              const s = statusInfo(r.status, r.expires_at);
              const Icon = s.icon;
              return (
                <Card key={r.id} className="p-4 sm:p-5 rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold truncate">{r.title}</div>
                        <Badge className={`${s.color} border-0 gap-1 font-medium`}>
                          <Icon className="w-3 h-3" /> {s.label}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                        <span>Создан: {new Date(r.created_at).toLocaleString('ru-RU')}</span>
                        {r.signed_at && <span>Подписан: {new Date(r.signed_at).toLocaleString('ru-RU')}</span>}
                        {r.signer_name && <span>Кем: {r.signer_name}</span>}
                        <span>{r.page_count} стр · {(r.file_size / 1024).toFixed(0)} КБ</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => copyLink(r.token)} className="rounded-xl">
                        <Copy className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Ссылка</span>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openShare(r)} className="rounded-xl">
                        <LinkIcon className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Поделиться</span>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openLink(r)} className="rounded-xl">
                        <ExternalLink className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Открыть</span>
                      </Button>
                      {r.signed_file_path && (
                        <Button size="sm" onClick={() => downloadSigned(r)} className="rounded-xl">
                          <Download className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Скачать</span>
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => remove(r)} className="rounded-xl text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={!!share} onOpenChange={(v) => !v && setShare(null)}>
        <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-primary to-primary/70 p-6 text-primary-foreground text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur">
              <LinkIcon className="w-7 h-7" />
            </div>
            <DialogTitle className="text-xl text-primary-foreground">Поделиться ссылкой</DialogTitle>
            <p className="text-primary-foreground/80 text-sm mt-1 truncate">{share?.title}</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex justify-center p-4 bg-white rounded-2xl border">
              {share && <QRCodeSVG value={share.url} size={180} level="M" />}
            </div>
            <div className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-muted rounded-xl">
              <Input readOnly value={share?.url || ''} className="border-0 bg-transparent text-xs font-mono h-8 p-0 focus-visible:ring-0" />
              <Button size="sm" variant="ghost" onClick={() => share && (navigator.clipboard.writeText(share.url), toast.success('Скопировано'))}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" onClick={() => share && window.open(`https://wa.me/?text=${encodeURIComponent('Пожалуйста, подпишите: ' + share.url)}`)} className="rounded-xl h-11">
                <MessageCircle className="w-4 h-4 mr-1" />WhatsApp
              </Button>
              <Button variant="outline" onClick={() => share && window.open(`https://t.me/share/url?url=${encodeURIComponent(share.url)}&text=${encodeURIComponent('Пожалуйста, подпишите')}`)} className="rounded-xl h-11">
                Telegram
              </Button>
              <Button variant="outline" onClick={() => share && window.open(`mailto:?subject=${encodeURIComponent('Запрос подписи')}&body=${encodeURIComponent('Пожалуйста, подпишите: ' + share.url)}`)} className="rounded-xl h-11">
                <Mail className="w-4 h-4 mr-1" />Email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
