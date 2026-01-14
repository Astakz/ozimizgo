import type { NotarialData } from '@/types/notarial';

export interface DocumentSection {
  type: 'header' | 'title' | 'subtitle' | 'body' | 'signature' | 'date';
  align: 'left' | 'center' | 'right';
  content: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export function generateObjectionDocument(data: NotarialData): DocumentSection[] {
  const creditorDisplay = data.creditorName;

  const sections: DocumentSection[] = [
    // Right-aligned header
    { type: 'header', align: 'right', content: 'Нотариусу', italic: true },
    { type: 'header', align: 'right', content: data.notaryName },
    { type: 'header', align: 'right', content: `Лицензия №${data.notaryLicense}`, italic: true },
    { type: 'header', align: 'right', content: `от: ${data.debtorName}`, bold: true },
    { type: 'header', align: 'right', content: `ИИН ${data.debtorIIN}`, italic: true },
    { type: 'header', align: 'right', content: `Эл. почта: ${data.debtorEmail || '________________________'}`, italic: true },

    // Centered title
    { type: 'title', align: 'center', content: 'ВОЗРАЖЕНИЕ', bold: true },
    { type: 'subtitle', align: 'center', content: 'на исполнительную надпись нотариуса', italic: true },
    { type: 'subtitle', align: 'center', content: `№ ${data.enforcementNumber}`, italic: true },

    // Body text
    { 
      type: 'body', 
      align: 'left', 
      content: `${data.enforcementDate} года мной была получена исполнительная надпись №${data.enforcementNumber} от ${data.enforcementDate} государственная лицензия №${data.notaryLicense}. При изучении исполнительной надписи мной было выяснено, что Вами была установлена сумма задолженности в пользу ${creditorDisplay}. Сумма задолженности в размере ${data.debtAmount} тенге${data.debtAmountWords ? ` (${data.debtAmountWords})` : ''}. Кроме того, подлежат взысканию в пользу указанного юридического лица расходы по совершению исполнительной надписи в сумме ${data.notaryExpenses} тенге.`,
      bold: true
    },
    { 
      type: 'body', 
      align: 'left', 
      content: `Общая сумма, подлежащая взысканию, составляет ${data.totalAmount} тенге${data.totalAmountWords ? ` (${data.totalAmountWords})` : ''}.`
    },
    { 
      type: 'body', 
      align: 'left', 
      content: 'С исполнительной надписью я не согласен (-на) по основаниям:'
    },
    { 
      type: 'body', 
      align: 'left', 
      content: `1.    В соответствии с п.2 ст.92-1 Закона РК «О нотариате» `,
      underline: false
    },
    { 
      type: 'body', 
      align: 'left', 
      content: `на основании исполнительной надписи или соответствующего постановления производится взыскание задолженности по следующим бесспорным требованиям, в том числе об исполнении обязательства, основанного на письменной сделке, срок исполнения которой наступил и неисполнение обязательства признается должником, в том числе в ответе на претензию, направленную взыскателю в порядке досудебного урегулирования спора.`,
      underline: true
    },
    { 
      type: 'body', 
      align: 'left', 
      content: `       В моем случае требование ${creditorDisplay} я не согласна с установленной суммой задолженности. Также мной не был получен досудебная претензия и неисполнение обязательства я не признавал (-а).`
    },
    { 
      type: 'body', 
      align: 'left', 
      content: `2.    Согласно п. 3 ст. 92-1 Закона `
    },
    { 
      type: 'body', 
      align: 'left', 
      content: `на основании исполнительной надписи не производится взыскание неустоек (пеней), процентов.`,
      underline: true
    },
    { 
      type: 'body', 
      align: 'left', 
      content: `       Однако, Вами учинена исполнительная надпись на сумму задолженности в размере ${data.totalAmount} тенге${data.totalAmountWords ? ` (${data.totalAmountWords})` : ''}.`
    },
    { 
      type: 'body', 
      align: 'left', 
      content: 'На основании выше сказанного,'
    },

    // Request section
    { type: 'title', align: 'center', content: 'ПРОШУ ВАС:', bold: true },
    { 
      type: 'body', 
      align: 'left', 
      content: `Отменить учиненную Вами исполнительную надпись №${data.enforcementNumber} от ${data.enforcementDate} государственная лицензия №${data.notaryLicense} о взыскании суммы задолженности с меня в пользу ${creditorDisplay} в сумме ${data.totalAmount} тенге${data.totalAmountWords ? ` (${data.totalAmountWords})` : ''}.`
    },
    { 
      type: 'body', 
      align: 'left', 
      content: `Постановление об отмене исполнительной надписи направить на эл. почту: ${data.debtorEmail || '________________________'}`
    },

    // Signature section
    { type: 'signature', align: 'left', content: `${data.debtorName}                                                     (подпись)` },
    { type: 'date', align: 'left', content: `«____» _________________ ${new Date().getFullYear()} г.` },
  ];

  return sections;
}

// Legacy function for backward compatibility (plain text)
export function generateObjectionDocumentText(data: NotarialData): string {
  const creditorDisplay = data.creditorName;

  return `                                                                     Нотариусу
                                                                     ${data.notaryName}
                                                                     Лицензия №${data.notaryLicense}
                                                                     от: ${data.debtorName}
                                                                     ИИН ${data.debtorIIN}
                                                                     Эл. почта: ${data.debtorEmail || '________________________'}


                                              ВОЗРАЖЕНИЕ
                                  на исполнительную надпись нотариуса
                                              № ${data.enforcementNumber}

${data.enforcementDate} года мной была получена исполнительная надпись №${data.enforcementNumber} от ${data.enforcementDate} государственная лицензия №${data.notaryLicense}. При изучении исполнительной надписи мной было выяснено, что Вами была установлена сумма задолженности в пользу ${creditorDisplay}. Сумма задолженности в размере ${data.debtAmount} тенге${data.debtAmountWords ? ` (${data.debtAmountWords})` : ''}. Кроме того, подлежат взысканию в пользу указанного юридического лица расходы по совершению исполнительной надписи в сумме ${data.notaryExpenses} тенге.

Общая сумма, подлежащая взысканию, составляет ${data.totalAmount} тенге${data.totalAmountWords ? ` (${data.totalAmountWords})` : ''}.

С исполнительной надписью я не согласен (-на) по основаниям:

1.    В соответствии с п.2 ст.92-1 Закона РК «О нотариате» на основании исполнительной надписи или соответствующего постановления производится взыскание задолженности по следующим бесспорным требованиям, в том числе об исполнении обязательства, основанного на письменной сделке, срок исполнения которой наступил и неисполнение обязательства признается должником, в том числе в ответе на претензию, направленную взыскателю в порядке досудебного урегулирования спора.
       В моем случае требование ${creditorDisplay} я не согласна с установленной суммой задолженности. Также мной не был получен досудебная претензия и неисполнение обязательства я не признавал (-а).

2.    Согласно п. 3 ст. 92-1 Закона на основании исполнительной надписи не производится взыскание неустоек (пеней), процентов.
       Однако, Вами учинена исполнительная надпись на сумму задолженности в размере ${data.totalAmount} тенге${data.totalAmountWords ? ` (${data.totalAmountWords})` : ''}.

На основании выше сказанного,

                                              ПРОШУ ВАС:

Отменить учиненную Вами исполнительную надпись №${data.enforcementNumber} от ${data.enforcementDate} государственная лицензия №${data.notaryLicense} о взыскании суммы задолженности с меня в пользу ${creditorDisplay} в сумме ${data.totalAmount} тенге${data.totalAmountWords ? ` (${data.totalAmountWords})` : ''}.

Постановление об отмене исполнительной надписи направить на эл. почту: ${data.debtorEmail || '________________________'}


${data.debtorName}                                                     (подпись)

«____» _________________ ${new Date().getFullYear()} г.`;
}
