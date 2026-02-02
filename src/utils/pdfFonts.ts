import { jsPDF } from 'jspdf';

// Multiple CDN sources for reliability - DejaVu Sans has excellent Cyrillic support
const FONT_SOURCES = [
  // Primary: jsDelivr
  {
    regular: 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf',
    bold: 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf',
  },
  // Fallback 1: unpkg
  {
    regular: 'https://unpkg.com/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf',
    bold: 'https://unpkg.com/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf',
  },
  // Fallback 2: cdnjs (PT Sans - also good Cyrillic)
  {
    regular: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf',
    bold: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf',
  },
];

async function fetchFontAsBase64(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
  
  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      cache: 'force-cache' // Use cache when available
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    // Validate it's a real TTF (starts with 0x00010000 or 'true')
    const header = new Uint8Array(arrayBuffer.slice(0, 4));
    const isValidTTF = 
      (header[0] === 0x00 && header[1] === 0x01 && header[2] === 0x00 && header[3] === 0x00) ||
      (header[0] === 0x74 && header[1] === 0x72 && header[2] === 0x75 && header[3] === 0x65);
    
    if (!isValidTTF) {
      throw new Error('Invalid TTF file');
    }
    
    // Convert ArrayBuffer to base64
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

let fontsLoaded = false;
let normalFontBase64: string | null = null;
let boldFontBase64: string | null = null;
let italicFontBase64: string | null = null;
let loadPromise: Promise<void> | null = null;

export function loadCyrillicFonts(): Promise<void> {
  if (fontsLoaded) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    console.log('Loading Cyrillic fonts...');
    
    let lastError: Error | null = null;
    
    // Try each CDN source
    for (const source of FONT_SOURCES) {
      try {
        console.log(`Trying font source: ${source.regular.split('/')[2]}`);
        
        const [regular, bold] = await Promise.all([
          fetchFontAsBase64(source.regular),
          fetchFontAsBase64(source.bold),
        ]);
        
        normalFontBase64 = regular;
        boldFontBase64 = bold;
        italicFontBase64 = regular; // Use regular as italic fallback
        
        console.log('Cyrillic fonts loaded successfully');
        fontsLoaded = true;
        return;
      } catch (error) {
        console.warn(`Font source failed:`, error);
        lastError = error as Error;
      }
    }
    
    throw new Error(`All font sources failed. Last error: ${lastError?.message}`);
  })().catch((error) => {
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
    // Add regular font
    doc.addFileToVFS('CyrillicFont-Regular.ttf', normalFontBase64);
    doc.addFont('CyrillicFont-Regular.ttf', 'CyrillicFont', 'normal');

    // Add bold font
    doc.addFileToVFS('CyrillicFont-Bold.ttf', boldFontBase64);
    doc.addFont('CyrillicFont-Bold.ttf', 'CyrillicFont', 'bold');
    
    // Add italic (using regular as fallback)
    if (italicFontBase64) {
      doc.addFileToVFS('CyrillicFont-Italic.ttf', italicFontBase64);
      doc.addFont('CyrillicFont-Italic.ttf', 'CyrillicFont', 'italic');
    }
    
    // Set the font immediately after adding
    doc.setFont('CyrillicFont', 'normal');
    
    console.log('Cyrillic fonts added to PDF successfully');
    return true;
  } catch (error) {
    console.error('Failed to add fonts to PDF:', error);
    return false;
  }
}

export function areFontsLoaded(): boolean {
  return fontsLoaded;
}
