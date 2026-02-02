import { jsPDF } from 'jspdf';
import { loadCyrillicFonts, addCyrillicFonts } from './pdfFonts';
import watermarkLogo from '@/assets/watermark-logo.png';

// A4 dimensions in mm
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 20; // 2cm margins like print @page margin: 2cm
const MARGIN_LEFT = MARGIN;
const MARGIN_RIGHT = MARGIN;
const MARGIN_TOP = MARGIN;
const MARGIN_BOTTOM = MARGIN;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

/**
 * Parse document text and generate PDF with selectable text
 * MATCHING THE PRINT STYLES EXACTLY from handlePrint() in ObjectionDocument.tsx
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
      const gState = doc.GState({ opacity: 0.15 });
      doc.saveGraphicsState();
      doc.setGState(gState);
      doc.addImage(watermarkLogo, 'PNG', MARGIN_LEFT, MARGIN_TOP, 20, 20);
      doc.restoreGraphicsState();
    } catch (e) {
      console.warn('Failed to add watermark:', e);
    }
  };

  addWatermark();

  // ===== PRINT STYLES (from handlePrint CSS) =====
  // body { font-size: 14pt; line-height: 1.8; }
  // .title { font-size: 16pt; font-weight: bold; margin: 20px 0 10px 0; }
  // .subtitle { font-style: italic; margin: 5px 0; }
  // .header { margin-bottom: 30px; }
  // .header-line { margin: 2px 0; }
  // .body-text-no-indent { margin: 15px 0; text-align: justify; }
  
  const FONT_SIZE_BODY = 14;      // body: font-size: 14pt
  const FONT_SIZE_TITLE = 16;     // .title: font-size: 16pt
  const LINE_HEIGHT_MULTIPLIER = 1.8;  // line-height: 1.8
  
  // Calculate line height in mm: pt * 1.8 / 2.835 (pt to mm)
  const LINE_HEIGHT_BODY = (FONT_SIZE_BODY * LINE_HEIGHT_MULTIPLIER) / 2.835;  // ≈ 8.9mm
  const LINE_HEIGHT_TITLE = (FONT_SIZE_TITLE * LINE_HEIGHT_MULTIPLIER) / 2.835; // ≈ 10.2mm
  const LINE_HEIGHT_HEADER = (FONT_SIZE_BODY * 1.4) / 2.835; // Tighter for header ≈ 6.9mm
  
  // Margins in mm (px to mm: px * 0.264583)
  const MARGIN_HEADER_BOTTOM = 30 * 0.264583;  // 30px ≈ 7.9mm
  const MARGIN_HEADER_LINE = 2 * 0.264583;     // 2px ≈ 0.5mm
  const MARGIN_TITLE_TOP = 20 * 0.264583;      // 20px ≈ 5.3mm
  const MARGIN_TITLE_BOTTOM = 10 * 0.264583;   // 10px ≈ 2.6mm
  const MARGIN_SUBTITLE = 5 * 0.264583;        // 5px ≈ 1.3mm
  const MARGIN_BODY_TEXT = 15 * 0.264583;      // 15px ≈ 4mm
  const MARGIN_SIGNATURE_TOP = 20 * 0.264583;  // 20px in signature div

  const lines = documentText.split('\n');
  let y = MARGIN_TOP + 22; // Start below watermark
  let inHeader = true;
  const headerLines: string[] = [];

  // Process document - matching formatForPrint() EXACTLY
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Empty line handling
    if (line.trim() === '') {
      if (inHeader && headerLines.length > 0) {
        // Render header block: .header { text-align: right; margin-bottom: 30px; }
        doc.setFontSize(FONT_SIZE_BODY);
        
        for (const hl of headerLines) {
          const content = hl.trim();
          if (!content) continue;

          if (y > PAGE_HEIGHT - MARGIN_BOTTOM) {
            doc.addPage();
            addWatermark();
            y = MARGIN_TOP;
          }

          // .header-italic for Нотариусу/Лицензия/ИИН/Эл. почта
          // .header-bold for от:
          if (content.includes('Нотариусу') || content.includes('Лицензия') || content.includes('ИИН') || content.includes('Эл. почта')) {
            if (fontsAdded) doc.setFont('CyrillicFont', 'italic');
          } else if (content.includes('от:')) {
            if (fontsAdded) doc.setFont('CyrillicFont', 'bold');
          } else {
            if (fontsAdded) doc.setFont('CyrillicFont', 'normal');
          }

          doc.text(content, PAGE_WIDTH - MARGIN_RIGHT, y, { align: 'right' });
          y += LINE_HEIGHT_HEADER + MARGIN_HEADER_LINE;
        }

        y += MARGIN_HEADER_BOTTOM;
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

    // "ВОЗРАЖЕНИЕ" or "ПРОШУ ВАС" - both use .title in formatForPrint()
    // .title { text-align: center; font-weight: bold; font-size: 16pt; margin: 20px 0 10px 0; }
    if (line.includes('ВОЗРАЖЕНИЕ') && !line.includes('на исполнительную')) {
      inHeader = false;
      y += MARGIN_TITLE_TOP;
      
      if (y > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        addWatermark();
        y = MARGIN_TOP;
      }
      
      doc.setFontSize(FONT_SIZE_TITLE);
      if (fontsAdded) doc.setFont('CyrillicFont', 'bold');
      doc.text(line.trim(), PAGE_WIDTH / 2, y, { align: 'center' });
      y += LINE_HEIGHT_TITLE + MARGIN_TITLE_BOTTOM;
      continue;
    }

    if (line.includes('ПРОШУ ВАС')) {
      y += MARGIN_TITLE_TOP;
      
      if (y > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        addWatermark();
        y = MARGIN_TOP;
      }
      
      doc.setFontSize(FONT_SIZE_TITLE);
      if (fontsAdded) doc.setFont('CyrillicFont', 'bold');
      doc.text(line.trim(), PAGE_WIDTH / 2, y, { align: 'center' });
      y += LINE_HEIGHT_TITLE + MARGIN_TITLE_BOTTOM;
      continue;
    }

    // Subtitles: .subtitle { text-align: center; font-style: italic; margin: 5px 0; }
    if (line.includes('на исполнительную надпись нотариуса') || line.match(/^\s+№\s/)) {
      y += MARGIN_SUBTITLE;
      
      if (y > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        addWatermark();
        y = MARGIN_TOP;
      }
      
      doc.setFontSize(FONT_SIZE_BODY);
      if (fontsAdded) doc.setFont('CyrillicFont', 'italic');
      doc.text(line.trim(), PAGE_WIDTH / 2, y, { align: 'center' });
      y += LINE_HEIGHT_BODY + MARGIN_SUBTITLE;
      continue;
    }

    // Signature line - signature image goes BEFORE the word "Подпись:"
    if (line.includes('Подпись:')) {
      y += MARGIN_BODY_TEXT;
      
      if (y > PAGE_HEIGHT - MARGIN_BOTTOM - 30) {
        doc.addPage();
        addWatermark();
        y = MARGIN_TOP;
      }
      
      // Add signature image BEFORE the "Подпись:" text
      if (signatureDataUrl) {
        try {
          doc.addImage(signatureDataUrl, 'PNG', MARGIN_LEFT, y - 12, 50, 18);
        } catch (e) {
          console.warn('Failed to add signature image:', e);
        }
      }
      
      // Draw "Подпись: ____________________" after the signature image
      doc.setFontSize(FONT_SIZE_BODY);
      if (fontsAdded) doc.setFont('CyrillicFont', 'normal');
      doc.text('Подпись: ____________________', MARGIN_LEFT, y + 10);
      y += LINE_HEIGHT_BODY + 10;
      
      y += MARGIN_BODY_TEXT;
      continue;
    }

    // Date line
    if (line.includes('«____»')) {
      y += MARGIN_BODY_TEXT;
      
      if (y > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        addWatermark();
        y = MARGIN_TOP;
      }
      
      doc.setFontSize(FONT_SIZE_BODY);
      if (fontsAdded) doc.setFont('CyrillicFont', 'normal');
      doc.text(line, MARGIN_LEFT, y);
      y += LINE_HEIGHT_BODY;
      continue;
    }

    // Regular paragraph: .body-text-no-indent { text-align: justify; margin: 15px 0; }
    inHeader = false;
    
    y += MARGIN_BODY_TEXT; // margin-top: 15px
    
    if (y > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      addWatermark();
      y = MARGIN_TOP;
    }

    y = addWrappedText(doc, line, MARGIN_LEFT, y, CONTENT_WIDTH, FONT_SIZE_BODY, fontsAdded, addWatermark, LINE_HEIGHT_BODY);
    y += MARGIN_BODY_TEXT; // margin-bottom: 15px
  }

  // Add signature at the end if provided (like signatureHtml in print)
  if (signatureDataUrl && !documentText.includes('Подпись:')) {
    y += MARGIN_SIGNATURE_TOP;
    if (y > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      addWatermark();
      y = MARGIN_TOP;
    }
    try {
      doc.addImage(signatureDataUrl, 'PNG', MARGIN_LEFT, y, 60, 21);
    } catch (e) {
      console.warn('Failed to add signature:', e);
    }
  }

  return doc;
}

/**
 * Add wrapped text (justified, no indent - matching .body-text-no-indent)
 */
function addWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  fontSize: number,
  fontsAdded: boolean,
  addWatermark: () => void,
  lineHeight: number
): number {
  doc.setFontSize(fontSize);
  if (fontsAdded) doc.setFont('CyrillicFont', 'normal');

  const words = text.split(' ');
  let currentLine = '';
  let currentY = startY;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = doc.getTextWidth(testLine);

    if (testWidth > maxWidth && currentLine) {
      if (currentY > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        addWatermark();
        currentY = MARGIN_TOP;
      }

      doc.text(currentLine, x, currentY);
      currentY += lineHeight;
      currentLine = word;
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
    doc.text(currentLine, x, currentY);
    currentY += lineHeight;
  }

  return currentY;
}
