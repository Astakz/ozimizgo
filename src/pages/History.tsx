import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Image, Trash2, Download, Eye, Loader2, FileStack } from 'lucide-react';
import { toast } from 'sonner';
import { generateSelectablePDF } from '@/utils/pdfDocumentGenerator';

interface DocumentRecord {
  id: string;
  original_filename: string;
  file_type: string;
  extracted_text: string;
  generated_objection: string;
  extracted_data: NotarialData | null;
  created_at: string;
}

export default function History() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [viewMode, setViewMode] = useState<'text' | 'objection' | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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
      setDocuments((data || []) as DocumentRecord[]);
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
      if (doc.extracted_data) {
        const sections = generateObjectionDocument(doc.extracted_data);
        await generatePDF(sections, doc.extracted_data);
        toast.success('PDF скачан');
      } else {
        // Fallback: download objection as text
        const blob = new Blob([doc.generated_objection], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `objection_${doc.original_filename}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error(e);
      toast.error('Ошибка генерации PDF');
    }
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
          <div className="flex items-center gap-3 mb-6">
            <FileStack className="h-7 w-7 text-gold" />
            <h2 className="text-2xl font-serif font-bold text-foreground">История документов</h2>
          </div>

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
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="mt-0.5 shrink-0">
                          {doc.file_type === 'pdf' ? (
                            <FileText className="h-5 w-5 text-red-500" />
                          ) : (
                            <Image className="h-5 w-5 text-blue-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate">{doc.original_filename}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">{formatDate(doc.created_at)}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase">
                              {doc.file_type}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                              Создано
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Просмотр текста"
                          onClick={() => { setSelectedDoc(doc); setViewMode('text'); }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Просмотр возражения"
                          onClick={() => { setSelectedDoc(doc); setViewMode('objection'); }}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Скачать PDF"
                          onClick={() => handleDownloadPDF(doc)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
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
              {viewMode === 'text' ? 'Извлечённый текст' : 'Возражение'}
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
