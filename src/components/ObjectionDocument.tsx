import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Copy, Download, Check, Printer, Loader2, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SignaturePad } from './SignaturePad';
import { PDFPreviewModal } from './PDFPreviewModal';
import { generateSelectablePDF } from '@/utils/pdfDocumentGenerator';
import { useTranslation } from 'react-i18next';
import type { DocumentSection } from '@/utils/generateObjection';

interface ObjectionDocumentProps {
  documentText: string;
  documentSections?: DocumentSection[];
}

export function ObjectionDocument({ documentText }: ObjectionDocumentProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const documentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => { if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl); };
  }, [pdfBlobUrl]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(documentText);
    setCopied(true);
    toast({ title: t('objection.copiedTitle'), description: t('objection.copiedDesc') });
    setTimeout(() => setCopied(false), 2000);
  };

  const generatePDFDocument = useCallback(async () => {
    return generateSelectablePDF(documentText, signatureDataUrl);
  }, [documentText, signatureDataUrl]);

  const handlePreviewPDF = async () => {
    setIsGeneratingPDF(true);
    setIsPreviewOpen(true);
    if (pdfBlobUrl) { URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null); }
    try {
      const doc = await generatePDFDocument();
      const blob = doc.output('blob');
      setPdfBlobUrl(URL.createObjectURL(blob));
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({ title: t('common.error'), description: t('objection.pdfError'), variant: 'destructive' });
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
      toast({ title: t('objection.pdfDownloaded'), description: t('objection.pdfDownloadedDesc') });
    }
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const doc = await generatePDFDocument();
      doc.save('Возражение_на_исполнительную_надпись.pdf');
      toast({ title: t('objection.pdfDownloaded'), description: t('objection.pdfDownloadedDesc') });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({ title: t('common.error'), description: t('objection.pdfError'), variant: 'destructive' });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html><html><head><title>${t('header.title')}</title>
        <style>
          @page { size: A4; margin: 2cm; }
          body { font-family: 'Times New Roman', Times, serif; font-size: 14pt; line-height: 1.8; padding: 2cm; }
          .header { text-align: right; margin-bottom: 30px; }
          .header-line { margin: 2px 0; } .header-italic { font-style: italic; } .header-bold { font-weight: bold; }
          .title { text-align: center; font-weight: bold; font-size: 16pt; margin: 20px 0 10px 0; }
          .subtitle { text-align: center; font-style: italic; margin: 5px 0; }
          .body-text { text-align: justify; margin: 15px 0; text-indent: 30px; }
          .body-text-no-indent { text-align: justify; margin: 15px 0; }
          .signature-section { margin-top: 40px; }
          .signature-image { margin-top: 5px; margin-left: 60px; }
          @media print { body { padding: 0; } }
        </style></head><body>
        <div class="document-content">${formatForPrint(documentText, signatureDataUrl)}</div>
        </body></html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const formatForPrint = (text: string, signature: string | null): string => {
    const lines = text.split('\n');
    let html = '';
    let inHeader = true;
    let headerContent = '';
    for (const line of lines) {
      if (line.trim() === '') {
        if (inHeader && headerContent) { html += `<div class="header">${headerContent}</div>`; headerContent = ''; inHeader = false; }
        continue;
      }
      if (inHeader && line.startsWith('                                                                     ')) {
        const content = line.trim();
        if (content.includes('Нотариусу') || content.includes('Лицензия') || content.includes('ИИН') || content.includes('Эл. почта')) {
          headerContent += `<div class="header-line header-italic">${content}</div>`;
        } else if (content.includes('от:')) {
          headerContent += `<div class="header-line header-bold">${content}</div>`;
        } else { headerContent += `<div class="header-line">${content}</div>`; }
      } else if (line.includes('ВОЗРАЖЕНИЕ') || line.includes('ПРОШУ ВАС')) {
        inHeader = false; html += `<div class="title">${line.trim()}</div>`;
      } else if (line.includes('на исполнительную надпись нотариуса') || line.match(/^\s+№\s/)) {
        html += `<div class="subtitle">${line.trim()}</div>`;
      } else if (line.includes('Подпись:')) {
        if (signature) html += `<div class="signature-image"><img src="${signature}" alt="Подпись" style="max-height: 50px;" /></div>`;
        html += `<p class="body-text-no-indent">Подпись: ____________________</p>`;
      } else { inHeader = false; html += `<p class="body-text-no-indent">${line}</p>`; }
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
                if (content.includes('Нотариусу') || content.includes('Лицензия') || content.includes('ИИН') || content.includes('Эл. почта')) className += " italic";
                else if (content.includes('от:')) className += " font-bold";
                return <div key={idx} className={className}>{content}</div>;
              })}
            </div>
          );
          headerLines = []; inHeader = false;
        }
        continue;
      }
      if (inHeader && line.startsWith('                                                                     ')) { headerLines.push(line); }
      else if (line.includes('ВОЗРАЖЕНИЕ') && !line.includes('на исполнительную')) { inHeader = false; elements.push(<h1 key={key++} className="text-center font-bold text-xl mt-8 mb-2">{line.trim()}</h1>); }
      else if (line.includes('ПРОШУ ВАС')) { elements.push(<h2 key={key++} className="text-center font-bold text-lg mt-8 mb-4">{line.trim()}</h2>); }
      else if (line.includes('на исполнительную надпись нотариуса')) { elements.push(<div key={key++} className="text-center italic text-sm mb-1">{line.trim()}</div>); }
      else if (line.match(/^\s+№\s/)) { elements.push(<div key={key++} className="text-center italic text-sm mb-6">{line.trim()}</div>); }
      else if (line.includes('На основании выше сказанного')) { elements.push(<p key={key++} className="text-sm leading-relaxed mt-6 mb-2">{line}</p>); }
      else if (line.includes('Подпись:')) {
        elements.push(
          <div key={key++} className="mt-2 text-sm">
            {signatureDataUrl && <div className="mb-1 ml-16"><img src={signatureDataUrl} alt="Подпись" className="h-12" /></div>}
            <div>Подпись: ____________________</div>
          </div>
        );
      } else if (line.includes('«____»')) { elements.push(<div key={key++} className="mt-4 text-sm">{line}</div>); }
      else { inHeader = false; elements.push(<p key={key++} className="text-sm leading-relaxed text-justify my-3">{line}</p>); }
    }
    return elements;
  };

  return (
    <>
      <div className="space-y-4 sm:space-y-6">
        <Card className="shadow-elevated animate-fade-in">
          <CardHeader className="border-b navy-gradient text-primary-foreground p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:gap-4">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-gold" />
                {t('objection.title')}
              </CardTitle>
              <div className="grid grid-cols-2 sm:flex gap-2 sm:flex-wrap">
                <Button variant="secondary" size="sm" onClick={handleCopy} className="gold-button text-xs sm:text-sm">
                  {copied ? <Check className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> : <Copy className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />}
                  {copied ? t('objection.copied') : t('objection.copy')}
                </Button>
                <Button variant="secondary" size="sm" onClick={handlePreviewPDF} className="gold-button text-xs sm:text-sm" disabled={isGeneratingPDF}>
                  <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  <span className="hidden xs:inline">{t('objection.preview')}</span>
                  <span className="xs:hidden">{t('objection.previewShort')}</span>
                </Button>
                <Button variant="secondary" size="sm" onClick={handleDownloadPDF} className="gold-button text-xs sm:text-sm" disabled={isGeneratingPDF}>
                  {isGeneratingPDF ? <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 animate-spin" /> : <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />}
                  {isGeneratingPDF ? t('objection.generating') : t('objection.download')}
                </Button>
                <Button variant="secondary" size="sm" onClick={handlePrint} className="gold-button text-xs sm:text-sm">
                  <Printer className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />{t('objection.print')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="legal-document p-4 sm:p-6 md:p-10 lg:p-12 max-h-[60vh] sm:max-h-[70vh] overflow-y-auto bg-paper">
              <div ref={documentRef} className="max-w-[800px] mx-auto bg-white shadow-lg border border-gray-200 p-4 sm:p-8 md:p-12 relative" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                <img src="/watermark-logo.png" alt="" className="absolute top-2 left-2 sm:top-4 sm:left-4 w-12 h-12 sm:w-16 sm:h-16 opacity-15 pointer-events-none select-none" aria-hidden="true" />
                {renderFormattedDocument()}
              </div>
            </div>
          </CardContent>
        </Card>
        <SignaturePad onSignatureChange={setSignatureDataUrl} />
      </div>
      <PDFPreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} pdfBlobUrl={pdfBlobUrl} onDownload={handleDownloadFromPreview} isLoading={isGeneratingPDF} />
    </>
  );
}
