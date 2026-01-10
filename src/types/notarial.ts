export interface NotarialData {
  notaryName: string;
  notaryLicense: string;
  enforcementNumber: string;
  enforcementDate: string;
  registryNumber: string;
  debtorName: string;
  debtorIIN: string;
  creditorName: string;
  debtAmount: string;
  notaryExpenses: string;
  totalAmount: string;
}

export interface ParsedDocument {
  rawText: string;
  extractedData: NotarialData;
  isValid: boolean;
  errors: string[];
}
