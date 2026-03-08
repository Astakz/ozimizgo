import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { FileText, Image, Trash2, Download, Eye, Loader2, FileStack, DownloadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { generateSelectablePDF } from '@/utils/pdfDocumentGenerator';

interface DocumentRecord {
  id: string;
  original_filename: string;
  file_type: string;
  extracted_text: string;
  generated_objection: string;
  extracted_data: any;
  created_at: string;
}

export default function History() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [viewMode, setViewMode] = useState<'text' | 'objection' | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadAllProgress, setDownloadAllProgress] = useState(0);

  useEffect(() => {
    if (user) fetchDocuments();
  }, [user]);

  const fetchDocuments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Ошибка загрузки истории');
      console.error(error);
    } else {
      setDocuments((data || []) as unknown as DocumentRecord[]);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) {
      toast.error('Ошибка удаления');
    } else {
      setDocuments(prev => prev.filter(d => d.id !== id));
      toast.success('Документ удалён');
    }
    setDeleting(null);
  };

  const handleDownloadPDF = async (doc: DocumentRecord) => {
    try {
      setDownloading(doc.id);
      setDownloadProgress(10);
      await new Promise(r => setTimeout(r, 200));
      setDownloadProgress(40);
      await new Promise(r => setTimeout(r, 200));
      setDownloadProgress(70);
      const pdf = await generateSelectablePDF(doc.generated_objection, null);
      setDownloadProgress(100);
      pdf.save(`${doc.original_filename.replace(/\.[^.]+$/, '')}_возражение.pdf`);
      await new Promise(r => setTimeout(r, 500));
      toast.success('PDF скачан');
    } catch (e) {
      console.error(e);
      toast.error('Ошибка генерации PDF');
    } finally {
      setDownloading(null);
      setDownloadProgress(0);
    }
  };

  const handleDownloadAll = async () => {
    if (documents.length === 0) return;
    setDownloadingAll(true);
    setDownloadAllProgress(0);
    let success = 0;
    for (let i = 0; i < documents.length; i++) {
      try {
        const doc = documents[i];
        const pdf = await generateSelectablePDF(doc.generated_objection, null);
        pdf.save(`${doc.original_filename.replace(/\.[^.]+$/, '')}_возражение.pdf`);
        success++;
      } catch (e) {
        console.error(e);
      }
      setDownloadAllProgress(Math.round(((i + 1) / documents.length) * 100));
    }
    await new Promise(r => setTimeout(r, 400));
    toast.success(`Скачано ${success} из ${documents.length} документов`);
    setDownloadingAll(false);
    setDownloadAllProgress(0);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-3 sm:px-4 py-6 sm:py-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <FileStack className="h-7 w-7 text-secondary" />
              <h1 className="text-2xl font-serif font-bold text-foreground">История документов</h1>
            </div>
            {documents.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={downloadingAll}
                onClick={handleDownloadAll}
                className="gap-2 self-start sm:self-auto"
              >
                {downloadingAll ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <DownloadCloud className="h-4 w-4" />
                )}
                Скачать все ({documents.length})
              </Button>
            )}
          </div>

          {/* Download all progress */}
          {downloadingAll && (
            <div className="mb-4 space-y-1">
              <Progress value={downloadAllProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">{downloadAllProgress}%</p>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileStack className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="text-lg font-medium">Нет сохранённых документов</p>
                <p className="text-sm mt-1">Загрузите документ на главной странице, и он появится здесь</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <Card key={doc.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-3 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      {/* Info */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="mt-0.5 shrink-0">
                          {doc.file_type === 'pdf' ? (
                            <FileText className="h-5 w-5 text-destructive" />
                          ) : (
                            <Image className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate text-sm sm:text-base">{doc.original_filename}</p>
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">{formatDate(doc.created_at)}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase">
                              {doc.file_type}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent-foreground">
                              Создано
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 sm:h-8 sm:w-8"
                          title="Просмотр текста"
                          onClick={() => { setSelectedDoc(doc); setViewMode('text'); }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 sm:h-8 sm:w-8"
                          title="Просмотр возражения"
                          onClick={() => { setSelectedDoc(doc); setViewMode('objection'); }}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 sm:h-8 sm:w-8"
                          title="Скачать PDF"
                          disabled={downloading === doc.id}
                          onClick={() => handleDownloadPDF(doc)}
                        >
                          {downloading === doc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
                          title="Удалить"
                          disabled={deleting === doc.id}
                          onClick={() => handleDelete(doc.id)}
                        >
                          {deleting === doc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Download progress */}
                    {downloading === doc.id && (
                      <div className="mt-3 space-y-1">
                        <Progress value={downloadProgress} className="h-2" />
                        <p className="text-xs text-muted-foreground text-right">{downloadProgress}%</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />

      {/* View dialog */}
      <Dialog open={!!viewMode} onOpenChange={() => { setViewMode(null); setSelectedDoc(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewMode === 'text' ? 'Извлечённый текст' : 'Возражение'}
              {selectedDoc && ` — ${selectedDoc.original_filename}`}
            </DialogTitle>
            <DialogDescription>
              {viewMode === 'text' ? 'Текст, извлечённый из загруженного документа' : 'Сгенерированное возражение на исполнительную надпись'}
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
