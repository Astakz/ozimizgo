import { useState, useCallback } from 'react';
import { Upload, FileText, Image, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface PDFUploaderProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
  isProcessed: boolean;
  error: string | null;
}

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png';

function isAcceptedFile(file: File): boolean {
  return ACCEPTED_TYPES.includes(file.type) || /\.(pdf|jpe?g|png)$/i.test(file.name);
}

export function PDFUploader({ onFileSelect, isProcessing, isProcessed, error }: PDFUploaderProps) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && isAcceptedFile(file)) { setFileName(file.name); onFileSelect(file); }
  }, [onFileSelect]);
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setFileName(file.name); onFileSelect(file); }
  }, [onFileSelect]);

  return (
    <div className="w-full max-w-2xl mx-auto px-2 sm:px-0">
      <div
        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
        className={cn(
          'upload-zone p-6 sm:p-8 md:p-12 cursor-pointer relative overflow-hidden',
          isDragging && 'active',
          isProcessed && !error && 'border-green-500 bg-green-50',
          error && 'border-destructive bg-red-50'
        )}
      >
        <input type="file" accept={ACCEPTED_EXTENSIONS} onChange={handleFileInput} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isProcessing} />
        <div className="flex flex-col items-center gap-3 sm:gap-4 text-center">
          {isProcessing ? (
            <>
              <Loader2 className="h-12 w-12 sm:h-16 sm:w-16 text-gold animate-spin" />
              <div>
                <p className="text-base sm:text-lg font-semibold text-foreground">{t('uploader.processing')}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t('uploader.extracting')}</p>
              </div>
            </>
          ) : isProcessed && !error ? (
            <>
              <CheckCircle className="h-12 w-12 sm:h-16 sm:w-16 text-green-600" />
              <div>
                <p className="text-base sm:text-lg font-semibold text-green-700">{t('uploader.processed')}</p>
                <p className="text-xs sm:text-sm text-green-600 mt-1 break-all">{fileName}</p>
              </div>
            </>
          ) : error ? (
            <>
              <AlertCircle className="h-12 w-12 sm:h-16 sm:w-16 text-destructive" />
              <div>
                <p className="text-base sm:text-lg font-semibold text-destructive">{t('uploader.error')}</p>
                <p className="text-xs sm:text-sm text-destructive/80 mt-1">{error}</p>
              </div>
            </>
          ) : (
            <>
              <div className="relative">
                <Upload className="h-12 w-12 sm:h-16 sm:w-16 text-navy-medium" />
                <div className="absolute -bottom-1 -right-1 flex gap-0.5">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-gold" />
                  <Image className="h-5 w-5 sm:h-6 sm:w-6 text-gold" />
                </div>
              </div>
              <div>
                <p className="text-base sm:text-lg font-semibold text-foreground">{t('uploader.upload')}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  <span className="hidden sm:inline">{t('uploader.dragOrClick')}</span>
                  <span className="sm:hidden">{t('uploader.clickToSelect')}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-2 sm:mt-3">{t('uploader.formats')}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
