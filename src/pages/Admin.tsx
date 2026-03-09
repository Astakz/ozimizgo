import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, Plus, Trash2, Users, Key, LogOut, Loader2, Copy, FileStack, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

interface InviteCode { id: string; code: string; is_used: boolean; created_at: string; used_at: string | null; }
interface Profile { id: string; user_id: string; name: string; email: string; invite_code: string | null; created_at: string; }
interface Document { id: string; user_id: string; original_filename: string; file_type: string; extracted_text: string; generated_objection: string; created_at: string; }

const Admin = () => {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [newCode, setNewCode] = useState('');
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [viewType, setViewType] = useState<'text' | 'objection'>('objection');

  const fetchCodes = useCallback(async () => {
    setLoadingCodes(true);
    const { data, error } = await supabase.from('invite_codes').select('id, code, is_used, created_at, used_at').order('created_at', { ascending: false });
    if (error) toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    else setInviteCodes(data || []);
    setLoadingCodes(false);
  }, [t]);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    else setUsers(data || []);
    setLoadingUsers(false);
  }, [t]);

  const fetchDocuments = useCallback(async () => {
    setLoadingDocs(true);
    const { data, error } = await supabase.from('documents').select('id, user_id, original_filename, file_type, extracted_text, generated_objection, created_at').order('created_at', { ascending: false });
    if (error) toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    else setDocuments(data || []);
    setLoadingDocs(false);
  }, [t]);

  useEffect(() => { fetchCodes(); fetchUsers(); fetchDocuments(); }, [fetchCodes, fetchUsers, fetchDocuments]);

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setNewCode(code);
  };

  const createInviteCode = async () => {
    if (!newCode.trim()) { toast({ title: t('common.error'), description: t('admin.enterCode'), variant: 'destructive' }); return; }
    setCreating(true);
    const { error } = await supabase.from('invite_codes').insert({ code: newCode.trim().toUpperCase() });
    if (error) toast({ title: t('common.error'), description: error.message.includes('duplicate') ? t('admin.codeExists') : error.message, variant: 'destructive' });
    else { toast({ title: t('common.success'), description: t('admin.codeCreated') }); setNewCode(''); fetchCodes(); }
    setCreating(false);
  };

  const deleteCode = async (id: string) => {
    const { error } = await supabase.from('invite_codes').delete().eq('id', id);
    if (error) toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    else { toast({ title: t('admin.deleted') }); fetchCodes(); }
  };

  const deleteUser = async (userId: string) => {
    const { error } = await supabase.from('profiles').delete().eq('user_id', userId);
    if (error) toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    else { toast({ title: t('admin.userDeleted') }); fetchUsers(); }
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
              <CardContent>
                <div className="flex gap-2">
                  <Input placeholder={t('admin.codePlaceholder')} value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} className="font-mono tracking-wider" />
                  <Button variant="outline" onClick={generateCode}>{t('admin.generate')}</Button>
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
                      <TableHead>{t('admin.code')}</TableHead><TableHead>{t('admin.status')}</TableHead><TableHead>{t('admin.createdAt')}</TableHead><TableHead className="text-right">{t('admin.actions')}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {inviteCodes.map((code) => (
                        <TableRow key={code.id}>
                          <TableCell className="font-mono tracking-wider font-medium">{code.code}</TableCell>
                          <TableCell><Badge variant={code.is_used ? 'secondary' : 'default'}>{code.is_used ? t('admin.used') : t('admin.active')}</Badge></TableCell>
                          <TableCell className="text-muted-foreground text-sm">{new Date(code.created_at).toLocaleDateString('ru-RU')}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => copyCode(code.code)}><Copy className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteCode(code.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
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
                      <TableHead>{t('admin.name')}</TableHead><TableHead>Email</TableHead><TableHead>{t('admin.inviteCode')}</TableHead><TableHead>{t('admin.regDate')}</TableHead><TableHead className="text-right">{t('admin.actions')}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.name}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell className="font-mono text-sm">{u.invite_code || '—'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{new Date(u.created_at).toLocaleDateString('ru-RU')}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => deleteUser(u.user_id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
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
      </main>
    </div>
  );
};

export default Admin;
