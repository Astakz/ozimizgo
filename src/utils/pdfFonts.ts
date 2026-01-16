import { jsPDF } from 'jspdf';

// PT Sans with Cyrillic support from Google Fonts
const PT_SANS_REGULAR_URL = 'https://cdn.jsdelivr.net/fontsource/fonts/pt-sans@latest/cyrillic-400-normal.ttf';
const PT_SANS_BOLD_URL = 'https://cdn.jsdelivr.net/fontsource/fonts/pt-sans@latest/cyrillic-700-normal.ttf';

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
let normalFontBase64: string | null = null;
let boldFontBase64: string | null = null;
let loadPromise: Promise<void> | null = null;

export function loadCyrillicFonts(): Promise<void> {
  if (fontsLoaded) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    console.log('Loading Cyrillic fonts...');

    [normalFontBase64, boldFontBase64] = await Promise.all([
      fetchFontAsBase64(PT_SANS_REGULAR_URL),
      fetchFontAsBase64(PT_SANS_BOLD_URL),
    ]);

    fontsLoaded = true;
    console.log('Cyrillic fonts loaded successfully');
  })().catch((error) => {
    // Allow retry after failure
    loadPromise = null;
    console.error('Failed to load Cyrillic fonts:', error);
    throw error;
  });

  return loadPromise;
}

export function addCyrillicFonts(doc: jsPDF): boolean {
  if (!normalFontBase64 || !boldFontBase64) {
    console.warn('Fonts not loaded, using default');
    return false;
  }
  
  try {
    doc.addFileToVFS('PTSans-Regular.ttf', normalFontBase64);
    // Use Identity-H to ensure proper Unicode (Cyrillic) mapping in the PDF
    doc.addFont('PTSans-Regular.ttf', 'PTSans', 'normal', 'Identity-H');

    doc.addFileToVFS('PTSans-Bold.ttf', boldFontBase64);
    doc.addFont('PTSans-Bold.ttf', 'PTSans', 'bold', 'Identity-H');

    return true;
  } catch (error) {
    console.error('Failed to add fonts to PDF:', error);
    return false;
  }
}

export function areFontsLoaded(): boolean {
  return fontsLoaded;
}
