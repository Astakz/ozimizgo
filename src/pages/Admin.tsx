import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Plus, Trash2, Users, Key, LogOut, Loader2, Copy, FileStack, Eye, Power, PowerOff, Pencil, Clock, Ban, ShieldOff, AlertTriangle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

interface InviteCode { id: string; code: string; is_used: boolean; created_at: string; used_at: string | null; expires_at: string | null; disabled: boolean; }
interface Profile { id: string; user_id: string; name: string; email: string; invite_code: string | null; created_at: string; blocked_until: string | null; blocked_reason: string | null; blocked_at: string | null; }
interface Document { id: string; user_id: string; original_filename: string; file_type: string; extracted_text: string; generated_objection: string; created_at: string; }

const DURATION_PRESETS: { label: string; seconds: number }[] = [
  { label: '1 минута', seconds: 60 },
  { label: '5 минут', seconds: 300 },
  { label: '10 минут', seconds: 600 },
  { label: '1 час', seconds: 3600 },
  { label: '24 часа', seconds: 86400 },
  { label: '7 дней', seconds: 604800 },
  { label: '30 дней', seconds: 2592000 },
  { label: 'Без срока', seconds: 0 },
  { label: 'Своё значение', seconds: -1 },
];

const BAN_PRESETS: { label: string; seconds: number }[] = [
  { label: '5 минут', seconds: 300 },
  { label: '30 минут', seconds: 1800 },
  { label: '1 час', seconds: 3600 },
  { label: '24 часа', seconds: 86400 },
  { label: '7 дней', seconds: 604800 },
  { label: '30 дней', seconds: 2592000 },
  { label: '1 год', seconds: 31536000 },
  { label: 'Своё значение (сек)', seconds: -1 },
];

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0с';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}д`);
  if (d || h) parts.push(`${h}ч`);
  if (d || h || m) parts.push(`${m}м`);
  parts.push(`${sec}с`);
  return parts.join(' ');
}

function CountdownCell({ expiresAt, disabled, isUsed }: { expiresAt: string | null; disabled: boolean; isUsed: boolean }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (isUsed) return <span className="text-muted-foreground text-sm">—</span>;
  if (disabled) return <span className="text-muted-foreground text-sm">отключён</span>;
  if (!expiresAt) return <span className="text-sm text-emerald-600">∞</span>;
  const remain = new Date(expiresAt).getTime() - Date.now();
  if (remain <= 0) return <span className="text-sm text-destructive">истёк</span>;
  return <span className="font-mono text-sm tabular-nums">{formatRemaining(remain)}</span>;
}

const Admin = () => {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [newCode, setNewCode] = useState('');
  const [durationPreset, setDurationPreset] = useState<string>('86400');
  const [customSeconds, setCustomSeconds] = useState<string>('');
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [viewType, setViewType] = useState<'text' | 'objection'>('objection');
  const [editing, setEditing] = useState<InviteCode | null>(null);
  const [editPreset, setEditPreset] = useState<string>('86400');
  const [editCustom, setEditCustom] = useState<string>('');
  const [banTarget, setBanTarget] = useState<Profile | null>(null);
  const [banPreset, setBanPreset] = useState<string>('3600');
  const [banCustom, setBanCustom] = useState<string>('');
  const [banReason, setBanReason] = useState<string>('');
  const [banSubmitting, setBanSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [, setNowTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Retry helper for transient mobile-Safari "Load failed" / network errors
  const withRetry = async <T,>(fn: () => Promise<{ data: T | null; error: unknown }>, attempts = 4): Promise<{ data: T | null; error: unknown }> => {
    let lastErr: unknown = null;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await fn();
        if (!res.error) return res;
        lastErr = res.error;
      } catch (e) {
        lastErr = e;
      }
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
    return { data: null, error: lastErr };
  };

  const fetchCodes = useCallback(async () => {
    setLoadingCodes(true);
    const { data, error } = await withRetry<InviteCode[]>(() => supabase.from('invite_codes').select('id, code, is_used, created_at, used_at, expires_at, disabled').order('created_at', { ascending: false }) as unknown as Promise<{ data: InviteCode[] | null; error: unknown }>);
    if (error) toast({ title: t('common.error'), description: (error as Error)?.message || String(error), variant: 'destructive' });
    else setInviteCodes(data || []);
    setLoadingCodes(false);
  }, [t]);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    const { data, error } = await withRetry<Profile[]>(() => supabase.from('profiles').select('*').order('created_at', { ascending: false }) as unknown as Promise<{ data: Profile[] | null; error: unknown }>);
    if (error) toast({ title: t('common.error'), description: (error as Error)?.message || String(error), variant: 'destructive' });
    else setUsers(data || []);
    setLoadingUsers(false);
  }, [t]);

  const fetchDocuments = useCallback(async () => {
    setLoadingDocs(true);
    const { data, error } = await withRetry<Document[]>(() => supabase.from('documents').select('id, user_id, original_filename, file_type, extracted_text, generated_objection, created_at').order('created_at', { ascending: false }) as unknown as Promise<{ data: Document[] | null; error: unknown }>);
    if (error) toast({ title: t('common.error'), description: (error as Error)?.message || String(error), variant: 'destructive' });
    else setDocuments(data || []);
    setLoadingDocs(false);
  }, [t]);

  useEffect(() => { fetchCodes(); fetchUsers(); fetchDocuments(); }, [fetchCodes, fetchUsers, fetchDocuments]);

  // Realtime subscription for invite_codes
  useEffect(() => {
    const channel = supabase
      .channel('admin-invite-codes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invite_codes' }, () => {
        fetchCodes();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchCodes]);

  // Realtime subscription for profiles (block status)
  useEffect(() => {
    const channel = supabase
      .channel('admin-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchUsers();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchUsers]);

  const callAdminAction = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('admin-user-action', { body: payload });
    if (error) throw error;
    if (data && typeof data === 'object' && 'error' in data && data.error) {
      throw new Error(String((data as { error: string }).error));
    }
    return data;
  };

  const submitBan = async () => {
    if (!banTarget) return;
    const secs = resolveSeconds(banPreset, banCustom);
    if (!secs || secs <= 0) { toast({ title: 'Ошибка', description: 'Укажите корректное время блокировки', variant: 'destructive' }); return; }
    setBanSubmitting(true);
    try {
      const blocked_until = new Date(Date.now() + secs * 1000).toISOString();
      await callAdminAction({ action: 'block', target_user_id: banTarget.user_id, blocked_until, reason: banReason || null });
      toast({ title: 'Аккаунт заблокирован' });
      setBanTarget(null); setBanReason(''); setBanCustom('');
      fetchUsers();
    } catch (e) {
      toast({ title: 'Ошибка', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally { setBanSubmitting(false); }
  };

  const unblockUser = async (u: Profile) => {
    try {
      await callAdminAction({ action: 'unblock', target_user_id: u.user_id });
      toast({ title: 'Блокировка снята' });
      fetchUsers();
    } catch (e) {
      toast({ title: 'Ошибка', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    }
  };

  const hardDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      await callAdminAction({ action: 'delete', target_user_id: deleteTarget.user_id });
      toast({ title: 'Аккаунт удалён' });
      setDeleteTarget(null);
      fetchUsers();
    } catch (e) {
      toast({ title: 'Ошибка', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally { setDeleteSubmitting(false); }
  };


  const resolveSeconds = (preset: string, custom: string): number | null => {
    if (preset === '0') return 0; // no expiry
    if (preset === '-1') {
      const n = parseInt(custom, 10);
      if (!Number.isFinite(n) || n <= 0) return null;
      return n;
    }
    const n = parseInt(preset, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setNewCode(code);
  };

  const createInviteCode = async () => {
    if (!newCode.trim()) { toast({ title: t('common.error'), description: t('admin.enterCode'), variant: 'destructive' }); return; }
    const secs = resolveSeconds(durationPreset, customSeconds);
    if (secs === null) { toast({ title: 'Ошибка', description: 'Укажите корректное время в секундах', variant: 'destructive' }); return; }
    setCreating(true);
    const expires_at = secs === 0 ? null : new Date(Date.now() + secs * 1000).toISOString();
    const { error } = await supabase.from('invite_codes').insert({ code: newCode.trim().toUpperCase(), expires_at, disabled: false });
    if (error) toast({ title: t('common.error'), description: error.message.includes('duplicate') ? t('admin.codeExists') : error.message, variant: 'destructive' });
    else { toast({ title: t('common.success'), description: t('admin.codeCreated') }); setNewCode(''); fetchCodes(); }
    setCreating(false);
  };

  const deleteCode = async (id: string) => {
    const { error } = await supabase.from('invite_codes').delete().eq('id', id);
    if (error) toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    else { toast({ title: t('admin.deleted') }); fetchCodes(); }
  };

  const toggleDisable = async (code: InviteCode) => {
    const { error } = await supabase.from('invite_codes').update({ disabled: !code.disabled }).eq('id', code.id);
    if (error) toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    else { toast({ title: code.disabled ? 'Код активирован' : 'Код отключён' }); fetchCodes(); }
  };

  const extendCode = async (code: InviteCode, addSeconds: number) => {
    const base = code.expires_at && new Date(code.expires_at).getTime() > Date.now()
      ? new Date(code.expires_at).getTime()
      : Date.now();
    const newExp = new Date(base + addSeconds * 1000).toISOString();
    const { error } = await supabase.from('invite_codes').update({ expires_at: newExp }).eq('id', code.id);
    if (error) toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    else { toast({ title: 'Срок продлён' }); fetchCodes(); }
  };

  const openEdit = (code: InviteCode) => {
    setEditing(code);
    setEditPreset('86400');
    setEditCustom('');
  };

  const saveEdit = async () => {
    if (!editing) return;
    const secs = resolveSeconds(editPreset, editCustom);
    if (secs === null) { toast({ title: 'Ошибка', description: 'Укажите корректное время', variant: 'destructive' }); return; }
    const expires_at = secs === 0 ? null : new Date(Date.now() + secs * 1000).toISOString();
    const { error } = await supabase.from('invite_codes').update({ expires_at }).eq('id', editing.id);
    if (error) toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    else { toast({ title: 'Время обновлено' }); setEditing(null); fetchCodes(); }
  };



  const openBan = (u: Profile) => {
    setBanTarget(u);
    setBanPreset('3600');
    setBanCustom('');
    setBanReason(u.blocked_reason || '');
  };

  const copyCode = (code: string) => { navigator.clipboard.writeText(code); toast({ title: t('admin.copied'), description: code }); };

  const deleteDocument = async (id: string) => {
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    else { toast({ title: t('admin.docDeleted') }); fetchDocuments(); }
  };

  const getUserEmail = (userId: string) => {
    const u = users.find((p) => p.user_id === userId);
    return u?.email || userId.slice(0, 8) + '...';
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="navy-gradient text-primary-foreground py-4 shadow-elevated">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-gold" />
            <h1 className="text-xl font-bold">{t('admin.title')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher variant="header" />
            <Button asChild variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
              <Link to="/">{t('admin.home')}</Link>
            </Button>
            <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-1" /> {t('nav.logout')}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <Tabs defaultValue="codes" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="codes" className="gap-2"><Key className="w-4 h-4" /> {t('admin.inviteCodes')}</TabsTrigger>
            <TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" /> {t('admin.users')}</TabsTrigger>
            <TabsTrigger value="documents" className="gap-2"><FileStack className="w-4 h-4" /> {t('admin.documents')}</TabsTrigger>
          </TabsList>

          <TabsContent value="codes" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">{t('admin.createCode')}</CardTitle>
                <CardDescription>{t('admin.createCodeDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input placeholder={t('admin.codePlaceholder')} value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} className="font-mono tracking-wider" />
                  <Button variant="outline" onClick={generateCode}>{t('admin.generate')}</Button>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Срок действия</Label>
                    <Select value={durationPreset} onValueChange={setDurationPreset}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DURATION_PRESETS.map((p) => (
                          <SelectItem key={p.seconds} value={String(p.seconds)}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {durationPreset === '-1' && (
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Секунд</Label>
                      <Input type="number" min={1} placeholder="например, 3600" value={customSeconds} onChange={(e) => setCustomSeconds(e.target.value)} />
                    </div>
                  )}
                  <Button onClick={createInviteCode} disabled={creating}>
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t('admin.create')}
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardHeader><CardTitle className="text-lg">{t('admin.codeList')}</CardTitle></CardHeader>
              <CardContent>
                {loadingCodes ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                : inviteCodes.length === 0 ? <p className="text-center text-muted-foreground py-8">{t('admin.noCodes')}</p>
                : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>{t('admin.code')}</TableHead>
                      <TableHead>{t('admin.status')}</TableHead>
                      <TableHead>Осталось</TableHead>
                      <TableHead>{t('admin.createdAt')}</TableHead>
                      <TableHead className="text-right">{t('admin.actions')}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {inviteCodes.map((code) => {
                        const expired = !!code.expires_at && new Date(code.expires_at).getTime() <= Date.now();
                        let statusLabel = t('admin.active');
                        let statusVariant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default';
                        if (code.is_used) { statusLabel = t('admin.used'); statusVariant = 'secondary'; }
                        else if (code.disabled) { statusLabel = 'Отключён'; statusVariant = 'outline'; }
                        else if (expired) { statusLabel = 'Истёк'; statusVariant = 'destructive'; }
                        return (
                          <TableRow key={code.id}>
                            <TableCell className="font-mono tracking-wider font-medium">{code.code}</TableCell>
                            <TableCell><Badge variant={statusVariant}>{statusLabel}</Badge></TableCell>
                            <TableCell><CountdownCell expiresAt={code.expires_at} disabled={code.disabled} isUsed={code.is_used} /></TableCell>
                            <TableCell className="text-muted-foreground text-sm">{new Date(code.created_at).toLocaleDateString('ru-RU')}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1 flex-wrap">
                                <Button variant="ghost" size="icon" title="Копировать" onClick={() => copyCode(code.code)}><Copy className="w-4 h-4" /></Button>
                                {!code.is_used && (
                                  <>
                                    <Button variant="ghost" size="icon" title="+1 час" onClick={() => extendCode(code, 3600)}><Clock className="w-4 h-4" /></Button>
                                    <Button variant="ghost" size="icon" title="Изменить срок" onClick={() => openEdit(code)}><Pencil className="w-4 h-4" /></Button>
                                    <Button variant="ghost" size="icon" title={code.disabled ? 'Активировать' : 'Отключить'} onClick={() => toggleDisable(code)}>
                                      {code.disabled ? <Power className="w-4 h-4 text-emerald-600" /> : <PowerOff className="w-4 h-4 text-amber-600" />}
                                    </Button>
                                  </>
                                )}
                                <Button variant="ghost" size="icon" title="Удалить" onClick={() => deleteCode(code.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="users">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">{t('admin.users')}</CardTitle>
                <CardDescription>{users.length} {t('admin.registered')}</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingUsers ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                : users.length === 0 ? <p className="text-center text-muted-foreground py-8">{t('admin.noUsers')}</p>
                : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>{t('admin.name')}</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Осталось</TableHead>
                      <TableHead>{t('admin.regDate')}</TableHead>
                      <TableHead className="text-right">{t('admin.actions')}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {users.map((u) => {
                        const blockedMs = u.blocked_until ? new Date(u.blocked_until).getTime() - Date.now() : 0;
                        const isBlocked = blockedMs > 0;
                        return (
                          <TableRow key={u.id} className={isBlocked ? 'bg-destructive/5' : undefined}>
                            <TableCell className="font-medium">{u.name || '—'}</TableCell>
                            <TableCell className="text-sm">{u.email}</TableCell>
                            <TableCell>
                              {isBlocked
                                ? <Badge variant="destructive" className="gap-1"><Ban className="w-3 h-3" />blocked</Badge>
                                : <Badge variant="default" className="gap-1">active</Badge>}
                            </TableCell>
                            <TableCell>
                              {isBlocked
                                ? <span className="font-mono text-sm tabular-nums text-destructive">{formatRemaining(blockedMs)}</span>
                                : <span className="text-muted-foreground text-sm">—</span>}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">{new Date(u.created_at).toLocaleDateString('ru-RU')}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1 flex-wrap">
                                {isBlocked ? (
                                  <>
                                    <Button variant="ghost" size="icon" title="Изменить срок блокировки" onClick={() => openBan(u)}><Pencil className="w-4 h-4" /></Button>
                                    <Button variant="ghost" size="icon" title="Разблокировать" onClick={() => unblockUser(u)}><ShieldOff className="w-4 h-4 text-emerald-600" /></Button>
                                  </>
                                ) : (
                                  <Button variant="ghost" size="icon" title="Заблокировать" onClick={() => openBan(u)}><Ban className="w-4 h-4 text-amber-600" /></Button>
                                )}
                                <Button variant="ghost" size="icon" title="Удалить навсегда" onClick={() => setDeleteTarget(u)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">{t('admin.allDocs')}</CardTitle>
                <CardDescription>{documents.length} {t('admin.docsCreated')}</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingDocs ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                : documents.length === 0 ? <p className="text-center text-muted-foreground py-8">{t('admin.noDocs')}</p>
                : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>{t('admin.file')}</TableHead><TableHead>{t('admin.user')}</TableHead><TableHead>{t('admin.type')}</TableHead><TableHead>{t('admin.date')}</TableHead><TableHead className="text-right">{t('admin.actions')}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {documents.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium max-w-[200px] truncate">{doc.original_filename}</TableCell>
                          <TableCell className="text-sm">{getUserEmail(doc.user_id)}</TableCell>
                          <TableCell><Badge variant="secondary">{doc.file_type}</Badge></TableCell>
                          <TableCell className="text-muted-foreground text-sm">{new Date(doc.created_at).toLocaleDateString('ru-RU')}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => { setSelectedDoc(doc); setViewType('objection'); }}><Eye className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteDocument(doc.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="text-lg">{selectedDoc?.original_filename}</DialogTitle>
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant={viewType === 'objection' ? 'default' : 'outline'} onClick={() => setViewType('objection')}>{t('admin.objectionView')}</Button>
                <Button size="sm" variant={viewType === 'text' ? 'default' : 'outline'} onClick={() => setViewType('text')}>{t('admin.extractedView')}</Button>
              </div>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <pre className="whitespace-pre-wrap text-sm p-4 bg-muted rounded-md">
                {viewType === 'objection' ? selectedDoc?.generated_objection : selectedDoc?.extracted_text}
              </pre>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Изменить срок действия</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Код: <span className="font-mono">{editing?.code}</span></div>
              <div>
                <Label className="text-xs">Новый срок (от текущего момента)</Label>
                <Select value={editPreset} onValueChange={setEditPreset}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DURATION_PRESETS.map((p) => (
                      <SelectItem key={p.seconds} value={String(p.seconds)}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editPreset === '-1' && (
                <div>
                  <Label className="text-xs">Секунд</Label>
                  <Input type="number" min={1} value={editCustom} onChange={(e) => setEditCustom(e.target.value)} />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Отмена</Button>
              <Button onClick={saveEdit}>Сохранить</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Ban dialog */}
        <Dialog open={!!banTarget} onOpenChange={(o) => !o && setBanTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Ban className="w-5 h-5 text-amber-600" /> Заблокировать аккаунт</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {banTarget?.email}
                {banTarget?.blocked_until && new Date(banTarget.blocked_until).getTime() > Date.now() && (
                  <div className="mt-1 text-amber-600">Уже заблокирован. Установка нового срока перезапишет текущий.</div>
                )}
              </div>
              <div>
                <Label className="text-xs">Длительность блокировки</Label>
                <Select value={banPreset} onValueChange={setBanPreset}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BAN_PRESETS.map((p) => (
                      <SelectItem key={p.seconds} value={String(p.seconds)}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {banPreset === '-1' && (
                <div>
                  <Label className="text-xs">Секунд</Label>
                  <Input type="number" min={1} value={banCustom} onChange={(e) => setBanCustom(e.target.value)} placeholder="например, 7200" />
                </div>
              )}
              <div>
                <Label className="text-xs">Причина (необязательно)</Label>
                <Textarea value={banReason} onChange={(e) => setBanReason(e.target.value)} rows={2} placeholder="Нарушение правил…" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBanTarget(null)} disabled={banSubmitting}>Отмена</Button>
              <Button onClick={submitBan} disabled={banSubmitting}>
                {banSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />} Заблокировать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Hard delete confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /> Удалить аккаунт навсегда?</AlertDialogTitle>
              <AlertDialogDescription>
                Аккаунт <span className="font-medium">{deleteTarget?.email}</span> и все связанные данные будут удалены из базы безвозвратно. Это действие нельзя отменить.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteSubmitting}>Отмена</AlertDialogCancel>
              <AlertDialogAction onClick={hardDeleteUser} disabled={deleteSubmitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleteSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </main>
    </div>
  );
};

export default Admin;
