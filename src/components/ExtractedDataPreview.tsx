import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileSearch, User, Building2, Banknote, Hash, Calendar, AlertTriangle } from 'lucide-react';
import type { NotarialData } from '@/types/notarial';

interface ExtractedDataPreviewProps {
  data: NotarialData;
  errors: string[];
}

export function ExtractedDataPreview({ data, errors }: ExtractedDataPreviewProps) {
  const dataFields = [
    { icon: User, label: 'Нотариус', value: data.notaryName, sublabel: `Лицензия № ${data.notaryLicense}` },
    { icon: Hash, label: 'Исполнительная надпись', value: `№ ${data.enforcementNumber}`, sublabel: `Реестр № ${data.registryNumber}` },
    { icon: Calendar, label: 'Дата', value: data.enforcementDate },
    { icon: User, label: 'Должник', value: data.debtorName, sublabel: `ИИН: ${data.debtorIIN}` },
    { icon: Building2, label: 'Взыскатель', value: data.creditorName },
    { icon: Banknote, label: 'Сумма задолженности', value: `${data.debtAmount} ₸` },
    { icon: Banknote, label: 'Расходы нотариуса', value: `${data.notaryExpenses} ₸` },
    { icon: Banknote, label: 'Общая сумма', value: `${data.totalAmount} ₸`, highlight: true },
  ];

  return (
    <Card className="shadow-card animate-fade-in">
      <CardHeader className="border-b bg-muted/30">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileSearch className="h-5 w-5 text-gold" />
          Извлечённые данные
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {errors.length > 0 && (
          <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
              <AlertTriangle className="h-4 w-4" />
              Предупреждения
            </div>
            <ul className="text-sm text-amber-600 space-y-1">
              {errors.map((error, idx) => (
                <li key={idx}>• {error}</li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="grid gap-4 md:grid-cols-2">
          {dataFields.map((field, idx) => (
            <div
              key={idx}
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
                    {field.value || <span className="text-muted-foreground italic">Не найдено</span>}
                  </p>
                  {field.sublabel && (
                    <p className="text-sm text-muted-foreground">{field.sublabel}</p>
                  )}
                </div>
                {!field.value && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 shrink-0">
                    Отсутствует
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
