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
  
  // Normalize text - remove extra spaces and newlines
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  
  // Helper function to find patterns
  const findPattern = (patterns: RegExp[], fieldName: string): string => {
    for (const pattern of patterns) {
      const match = normalizedText.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    errors.push(`Не удалось извлечь: ${fieldName}`);
    return '';
  };

  // Extract notary name - format: "Я, КАЗЫБАЕВА ГУЛМИРА УСЕНОВНА, нотариус"
  const notaryName = findPattern([
    /Я,\s+([А-ЯЁ]+\s+[А-ЯЁ]+\s+[А-ЯЁ]+),?\s+нотариус/i,
    /нотариус\s+([А-ЯЁ]+\s+[А-ЯЁ]+\s+[А-ЯЁ]+)/i,
    /Нотариус\s+([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+)/i,
  ], 'ФИО нотариуса');

  // Extract license number - format: "лицензия №22014333" or "государственная лицензия №22014333"
  const notaryLicense = findPattern([
    /(?:государственная\s+)?лицензи[яи]\s*№?\s*(\d+)/i,
    /лицензи[яи]\s+(\d+)/i,
  ], 'Номер лицензии');

  // Extract unique enforcement number - format: "Уникальный номер 007684/447" or from registry
  const enforcementNumber = findPattern([
    /Уникальный\s+номер\s+(\d+\/?\d*)/i,
    /Бірегей\s+нөмір\s+(\d+\/?\d*)/i,
    /реестр[а-яё]*\s*(?:за\s*)?№?\s*(\d+)/i,
    /Зарегистрировано\s+в\s+реестре\s+за\s+№\s*(\d+)/i,
  ], 'Номер исполнительной надписи');

  // Extract date - format: "«9» сентября 2024г." or "Дата создания 2024г."
  const enforcementDate = findPattern([
    /[«"](\d{1,2})[»"]\s*(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s*(\d{4})/i,
    /Дата\s+создания\s+(\d{4})/i,
    /(\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+\d{4})/i,
  ], 'Дата исполнительной надписи');

  // Try to format date properly
  let formattedDate = '';
  const dateMatch = normalizedText.match(/[«"](\d{1,2})[»"]\s*(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s*(\d{4})/i);
  if (dateMatch) {
    formattedDate = `${dateMatch[1]} ${dateMatch[2]} ${dateMatch[3]} г.`;
  } else {
    formattedDate = enforcementDate;
  }

  // Extract registry number - format: "Зарегистрировано в реестре за № 7684"
  const registryNumber = findPattern([
    /Зарегистрировано\s+в\s+реестре\s+за\s+№\s*(\d+)/i,
    /реестр[а-яё]*\s*(?:за\s*)?№?\s*(\d+)/i,
  ], 'Номер реестра');

  // Extract debtor name - format: "взыскать ... с АМАНОВ АСАДБЕК АСАНХАНОВИЧ"
  const debtorName = findPattern([
    /взыскать[^,]+с\s+([А-ЯЁ]+\s+[А-ЯЁ]+\s+[А-ЯЁ]+)/i,
    /с\s+([А-ЯЁ]+\s+[А-ЯЁ]+\s+[А-ЯЁ]+),?\s+\d{2}\.\d{2}\.\d{4}/i,
    /должник[а-яё]*[:\s]+([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s*[А-ЯЁ]?[а-яё]*)/i,
  ], 'ФИО должника');

  // Extract debtor IIN - format: "ИИН 000523500660"
  const debtorIIN = findPattern([
    /ИИН\s*(\d{12})/i,
    /,\s*(\d{12}),/,
  ], 'ИИН должника');

  // Extract creditor name - format: 'в пользу Товарищество с ограниченной ответственностью "Микрофинансовая организация "CreditBar'
  const creditorName = findPattern([
    /в\s+пользу\s+(?:Товарищество[^"«]+)?[«"]?([^»"(]+(?:МФО|Микрофинансовая организация)?[^»"(]*)[»"]?/i,
    /в\s+пользу\s+([^,]+(?:ТОО|АО|МФО|Банк)[^,]+)/i,
    /взыскател[ьяю][:\s]+([^,]+)/i,
  ], 'Наименование взыскателя');

  // Clean up creditor name
  let cleanCreditorName = creditorName
    .replace(/\(представитель.*$/i, '')
    .replace(/Товарищество с ограниченной ответственностью\s*/i, 'ТОО ')
    .replace(/[«»""]/g, '"')
    .trim();

  // Extract debt amount - format: "задолженность в сумме 109359,72 тенге"
  const debtAmount = findPattern([
    /задолженность\s+в\s+сумме\s+([\d\s,\.]+)\s*тенге/i,
    /сумм[аыу]\s+(?:основного\s+)?долга[:\s]*([\d\s,\.]+)\s*(?:тенге|тг|₸)/i,
    /задолженност[ьи][:\s]*([\d\s,\.]+)\s*(?:тенге|тг|₸)/i,
  ], 'Сумма задолженности');

  // Extract debt amount in words
  const debtAmountWords = findPattern([
    /задолженность\s+в\s+сумме\s+[\d\s,\.]+\s*тенге\s*\(([^)]+)\)/i,
    /сумм[аыу]\s+[\d\s,\.]+\s*тенге\s*\(([^)]+)\)/i,
  ], 'Сумма прописью');

  // Extract notary expenses - format: "расходы по совершению исполнительной надписи в сумме 6223 тенге"
  const notaryExpenses = findPattern([
    /расход[а-яё]*\s+(?:по\s+совершению\s+)?(?:исполнительной\s+надписи\s+)?в\s+сумме\s+([\d\s,\.]+)\s*тенге/i,
    /расход[а-яё]*[:\s]*([\d\s,\.]+)\s*(?:тенге|тг|₸)/i,
    /Взыскано[:\s]*([\d\s,\.]+)\s*тенге/i,
  ], 'Расходы нотариуса');

  // Extract total amount - format: "Общая сумма, подлежащая взысканию, составляет 115582.72 тенге"
  const totalAmount = findPattern([
    /Общая\s+сумма[,\s]+подлежащая\s+взысканию[,\s]+составляет\s+([\d\s,\.]+)\s*тенге/i,
    /итого[:\s]*([\d\s,\.]+)\s*(?:тенге|тг|₸)/i,
    /общ[а-яё]+\s+сумм[а-яё]*[:\s]*([\d\s,\.]+)\s*(?:тенге|тг|₸)/i,
    /всего\s+(?:к\s+)?взыскани[юя][:\s]*([\d\s,\.]+)\s*(?:тенге|тг|₸)/i,
  ], 'Общая сумма взыскания');

  // Extract total amount in words
  const totalAmountWords = findPattern([
    /Общая\s+сумма[,\s]+подлежащая\s+взысканию[,\s]+составляет\s+[\d\s,\.]+\s*тенге\s*\(([^)]+)\)/i,
    /общ[а-яё]+\s+сумм[а-яё]*\s+[\d\s,\.]+\s*тенге\s*\(([^)]+)\)/i,
  ], 'Общая сумма прописью');

  // Format amounts - replace comma with dot, remove spaces
  const formatAmount = (amount: string): string => {
    return amount.replace(/\s/g, '').replace(',', '.');
  };

  const extractedData: NotarialData = {
    notaryName: notaryName.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' '),
    notaryLicense,
    enforcementNumber,
    enforcementDate: formattedDate,
    registryNumber,
    debtorName: debtorName.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' '),
    debtorIIN,
    debtorEmail: '',
    creditorName: cleanCreditorName,
    debtAmount: formatAmount(debtAmount),
    debtAmountWords: debtAmountWords,
    notaryExpenses: formatAmount(notaryExpenses),
    totalAmount: formatAmount(totalAmount),
    totalAmountWords: totalAmountWords,
  };

  // Check if we have minimum required fields
  const isValid = !!(
    extractedData.notaryName &&
    extractedData.debtorName &&
    extractedData.creditorName &&
    extractedData.totalAmount
  );

  return {
    rawText: text,
    extractedData,
    isValid,
    errors,
  };
}
