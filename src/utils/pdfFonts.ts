import { jsPDF } from 'jspdf';

// Use Noto Sans with full Cyrillic + Latin + extended Unicode support
// These fonts have much broader character coverage than PT Sans
const NOTO_SANS_REGULAR_URL = 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans/files/noto-sans-cyrillic-ext-400-normal.woff';
const NOTO_SANS_BOLD_URL = 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans/files/noto-sans-cyrillic-ext-700-normal.woff';

// Fallback to DejaVu Sans which has excellent Unicode coverage
const DEJAVU_REGULAR_URL = 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf';
const DEJAVU_BOLD_URL = 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf';

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
    console.log('Loading Cyrillic fonts (DejaVu Sans)...');

    try {
      // Try DejaVu Sans first - it has the best Unicode coverage for legal documents
      [normalFontBase64, boldFontBase64] = await Promise.all([
        fetchFontAsBase64(DEJAVU_REGULAR_URL),
        fetchFontAsBase64(DEJAVU_BOLD_URL),
      ]);
      console.log('DejaVu Sans fonts loaded successfully');
    } catch (error) {
      console.warn('DejaVu fonts failed, trying Noto Sans...', error);
      // Fallback to Noto Sans
      [normalFontBase64, boldFontBase64] = await Promise.all([
        fetchFontAsBase64(NOTO_SANS_REGULAR_URL),
        fetchFontAsBase64(NOTO_SANS_BOLD_URL),
      ]);
      console.log('Noto Sans fonts loaded successfully');
    }

    fontsLoaded = true;
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
    doc.addFileToVFS('CyrillicFont-Regular.ttf', normalFontBase64);
    doc.addFont('CyrillicFont-Regular.ttf', 'CyrillicFont', 'normal');

    doc.addFileToVFS('CyrillicFont-Bold.ttf', boldFontBase64);
    doc.addFont('CyrillicFont-Bold.ttf', 'CyrillicFont', 'bold');

    return true;
  } catch (error) {
    console.error('Failed to add fonts to PDF:', error);
    return false;
  }
}

export function areFontsLoaded(): boolean {
  return fontsLoaded;
}
