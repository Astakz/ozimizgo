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
  let y = MARGIN_TOP + 20; // Start below watermark (matching UI top-4 = 16px ≈ 4mm + logo 16mm)
  let inHeader = true;
  const headerLines: string[] = [];

  // Match UI styling exactly - Times New Roman equivalents
  const FONT_SIZE_SM = 10;    // text-sm (0.875rem = 14px) → 10pt for PDF
  const FONT_SIZE_LG = 13;    // text-lg (1.125rem = 18px) → 13pt for PDF
  const FONT_SIZE_XL = 16;    // text-xl (1.25rem = 20px) → 16pt for PDF
  const LINE_HEIGHT_RELAXED = 5;  // leading-relaxed
  const PARAGRAPH_SPACING_SM = 2; // my-3 equivalent
  const PARAGRAPH_SPACING_LG = 6; // mb-6/mt-8 equivalent

  // Helper to add wrapped text
  const addWrappedText = (
    text: string,
    x: number,
    startY: number,
    maxWidth: number,
    fontSize: number,
    fontStyle: 'normal' | 'bold' | 'italic',
    align: 'left' | 'center' | 'right' = 'left'
  ): number => {
    doc.setFontSize(fontSize);
    if (fontsAdded) {
      doc.setFont('CyrillicFont', fontStyle === 'italic' ? 'normal' : fontStyle);
    }

    const splitText = doc.splitTextToSize(text, maxWidth);
    let currentY = startY;

    for (const line of splitText) {
      if (currentY > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        addWatermark();
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

  // Process document line by line - matching renderFormattedDocument() exactly
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Empty line handling
    if (line.trim() === '') {
      if (inHeader && headerLines.length > 0) {
        // Render header block (text-right mb-8)
        doc.setFontSize(FONT_SIZE_SM);
        
        for (const hl of headerLines) {
          const content = hl.trim();
          if (!content) continue;

          if (y > PAGE_HEIGHT - MARGIN_BOTTOM) {
            doc.addPage();
            addWatermark();
            y = MARGIN_TOP;
          }

          // Match UI: italic for Нотариусу/Лицензия/ИИН/Эл. почта, bold for от:
          if (content.includes('Нотариусу') || content.includes('Лицензия') || content.includes('ИИН') || content.includes('Эл. почта')) {
            if (fontsAdded) doc.setFont('CyrillicFont', 'normal'); // italic style
          } else if (content.includes('от:')) {
            if (fontsAdded) doc.setFont('CyrillicFont', 'bold');
          } else {
            if (fontsAdded) doc.setFont('CyrillicFont', 'normal');
          }

          doc.text(content, PAGE_WIDTH - MARGIN_RIGHT, y, { align: 'right' });
          y += LINE_HEIGHT_RELAXED;
        }

        y += PARAGRAPH_SPACING_LG; // mb-8 equivalent
        headerLines.length = 0;
        inHeader = false;
      }
      continue;
    }

    // Header lines (right-aligned block)
    if (inHeader && line.startsWith('                                                                     ')) {
      headerLines.push(line);
      continue;
    }

    // "ВОЗРАЖЕНИЕ" title (text-center font-bold text-xl mt-8 mb-2)
    if (line.includes('ВОЗРАЖЕНИЕ') && !line.includes('на исполнительную')) {
      inHeader = false;
      y += PARAGRAPH_SPACING_LG; // mt-8
      doc.setFontSize(FONT_SIZE_XL);
      if (fontsAdded) doc.setFont('CyrillicFont', 'bold');
      doc.text(line.trim(), PAGE_WIDTH / 2, y, { align: 'center' });
      y += LINE_HEIGHT_RELAXED + PARAGRAPH_SPACING_SM; // mb-2
      continue;
    }

    // "ПРОШУ ВАС" section header (text-center font-bold text-lg mt-8 mb-4)
    if (line.includes('ПРОШУ ВАС')) {
      y += PARAGRAPH_SPACING_LG; // mt-8
      doc.setFontSize(FONT_SIZE_LG);
      if (fontsAdded) doc.setFont('CyrillicFont', 'bold');
      doc.text(line.trim(), PAGE_WIDTH / 2, y, { align: 'center' });
      y += LINE_HEIGHT_RELAXED + PARAGRAPH_SPACING_SM * 2; // mb-4
      continue;
    }

    // Subtitle "на исполнительную надпись нотариуса" (text-center italic text-sm mb-1)
    if (line.includes('на исполнительную надпись нотариуса')) {
      doc.setFontSize(FONT_SIZE_SM);
      if (fontsAdded) doc.setFont('CyrillicFont', 'normal');
      doc.text(line.trim(), PAGE_WIDTH / 2, y, { align: 'center' });
      y += LINE_HEIGHT_RELAXED; // mb-1
      continue;
    }

    // Registry number line (text-center italic text-sm mb-6)
    if (line.match(/^\s+№\s/)) {
      doc.setFontSize(FONT_SIZE_SM);
      if (fontsAdded) doc.setFont('CyrillicFont', 'normal');
      doc.text(line.trim(), PAGE_WIDTH / 2, y, { align: 'center' });
      y += LINE_HEIGHT_RELAXED + PARAGRAPH_SPACING_LG; // mb-6
      continue;
    }

    // "На основании выше сказанного" (text-sm leading-relaxed mt-6 mb-2)
    if (line.includes('На основании выше сказанного')) {
      y += PARAGRAPH_SPACING_LG; // mt-6
      doc.setFontSize(FONT_SIZE_SM);
      if (fontsAdded) doc.setFont('CyrillicFont', 'normal');
      doc.text(line, MARGIN_LEFT, y);
      y += LINE_HEIGHT_RELAXED + PARAGRAPH_SPACING_SM; // mb-2
      continue;
    }

    // Signature line (mt-2 text-sm)
    if (line.includes('Подпись:')) {
      y += PARAGRAPH_SPACING_SM; // mt-2
      doc.setFontSize(FONT_SIZE_SM);
      if (fontsAdded) doc.setFont('CyrillicFont', 'normal');
      
      doc.text('Подпись:', MARGIN_LEFT, y);
      
      if (signatureDataUrl) {
        try {
          // Signature image matching UI h-12 (48px ≈ 12mm)
          doc.addImage(signatureDataUrl, 'PNG', MARGIN_LEFT + 22, y - 8, 45, 12);
        } catch (e) {
          console.warn('Failed to add signature image:', e);
          doc.line(MARGIN_LEFT + 22, y, MARGIN_LEFT + 70, y);
        }
      } else {
        // Placeholder line (w-48 ≈ 192px ≈ 50mm)
        doc.line(MARGIN_LEFT + 22, y, MARGIN_LEFT + 70, y);
      }
      
      y += LINE_HEIGHT_RELAXED + PARAGRAPH_SPACING_SM;
      continue;
    }

    // Date line (mt-4 text-sm)
    if (line.includes('«____»')) {
      y += PARAGRAPH_SPACING_SM * 2; // mt-4
      doc.setFontSize(FONT_SIZE_SM);
      if (fontsAdded) doc.setFont('CyrillicFont', 'normal');
      doc.text(line, MARGIN_LEFT, y);
      y += LINE_HEIGHT_RELAXED;
      continue;
    }

    // Regular paragraph (text-sm leading-relaxed text-justify my-3)
    inHeader = false;
    
    if (y > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      addWatermark();
      y = MARGIN_TOP;
    }

    y += PARAGRAPH_SPACING_SM; // my-3 top margin
    y = addWrappedTextWithIndent(doc, line, MARGIN_LEFT, y, CONTENT_WIDTH, FONT_SIZE_SM, 10, fontsAdded, addWatermark);
    y += PARAGRAPH_SPACING_SM; // my-3 bottom margin
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
