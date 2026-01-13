import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Copy, Download, Check, Printer, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SignaturePad } from './SignaturePad';
import { loadCyrillicFonts, addCyrillicFonts, areFontsLoaded } from '@/utils/pdfFonts';

interface ObjectionDocumentProps {
  documentText: string;
}

export function ObjectionDocument({ documentText }: ObjectionDocumentProps) {
  const [copied, setCopied] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const { toast } = useToast();

  // Preload fonts on component mount
  useEffect(() => {
    loadCyrillicFonts();
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(documentText);
    setCopied(true);
    toast({
      title: "Скопировано!",
      description: "Текст возражения скопирован в буфер обмена",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    
    try {
      // Ensure fonts are loaded
      if (!areFontsLoaded()) {
        await loadCyrillicFonts();
      }

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Add Cyrillic fonts to this document
      const fontsAdded = addCyrillicFonts(doc);
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      let yPosition = margin;
      const lineHeight = 6;

      // Set default font
      const fontName = fontsAdded ? 'Roboto' : 'helvetica';

      // Split text into lines
      const lines = documentText.split('\n');
      
      for (const line of lines) {
        // Check if we need a new page
        if (yPosition > pageHeight - margin - 20) {
          doc.addPage();
          yPosition = margin;
        }

        if (line.trim() === '') {
          yPosition += lineHeight / 2;
          continue;
        }

        // Handle long lines by splitting them
        doc.setFont(fontName, 'normal');
        doc.setFontSize(11);
        const splitLines = doc.splitTextToSize(line, maxWidth);
        
        for (const splitLine of splitLines) {
          if (yPosition > pageHeight - margin - 20) {
            doc.addPage();
            yPosition = margin;
          }
          
          // Check for centered text (ВОЗРАЖЕНИЕ, ПРОШУ ВАС, Основание)
          const trimmedLine = line.trim();
          if (trimmedLine === 'ВОЗРАЖЕНИЕ' || trimmedLine.startsWith('на исполнительную надпись')) {
            doc.setFontSize(14);
            doc.setFont(fontName, 'bold');
            doc.text(splitLine.trim(), pageWidth / 2, yPosition, { align: 'center' });
          } else if (trimmedLine.startsWith('Основание №')) {
            doc.setFontSize(12);
            doc.setFont(fontName, 'bold');
            doc.text(splitLine.trim(), pageWidth / 2, yPosition, { align: 'center' });
          } else if (trimmedLine.includes('ПРОШУ ВАС')) {
            doc.setFontSize(12);
            doc.setFont(fontName, 'bold');
            doc.text(splitLine, margin, yPosition);
          } else {
            doc.setFontSize(11);
            doc.setFont(fontName, 'normal');
            doc.text(splitLine, margin, yPosition);
          }
          
          yPosition += lineHeight;
        }
      }

      // Add signature if exists
      if (signatureDataUrl) {
        if (yPosition > pageHeight - margin - 30) {
          doc.addPage();
          yPosition = margin;
        }
        
        yPosition += 10;
        doc.addImage(signatureDataUrl, 'PNG', margin, yPosition, 50, 20);
      }

      doc.save('Возражение_на_исполнительную_надпись.pdf');
      
      toast({
        title: "PDF скачан!",
        description: "Документ сохранён на ваше устройство",
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось сгенерировать PDF",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
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
            @page {
              size: A4;
              margin: 2cm;
            }
            body {
              font-family: 'Times New Roman', Times, serif;
              font-size: 14pt;
              line-height: 1.8;
              padding: 2cm;
              white-space: pre-wrap;
            }
            @media print {
              body {
                padding: 0;
              }
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
                onClick={handleDownloadPDF}
                className="gold-button"
                disabled={isGeneratingPDF}
              >
                {isGeneratingPDF ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                {isGeneratingPDF ? 'Генерация...' : 'Скачать PDF'}
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
          <div className="legal-document p-6 md:p-10 lg:p-12 max-h-[70vh] overflow-y-auto bg-paper">
            <div className="max-w-[800px] mx-auto bg-white shadow-lg border border-gray-200 p-8 md:p-12">
              <pre className="whitespace-pre-wrap text-[13px] md:text-[14px] leading-[1.8] font-mono text-gray-900" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
                {documentText}
              </pre>
              {signatureDataUrl && (
                <div className="mt-6 ml-0">
                  <img src={signatureDataUrl} alt="Подпись" className="max-h-16" />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <SignaturePad onSignatureChange={setSignatureDataUrl} />
    </div>
  );
}