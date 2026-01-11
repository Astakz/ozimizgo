import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Copy, Download, Check, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SignaturePad } from './SignaturePad';

interface ObjectionDocumentProps {
  documentText: string;
}

export function ObjectionDocument({ documentText }: ObjectionDocumentProps) {
  const [copied, setCopied] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(documentText);
    setCopied(true);
    toast({
      title: "Скопировано!",
      description: "Текст возражения скопирован в буфер обмена",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([documentText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Возражение_на_исполнительную_надпись.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Документ скачан!",
      description: "Файл сохранён на ваше устройство",
    });
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const signatureHtml = signatureDataUrl 
        ? `<div style="margin-top: 20px;"><img src="${signatureDataUrl}" alt="Подпись" style="max-height: 80px;" /></div>`
        : '';
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Возражение на исполнительную надпись</title>
          <style>
            body {
              font-family: 'Times New Roman', Times, serif;
              font-size: 14pt;
              line-height: 1.8;
              padding: 2cm;
              white-space: pre-wrap;
            }
          </style>
        </head>
        <body>${documentText}${signatureHtml}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-elevated animate-fade-in">
        <CardHeader className="border-b navy-gradient text-primary-foreground">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <FileText className="h-6 w-6 text-gold" />
              Готовое возражение
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopy}
                className="gold-button"
              >
                {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {copied ? 'Скопировано' : 'Копировать'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownload}
                className="gold-button"
              >
                <Download className="h-4 w-4 mr-1" />
                Скачать
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePrint}
                className="gold-button"
              >
                <Printer className="h-4 w-4 mr-1" />
                Печать
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="legal-document p-8 md:p-12 max-h-[70vh] overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm md:text-base leading-relaxed font-legal text-foreground">
              {documentText}
            </pre>
            {signatureDataUrl && (
              <div className="mt-4">
                <img src={signatureDataUrl} alt="Подпись" className="max-h-20" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <SignaturePad onSignatureChange={setSignatureDataUrl} />
    </div>
  );
}
