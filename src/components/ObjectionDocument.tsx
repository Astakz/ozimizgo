import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Copy, Download, Check, Printer, Loader2, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SignaturePad } from './SignaturePad';
import { PDFPreviewModal } from './PDFPreviewModal';
import { generateSelectablePDF } from '@/utils/pdfDocumentGenerator';
import type { DocumentSection } from '@/utils/generateObjection';

interface ObjectionDocumentProps {
  documentText: string;
  documentSections?: DocumentSection[];
}

export function ObjectionDocument({ documentText }: ObjectionDocumentProps) {
  const [copied, setCopied] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const documentRef = useRef<HTMLDivElement>(null);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(documentText);
    setCopied(true);
    toast({
      title: "Скопировано!",
      description: "Текст возражения скопирован в буфер обмена",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate PDF with selectable text using jsPDF with Cyrillic fonts
  const generatePDFDocument = useCallback(async () => {
    return generateSelectablePDF(documentText, signatureDataUrl);
  }, [documentText, signatureDataUrl]);

  const handlePreviewPDF = async () => {
    setIsGeneratingPDF(true);
    setIsPreviewOpen(true);
    
    // Cleanup previous blob URL
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
    
    try {
      const doc = await generatePDFDocument();
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось сгенерировать PDF",
        variant: "destructive",
      });
      setIsPreviewOpen(false);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleDownloadFromPreview = () => {
    if (pdfBlobUrl) {
      const link = document.createElement('a');
      link.href = pdfBlobUrl;
      link.download = 'Возражение_на_исполнительную_надпись.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "PDF скачан!",
        description: "Документ сохранён на ваше устройство",
      });
    }
  };

  const handleClosePreview = () => {
    setIsPreviewOpen(false);
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    
    try {
      const doc = await generatePDFDocument();
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
            }
            .header {
              text-align: right;
              margin-bottom: 30px;
            }
            .header-line {
              margin: 2px 0;
            }
            .header-italic {
              font-style: italic;
            }
            .header-bold {
              font-weight: bold;
            }
            .title {
              text-align: center;
              font-weight: bold;
              font-size: 16pt;
              margin: 20px 0 10px 0;
            }
            .subtitle {
              text-align: center;
              font-style: italic;
              margin: 5px 0;
            }
            .body-text {
              text-align: justify;
              margin: 15px 0;
              text-indent: 30px;
            }
            .body-text-no-indent {
              text-align: justify;
              margin: 15px 0;
            }
            .underline {
              text-decoration: underline;
            }
            .signature-section {
              margin-top: 40px;
            }
            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="document-content">${formatForPrint(documentText)}</div>
          ${signatureHtml}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const formatForPrint = (text: string): string => {
    const lines = text.split('\n');
    let html = '';
    let inHeader = true;
    let headerContent = '';

    for (const line of lines) {
      if (line.trim() === '') {
        if (inHeader && headerContent) {
          html += `<div class="header">${headerContent}</div>`;
          headerContent = '';
          inHeader = false;
        }
        continue;
      }

      if (inHeader && line.startsWith('                                                                     ')) {
        const content = line.trim();
        if (content.includes('Нотариусу') || content.includes('Лицензия') || content.includes('ИИН') || content.includes('Эл. почта')) {
          headerContent += `<div class="header-line header-italic">${content}</div>`;
        } else if (content.includes('от:')) {
          headerContent += `<div class="header-line header-bold">${content}</div>`;
        } else {
          headerContent += `<div class="header-line">${content}</div>`;
        }
      } else if (line.includes('ВОЗРАЖЕНИЕ') || line.includes('ПРОШУ ВАС')) {
        inHeader = false;
        html += `<div class="title">${line.trim()}</div>`;
      } else if (line.includes('на исполнительную надпись нотариуса') || line.match(/^\s+№\s/)) {
        html += `<div class="subtitle">${line.trim()}</div>`;
      } else {
        inHeader = false;
        html += `<p class="body-text-no-indent">${line}</p>`;
      }
    }

    return html;
  };

  const renderFormattedDocument = () => {
    const lines = documentText.split('\n');
    const elements: JSX.Element[] = [];
    let headerLines: string[] = [];
    let inHeader = true;
    let key = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.trim() === '') {
        if (inHeader && headerLines.length > 0) {
          elements.push(
            <div key={key++} className="text-right mb-8">
              {headerLines.map((hl, idx) => {
                const content = hl.trim();
                let className = "text-sm leading-relaxed";
                if (content.includes('Нотариусу') || content.includes('Лицензия') || content.includes('ИИН') || content.includes('Эл. почта')) {
                  className += " italic";
                } else if (content.includes('от:')) {
                  className += " font-bold";
                }
                return <div key={idx} className={className}>{content}</div>;
              })}
            </div>
          );
          headerLines = [];
          inHeader = false;
        }
        continue;
      }

      if (inHeader && line.startsWith('                                                                     ')) {
        headerLines.push(line);
      } else if (line.includes('ВОЗРАЖЕНИЕ') && !line.includes('на исполнительную')) {
        inHeader = false;
        elements.push(
          <h1 key={key++} className="text-center font-bold text-xl mt-8 mb-2">
            {line.trim()}
          </h1>
        );
      } else if (line.includes('ПРОШУ ВАС')) {
        elements.push(
          <h2 key={key++} className="text-center font-bold text-lg mt-8 mb-4">
            {line.trim()}
          </h2>
        );
      } else if (line.includes('на исполнительную надпись нотариуса')) {
        elements.push(
          <div key={key++} className="text-center italic text-sm mb-1">
            {line.trim()}
          </div>
        );
      } else if (line.match(/^\s+№\s/)) {
        elements.push(
          <div key={key++} className="text-center italic text-sm mb-6">
            {line.trim()}
          </div>
        );
      } else if (line.includes('На основании выше сказанного')) {
        elements.push(
          <p key={key++} className="text-sm leading-relaxed mt-6 mb-2">
            {line}
          </p>
        );
      } else if (line.includes('Подпись:')) {
        elements.push(
          <div key={key++} className="mt-2 text-sm flex items-end gap-2">
            <span>Подпись:</span>
            {signatureDataUrl ? (
              <img src={signatureDataUrl} alt="Подпись" className="h-12 inline-block" />
            ) : (
              <span className="inline-block w-48 border-b border-gray-400"></span>
            )}
          </div>
        );
      } else if (line.includes('«____»')) {
        elements.push(
          <div key={key++} className="mt-4 text-sm">
            {line}
          </div>
        );
      } else {
        inHeader = false;
        elements.push(
          <p key={key++} className="text-sm leading-relaxed text-justify my-3">
            {line}
          </p>
        );
      }
    }

    return elements;
  };

  return (
    <>
      <div className="space-y-6">
        <Card className="shadow-elevated animate-fade-in">
          <CardHeader className="border-b navy-gradient text-primary-foreground">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileText className="h-6 w-6 text-gold" />
                Готовое возражение
              </CardTitle>
              <div className="flex gap-2 flex-wrap">
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
                  onClick={handlePreviewPDF}
                  className="gold-button"
                  disabled={isGeneratingPDF}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Предпросмотр
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
              <div 
                ref={documentRef}
                className="max-w-[800px] mx-auto bg-white shadow-lg border border-gray-200 p-8 md:p-12 relative" 
                style={{ fontFamily: "'Times New Roman', Times, serif" }}
              >
                {/* Watermark logo */}
                <img 
                  src="/watermark-logo.png" 
                  alt="" 
                  className="absolute top-4 left-4 w-16 h-16 opacity-15 pointer-events-none select-none"
                  aria-hidden="true"
                />
                {renderFormattedDocument()}
              </div>
            </div>
          </CardContent>
        </Card>

        <SignaturePad onSignatureChange={setSignatureDataUrl} />
      </div>

      <PDFPreviewModal
        isOpen={isPreviewOpen}
        onClose={handleClosePreview}
        pdfBlobUrl={pdfBlobUrl}
        onDownload={handleDownloadFromPreview}
        isLoading={isGeneratingPDF}
      />
    </>
  );
}
