import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Generate PDF that matches the print version EXACTLY
 * Uses html2canvas to render the same HTML as print
 */
export async function generateSelectablePDF(
  documentText: string,
  signatureDataUrl: string | null
): Promise<jsPDF> {
  // Create a temporary container with the same styles as print
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '210mm'; // A4 width
  container.style.backgroundColor = 'white';
  
  // Generate the same HTML as formatForPrint
  const htmlContent = formatDocumentForPDF(documentText, signatureDataUrl);
  
  container.innerHTML = `
    <div style="
      font-family: 'Times New Roman', Times, serif;
      font-size: 14pt;
      line-height: 1.8;
      padding: 2cm;
      background: white;
      color: black;
    ">
      ${htmlContent}
    </div>
  `;
  
  document.body.appendChild(container);

  try {
    // Render to canvas
    const canvas = await html2canvas(container, {
      scale: 2, // Higher quality
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    // Create PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    
    // A4 dimensions
    const pageWidth = 210;
    const pageHeight = 297;
    
    // Calculate image dimensions to fit A4
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * pageWidth) / canvas.width;
    
    // If image is taller than one page, split across multiple pages
    if (imgHeight <= pageHeight) {
      doc.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
    } else {
      let heightLeft = imgHeight;
      let position = 0;
      let page = 0;
      
      while (heightLeft > 0) {
        if (page > 0) {
          doc.addPage();
        }
        
        // Calculate the portion of the image to show on this page
        doc.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        
        heightLeft -= pageHeight;
        position -= pageHeight;
        page++;
      }
    }

    return doc;
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Format document for PDF - IDENTICAL to formatForPrint in ObjectionDocument.tsx
 */
function formatDocumentForPDF(text: string, signature: string | null): string {
  const lines = text.split('\n');
  let html = '';
  let inHeader = true;
  let headerContent = '';

  // Add watermark
  html += `<img src="/watermark-logo.png" alt="" style="position: absolute; top: 0; left: 0; width: 50px; height: 50px; opacity: 0.15; pointer-events: none;" />`;

  for (const line of lines) {
    if (line.trim() === '') {
      if (inHeader && headerContent) {
        html += `<div style="text-align: right; margin-bottom: 30px;">${headerContent}</div>`;
        headerContent = '';
        inHeader = false;
      }
      continue;
    }

    if (inHeader && line.startsWith('                                                                     ')) {
      const content = line.trim();
      if (content.includes('Нотариусу') || content.includes('Лицензия') || content.includes('ИИН') || content.includes('Эл. почта')) {
        headerContent += `<div style="margin: 2px 0; font-style: italic;">${content}</div>`;
      } else if (content.includes('от:')) {
        headerContent += `<div style="margin: 2px 0; font-weight: bold;">${content}</div>`;
      } else {
        headerContent += `<div style="margin: 2px 0;">${content}</div>`;
      }
    } else if (line.includes('ВОЗРАЖЕНИЕ') || line.includes('ПРОШУ ВАС')) {
      inHeader = false;
      html += `<div style="text-align: center; font-weight: bold; font-size: 16pt; margin: 20px 0 10px 0;">${line.trim()}</div>`;
    } else if (line.includes('на исполнительную надпись нотариуса') || line.match(/^\s+№\s/)) {
      html += `<div style="text-align: center; font-style: italic; margin: 5px 0;">${line.trim()}</div>`;
    } else if (line.includes('Подпись:')) {
      // Signature image goes BEFORE the "Подпись:" text
      if (signature) {
        html += `<div style="margin-top: 5px; margin-left: 60px;"><img src="${signature}" alt="Подпись" style="max-height: 50px;" /></div>`;
      }
      html += `<p style="text-align: justify; margin: 15px 0;">Подпись: ____________________</p>`;
    } else {
      inHeader = false;
      html += `<p style="text-align: justify; margin: 15px 0;">${line}</p>`;
    }
  }

  return html;
}
