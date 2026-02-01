import { jsPDF } from 'jspdf';
import { loadCyrillicFonts, addCyrillicFonts } from './pdfFonts';

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

  const lines = documentText.split('\n');
  let y = MARGIN_TOP;
  let inHeader = true;
  const headerLines: string[] = [];

  const LINE_HEIGHT = 6;
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
        currentY = MARGIN_TOP;
      }

      let textX = x;
      if (align === 'center') {
        textX = PAGE_WIDTH / 2;
      } else if (align === 'right') {
        textX = PAGE_WIDTH - MARGIN_RIGHT;
      }

      doc.text(line, textX, currentY, { align });
      currentY += LINE_HEIGHT;
    }

    return currentY;
  };

  // Process header (right-aligned block)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === '' && inHeader && headerLines.length > 0) {
      // Render header block (right-aligned)
      doc.setFontSize(11);
      if (fontsAdded) doc.setFont('CyrillicFont', 'normal');

      for (const hl of headerLines) {
        const content = hl.trim();
        if (!content) continue;

        // Check page break
        if (y > PAGE_HEIGHT - MARGIN_BOTTOM) {
          doc.addPage();
          y = MARGIN_TOP;
        }

        // Determine style
        if (content.includes('от:')) {
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
        y = MARGIN_TOP;
      }

      // Title: ВОЗРАЖЕНИЕ
      if (trimmed.includes('ВОЗРАЖЕНИЕ') && !trimmed.includes('на исполнительную')) {
        y += PARAGRAPH_SPACING;
        y = addWrappedText(trimmed, MARGIN_LEFT, y, CONTENT_WIDTH, 14, 'bold', 'center');
        y += PARAGRAPH_SPACING / 2;
        continue;
      }

      // Subtitle: на исполнительную надпись нотариуса
      if (trimmed.includes('на исполнительную надпись нотариуса')) {
        doc.setFontSize(11);
        if (fontsAdded) doc.setFont('CyrillicFont', 'normal');
        doc.text(trimmed, PAGE_WIDTH / 2, y, { align: 'center' });
        y += LINE_HEIGHT;
        continue;
      }

      // Registry number line (starts with №)
      if (trimmed.match(/^№\s/)) {
        doc.setFontSize(11);
        if (fontsAdded) doc.setFont('CyrillicFont', 'normal');
        doc.text(trimmed, PAGE_WIDTH / 2, y, { align: 'center' });
        y += LINE_HEIGHT + PARAGRAPH_SPACING * 2;
        continue;
      }

      // Section header: ПРОШУ ВАС
      if (trimmed.includes('ПРОШУ ВАС')) {
        y += PARAGRAPH_SPACING;
        y = addWrappedText(trimmed, MARGIN_LEFT, y, CONTENT_WIDTH, 12, 'bold', 'center');
        y += PARAGRAPH_SPACING;
        continue;
      }

      // Signature line
      if (trimmed.includes('Подпись:')) {
        y += PARAGRAPH_SPACING;
        doc.setFontSize(11);
        if (fontsAdded) doc.setFont('CyrillicFont', 'normal');
        
        doc.text('Подпись:', MARGIN_LEFT, y);
        
        if (signatureDataUrl) {
          try {
            // Add signature image
            doc.addImage(signatureDataUrl, 'PNG', MARGIN_LEFT + 25, y - 8, 50, 15);
          } catch (e) {
            console.warn('Failed to add signature image:', e);
            // Draw line placeholder
            doc.line(MARGIN_LEFT + 25, y, MARGIN_LEFT + 80, y);
          }
        } else {
          // Draw line placeholder
          doc.line(MARGIN_LEFT + 25, y, MARGIN_LEFT + 80, y);
        }
        
        y += LINE_HEIGHT + PARAGRAPH_SPACING;
        continue;
      }

      // Date line
      if (trimmed.includes('«____»')) {
        doc.setFontSize(11);
        if (fontsAdded) doc.setFont('CyrillicFont', 'normal');
        doc.text(trimmed, MARGIN_LEFT, y);
        y += LINE_HEIGHT;
        continue;
      }

      // Regular paragraph with first-line indent
      const indent = 10; // First line indent in mm
      y = addWrappedTextWithIndent(doc, trimmed, MARGIN_LEFT, y, CONTENT_WIDTH, 11, indent, fontsAdded);
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
  fontsAdded: boolean
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
      currentY = MARGIN_TOP;
    }
    const lineX = isFirstLine ? x + indent : x;
    doc.text(currentLine, lineX, currentY);
    currentY += LINE_HEIGHT;
  }

  return currentY;
}
