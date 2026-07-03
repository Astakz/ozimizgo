export type SignFieldType =
  | 'signature'
  | 'initials'
  | 'name'
  | 'iin'
  | 'email'
  | 'phone'
  | 'date'
  | 'text'
  | 'checkbox';

export interface SignField {
  id: string;
  type: SignFieldType;
  page: number;      // 1-based
  x: number;         // in PDF points, top-left origin (y from top)
  y: number;
  w: number;
  h: number;
  required?: boolean;
  label?: string;
}

export type FieldValue = string | boolean | null;
export type FieldValueMap = Record<string, FieldValue>;

export interface SignatureRequestPublic {
  id: string;
  title: string;
  pageCount: number;
  fileSize: number;
  fields: SignField[];
  status: string;
  expiresAt: string | null;
  createdAt: string;
  pdfUrl: string | null;
}
