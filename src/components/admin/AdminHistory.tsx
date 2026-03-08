import { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Trash2, Loader2, Search, Eye, Download, FileText, Image, CalendarIcon, X, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateSelectablePDF } from '@/utils/pdfDocumentGenerator';

interface UserDoc {
  id: string;
  user_id: string;
  original_filename: string;
  file_type: string;
  extracted_text: string;
  generated_objection: string;
  extracted_data: any;
  created_at: string;
  user_name: string;
  user_nickname: string;
  user_avatar: string | null;
  user_role: string;
}

const ROLE_LABELS: Record<string, string> = {
  user: 'Клиент',
  lawyer: 'Юрист',
  admin: 'Админ',
};

export default function AdminHistory() {
  const [documents, setDocuments] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<UserDoc | null>(null);
  const [viewMode, setViewMode] = useState<'text' | 'objection' | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [docsRes, rolesRes] = await Promise.all([
      supabase.from('documents').select('*').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('user_id, role'),
    ]);

    if (docsRes.error) {
      toast({ title: 'Ошибка', description: docsRes.error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const docs = docsRes.data || [];
    const roleMap: Record<string, string> = {};
    (rolesRes.data || []).forEach((r: any) => { roleMap[r.user_id] = r.role; });

    const userIds = [...new Set(docs.map(d => d.user_id))];
    let profileMap: Record<string, { name: string; nickname: string; avatar: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, nickname, avatar_url')
        .in('user_id', userIds);
      (profiles || []).forEach(p => {
        profileMap[p.user_id] = {
          name: p.full_name || p.nickname || 'Аноним',
          nickname: p.nickname || '',
          avatar: p.avatar_url,
        };
      });
    }

    setDocuments(docs.map(d => ({
      ...d,
      user_name: profileMap[d.user_id]?.name || 'Неизвестный',
      user_nickname: profileMap[d.user_id]?.nickname || '',
      user_avatar: profileMap[d.user_id]?.avatar || null,
      user_role: roleMap[d.user_id] || 'user',
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      if (selectedUserId && doc.user_id !== selectedUserId) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !doc.user_name.toLowerCase().includes(q) &&
          !doc.user_nickname.toLowerCase().includes(q) &&
          !doc.original_filename.toLowerCase().includes(q)
        ) return false;
      }
      if (roleFilter !== 'all' && doc.user_role !== roleFilter) return false;
      const docDate = new Date(doc.created_at);
      if (dateFrom) { const f = new Date(dateFrom); f.setHours(0, 0, 0, 0); if (docDate < f) return false; }
      if (dateTo) { const t = new Date(dateTo); t.setHours(23, 59, 59, 999); if (docDate > t) return false; }
      return true;
    });
  }, [documents, searchQuery, roleFilter, dateFrom, dateTo, selectedUserId]);

  // Unique users for "view user history"
  const uniqueUsers = useMemo(() => {
    const map = new Map<string, UserDoc>();
    documents.forEach(d => { if (!map.has(d.user_id)) map.set(d.user_id, d); });
    return Array.from(map.values());
  }, [documents]);

  const hasActiveFilters = searchQuery || roleFilter !== 'all' || dateFrom || dateTo || selectedUserId;
  const clearFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
    setSelectedUserId(null);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    } else {
      setDocuments(prev => prev.filter(d => d.id !== id));
      toast({ title: 'Документ удалён' });
    }
  };

  const handleDownload = async (doc: UserDoc) => {
    try {
      setDownloading(doc.id);
      const pdf = await generateSelectablePDF(doc.generated_objection, null);
      pdf.save(`${doc.original_filename.replace(/\.[^.]+$/, '')}_возражение.pdf`);
      toast({ title: 'PDF скачан' });
    } catch {
      toast({ title: 'Ошибка генерации PDF', variant: 'destructive' });
    } finally {
      setDownloading(null);
    }
  };

  const initials = (name: string) => (name || '?').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Поиск по имени, username или файлу..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Все роли" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все роли</SelectItem>
              <SelectItem value="user">Клиент</SelectItem>
              <SelectItem value="lawyer">Юрист</SelectItem>
              <SelectItem value="admin">Админ</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-2 text-xs", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateFrom ? format(dateFrom, 'dd.MM.yyyy', { locale: ru }) : 'Дата от'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-2 text-xs", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateTo ? format(dateTo, 'dd.MM.yyyy', { locale: ru }) : 'Дата до'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          {selectedUserId && (
            <Badge variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => setSelectedUserId(null)}>
              <User className="h-3 w-3" />
              {documents.find(d => d.user_id === selectedUserId)?.user_name}
              <X className="h-3 w-3" />
            </Badge>
          )}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs text-muted-foreground">
              <X className="h-3.5 w-3.5" /> Сбросить
            </Button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            Найдено: {filteredDocs.length} из {documents.length}
          </span>
        </div>
      </div>

      {/* Table */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">
            {selectedUserId
              ? `История: ${documents.find(d => d.user_id === selectedUserId)?.user_name}`
              : 'История всех пользователей'}
          </CardTitle>
          <CardDescription>Документы и возражения всех пользователей</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filteredDocs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Нет документов</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Пользователь</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead>Документ</TableHead>
                    <TableHead className="hidden md:table-cell">Тип</TableHead>
                    <TableHead className="hidden md:table-cell">Дата</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocs.map(doc => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <button className="flex items-center gap-2 hover:underline text-left" onClick={() => setSelectedUserId(doc.user_id)}>
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={doc.user_avatar || ''} />
                            <AvatarFallback className="text-xs bg-muted">{initials(doc.user_name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{doc.user_name}</p>
                            {doc.user_nickname && <p className="text-xs text-muted-foreground">@{doc.user_nickname}</p>}
                          </div>
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{ROLE_LABELS[doc.user_role] || doc.user_role}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {doc.file_type === 'pdf' ? <FileText className="h-4 w-4 text-destructive shrink-0" /> : <Image className="h-4 w-4 text-primary shrink-0" />}
                          <span className="text-sm truncate max-w-[180px]">{doc.original_filename}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted uppercase">{doc.file_type}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {new Date(doc.created_at).toLocaleDateString('ru-RU')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Просмотр текста" onClick={() => { setSelectedDoc(doc); setViewMode('text'); }}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Просмотр возражения" onClick={() => { setSelectedDoc(doc); setViewMode('objection'); }}>
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Скачать PDF" disabled={downloading === doc.id} onClick={() => handleDownload(doc)}>
                            {downloading === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Удалить" onClick={() => handleDelete(doc.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View dialog */}
      <Dialog open={!!viewMode} onOpenChange={() => { setViewMode(null); setSelectedDoc(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewMode === 'text' ? 'Извлечённый текст' : 'Возражение'}
              {selectedDoc && ` — ${selectedDoc.original_filename}`}
            </DialogTitle>
            <DialogDescription>
              {selectedDoc && `Пользователь: ${selectedDoc.user_name} (@${selectedDoc.user_nickname}) · ${ROLE_LABELS[selectedDoc.user_role]}`}
            </DialogDescription>
          </DialogHeader>
          <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-lg leading-relaxed">
            {viewMode === 'text' ? selectedDoc?.extracted_text : selectedDoc?.generated_objection}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
