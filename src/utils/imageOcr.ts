import { supabase } from '@/integrations/supabase/client';

export async function extractTextFromImage(file: File): Promise<string> {
  const base64 = await fileToBase64(file);
  
  const { data, error } = await supabase.functions.invoke('ocr-extract', {
    body: {
      imageBase64: base64,
      mimeType: file.type || 'image/jpeg',
    },
  });

  if (error) {
    console.error('OCR error:', error);
    throw new Error('Ошибка распознавания текста на изображении');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data?.text || '';
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:...;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsDataURL(file);
  });
}
