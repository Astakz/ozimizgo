import type { NotarialData, ParsedDocument } from '@/types/notarial';

// Declare the global pdfjsLib that will be loaded from CDN
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

let pdfjsLoaded = false;

async function loadPdfJs(): Promise<void> {
  if (pdfjsLoaded && window.pdfjsLib) {
    return;
  }

  return new Promise((resolve, reject) => {
    // Load main library
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      pdfjsLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js'));
    document.head.appendChild(script);
  });
}

export async function extractTextFromPDF(file: File): Promise<string> {
  await loadPdfJs();
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }
  
  return fullText;
}

export function extractNotarialData(text: string): ParsedDocument {
  const errors: string[] = [];
  
  // Helper function to find patterns
  const findPattern = (patterns: RegExp[], fieldName: string): string => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    errors.push(`Не удалось извлечь: ${fieldName}`);
    return '';
  };

  // Extract notary name
  const notaryName = findPattern([
    /нотариус[а-яё\s]*?([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s*[А-ЯЁ]?[а-яё]*)/i,
    /([А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.[А-ЯЁ]\.)[,\s]*нотариус/i,
    /нотариус(?:а|у|ом)?\s+([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?)/i,
  ], 'ФИО нотариуса');

  // Extract license number
  const notaryLicense = findPattern([
    /лицензи[яию]\s*№?\s*(\d+)/i,
    /№\s*лицензии[:\s]*(\d+)/i,
    /лицензия\s+(\d+)/i,
  ], 'Номер лицензии');

  // Extract enforcement note number
  const enforcementNumber = findPattern([
    /исполнительн(?:ая|ой)\s+надпис(?:ь|и)\s*№?\s*(\d+)/i,
    /№\s*(\d+)[,\s]*исполнительн/i,
    /надпись\s*№\s*(\d+)/i,
  ], 'Номер исполнительной надписи');

  // Extract date
  const enforcementDate = findPattern([
    /от\s+[«"]?(\d{1,2}[\.\/]\d{1,2}[\.\/]\d{2,4})[»"]?/i,
    /(\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+\d{4})/i,
    /дата[:\s]+(\d{1,2}[\.\/]\d{1,2}[\.\/]\d{2,4})/i,
  ], 'Дата исполнительной надписи');

  // Extract registry number
  const registryNumber = findPattern([
    /реестр[а-яё]*\s*№?\s*(\d+)/i,
    /№\s*реестра[:\s]*(\d+)/i,
    /зарегистрирован[а-яё]*\s+(?:за\s+)?№?\s*(\d+)/i,
  ], 'Номер реестра');

  // Extract debtor name
  const debtorName = findPattern([
    /должник[а-яё]*[:\s]+([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s*[А-ЯЁ]?[а-яё]*)/i,
    /взыскать\s+с\s+([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?)/i,
    /с\s+гражданин[а-яё]*\s+([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?)/i,
  ], 'ФИО должника');

  // Extract debtor IIN
  const debtorIIN = findPattern([
    /ИИН[:\s]*(\d{12})/i,
    /индивидуальн[а-яё]+\s+идентификационн[а-яё]+\s+номер[а-яё]*[:\s]*(\d{12})/i,
    /(\d{12})/,
  ], 'ИИН должника');

  // Extract creditor name
  const creditorName = findPattern([
    /взыскател[ьяю][:\s]+([А-ЯЁа-яё\s«»""\-]+(?:ТОО|АО|МФО|ИП|БВУ|Банк)[А-ЯЁа-яё\s«»""\-]*)/i,
    /в\s+пользу\s+([А-ЯЁа-яё\s«»""\-]+)/i,
    /кредитор[а-яё]*[:\s]+([А-ЯЁа-яё\s«»""\-]+)/i,
    /(?:ТОО|АО|МФО)\s*[«"]([^»"]+)[»"]/i,
  ], 'Наименование взыскателя');

  // Extract debt amount
  const debtAmount = findPattern([
    /сумм[аыу]\s+(?:основного\s+)?долга[:\s]*([\d\s,\.]+)\s*(?:тенге|тг|₸)/i,
    /задолженност[ьи][:\s]*([\d\s,\.]+)\s*(?:тенге|тг|₸)/i,
    /взыскать[^₸тг]*?([\d\s,\.]+)\s*(?:тенге|тг|₸)/i,
  ], 'Сумма задолженности');

  // Extract notary expenses
  const notaryExpenses = findPattern([
    /расход[а-яё]*\s+нотариус[а-яё]*[:\s]*([\d\s,\.]+)\s*(?:тенге|тг|₸)/i,
    /нотариальн[а-яё]+\s+расход[а-яё]*[:\s]*([\d\s,\.]+)\s*(?:тенге|тг|₸)/i,
    /государственн[а-яё]+\s+пошлин[а-яё]*[:\s]*([\d\s,\.]+)\s*(?:тенге|тг|₸)/i,
  ], 'Расходы нотариуса');

  // Extract total amount
  const totalAmount = findPattern([
    /итого[:\s]*([\d\s,\.]+)\s*(?:тенге|тг|₸)/i,
    /общ[а-яё]+\s+сумм[а-яё]*[:\s]*([\d\s,\.]+)\s*(?:тенге|тг|₸)/i,
    /всего\s+к\s+взыскани[юя][:\s]*([\d\s,\.]+)\s*(?:тенге|тг|₸)/i,
  ], 'Общая сумма взыскания');

  const extractedData: NotarialData = {
    notaryName,
    notaryLicense,
    enforcementNumber,
    enforcementDate,
    registryNumber,
    debtorName,
    debtorIIN,
    creditorName,
    debtAmount: debtAmount.replace(/\s/g, ''),
    notaryExpenses: notaryExpenses.replace(/\s/g, ''),
    totalAmount: totalAmount.replace(/\s/g, ''),
  };

  // Check if we have minimum required fields
  const isValid = !!(
    extractedData.notaryName &&
    extractedData.enforcementNumber &&
    extractedData.debtorName &&
    extractedData.creditorName
  );

  return {
    rawText: text,
    extractedData,
    isValid,
    errors,
  };
}
