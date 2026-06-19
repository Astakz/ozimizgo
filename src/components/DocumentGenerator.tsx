import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileSignature, Loader2, Download, Printer, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { generateSelectablePDF } from '@/utils/pdfDocumentGenerator';

type DocType =
  | 'objection_executive'
  | 'restructuring'
  | 'penalty_reduction'
  | 'collector_complaint'
  | 'financial_complaint'
  | 'court_claim';

interface FieldsState {
  fullName: string;
  iin: string;
  address: string;
  phone: string;
  email: string;
  creditor: string;
  contractNumber: string;
  contractDate: string;
  amount: string;
  details: string;
}

const EMPTY: FieldsState = {
  fullName: '',
  iin: '',
  address: '',
  phone: '',
  email: '',
  creditor: '',
  contractNumber: '',
  contractDate: '',
  amount: '',
  details: '',
};

export const DocumentGenerator = ({ onGenerated }: { onGenerated?: () => void }) => {
  const { t, i18n } = useTranslation();
  const [docType, setDocType] = useState<DocType>('objection_executive');
  const [fields, setFields] = useState<FieldsState>(EMPTY);
  const [isLoading, setIsLoading] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);

  const update = (k: keyof FieldsState, v: string) =>
    setFields((p) => ({ ...p, [k]: v }));

  const docTypes: { value: DocType; label: string }[] = [
    { value: 'objection_executive', label: t('docGen.types.objection_executive') },
    { value: 'restructuring', label: t('docGen.types.restructuring') },
    { value: 'penalty_reduction', label: t('docGen.types.penalty_reduction') },
    { value: 'collector_complaint', label: t('docGen.types.collector_complaint') },
    { value: 'financial_complaint', label: t('docGen.types.financial_complaint') },
    { value: 'court_claim', label: t('docGen.types.court_claim') },
  ];

  const handleGenerate = async () => {
    if (!fields.fullName.trim()) {
      toast.error(t('docGen.errFullName'));
      return;
    }
    setIsLoading(true);
    setGenerated(null);
    try {
      const { data, error } = await supabase.functions.invoke('ai-lawyer', {
        body: {
          mode: 'generate',
          docType,
          language: i18n.language,
          fields,
        },
      });
      if (error) {
        const ctx: any = (error as any).context;
        if (ctx?.status === 429) toast.error(t('aiLawyer.limitReached'));
        else toast.error(t('common.error'));
        return;
      }
      setGenerated(data.answer);
      onGenerated?.();
      toast.success(t('docGen.ready'));
    } catch (e) {
      console.error(e);
      toast.error(t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!generated) return;
    try {
      const doc = await generateSelectablePDF(generated, null);
      doc.save(`${docType}-${Date.now()}.pdf`);
    } catch (e) {
      console.error(e);
      toast.error(t('common.error'));
    }
  };

  const handleDownloadTxt = () => {
    if (!generated) return;
    const blob = new Blob([generated], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docType}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!generated) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Document</title>
      <style>
        body{font-family:'Times New Roman',serif;font-size:14pt;line-height:1.8;padding:2cm;white-space:pre-wrap;}
      </style></head>
      <body>${generated.replace(/</g, '&lt;')}</body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <Card className="shadow-elevated animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <FileSignature className="h-5 w-5 text-gold" />
          {t('docGen.title')}
        </CardTitle>
        <p className="text-xs sm:text-sm text-muted-foreground">{t('docGen.subtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-sm">{t('docGen.docType')}</Label>
          <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {docTypes.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label className="text-sm">{t('docGen.fields.fullName')} *</Label>
            <Input value={fields.fullName} onChange={(e) => update('fullName', e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-sm">{t('docGen.fields.iin')}</Label>
            <Input value={fields.iin} onChange={(e) => update('iin', e.target.value)} maxLength={12} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-sm">{t('docGen.fields.phone')}</Label>
            <Input value={fields.phone} onChange={(e) => update('phone', e.target.value)} className="mt-1.5" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-sm">{t('docGen.fields.address')}</Label>
            <Input value={fields.address} onChange={(e) => update('address', e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-sm">{t('docGen.fields.email')}</Label>
            <Input value={fields.email} onChange={(e) => update('email', e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-sm">{t('docGen.fields.creditor')}</Label>
            <Input value={fields.creditor} onChange={(e) => update('creditor', e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-sm">{t('docGen.fields.contractNumber')}</Label>
            <Input value={fields.contractNumber} onChange={(e) => update('contractNumber', e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-sm">{t('docGen.fields.contractDate')}</Label>
            <Input type="date" value={fields.contractDate} onChange={(e) => update('contractDate', e.target.value)} className="mt-1.5" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-sm">{t('docGen.fields.amount')}</Label>
            <Input value={fields.amount} onChange={(e) => update('amount', e.target.value)} className="mt-1.5" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-sm">{t('docGen.fields.details')}</Label>
            <Textarea
              value={fields.details}
              onChange={(e) => update('details', e.target.value)}
              rows={4}
              className="mt-1.5"
              placeholder={t('docGen.detailsPlaceholder')}
            />
          </div>
        </div>

        <Button onClick={handleGenerate} disabled={isLoading} size="lg" className="w-full gold-button">
          {isLoading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('docGen.generating')}</>
          ) : (
            <><Sparkles className="h-4 w-4 mr-2" /> {t('docGen.generate')}</>
          )}
        </Button>

        {generated && (
          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleDownloadPdf} variant="default" size="sm">
                <Download className="h-4 w-4 mr-2" /> PDF
              </Button>
              <Button onClick={handleDownloadTxt} variant="secondary" size="sm">
                <Download className="h-4 w-4 mr-2" /> TXT
              </Button>
              <Button onClick={handlePrint} variant="outline" size="sm">
                <Printer className="h-4 w-4 mr-2" /> {t('docGen.print')}
              </Button>
            </div>
            <div className="border rounded-md p-4 bg-muted/30 max-h-[500px] overflow-auto">
              <pre className="whitespace-pre-wrap text-sm font-serif leading-relaxed">{generated}</pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
