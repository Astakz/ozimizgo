import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Briefcase, Plus, Loader2, MessageSquare, Star, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface CaseRecord {
  id: string;
  client_id: string;
  title: string;
  description: string;
  case_type: string;
  status: string;
  created_at: string;
  client_name?: string;
  response_count?: number;
}

interface LawyerResponseProfile {
  id: string;
  lawyer_id: string;
  message: string;
  created_at: string;
  full_name?: string;
  nickname?: string;
  avatar_url?: string;
  profession?: string;
  specialization?: string[];
  avg_rating: number;
  review_count: number;
}

const CASE_TYPES = [
  { value: 'civil', label: 'Гражданское' },
  { value: 'criminal', label: 'Уголовное' },
  { value: 'administrative', label: 'Административное' },
  { value: 'family', label: 'Семейное' },
  { value: 'labor', label: 'Трудовое' },
  { value: 'tax', label: 'Налоговое' },
  { value: 'corporate', label: 'Корпоративное' },
  { value: 'other', label: 'Другое' },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  open: { label: 'Открыто', color: 'bg-accent/20 text-accent-foreground' },
  in_progress: { label: 'В работе', color: 'bg-primary/20 text-primary' },
  closed: { label: 'Закрыто', color: 'bg-muted text-muted-foreground' },
};

export default function Cases() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [caseType, setCaseType] = useState('civil');
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);
  const [responses, setResponses] = useState<LawyerResponseProfile[]>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [respondingCase, setRespondingCase] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Ошибка загрузки дел');
      setLoading(false);
      return;
    }

    const clientIds = [...new Set((data || []).map((c: any) => c.client_id))];
    let clientMap: Record<string, string> = {};
    if (clientIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, nickname')
        .in('user_id', clientIds);
      (profiles || []).forEach((p: any) => {
        clientMap[p.user_id] = p.full_name || p.nickname || 'Аноним';
      });
    }

    const { data: respCounts } = await supabase.from('case_responses').select('case_id');
    const countMap: Record<string, number> = {};
    (respCounts || []).forEach((r: any) => {
      countMap[r.case_id] = (countMap[r.case_id] || 0) + 1;
    });

    setCases((data || []).map((c: any) => ({
      ...c,
      client_name: clientMap[c.client_id] || 'Аноним',
      response_count: countMap[c.id] || 0,
    })));
    setLoading(false);
  };

  const createCase = async () => {
    if (!user || !title.trim() || !description.trim()) {
      toast.error('Заполните все поля');
      return;
    }
    setCreating(true);
    const { error } = await supabase.from('cases').insert({
      client_id: user.id,
      title: title.trim(),
      description: description.trim(),
      case_type: caseType,
    });
    if (error) {
      toast.error('Ошибка создания дела');
    } else {
      toast.success('Дело создано');
      setShowCreate(false);
      setTitle('');
      setDescription('');
      setCaseType('civil');
      fetchCases();
    }
    setCreating(false);
  };

  const openCase = async (c: CaseRecord) => {
    setSelectedCase(c);
    setResponsesLoading(true);
    const { data } = await supabase
      .from('case_responses')
      .select('*')
      .eq('case_id', c.id)
      .order('created_at', { ascending: true });

    const lawyerIds = [...new Set((data || []).map((r: any) => r.lawyer_id))];
    let profileMap: Record<string, any> = {};
    let ratingMap: Record<string, { sum: number; count: number }> = {};

    if (lawyerIds.length > 0) {
      const [profilesRes, reviewsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, nickname, avatar_url, profession, specialization').in('user_id', lawyerIds),
        supabase.from('reviews').select('lawyer_id, rating').in('lawyer_id', lawyerIds),
      ]);

      (profilesRes.data || []).forEach((p: any) => { profileMap[p.user_id] = p; });
      (reviewsRes.data || []).forEach((r: any) => {
        if (!ratingMap[r.lawyer_id]) ratingMap[r.lawyer_id] = { sum: 0, count: 0 };
        ratingMap[r.lawyer_id].sum += r.rating;
        ratingMap[r.lawyer_id].count += 1;
      });
    }

    setResponses((data || []).map((r: any) => {
      const p = profileMap[r.lawyer_id] || {};
      const rt = ratingMap[r.lawyer_id];
      return {
        ...r,
        full_name: p.full_name || null,
        nickname: p.nickname || null,
        avatar_url: p.avatar_url || null,
        profession: p.profession || null,
        specialization: p.specialization || null,
        avg_rating: rt ? rt.sum / rt.count : 0,
        review_count: rt?.count || 0,
      };
    }));
    setResponsesLoading(false);
  };

  const submitResponse = async () => {
    if (!user || !selectedCase || !responseText.trim()) return;
    setRespondingCase(true);
    const { error } = await supabase.from('case_responses').insert({
      case_id: selectedCase.id,
      lawyer_id: user.id,
      message: responseText.trim(),
    });
    if (error) {
      toast.error('Ошибка отправки отклика');
    } else {
      toast.success('Отклик отправлен — приватный чат создан');
      setResponseText('');
      // Navigate to chat with client
      navigate(`/chat?to=${selectedCase.client_id}`);
    }
    setRespondingCase(false);
  };

  const goToChat = (userId: string) => {
    navigate(`/chat?to=${userId}`);
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`h-3 w-3 ${i <= Math.round(rating) ? 'text-secondary fill-secondary' : 'text-muted-foreground/30'}`} />
      ))}
    </div>
  );

  const filteredCases = typeFilter === 'all' ? cases : cases.filter(c => c.case_type === typeFilter);
  const getCaseTypeLabel = (t: string) => CASE_TYPES.find(ct => ct.value === t)?.label || t;

  const isClientOfCase = selectedCase && user && selectedCase.client_id === user.id;
  const isLawyer = responses.some(r => r.lawyer_id === user?.id);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-3 sm:px-4 py-6 sm:py-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <Briefcase className="h-7 w-7 text-secondary" />
              <h1 className="text-2xl font-serif font-bold text-foreground">Дела</h1>
            </div>
            <Button onClick={() => setShowCreate(true)} className="gap-2 self-start sm:self-auto">
              <Plus className="h-4 w-4" /> Создать дело
            </Button>
          </div>

          <div className="mb-4">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Тип дела" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                {CASE_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCases.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="text-lg font-medium">Нет дел</p>
                <p className="text-sm mt-1">Создайте новое дело для поиска юриста</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredCases.map(c => (
                <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openCase(c)}>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground">{c.title}</p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.description}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">{getCaseTypeLabel(c.case_type)}</Badge>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_MAP[c.status]?.color || 'bg-muted text-muted-foreground'}`}>
                            {STATUS_MAP[c.status]?.label || c.status}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString('ru-RU')}
                          </span>
                          <span className="text-xs text-muted-foreground">от {c.client_name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                        <MessageSquare className="h-4 w-4" />
                        <span className="text-sm">{c.response_count}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />

      {/* Create case dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новое дело</DialogTitle>
            <DialogDescription>Опишите ваше дело, чтобы подходящие юристы могли откликнуться</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Заголовок дела" value={title} onChange={e => setTitle(e.target.value)} />
            <Textarea placeholder="Подробное описание..." value={description} onChange={e => setDescription(e.target.value)} rows={5} />
            <Select value={caseType} onValueChange={setCaseType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CASE_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={createCase} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Case detail dialog with lawyer profiles */}
      <Dialog open={!!selectedCase} onOpenChange={open => { if (!open) setSelectedCase(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedCase && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedCase.title}</DialogTitle>
                <DialogDescription>
                  {getCaseTypeLabel(selectedCase.case_type)} · {selectedCase.client_name} · {new Date(selectedCase.created_at).toLocaleDateString('ru-RU')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <p className="text-sm text-foreground whitespace-pre-wrap">{selectedCase.description}</p>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" /> Отклики ({responses.length})
                  </h3>

                  {responsesLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : responses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Пока нет откликов</p>
                  ) : (
                    <div className="space-y-3">
                      {responses.map(r => (
                        <Card key={r.id} className="overflow-hidden">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <Avatar className="h-10 w-10 shrink-0">
                                <AvatarImage src={r.avatar_url || ''} />
                                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                  {(r.full_name || r.nickname || '?')[0]?.toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                  <div>
                                    <p className="text-sm font-semibold">{r.full_name || r.nickname || 'Юрист'}</p>
                                    {r.profession && (
                                      <p className="text-xs text-muted-foreground">{r.profession}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {renderStars(r.avg_rating)}
                                    <span className="text-xs text-muted-foreground">
                                      {r.avg_rating > 0 ? r.avg_rating.toFixed(1) : '—'} ({r.review_count})
                                    </span>
                                  </div>
                                </div>

                                {r.specialization && r.specialization.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {r.specialization.map(s => (
                                      <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">{s}</Badge>
                                    ))}
                                  </div>
                                )}

                                <p className="text-sm mt-2">{r.message}</p>

                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(r.created_at).toLocaleDateString('ru-RU')}
                                  </span>
                                  {/* Client sees "Chat" button; lawyer sees their own response */}
                                  {isClientOfCase ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="gap-1.5 h-7 text-xs"
                                      onClick={(e) => { e.stopPropagation(); goToChat(r.lawyer_id); }}
                                    >
                                      <MessageCircle className="h-3 w-3" /> Чат
                                    </Button>
                                  ) : r.lawyer_id === user?.id ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="gap-1.5 h-7 text-xs"
                                      onClick={(e) => { e.stopPropagation(); goToChat(selectedCase.client_id); }}
                                    >
                                      <MessageCircle className="h-3 w-3" /> Чат с клиентом
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Response form for lawyers */}
                  {selectedCase.status === 'open' && user && selectedCase.client_id !== user.id && !isLawyer && (
                    <div className="mt-4 space-y-2 border rounded-lg p-3 bg-muted/30">
                      <p className="text-sm font-medium">Откликнуться на дело</p>
                      <Textarea
                        placeholder="Опишите как вы можете помочь..."
                        value={responseText}
                        onChange={e => setResponseText(e.target.value)}
                        rows={3}
                      />
                      <Button onClick={submitResponse} disabled={respondingCase || !responseText.trim()} size="sm" className="gap-1.5">
                        {respondingCase && <Loader2 className="h-4 w-4 animate-spin" />}
                        Откликнуться и начать чат
                      </Button>
                    </div>
                  )}

                  {isLawyer && (
                    <p className="text-xs text-muted-foreground mt-3">Вы уже откликнулись на это дело</p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
