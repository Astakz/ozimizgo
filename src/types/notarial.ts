export interface NotarialData {
  notaryName: string;
  notaryLicense: string;
  enforcementNumber: string;
  enforcementDate: string;
  registryNumber: string;
  debtorName: string;
  debtorIIN: string;
  debtorEmail: string;
  creditorName: string;
  debtAmount: string;
  debtAmountWords: string;
  notaryExpenses: string;
  totalAmount: string;
  totalAmountWords: string;
}

export interface ParsedDocument {
  rawText: string;
  extractedData: NotarialData;
  isValid: boolean;
  errors: string[];
}
