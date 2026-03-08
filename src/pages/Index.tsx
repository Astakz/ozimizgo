import { useState, useRef } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { PDFUploader } from '@/components/PDFUploader';
import { ExtractedDataPreview } from '@/components/ExtractedDataPreview';
import { ObjectionDocument } from '@/components/ObjectionDocument';
import { extractTextFromPDF, extractNotarialData } from '@/utils/pdfParser';
import { generateObjectionDocumentText } from '@/utils/generateObjection';
import { extractTextFromImage } from '@/utils/imageOcr';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { ParsedDocument, NotarialData } from '@/types/notarial';
import { Separator } from '@/components/ui/separator';
import { ArrowDown } from 'lucide-react';
import { toast } from 'sonner';

function isImageFile(file: File): boolean {
  return /^image\/(jpeg|jpg|png)$/.test(file.type) || /\.(jpe?g|png)$/i.test(file.name);
}

const Index = () => {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedDocument, setParsedDocument] = useState<ParsedDocument | null>(null);
  const [currentData, setCurrentData] = useState<NotarialData | null>(null);
  const [objectionText, setObjectionText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const extractedTextRef = useRef<string>('');
  const fileInfoRef = useRef<{ name: string; type: string }>({ name: '', type: '' });

  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setParsedDocument(null);
    setCurrentData(null);
    setObjectionText(null);

    try {
      let text: string;
      const isImage = isImageFile(file);
      fileInfoRef.current = { name: file.name, type: isImage ? 'image' : 'pdf' };

      if (isImage) {
        text = await extractTextFromImage(file);
      } else {
        text = await extractTextFromPDF(file);
      }
      
      if (!text || text.trim().length < 50) {
        throw new Error('Файл пуст или не содержит достаточно текста');
      }

      const parsed = extractNotarialData(text);
      extractedTextRef.current = text;
      setParsedDocument(parsed);
      setCurrentData(parsed.extractedData);

    } catch (err) {
      console.error('Error processing file:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при обработке файла');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDataChange = (updatedData: NotarialData) => {
    setCurrentData(updatedData);
    setObjectionText(null);
  };

  const handleGenerate = async () => {
    if (currentData) {
      const objection = generateObjectionDocumentText(currentData);
      setObjectionText(objection);

      // Save to history with PDF upload
      if (user) {
        try {
          // Generate PDF blob
          const { generateSelectablePDF } = await import('@/utils/pdfDocumentGenerator');
          const pdfDoc = await generateSelectablePDF(objection, null);
          const pdfBlob = pdfDoc.output('blob');
          
          const fileName = `${user.id}/${Date.now()}_${fileInfoRef.current.name.replace(/\.[^.]+$/, '')}.pdf`;
          
          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(fileName, pdfBlob, { contentType: 'application/pdf' });

          let fileUrl: string | null = null;
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName);
            fileUrl = urlData.publicUrl;
          }

          const { error } = await supabase.from('documents').insert({
            user_id: user.id,
            original_filename: fileInfoRef.current.name,
            file_type: fileInfoRef.current.type,
            extracted_text: extractedTextRef.current,
            generated_objection: objection,
            extracted_data: currentData as any,
            file_url: fileUrl,
          } as any);
          if (error) {
            console.error('Error saving document:', error);
          } else {
            toast.success('Документ сохранён в историю');
          }
        } catch (saveErr) {
          console.error('Error saving document:', saveErr);
        }
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-3 sm:px-4 py-6 sm:py-8 md:py-12">
        <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
          <section className="animate-fade-in">
            <PDFUploader
              onFileSelect={handleFileSelect}
              isProcessing={isProcessing}
              isProcessed={!!parsedDocument}
              error={error}
            />
          </section>

          {parsedDocument && currentData && (
            <>
              <div className="flex justify-center">
                <ArrowDown className="h-6 w-6 sm:h-8 sm:w-8 text-gold animate-bounce" />
              </div>
              
              <section>
                <ExtractedDataPreview
                  data={currentData}
                  errors={parsedDocument.errors}
                  onDataChange={handleDataChange}
                  onGenerate={handleGenerate}
                />
              </section>
            </>
          )}

          {objectionText && (
            <>
              <Separator className="my-6 sm:my-8" />
              
              <section>
                <ObjectionDocument documentText={objectionText} />
              </section>
            </>
          )}

          {!parsedDocument && !isProcessing && (
            <section className="text-center py-6 sm:py-8 animate-fade-in">
              <h2 className="text-lg sm:text-xl font-serif font-semibold text-foreground mb-3 sm:mb-4">
                Как это работает?
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mt-4 sm:mt-6">
                {[
                  { step: '1', title: 'Загрузите документ', desc: 'PDF, фото или скриншот исполнительной надписи' },
                  { step: '2', title: 'Проверьте данные', desc: 'Отредактируйте при необходимости' },
                  { step: '3', title: 'Готовый документ', desc: 'Возражение в официальном формате РК' },
                ].map((item) => (
                  <div key={item.step} className="p-4 sm:p-6 rounded-lg bg-card shadow-card border">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gold text-navy-deep font-bold flex items-center justify-center mx-auto mb-2 sm:mb-3 text-sm sm:text-base">
                      {item.step}
                    </div>
                    <h3 className="font-semibold text-foreground text-sm sm:text-base">{item.title}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
