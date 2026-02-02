import { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PDFUploaderProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
  isProcessed: boolean;
  error: string | null;
}

export function PDFUploader({ onFileSelect, isProcessing, isProcessed, error }: PDFUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      setFileName(file.name);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  return (
    <div className="w-full max-w-2xl mx-auto px-2 sm:px-0">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'upload-zone p-6 sm:p-8 md:p-12 cursor-pointer relative overflow-hidden',
          isDragging && 'active',
          isProcessed && !error && 'border-green-500 bg-green-50',
          error && 'border-destructive bg-red-50'
        )}
      >
        <input
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isProcessing}
        />
        
        <div className="flex flex-col items-center gap-3 sm:gap-4 text-center">
          {isProcessing ? (
            <>
              <Loader2 className="h-12 w-12 sm:h-16 sm:w-16 text-gold animate-spin" />
              <div>
                <p className="text-base sm:text-lg font-semibold text-foreground">Обработка документа...</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Извлечение данных из PDF</p>
              </div>
            </>
          ) : isProcessed && !error ? (
            <>
              <CheckCircle className="h-12 w-12 sm:h-16 sm:w-16 text-green-600" />
              <div>
                <p className="text-base sm:text-lg font-semibold text-green-700">Документ обработан!</p>
                <p className="text-xs sm:text-sm text-green-600 mt-1 break-all">{fileName}</p>
              </div>
            </>
          ) : error ? (
            <>
              <AlertCircle className="h-12 w-12 sm:h-16 sm:w-16 text-destructive" />
              <div>
                <p className="text-base sm:text-lg font-semibold text-destructive">Ошибка обработки</p>
                <p className="text-xs sm:text-sm text-destructive/80 mt-1">{error}</p>
              </div>
            </>
          ) : (
            <>
              <div className="relative">
                <Upload className="h-12 w-12 sm:h-16 sm:w-16 text-navy-medium" />
                <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-gold absolute -bottom-1 -right-1" />
              </div>
              <div>
                <p className="text-base sm:text-lg font-semibold text-foreground">
                  Загрузите исполнительную надпись
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  <span className="hidden sm:inline">Перетащите PDF-файл сюда или </span>
                  <span className="sm:hidden">Нажмите для </span>
                  нажмите для выбора
                </p>
                <p className="text-xs text-muted-foreground mt-2 sm:mt-3">
                  Поддерживается только PDF формат (Е-Нотариат)
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
