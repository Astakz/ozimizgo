import { jsPDF } from 'jspdf';

// PT Sans Regular font (subset with Cyrillic support)
const PT_SANS_NORMAL_URL = 'https://cdn.jsdelivr.net/npm/@fontsource/pt-sans@5.0.8/files/pt-sans-cyrillic-400-normal.woff';
const PT_SANS_BOLD_URL = 'https://cdn.jsdelivr.net/npm/@fontsource/pt-sans@5.0.8/files/pt-sans-cyrillic-700-normal.woff';

async function fetchFontAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

let fontsLoaded = false;
let normalFontBase64: string | null = null;
let boldFontBase64: string | null = null;

export async function loadCyrillicFonts(): Promise<void> {
  if (fontsLoaded) return;
  
  try {
    [normalFontBase64, boldFontBase64] = await Promise.all([
      fetchFontAsBase64(PT_SANS_NORMAL_URL),
      fetchFontAsBase64(PT_SANS_BOLD_URL),
    ]);
    fontsLoaded = true;
  } catch (error) {
    console.error('Failed to load Cyrillic fonts:', error);
  }
}

export function addCyrillicFonts(doc: jsPDF): void {
  if (normalFontBase64) {
    doc.addFileToVFS('PTSans-Regular.ttf', normalFontBase64);
    doc.addFont('PTSans-Regular.ttf', 'PTSans', 'normal');
  }
  
  if (boldFontBase64) {
    doc.addFileToVFS('PTSans-Bold.ttf', boldFontBase64);
    doc.addFont('PTSans-Bold.ttf', 'PTSans', 'bold');
  }
}

export function areFontsLoaded(): boolean {
  return fontsLoaded;
}
