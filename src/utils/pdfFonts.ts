import { jsPDF } from 'jspdf';

// Using Google Fonts CDN for TTF format (jsPDF requires TTF, not WOFF)
const ROBOTO_REGULAR_URL = 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5Q.ttf';
const ROBOTO_BOLD_URL = 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlvAw.ttf';

async function fetchFontAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  
  // Convert ArrayBuffer to base64
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

let fontsLoaded = false;
let normalFontBase64: string | null = null;
let boldFontBase64: string | null = null;

export async function loadCyrillicFonts(): Promise<void> {
  if (fontsLoaded) return;
  
  try {
    [normalFontBase64, boldFontBase64] = await Promise.all([
      fetchFontAsBase64(ROBOTO_REGULAR_URL),
      fetchFontAsBase64(ROBOTO_BOLD_URL),
    ]);
    fontsLoaded = true;
    console.log('Cyrillic fonts loaded successfully');
  } catch (error) {
    console.error('Failed to load Cyrillic fonts:', error);
  }
}

export function addCyrillicFonts(doc: jsPDF): boolean {
  if (!normalFontBase64 || !boldFontBase64) {
    console.warn('Fonts not loaded, using default');
    return false;
  }
  
  try {
    doc.addFileToVFS('Roboto-Regular.ttf', normalFontBase64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    
    doc.addFileToVFS('Roboto-Bold.ttf', boldFontBase64);
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
    
    return true;
  } catch (error) {
    console.error('Failed to add fonts to PDF:', error);
    return false;
  }
}

export function areFontsLoaded(): boolean {
  return fontsLoaded;
}
