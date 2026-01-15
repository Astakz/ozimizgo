import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FileSearch, User, Building2, Banknote, Hash, Calendar, AlertTriangle, Pencil, Check, FileText } from 'lucide-react';
import type { NotarialData } from '@/types/notarial';

interface ExtractedDataPreviewProps {
  data: NotarialData;
  errors: string[];
  onDataChange: (data: NotarialData) => void;
  onGenerate: () => void;
}

export function ExtractedDataPreview({ data, errors, onDataChange, onGenerate }: ExtractedDataPreviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<NotarialData>(data);

  const handleFieldChange = (field: keyof NotarialData, value: string) => {
    const updated = { ...editedData, [field]: value };
    setEditedData(updated);
  };

  const handleSave = () => {
    onDataChange(editedData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedData(data);
    setIsEditing(false);
  };

  const dataFields: { key: keyof NotarialData; icon: any; label: string; sublabelKey?: keyof NotarialData; highlight?: boolean }[] = [
    { key: 'notaryName', icon: User, label: 'Нотариус', sublabelKey: 'notaryLicense' },
    { key: 'enforcementNumber', icon: Hash, label: 'Номер исполнительной надписи', sublabelKey: 'registryNumber' },
    { key: 'enforcementDate', icon: Calendar, label: 'Дата' },
    { key: 'debtorName', icon: User, label: 'Должник', sublabelKey: 'debtorIIN' },
    { key: 'creditorName', icon: Building2, label: 'Взыскатель' },
    { key: 'debtAmount', icon: Banknote, label: 'Сумма задолженности', sublabelKey: 'debtAmountWords' },
    { key: 'notaryExpenses', icon: Banknote, label: 'Расходы нотариуса' },
    { key: 'totalAmount', icon: Banknote, label: 'Общая сумма', sublabelKey: 'totalAmountWords', highlight: true },
  ];

  const allFields: { key: keyof NotarialData; label: string }[] = [
    { key: 'notaryName', label: 'ФИО нотариуса' },
    { key: 'notaryLicense', label: 'Номер лицензии' },
    { key: 'enforcementNumber', label: 'Номер исполнительной надписи' },
    { key: 'enforcementDate', label: 'Дата исполнительной надписи' },
    { key: 'registryNumber', label: 'Номер реестра' },
    { key: 'debtorName', label: 'ФИО должника' },
    { key: 'debtorIIN', label: 'ИИН должника' },
    { key: 'debtorEmail', label: 'Эл. почта должника' },
    { key: 'creditorName', label: 'Наименование взыскателя' },
    { key: 'debtAmount', label: 'Сумма задолженности (тенге)' },
    { key: 'debtAmountWords', label: 'Сумма задолженности прописью' },
    { key: 'notaryExpenses', label: 'Расходы нотариуса (тенге)' },
    { key: 'totalAmount', label: 'Общая сумма взыскания (тенге)' },
    { key: 'totalAmountWords', label: 'Общая сумма прописью' },
    { key: 'objectionDate', label: 'Дата составления возражения' },
  ];

  if (isEditing) {
    return (
      <Card className="shadow-card animate-fade-in">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Pencil className="h-5 w-5 text-gold" />
            Редактирование данных
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-4 md:grid-cols-2">
            {allFields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key} className="text-sm font-medium">
                  {field.label}
                </Label>
                <Input
                  id={field.key}
                  value={editedData[field.key]}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  placeholder={`Введите ${field.label.toLowerCase()}`}
                  className="border-border focus:ring-gold focus:border-gold"
                />
              </div>
            ))}
          </div>
          
          <div className="flex gap-3 mt-6 justify-end">
            <Button variant="outline" onClick={handleCancel}>
              Отмена
            </Button>
            <Button onClick={handleSave} className="gold-button">
              <Check className="h-4 w-4 mr-2" />
              Сохранить изменения
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card animate-fade-in">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSearch className="h-5 w-5 text-gold" />
            Извлечённые данные
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsEditing(true)}
            className="gap-2"
          >
            <Pencil className="h-4 w-4" />
            Редактировать
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {errors.length > 0 && (
          <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
              <AlertTriangle className="h-4 w-4" />
              Предупреждения — проверьте и отредактируйте данные
            </div>
            <ul className="text-sm text-amber-600 space-y-1">
              {errors.map((error, idx) => (
                <li key={idx}>• {error}</li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="grid gap-4 md:grid-cols-2">
          {dataFields.map((field) => (
            <div
              key={field.key}
              className={`p-4 rounded-lg border ${
                field.highlight
                  ? 'bg-gold/10 border-gold/30'
                  : 'bg-muted/20 border-border'
              }`}
            >
              <div className="flex items-start gap-3">
                <field.icon className={`h-5 w-5 mt-0.5 ${field.highlight ? 'text-gold-dark' : 'text-navy-medium'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{field.label}</p>
                  <p className={`font-medium truncate ${field.highlight ? 'text-lg text-gold-dark' : ''}`}>
                    {data[field.key] ? (
                      field.key.includes('Amount') || field.key.includes('Expenses') 
                        ? `${data[field.key]} ₸` 
                        : field.key === 'enforcementNumber' 
                          ? `№ ${data[field.key]}`
                          : data[field.key]
                    ) : (
                      <span className="text-muted-foreground italic">Не найдено</span>
                    )}
                  </p>
                  {field.sublabelKey && data[field.sublabelKey] && (
                    <p className="text-sm text-muted-foreground">
                      {field.sublabelKey === 'notaryLicense' && `Лицензия № ${data[field.sublabelKey]}`}
                      {field.sublabelKey === 'registryNumber' && `Реестр № ${data[field.sublabelKey]}`}
                      {field.sublabelKey === 'debtorIIN' && `ИИН: ${data[field.sublabelKey]}`}
                      {field.sublabelKey === 'debtAmountWords' && data[field.sublabelKey]}
                      {field.sublabelKey === 'totalAmountWords' && data[field.sublabelKey]}
                    </p>
                  )}
                </div>
                {!data[field.key] && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 shrink-0">
                    Отсутствует
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t">
          <Button 
            onClick={onGenerate} 
            className="w-full gold-button py-6 text-lg"
          >
            <FileText className="h-5 w-5 mr-2" />
            Сформировать возражение
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
