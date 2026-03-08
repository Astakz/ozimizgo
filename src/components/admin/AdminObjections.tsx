import { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Trash2, Loader2, Search, Eye, Download, FileText, Image, CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateSelectablePDF } from '@/utils/pdfDocumentGenerator';

interface DocumentRecord {
  id: string;
  user_id: string;
  original_filename: string;
  file_type: string;
  extracted_text: string;
  generated_objection: string;
  extracted_data: any;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

export default function AdminObjections() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [viewMode, setViewMode] = useState<'text' | 'objection' | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [userFilter, setUserFilter] = useState('all');

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const docs = data || [];
    const userIds = [...new Set(docs.map(d => d.user_id))];

    let userMap: Record<string, { name: string; email: string }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, nickname, email')
        .in('user_id', userIds);
      (profiles || []).forEach(p => {
        userMap[p.user_id] = {
          name: p.full_name || p.nickname || 'Аноним',
          email: p.email,
        };
      });
    }

    setDocuments(docs.map(d => ({
      ...d,
      user_name: userMap[d.user_id]?.name || 'Неизвестный',
      user_email: userMap[d.user_id]?.email || '',
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const uniqueUsers = useMemo(() => {
    const map = new Map<string, string>();
    documents.forEach(d => {
      if (!map.has(d.user_id)) map.set(d.user_id, d.user_name || '');
    });
    return Array.from(map.entries());
  }, [documents]);

  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!doc.original_filename.toLowerCase().includes(q) && !(doc.user_name || '').toLowerCase().includes(q)) return false;
      }
      if (userFilter !== 'all' && doc.user_id !== userFilter) return false;
      const docDate = new Date(doc.created_at);
      if (dateFrom) { const f = new Date(dateFrom); f.setHours(0,0,0,0); if (docDate < f) return false; }
      if (dateTo) { const t = new Date(dateTo); t.setHours(23,59,59,999); if (docDate > t) return false; }
      return true;
    });
  }, [documents, searchQuery, userFilter, dateFrom, dateTo]);

  const hasActiveFilters = searchQuery || dateFrom || dateTo || userFilter !== 'all';
  const clearFilters = () => { setSearchQuery(''); setDateFrom(undefined); setDateTo(undefined); setUserFilter('all'); };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    } else {
      setDocuments(prev => prev.filter(d => d.id !== id));
      toast({ title: 'Удалено' });
    }
  };

  const handleDownload = async (doc: DocumentRecord) => {
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

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Поиск по файлу или пользователю..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Все пользователи" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все пользователи</SelectItem>
              {uniqueUsers.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
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
          <CardTitle className="text-lg">Возражения</CardTitle>
          <CardDescription>Все сгенерированные возражения</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filteredDocs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Нет возражений</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Файл</TableHead>
                    <TableHead className="hidden sm:table-cell">Пользователь</TableHead>
                    <TableHead className="hidden md:table-cell">Тип</TableHead>
                    <TableHead className="hidden md:table-cell">Дата</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocs.map(doc => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {doc.file_type === 'pdf' ? <FileText className="h-4 w-4 text-destructive shrink-0" /> : <Image className="h-4 w-4 text-primary shrink-0" />}
                          <span className="text-sm truncate max-w-[200px]">{doc.original_filename}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{doc.user_name}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted uppercase">{doc.file_type}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {new Date(doc.created_at).toLocaleDateString('ru-RU')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedDoc(doc); setViewMode('text'); }}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedDoc(doc); setViewMode('objection'); }}>
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={downloading === doc.id} onClick={() => handleDownload(doc)}>
                            {downloading === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(doc.id)}>
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
              {selectedDoc && `Пользователь: ${selectedDoc.user_name}`}
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
