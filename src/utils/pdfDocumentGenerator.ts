import { jsPDF } from 'jspdf';
import { loadCyrillicFonts, addCyrillicFonts } from './pdfFonts';
import watermarkLogo from '@/assets/watermark-logo.png';

interface TextBlock {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontStyle: 'normal' | 'bold' | 'italic';
  align: 'left' | 'center' | 'right';
  maxWidth?: number;
}

// A4 dimensions in mm
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const MARGIN_TOP = 20;
const MARGIN_BOTTOM = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

/**
 * Parse document text and generate PDF with selectable text
 * matching the visual layout exactly
 */
export async function generateSelectablePDF(
  documentText: string,
  signatureDataUrl: string | null
): Promise<jsPDF> {
  // Load fonts first
  await loadCyrillicFonts();

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Add Cyrillic fonts
  const fontsAdded = addCyrillicFonts(doc);
  if (fontsAdded) {
    doc.setFont('CyrillicFont', 'normal');
  }

  // Add watermark logo to each page with transparency
  const addWatermark = () => {
    try {
      // Save current graphics state
      const gState = doc.GState({ opacity: 0.15 });
      doc.saveGraphicsState();
      doc.setGState(gState);
      
      // Position: top-left corner, small size (20x20mm)
      doc.addImage(watermarkLogo, 'PNG', MARGIN_LEFT, MARGIN_TOP, 20, 20);
      
      // Restore graphics state
      doc.restoreGraphicsState();
    } catch (e) {
      console.warn('Failed to add watermark:', e);
    }
  };

  // Add watermark to first page
  addWatermark();

  const lines = documentText.split('\n');
  let y = MARGIN_TOP + 25; // Start below watermark
  let inHeader = true;
  const headerLines: string[] = [];

  // Match UI styling exactly
  const FONT_SIZE_SM = 10; // text-sm equivalent
  const FONT_SIZE_BASE = 11;
  const FONT_SIZE_LG = 13; // text-lg equivalent  
  const FONT_SIZE_XL = 16; // text-xl equivalent
  const LINE_HEIGHT = 5;
  const LINE_HEIGHT_RELAXED = 6;
  const PARAGRAPH_SPACING = 4;

  // Helper to add text with word wrap
  const addWrappedText = (
    text: string,
    x: number,
    startY: number,
    maxWidth: number,
    fontSize: number,
    fontStyle: 'normal' | 'bold' | 'italic',
    align: 'left' | 'center' | 'right' | 'justify' = 'left'
  ): number => {
    doc.setFontSize(fontSize);
    if (fontsAdded) {
      doc.setFont('CyrillicFont', fontStyle === 'italic' ? 'normal' : fontStyle);
    }

    const splitText = doc.splitTextToSize(text, maxWidth);
    let currentY = startY;

    for (const line of splitText) {
      // Check page break
      if (currentY > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        addWatermark(); // Add watermark to new page
        currentY = MARGIN_TOP;
      }

      let textX = x;
      if (align === 'center') {
        textX = PAGE_WIDTH / 2;
      } else if (align === 'right') {
        textX = PAGE_WIDTH - MARGIN_RIGHT;
      }

      doc.text(line, textX, currentY, { align });
      currentY += LINE_HEIGHT_RELAXED;
    }

    return currentY;
  };

  // Process header (right-aligned block) - matches UI text-right text-sm
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === '' && inHeader && headerLines.length > 0) {
      // Render header block (right-aligned) - matching UI exactly
      doc.setFontSize(FONT_SIZE_SM);
      if (fontsAdded) doc.setFont('CyrillicFont', 'normal');

      for (const hl of headerLines) {
        const content = hl.trim();
        if (!content) continue;

        // Check page break
        if (y > PAGE_HEIGHT - MARGIN_BOTTOM) {
          doc.addPage();
          addWatermark();
          y = MARGIN_TOP;
        }

        // Match UI styling: italic for certain lines, bold for "от:"
        if (content.includes('Нотариусу') || content.includes('Лицензия') || content.includes('ИИН') || content.includes('Эл. почта')) {
          if (fontsAdded) doc.setFont('CyrillicFont', 'normal'); // italic not supported, use normal
        } else if (content.includes('от:')) {
          if (fontsAdded) doc.setFont('CyrillicFont', 'bold');
        } else {
          if (fontsAdded) doc.setFont('CyrillicFont', 'normal');
        }

        doc.text(content, PAGE_WIDTH - MARGIN_RIGHT, y, { align: 'right' });
        y += LINE_HEIGHT;
      }

      y += PARAGRAPH_SPACING * 2;
      inHeader = false;
      continue;
    }

    if (inHeader && line.startsWith('                                                                     ')) {
      headerLines.push(line);
      continue;
    }

    if (inHeader && line.trim() !== '') {
      // Not a header line, process as content
      inHeader = false;
    }

    if (!inHeader) {
      const trimmed = line.trim();

      // Skip empty lines but add spacing
      if (trimmed === '') {
        y += PARAGRAPH_SPACING;
        continue;
      }

      // Check page break
      if (y > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        addWatermark();
        y = MARGIN_TOP;
      }

      // Title: ВОЗРАЖЕНИЕ - matches UI text-xl font-bold text-center
      if (trimmed.includes('ВОЗРАЖЕНИЕ') && !trimmed.includes('на исполнительную')) {
        y += PARAGRAPH_SPACING * 2;
        y = addWrappedText(trimmed, MARGIN_LEFT, y, CONTENT_WIDTH, FONT_SIZE_XL, 'bold', 'center');
        y += PARAGRAPH_SPACING / 2;
        continue;
      }

      // Subtitle: на исполнительную надпись нотариуса - matches UI text-sm italic text-center
      if (trimmed.includes('на исполнительную надпись нотариуса')) {
        doc.setFontSize(FONT_SIZE_SM);
        if (fontsAdded) doc.setFont('CyrillicFont', 'normal');
        doc.text(trimmed, PAGE_WIDTH / 2, y, { align: 'center' });
        y += LINE_HEIGHT;
        continue;
      }

      // Registry number line (starts with №) - matches UI text-sm italic text-center mb-6
      if (trimmed.match(/^№\s/)) {
        doc.setFontSize(FONT_SIZE_SM);
        if (fontsAdded) doc.setFont('CyrillicFont', 'normal');
        doc.text(trimmed, PAGE_WIDTH / 2, y, { align: 'center' });
        y += LINE_HEIGHT + PARAGRAPH_SPACING * 3; // mb-6 equivalent
        continue;
      }

      // Section header: ПРОШУ ВАС - matches UI text-lg font-bold text-center
      if (trimmed.includes('ПРОШУ ВАС')) {
        y += PARAGRAPH_SPACING * 2;
        y = addWrappedText(trimmed, MARGIN_LEFT, y, CONTENT_WIDTH, FONT_SIZE_LG, 'bold', 'center');
        y += PARAGRAPH_SPACING;
        continue;
      }

      // Signature line - matches UI text-sm
      if (trimmed.includes('Подпись:')) {
        y += PARAGRAPH_SPACING;
        doc.setFontSize(FONT_SIZE_SM);
        if (fontsAdded) doc.setFont('CyrillicFont', 'normal');
        
        doc.text('Подпись:', MARGIN_LEFT, y);
        
        if (signatureDataUrl) {
          try {
            // Add signature image - matching UI h-12 (48px ~ 12mm)
            doc.addImage(signatureDataUrl, 'PNG', MARGIN_LEFT + 22, y - 8, 45, 12);
          } catch (e) {
            console.warn('Failed to add signature image:', e);
            // Draw line placeholder
            doc.line(MARGIN_LEFT + 22, y, MARGIN_LEFT + 70, y);
          }
        } else {
          // Draw line placeholder - matching UI w-48
          doc.line(MARGIN_LEFT + 22, y, MARGIN_LEFT + 70, y);
        }
        
        y += LINE_HEIGHT_RELAXED + PARAGRAPH_SPACING;
        continue;
      }

      // Date line - matches UI text-sm
      if (trimmed.includes('«____»')) {
        doc.setFontSize(FONT_SIZE_SM);
        if (fontsAdded) doc.setFont('CyrillicFont', 'normal');
        doc.text(trimmed, MARGIN_LEFT, y);
        y += LINE_HEIGHT_RELAXED;
        continue;
      }

      // Regular paragraph with first-line indent - matches UI text-sm text-justify my-3
      const indent = 10; // First line indent in mm
      y = addWrappedTextWithIndent(doc, trimmed, MARGIN_LEFT, y, CONTENT_WIDTH, FONT_SIZE_SM, indent, fontsAdded, addWatermark);
      y += PARAGRAPH_SPACING;
    }
  }

  return doc;
}

/**
 * Add wrapped text with first-line indent (justified)
 */
function addWrappedTextWithIndent(
  doc: jsPDF,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  fontSize: number,
  indent: number,
  fontsAdded: boolean,
  addWatermark: () => void
): number {
  doc.setFontSize(fontSize);
  if (fontsAdded) doc.setFont('CyrillicFont', 'normal');

  const LINE_HEIGHT = 6;

  // First line has indent
  const firstLineWidth = maxWidth - indent;
  const words = text.split(' ');
  let currentLine = '';
  let isFirstLine = true;
  let currentY = startY;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const lineWidth = isFirstLine ? firstLineWidth : maxWidth;
    const testWidth = doc.getTextWidth(testLine);

    if (testWidth > lineWidth && currentLine) {
      // Output current line
      if (currentY > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        addWatermark();
        currentY = MARGIN_TOP;
      }

      const lineX = isFirstLine ? x + indent : x;
      doc.text(currentLine, lineX, currentY);
      currentY += LINE_HEIGHT;
      currentLine = word;
      isFirstLine = false;
    } else {
      currentLine = testLine;
    }
  }

  // Output last line
  if (currentLine) {
    if (currentY > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      addWatermark();
      currentY = MARGIN_TOP;
    }
    const lineX = isFirstLine ? x + indent : x;
    doc.text(currentLine, lineX, currentY);
    currentY += LINE_HEIGHT;
  }

  return currentY;
}
