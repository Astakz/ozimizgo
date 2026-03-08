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
import { Switch } from '@/components/ui/switch';
import { Briefcase, Plus, Loader2, MessageSquare, Star, MessageCircle, Trash2, Shield, Eye, FileText, MessageSquarePlus, FileEdit } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
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
  permissions: string[];
  actionLogs: { action_type: string; performed_at: string }[];
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

const PERMISSION_TYPES = [
  { value: 'view_profile', label: 'Просмотр профиля', icon: Eye },
  { value: 'create_consultation', label: 'Консультация', icon: MessageSquarePlus },
  { value: 'add_comment', label: 'Комментарии', icon: MessageSquare },
  { value: 'create_document', label: 'Документы', icon: FileEdit },
];

export default function Cases() {
  const { user, isAdmin } = useAuth();
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
  const [permissionsLoading, setPermissionsLoading] = useState<Record<string, boolean>>({});

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
    let permissionsMap: Record<string, string[]> = {};
    let actionLogsMap: Record<string, { action_type: string; performed_at: string }[]> = {};

    if (lawyerIds.length > 0) {
      const [profilesRes, reviewsRes, permissionsRes, logsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, nickname, avatar_url, profession, specialization').in('user_id', lawyerIds),
        supabase.from('reviews').select('lawyer_id, rating').in('lawyer_id', lawyerIds),
        supabase.from('lawyer_case_permissions').select('*').eq('case_id', c.id).in('lawyer_id', lawyerIds),
        supabase.from('lawyer_action_logs').select('*').eq('case_id', c.id).in('lawyer_id', lawyerIds),
      ]);

      (profilesRes.data || []).forEach((p: any) => { profileMap[p.user_id] = p; });
      (reviewsRes.data || []).forEach((r: any) => {
        if (!ratingMap[r.lawyer_id]) ratingMap[r.lawyer_id] = { sum: 0, count: 0 };
        ratingMap[r.lawyer_id].sum += r.rating;
        ratingMap[r.lawyer_id].count += 1;
      });
      (permissionsRes.data || []).forEach((p: any) => {
        if (!permissionsMap[p.lawyer_id]) permissionsMap[p.lawyer_id] = [];
        permissionsMap[p.lawyer_id].push(p.permission_type);
      });
      (logsRes.data || []).forEach((l: any) => {
        if (!actionLogsMap[l.lawyer_id]) actionLogsMap[l.lawyer_id] = [];
        actionLogsMap[l.lawyer_id].push({ action_type: l.action_type, performed_at: l.performed_at });
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
        permissions: permissionsMap[r.lawyer_id] || [],
        actionLogs: actionLogsMap[r.lawyer_id] || [],
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
      navigate(`/chat?to=${selectedCase.client_id}`);
    }
    setRespondingCase(false);
  };

  const goToChat = (userId: string) => {
    navigate(`/chat?to=${userId}`);
  };

  const deleteCase = async (caseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('case_responses').delete().eq('case_id', caseId);
    const { error } = await supabase.from('cases').delete().eq('id', caseId);
    if (error) {
      toast.error('Ошибка удаления дела');
    } else {
      toast.success('Дело удалено');
      setCases(prev => prev.filter(c => c.id !== caseId));
      if (selectedCase?.id === caseId) setSelectedCase(null);
    }
  };

  const togglePermission = async (lawyerId: string, permissionType: string, hasPermission: boolean) => {
    if (!selectedCase || !user) return;
    const key = `${lawyerId}-${permissionType}`;
    setPermissionsLoading(prev => ({ ...prev, [key]: true }));

    try {
      if (hasPermission) {
        await supabase.from('lawyer_case_permissions')
          .delete()
          .eq('case_id', selectedCase.id)
          .eq('lawyer_id', lawyerId)
          .eq('permission_type', permissionType);
      } else {
        await supabase.from('lawyer_case_permissions').insert({
          case_id: selectedCase.id,
          lawyer_id: lawyerId,
          permission_type: permissionType,
          granted_by: user.id,
        });
      }

      setResponses(prev => prev.map(r => {
        if (r.lawyer_id === lawyerId) {
          return {
            ...r,
            permissions: hasPermission
              ? r.permissions.filter(p => p !== permissionType)
              : [...r.permissions, permissionType],
          };
        }
        return r;
      }));
      toast.success(hasPermission ? 'Разрешение снято' : 'Разрешение выдано');
    } catch (err) {
      toast.error('Ошибка изменения разрешений');
    }

    setPermissionsLoading(prev => ({ ...prev, [key]: false }));
  };

  const canPerformAction = (r: LawyerResponseProfile, actionType: string) => {
    if (!r.permissions.includes(actionType)) return false;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const usedThisMonth = r.actionLogs.some(
      log => log.action_type === actionType && new Date(log.performed_at) >= startOfMonth
    );
    return !usedThisMonth;
  };

  const performLawyerAction = async (actionType: string) => {
    if (!user || !selectedCase) return;
    const { error } = await supabase.from('lawyer_action_logs').insert({
      lawyer_id: user.id,
      case_id: selectedCase.id,
      action_type: actionType,
    });
    if (error) {
      toast.error('Ошибка выполнения действия');
    } else {
      toast.success('Действие выполнено');
      openCase(selectedCase);
    }
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
  const currentLawyerResponse = responses.find(r => r.lawyer_id === user?.id);

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
                      <div className="flex items-center gap-2 shrink-0">
                        {user && c.client_id === user.id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={e => e.stopPropagation()}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={e => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Удалить дело?</AlertDialogTitle>
                                <AlertDialogDescription>Вы действительно хотите удалить это дело? Все отклики будут удалены.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Отмена</AlertDialogCancel>
                                <AlertDialogAction onClick={e => deleteCase(c.id, e)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Удалить</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MessageSquare className="h-4 w-4" />
                          <span className="text-sm">{c.response_count}</span>
                        </div>
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

      {/* Case detail dialog with lawyer profiles and permissions */}
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

                {/* Lawyer actions panel - for lawyers who have responded */}
                {currentLawyerResponse && (
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" /> Ваши доступные действия
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {PERMISSION_TYPES.map(perm => {
                        const hasPermission = currentLawyerResponse.permissions.includes(perm.value);
                        const canDo = canPerformAction(currentLawyerResponse, perm.value);
                        const Icon = perm.icon;
                        return (
                          <Button
                            key={perm.value}
                            variant={canDo ? "default" : "outline"}
                            size="sm"
                            disabled={!canDo}
                            onClick={() => performLawyerAction(perm.value)}
                            className="justify-start gap-2 text-xs h-auto py-2"
                          >
                            <Icon className="h-3.5 w-3.5" />
                            <span className="truncate">{perm.label}</span>
                            {!hasPermission && <span className="text-[10px] text-muted-foreground ml-auto">(нет)</span>}
                            {hasPermission && !canDo && <span className="text-[10px] text-muted-foreground ml-auto">(исп.)</span>}
                          </Button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Каждое действие доступно 1 раз в месяц</p>
                  </div>
                )}

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

                                {/* Permissions display */}
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {PERMISSION_TYPES.map(perm => {
                                    const has = r.permissions.includes(perm.value);
                                    const Icon = perm.icon;
                                    return (
                                      <Badge
                                        key={perm.value}
                                        variant={has ? "default" : "outline"}
                                        className={`text-[10px] gap-1 ${!has ? 'opacity-40' : ''}`}
                                      >
                                        <Icon className="h-2.5 w-2.5" />
                                        {perm.label.split(' ')[0]}
                                      </Badge>
                                    );
                                  })}
                                </div>

                                {/* Admin permission controls */}
                                {isAdmin && (
                                  <div className="mt-3 pt-3 border-t">
                                    <p className="text-xs font-medium mb-2 flex items-center gap-1">
                                      <Shield className="h-3 w-3" /> Управление доступом (Админ)
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {PERMISSION_TYPES.map(perm => {
                                        const has = r.permissions.includes(perm.value);
                                        const loadingKey = `${r.lawyer_id}-${perm.value}`;
                                        const isLoading = permissionsLoading[loadingKey];
                                        return (
                                          <div key={perm.value} className="flex items-center justify-between gap-2 text-xs">
                                            <span className="truncate">{perm.label}</span>
                                            <Switch
                                              checked={has}
                                              disabled={isLoading}
                                              onCheckedChange={() => togglePermission(r.lawyer_id, perm.value, has)}
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(r.created_at).toLocaleDateString('ru-RU')}
                                  </span>
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