import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { FileText, Image, Trash2, Download, Eye, Loader2, FileStack, Search, CalendarIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { generateSelectablePDF } from '@/utils/pdfDocumentGenerator';
import { useTranslation } from 'react-i18next';

interface DocumentRecord {
  id: string;
  original_filename: string;
  file_type: string;
  extracted_text: string;
  generated_objection: string;
  extracted_data: any;
  created_at: string;
  file_url: string | null;
}

export default function History() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [viewMode, setViewMode] = useState<'text' | 'objection' | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      if (searchQuery && !doc.original_filename.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      const docDate = new Date(doc.created_at);
      if (dateFrom && docDate < new Date(dateFrom.setHours(0, 0, 0, 0))) return false;
      if (dateTo && docDate > new Date(new Date(dateTo).setHours(23, 59, 59, 999))) return false;
      return true;
    });
  }, [documents, searchQuery, dateFrom, dateTo]);

  const hasFilters = searchQuery || dateFrom || dateTo;
  const clearFilters = () => { setSearchQuery(''); setDateFrom(undefined); setDateTo(undefined); };

  useEffect(() => { if (user) fetchDocuments(); }, [user]);

  const fetchDocuments = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
    if (error) { toast.error(t('history.loadError')); console.error(error); }
    else setDocuments((data || []) as unknown as DocumentRecord[]);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) toast.error(t('history.deleteError'));
    else { setDocuments(prev => prev.filter(d => d.id !== id)); toast.success(t('history.deleted')); }
    setDeleting(null);
  };

  const handleDownload = async (doc: DocumentRecord) => {
    if (doc.file_url) {
      const link = document.createElement('a');
      link.href = doc.file_url;
      link.download = `${doc.original_filename.replace(/\.[^.]+$/, '')}_возражение.pdf`;
      link.target = '_blank'; link.rel = 'noopener noreferrer';
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      toast.success(t('history.downloadStarted'));
      return;
    }
    try {
      const pdfDoc = await generateSelectablePDF(doc.generated_objection, null);
      const blob = pdfDoc.output('blob');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `${doc.original_filename.replace(/\.[^.]+$/, '')}_возражение.pdf`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(t('history.pdfDownloaded'));
    } catch (e) { console.error(e); toast.error(t('history.pdfError')); }
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-3 sm:px-4 py-6 sm:py-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <FileStack className="h-7 w-7 text-gold" />
            <h2 className="text-2xl font-serif font-bold text-foreground">{t('history.title')}</h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t('history.search')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start text-left font-normal w-full sm:w-[180px]", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, 'dd.MM.yyyy') : t('history.dateFrom')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={ru} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start text-left font-normal w-full sm:w-[180px]", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, 'dd.MM.yyyy') : t('history.dateTo')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={ru} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            {hasFilters && (
              <Button variant="ghost" size="icon" onClick={clearFilters}><X className="h-4 w-4" /></Button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : filteredDocuments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileStack className="h-12 w-12 mx-auto mb-3 opacity-40" />
                {hasFilters ? (<><p className="text-lg font-medium">{t('history.notFound')}</p><p className="text-sm mt-1">{t('history.tryOther')}</p></>) : (<><p className="text-lg font-medium">{t('history.empty')}</p><p className="text-sm mt-1">{t('history.emptyHint')}</p></>)}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredDocuments.map((doc) => (
                <Card key={doc.id} className={cn("transition-all cursor-pointer", activeId === doc.id ? "ring-2 ring-primary shadow-lg" : "hover:shadow-md")} onClick={() => setActiveId(activeId === doc.id ? null : doc.id)}>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="mt-0.5 shrink-0">
                          {doc.file_type === 'pdf' ? <FileText className="h-5 w-5 text-destructive" /> : <Image className="h-5 w-5 text-primary" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate">{doc.original_filename}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">{formatDate(doc.created_at)}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase">{doc.file_type}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground">{t('history.created')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-8 sm:w-8" title={t('history.viewText')} onClick={(e) => { e.stopPropagation(); setSelectedDoc(doc); setViewMode('text'); }}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-8 sm:w-8" title={t('history.viewObjection')} onClick={(e) => { e.stopPropagation(); setSelectedDoc(doc); setViewMode('objection'); }}><FileText className="h-4 w-4" /></Button>
                        <Button variant="default" size="icon" className="h-10 w-10 sm:h-8 sm:w-8" title={t('history.downloadPdf')} onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}><Download className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-8 sm:w-8 text-destructive hover:text-destructive" title={t('history.delete')} disabled={deleting === doc.id} onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}>
                          {deleting === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
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

      <Dialog open={!!viewMode} onOpenChange={() => { setViewMode(null); setSelectedDoc(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewMode === 'text' ? t('history.extractedText') : t('history.objectionText')}
              {selectedDoc && ` — ${selectedDoc.original_filename}`}
            </DialogTitle>
          </DialogHeader>
          <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-lg leading-relaxed">
            {viewMode === 'text' ? selectedDoc?.extracted_text : selectedDoc?.generated_objection}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
