import { jsPDF } from 'jspdf';

// PT Sans with Cyrillic support - proper TTF files
const PT_SANS_REGULAR_URL = 'https://cdn.jsdelivr.net/gh/nicholaswmin/font-files@master/PTSans-Regular.ttf';
const PT_SANS_BOLD_URL = 'https://cdn.jsdelivr.net/gh/nicholaswmin/font-files@master/PTSans-Bold.ttf';

async function fetchFontAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch font: ${response.status}`);
  }
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
let fontsLoading = false;
let normalFontBase64: string | null = null;
let boldFontBase64: string | null = null;

export async function loadCyrillicFonts(): Promise<void> {
  if (fontsLoaded || fontsLoading) return;
  
  fontsLoading = true;
  
  try {
    console.log('Loading Cyrillic fonts...');
    [normalFontBase64, boldFontBase64] = await Promise.all([
      fetchFontAsBase64(PT_SANS_REGULAR_URL),
      fetchFontAsBase64(PT_SANS_BOLD_URL),
    ]);
    fontsLoaded = true;
    console.log('Cyrillic fonts loaded successfully');
  } catch (error) {
    console.error('Failed to load Cyrillic fonts:', error);
    fontsLoading = false;
    throw error;
  }
}

export function addCyrillicFonts(doc: jsPDF): boolean {
  if (!normalFontBase64 || !boldFontBase64) {
    console.warn('Fonts not loaded, using default');
    return false;
  }
  
  try {
    doc.addFileToVFS('PTSans-Regular.ttf', normalFontBase64);
    doc.addFont('PTSans-Regular.ttf', 'PTSans', 'normal');
    
    doc.addFileToVFS('PTSans-Bold.ttf', boldFontBase64);
    doc.addFont('PTSans-Bold.ttf', 'PTSans', 'bold');
    
    return true;
  } catch (error) {
    console.error('Failed to add fonts to PDF:', error);
    return false;
  }
}

export function areFontsLoaded(): boolean {
  return fontsLoaded;
}
