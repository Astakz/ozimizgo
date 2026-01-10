import { useState } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { PDFUploader } from '@/components/PDFUploader';
import { ExtractedDataPreview } from '@/components/ExtractedDataPreview';
import { ObjectionDocument } from '@/components/ObjectionDocument';
import { extractTextFromPDF, extractNotarialData } from '@/utils/pdfParser';
import { generateObjectionDocument } from '@/utils/generateObjection';
import type { ParsedDocument } from '@/types/notarial';
import { Separator } from '@/components/ui/separator';
import { ArrowDown } from 'lucide-react';

const Index = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedDocument, setParsedDocument] = useState<ParsedDocument | null>(null);
  const [objectionText, setObjectionText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setParsedDocument(null);
    setObjectionText(null);

    try {
      const text = await extractTextFromPDF(file);
      
      if (!text || text.trim().length < 50) {
        throw new Error('PDF-файл пуст или не содержит достаточно текста');
      }

      const parsed = extractNotarialData(text);
      setParsedDocument(parsed);

      if (parsed.isValid) {
        const objection = generateObjectionDocument(parsed.extractedData);
        setObjectionText(objection);
      } else {
        setError('Не удалось извлечь основные данные из документа. Проверьте, что загружен корректный PDF исполнительной надписи.');
      }
    } catch (err) {
      console.error('Error processing PDF:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при обработке PDF файла');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Upload Section */}
          <section className="animate-fade-in">
            <PDFUploader
              onFileSelect={handleFileSelect}
              isProcessing={isProcessing}
              isProcessed={!!parsedDocument && parsedDocument.isValid}
              error={error}
            />
          </section>

          {/* Extracted Data Section */}
          {parsedDocument && (
            <>
              <div className="flex justify-center">
                <ArrowDown className="h-8 w-8 text-gold animate-bounce" />
              </div>
              
              <section>
                <ExtractedDataPreview
                  data={parsedDocument.extractedData}
                  errors={parsedDocument.errors}
                />
              </section>
            </>
          )}

          {/* Generated Document Section */}
          {objectionText && (
            <>
              <Separator className="my-8" />
              
              <section>
                <ObjectionDocument documentText={objectionText} />
              </section>
            </>
          )}

          {/* Instructions when no document */}
          {!parsedDocument && !isProcessing && (
            <section className="text-center py-8 animate-fade-in">
              <h2 className="text-xl font-serif font-semibold text-foreground mb-4">
                Как это работает?
              </h2>
              <div className="grid md:grid-cols-3 gap-6 mt-6">
                {[
                  { step: '1', title: 'Загрузите PDF', desc: 'Исполнительная надпись нотариуса из Е-Нотариат' },
                  { step: '2', title: 'Автоматическая обработка', desc: 'Извлечение всех необходимых данных' },
                  { step: '3', title: 'Готовый документ', desc: 'Возражение в официальном формате РК' },
                ].map((item) => (
                  <div key={item.step} className="p-6 rounded-lg bg-card shadow-card border">
                    <div className="w-10 h-10 rounded-full bg-gold text-navy-deep font-bold flex items-center justify-center mx-auto mb-3">
                      {item.step}
                    </div>
                    <h3 className="font-semibold text-foreground">{item.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
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
