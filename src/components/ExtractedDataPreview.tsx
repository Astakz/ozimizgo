import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileSearch, User, Building2, Banknote, Hash, Calendar, CalendarIcon, AlertTriangle, Pencil, Check, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { NotarialData } from '@/types/notarial';
import { useTranslation } from 'react-i18next';

interface ExtractedDataPreviewProps {
  data: NotarialData;
  errors: string[];
  onDataChange: (data: NotarialData) => void;
  onGenerate: () => void;
}

export function ExtractedDataPreview({ data, errors, onDataChange, onGenerate }: ExtractedDataPreviewProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<NotarialData>(data);
  const [objectionDate, setObjectionDate] = useState<Date | undefined>(new Date());

  const formatObjectionDate = (date: Date): string => {
    const day = format(date, 'd', { locale: ru });
    const month = format(date, 'MMMM', { locale: ru });
    const year = format(date, 'yyyy', { locale: ru });
    return `«${day}» ${month} ${year} г.`;
  };

  useEffect(() => {
    if (!data.objectionDate && objectionDate) {
      const formattedDate = formatObjectionDate(objectionDate);
      onDataChange({ ...data, objectionDate: formattedDate });
    }
  }, []);

  const handleDateSelect = (date: Date | undefined) => {
    setObjectionDate(date);
    if (date) {
      const formattedDate = formatObjectionDate(date);
      const updated = { ...editedData, objectionDate: formattedDate };
      setEditedData(updated);
      onDataChange(updated);
    }
  };

  const handleFieldChange = (field: keyof NotarialData, value: string) => {
    const updated = { ...editedData, [field]: value };
    setEditedData(updated);
  };

  const handleSave = () => { onDataChange(editedData); setIsEditing(false); };
  const handleCancel = () => { setEditedData(data); setIsEditing(false); };

  const dataFields: { key: keyof NotarialData; icon: any; label: string; sublabelKey?: keyof NotarialData; highlight?: boolean }[] = [
    { key: 'notaryName', icon: User, label: t('field.notaryName'), sublabelKey: 'notaryLicense' },
    { key: 'enforcementNumber', icon: Hash, label: t('field.enforcementNumber'), sublabelKey: 'registryNumber' },
    { key: 'enforcementDate', icon: Calendar, label: t('field.enforcementDate') },
    { key: 'debtorName', icon: User, label: t('field.debtorName'), sublabelKey: 'debtorIIN' },
    { key: 'creditorName', icon: Building2, label: t('field.creditorName') },
    { key: 'debtAmount', icon: Banknote, label: t('field.debtAmount'), sublabelKey: 'debtAmountWords' },
    { key: 'notaryExpenses', icon: Banknote, label: t('field.notaryExpenses') },
    { key: 'totalAmount', icon: Banknote, label: t('field.totalAmount'), sublabelKey: 'totalAmountWords', highlight: true },
  ];

  const allFields: { key: keyof NotarialData; label: string }[] = [
    { key: 'notaryName', label: t('field.notaryNameFull') },
    { key: 'notaryLicense', label: t('field.notaryLicense') },
    { key: 'notaryLicenseDate', label: t('field.notaryLicenseDate') },
    { key: 'enforcementNumber', label: t('field.enforcementNumberFull') },
    { key: 'enforcementDate', label: t('field.enforcementDateFull') },
    { key: 'registryNumber', label: t('field.registryNumber') },
    { key: 'debtorName', label: t('field.debtorNameFull') },
    { key: 'debtorIIN', label: t('field.debtorIIN') },
    { key: 'debtorEmail', label: t('field.debtorEmail') },
    { key: 'creditorName', label: t('field.creditorNameFull') },
    { key: 'debtAmount', label: t('field.debtAmountFull') },
    { key: 'debtAmountWords', label: t('field.debtAmountWords') },
    { key: 'notaryExpenses', label: t('field.notaryExpensesFull') },
    { key: 'totalAmount', label: t('field.totalAmountFull') },
    { key: 'totalAmountWords', label: t('field.totalAmountWords') },
  ];

  if (isEditing) {
    return (
      <Card className="shadow-card animate-fade-in">
        <CardHeader className="border-b bg-muted/30 p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Pencil className="h-4 w-4 sm:h-5 sm:w-5 text-gold" />
            {t('extracted.editing')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
            {allFields.map((field) => (
              <div key={field.key} className="space-y-1.5 sm:space-y-2">
                <Label htmlFor={field.key} className="text-xs sm:text-sm font-medium">{field.label}</Label>
                <Input id={field.key} value={editedData[field.key]} onChange={(e) => handleFieldChange(field.key, e.target.value)} placeholder={`${t('extracted.enterPrefix')} ${field.label.toLowerCase()}`} className="border-border focus:ring-gold focus:border-gold text-sm" />
              </div>
            ))}
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 mt-4 sm:mt-6 sm:justify-end">
            <Button variant="outline" onClick={handleCancel} className="w-full sm:w-auto">{t('extracted.cancel')}</Button>
            <Button onClick={handleSave} className="gold-button w-full sm:w-auto">
              <Check className="h-4 w-4 mr-2" />{t('extracted.save')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card animate-fade-in">
      <CardHeader className="border-b bg-muted/30 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <FileSearch className="h-4 w-4 sm:h-5 sm:w-5 text-gold" />
            {t('extracted.title')}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-2 w-full sm:w-auto">
            <Pencil className="h-4 w-4" />{t('extracted.edit')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {errors.length > 0 && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-2 text-amber-700 font-medium mb-2 text-sm sm:text-base">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{t('extracted.warnings')}</span>
            </div>
            <ul className="text-xs sm:text-sm text-amber-600 space-y-1">
              {errors.map((error, idx) => (<li key={idx}>• {error}</li>))}
            </ul>
          </div>
        )}
        
        <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
          {dataFields.map((field) => (
            <div key={field.key} className={`p-3 sm:p-4 rounded-lg border ${field.highlight ? 'bg-gold/10 border-gold/30' : 'bg-muted/20 border-border'}`}>
              <div className="flex items-start gap-2 sm:gap-3">
                <field.icon className={`h-4 w-4 sm:h-5 sm:w-5 mt-0.5 shrink-0 ${field.highlight ? 'text-gold-dark' : 'text-navy-medium'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{field.label}</p>
                  <p className={`font-medium text-sm sm:text-base break-words ${field.highlight ? 'sm:text-lg text-gold-dark' : ''}`}>
                    {data[field.key] ? (
                      field.key.includes('Amount') || field.key.includes('Expenses') ? `${data[field.key]} ₸` : field.key === 'enforcementNumber' ? `№ ${data[field.key]}` : data[field.key]
                    ) : (
                      <span className="text-muted-foreground italic">{t('extracted.notFound')}</span>
                    )}
                  </p>
                  {field.sublabelKey && data[field.sublabelKey] && (
                    <p className="text-xs sm:text-sm text-muted-foreground break-words">
                      {field.sublabelKey === 'notaryLicense' && `${t('field.notaryLicense')} № ${data[field.sublabelKey]}${data.notaryLicenseDate ? ` от ${data.notaryLicenseDate}` : ''}`}
                      {field.sublabelKey === 'registryNumber' && `${t('field.registryNumber')} № ${data[field.sublabelKey]}`}
                      {field.sublabelKey === 'debtorIIN' && `${t('field.debtorIIN')}: ${data[field.sublabelKey]}`}
                      {field.sublabelKey === 'debtAmountWords' && data[field.sublabelKey]}
                      {field.sublabelKey === 'totalAmountWords' && data[field.sublabelKey]}
                    </p>
                  )}
                </div>
                {!data[field.key] && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 shrink-0 text-xs">{t('extracted.missing')}</Badge>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 sm:mt-6 p-3 sm:p-4 rounded-lg border bg-muted/20 border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-navy-medium shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('extracted.objectionDate')}</p>
                <p className="font-medium text-sm sm:text-base">{data.objectionDate || t('extracted.notSpecified')}</p>
              </div>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 w-full sm:w-auto">
                  <CalendarIcon className="h-4 w-4" />{t('extracted.changeDate')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent mode="single" selected={objectionDate} onSelect={handleDateSelect} initialFocus locale={ru} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t">
          <Button onClick={onGenerate} className="w-full gold-button py-5 sm:py-6 text-base sm:text-lg">
            <FileText className="h-5 w-5 mr-2" />{t('extracted.generate')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
