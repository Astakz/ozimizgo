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
  let y = MARGIN_TOP + 22; // Start below watermark (UI: top-4 = 16px ≈ 4mm, logo w-16 h-16 = 16mm)
  let inHeader = true;
  const headerLines: string[] = [];

  // Match UI styling EXACTLY - Times New Roman equivalents
  // UI uses: text-sm = 0.875rem = 14px, text-lg = 1.125rem = 18px, text-xl = 1.25rem = 20px
  // PDF conversion: px * 0.75 = pt (approx), but we adjust for visual match
  const FONT_SIZE_SM = 11;    // text-sm → 11pt for better readability
  const FONT_SIZE_LG = 14;    // text-lg → 14pt
  const FONT_SIZE_XL = 17;    // text-xl → 17pt
  const LINE_HEIGHT = 5.5;    // leading-relaxed equivalent
  const LINE_HEIGHT_HEADER = 5; // Slightly tighter for header
  const SPACING_MB_1 = 1.5;   // mb-1
  const SPACING_MB_2 = 3;     // mb-2
  const SPACING_MB_4 = 6;     // mb-4
  const SPACING_MB_6 = 9;     // mb-6
  const SPACING_MB_8 = 12;    // mb-8
  const SPACING_MT_2 = 3;     // mt-2
  const SPACING_MT_4 = 6;     // mt-4
  const SPACING_MT_6 = 9;     // mt-6
  const SPACING_MT_8 = 12;    // mt-8
  const SPACING_MY_3 = 4.5;   // my-3

  // Process document line by line - matching renderFormattedDocument() EXACTLY
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Empty line handling
    if (line.trim() === '') {
      if (inHeader && headerLines.length > 0) {
        // Render header block: className="text-right mb-8"
        doc.setFontSize(FONT_SIZE_SM);
        
        for (const hl of headerLines) {
          const content = hl.trim();
          if (!content) continue;

          if (y > PAGE_HEIGHT - MARGIN_BOTTOM) {
            doc.addPage();
            addWatermark();
            y = MARGIN_TOP;
          }

          // UI: italic for Нотариусу/Лицензия/ИИН/Эл. почта, bold for от:
          // className="text-sm leading-relaxed" + conditional italic/bold
          if (content.includes('Нотариусу') || content.includes('Лицензия') || content.includes('ИИН') || content.includes('Эл. почта')) {
            if (fontsAdded) doc.setFont('CyrillicFont', 'normal'); // italic in UI
          } else if (content.includes('от:')) {
            if (fontsAdded) doc.setFont('CyrillicFont', 'bold');
          } else {
            if (fontsAdded) doc.setFont('CyrillicFont', 'normal');
          }

          doc.text(content, PAGE_WIDTH - MARGIN_RIGHT, y, { align: 'right' });
          y += LINE_HEIGHT_HEADER;
        }

        y += SPACING_MB_8; // mb-8
        headerLines.length = 0;
        inHeader = false;
      }
      continue;
    }

    // Header lines (right-aligned block): starts with lots of spaces
    if (inHeader && line.startsWith('                                                                     ')) {
      headerLines.push(line);
      continue;
    }

    // "ВОЗРАЖЕНИЕ" title: className="text-center font-bold text-xl mt-8 mb-2"
    if (line.includes('ВОЗРАЖЕНИЕ') && !line.includes('на исполнительную')) {
      inHeader = false;
      y += SPACING_MT_8; // mt-8
      doc.setFontSize(FONT_SIZE_XL);
      if (fontsAdded) doc.setFont('CyrillicFont', 'bold');
      doc.text(line.trim(), PAGE_WIDTH / 2, y, { align: 'center' });
      y += LINE_HEIGHT + SPACING_MB_2; // + mb-2
      continue;
    }

    // "ПРОШУ ВАС" section header: className="text-center font-bold text-lg mt-8 mb-4"
    if (line.includes('ПРОШУ ВАС')) {
      y += SPACING_MT_8; // mt-8
      doc.setFontSize(FONT_SIZE_LG);
      if (fontsAdded) doc.setFont('CyrillicFont', 'bold');
      doc.text(line.trim(), PAGE_WIDTH / 2, y, { align: 'center' });
      y += LINE_HEIGHT + SPACING_MB_4; // + mb-4
      continue;
    }

    // Subtitle "на исполнительную надпись нотариуса": className="text-center italic text-sm mb-1"
    if (line.includes('на исполнительную надпись нотариуса')) {
      doc.setFontSize(FONT_SIZE_SM);
      if (fontsAdded) doc.setFont('CyrillicFont', 'normal'); // italic
      doc.text(line.trim(), PAGE_WIDTH / 2, y, { align: 'center' });
      y += LINE_HEIGHT + SPACING_MB_1; // + mb-1
      continue;
    }

    // Registry number line "№ ...": className="text-center italic text-sm mb-6"
    if (line.match(/^\s+№\s/)) {
      doc.setFontSize(FONT_SIZE_SM);
      if (fontsAdded) doc.setFont('CyrillicFont', 'normal'); // italic
      doc.text(line.trim(), PAGE_WIDTH / 2, y, { align: 'center' });
      y += LINE_HEIGHT + SPACING_MB_6; // + mb-6
      continue;
    }

    // "На основании выше сказанного": className="text-sm leading-relaxed mt-6 mb-2"
    if (line.includes('На основании выше сказанного')) {
      y += SPACING_MT_6; // mt-6
      doc.setFontSize(FONT_SIZE_SM);
      if (fontsAdded) doc.setFont('CyrillicFont', 'normal');
      doc.text(line, MARGIN_LEFT, y);
      y += LINE_HEIGHT + SPACING_MB_2; // + mb-2
      continue;
    }

    // Signature line: className="mt-2 text-sm flex items-end gap-2"
    if (line.includes('Подпись:')) {
      y += SPACING_MT_2; // mt-2
      doc.setFontSize(FONT_SIZE_SM);
      if (fontsAdded) doc.setFont('CyrillicFont', 'normal');
      
      doc.text('Подпись:', MARGIN_LEFT, y);
      
      if (signatureDataUrl) {
        try {
          // Signature: UI h-12 (48px ≈ 12.7mm), width auto ~45mm
          doc.addImage(signatureDataUrl, 'PNG', MARGIN_LEFT + 22, y - 9, 45, 12);
        } catch (e) {
          console.warn('Failed to add signature image:', e);
          // Fallback: UI w-48 (192px ≈ 51mm)
          doc.line(MARGIN_LEFT + 22, y, MARGIN_LEFT + 73, y);
        }
      } else {
        // Placeholder line: className="inline-block w-48 border-b"
        doc.line(MARGIN_LEFT + 22, y, MARGIN_LEFT + 73, y);
      }
      
      y += LINE_HEIGHT + SPACING_MT_2;
      continue;
    }

    // Date line: className="mt-4 text-sm"
    if (line.includes('«____»')) {
      y += SPACING_MT_4; // mt-4
      doc.setFontSize(FONT_SIZE_SM);
      if (fontsAdded) doc.setFont('CyrillicFont', 'normal');
      doc.text(line, MARGIN_LEFT, y);
      y += LINE_HEIGHT;
      continue;
    }

    // Regular paragraph: className="text-sm leading-relaxed text-justify my-3"
    inHeader = false;
    
    if (y > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      addWatermark();
      y = MARGIN_TOP;
    }

    y += SPACING_MY_3; // my-3 top
    y = addWrappedTextWithIndent(doc, line, MARGIN_LEFT, y, CONTENT_WIDTH, FONT_SIZE_SM, 10, fontsAdded, addWatermark, LINE_HEIGHT);
    y += SPACING_MY_3; // my-3 bottom
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
  addWatermark: () => void,
  lineHeight: number = 5.5
): number {
  doc.setFontSize(fontSize);
  if (fontsAdded) doc.setFont('CyrillicFont', 'normal');

  // First line has indent (text-indent equivalent)
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
      currentY += lineHeight;
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
    currentY += lineHeight;
  }

  return currentY;
}
