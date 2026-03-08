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

const ObjectionGenerator = () => {
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

      if (user) {
        const { error } = await supabase.from('documents').insert({
          user_id: user.id,
          original_filename: fileInfoRef.current.name,
          file_type: fileInfoRef.current.type,
          extracted_text: extractedTextRef.current,
          generated_objection: objection,
          extracted_data: currentData as any,
        });
        if (error) {
          console.error('Error saving document:', error);
        } else {
          toast.success('Документ сохранён в историю');
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
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ObjectionGenerator;
