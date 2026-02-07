import jsPDF from 'jspdf';
import { subVars } from './callSign';
import { parseTaxiRoute } from './taxiParser';

// Format date as "Feb 6, 2026"
function formatDate(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

// Format date for filename as "Feb-6-2026"
function formatDateForFilename(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]}-${date.getDate()}-${date.getFullYear()}`;
}

// Render a line of text with [brackets] bold, returns the y position after rendering
function renderTextWithBoldBrackets(doc, text, x, y, maxWidth, fontSize, isItalic = false) {
  doc.setFontSize(fontSize);

  // First, wrap the entire text to see if it fits
  const fullLines = doc.splitTextToSize(text, maxWidth);

  if (fullLines.length === 1) {
    // Single line - render with bold brackets inline
    const regex = /\[([^\]]+)\]/g;
    let lastIndex = 0;
    let currentX = x;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Render text before bracket
      if (match.index > lastIndex) {
        const beforeText = text.slice(lastIndex, match.index);
        doc.setFont('helvetica', isItalic ? 'italic' : 'normal');
        doc.text(beforeText, currentX, y);
        currentX += doc.getTextWidth(beforeText);
      }
      // Render bracketed text bold
      const bracketText = `[${match[1]}]`;
      doc.setFont('helvetica', isItalic ? 'bolditalic' : 'bold');
      doc.text(bracketText, currentX, y);
      currentX += doc.getTextWidth(bracketText);
      lastIndex = regex.lastIndex;
    }
    // Render remaining text
    if (lastIndex < text.length) {
      doc.setFont('helvetica', isItalic ? 'italic' : 'normal');
      doc.text(text.slice(lastIndex), currentX, y);
    }
    return y + 14;
  } else {
    // Multi-line - just render normally (bold brackets too complex for wrapped text)
    doc.setFont('helvetica', isItalic ? 'italic' : 'normal');
    doc.text(fullLines, x, y);
    return y + fullLines.length * 14;
  }
}

export function exportToPdf({ callSign, flightRules, route, blockInstances, calls, hidden, hiddenBlocks, vars, abbr }) {
  const visible = calls.filter(c => !hidden.has(c.id) && !hiddenBlocks.has(c._blockKey || c.block));
  const byBlockKey = visible.reduce((acc, c) => {
    const key = c._blockKey || c.block;
    (acc[key] = acc[key] || []).push(c);
    return acc;
  }, {});

  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 50;
  const marginR = 50;
  const marginTop = 50;
  const contentW = pageW - marginL - marginR;
  const footerY = pageH - 30;
  let y = marginTop;

  const today = new Date();

  // Check if this is a library export (no route)
  const isLibraryExport = !route || route.length === 0;

  // Build filename
  const routeIds = isLibraryExport ? '' : route.map(s => s.airport?.id || '???').join('-');
  const fileName = isLibraryExport
    ? `RadioCallsLibrary_${formatDateForFilename(today)}`
    : `CommSheet_${callSign?.replace(/\s+/g, '') || 'untitled'}_${flightRules.toUpperCase()}_${routeIds}_${formatDateForFilename(today)}`;

  // Header text for page header (pages 2+) - use dash for font compatibility
  const routeArrows = isLibraryExport ? '' : route.map(s => s.airport?.id || '???').join(' - ');
  const headerText = isLibraryExport
    ? `${callSign || 'Radio Calls Library'} | ${formatDate(today)}`
    : `${callSign || '[Call Sign]'} | ${flightRules.toUpperCase()} | ${routeArrows} | ${formatDate(today)}`;

  const depApt = route?.find(s => s.type === 'dep')?.airport;
  const arrApt = route?.find(s => s.type === 'arr')?.airport;

  const checkPage = (needed = 40) => {
    if (y + needed > pageH - 60) {
      doc.addPage();
      y = marginTop;
    }
  };

  // Title - 16pt bold
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text(isLibraryExport ? 'RADIO CALLS LIBRARY' : `COMM SHEET: ${callSign || '[Call Sign]'}`, marginL, y);
  y += 20;

  // Empty line
  y += 14;

  // Flight info - 11pt gray (only for comm sheets, not library exports)
  if (!isLibraryExport) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(85);
    const info = [
      `Flight Rules: ${flightRules.toUpperCase()}`,
      `Route: ${routeArrows}`,
      `Departure: ${depApt?.name || '???'} (${depApt?.towered ? 'Towered' : 'Non-Towered'})`,
      `Arrival: ${arrApt?.name || '???'} (${arrApt?.towered ? 'Towered' : 'Non-Towered'})`,
    ];
    info.forEach(line => {
      doc.text(line, marginL, y);
      y += 14;
    });

    // Empty line
    y += 14;
  }

  // Divider
  doc.setDrawColor(51);
  doc.setLineWidth(0.75);
  doc.line(marginL, y, pageW - marginR, y);
  y += 14;

  // Empty line after divider
  y += 14;

  blockInstances.forEach(inst => {
    const blockCalls = byBlockKey[inst.key];
    if (!blockCalls?.length) return;

    checkPage(60);

    // Empty line before block
    y += 14;

    const label = inst.contextLabel ? `${inst.name} ${inst.contextLabel}` : inst.name;

    // Block header - 14pt bold
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(label, marginL, y);

    // Target frequency - 11pt right-aligned gray
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(136);
    const targetText = `(${inst.target || ''})`;
    const targetW = doc.getTextWidth(targetText);
    doc.text(targetText, pageW - marginR - targetW, y);
    y += 4;

    // Light underline
    doc.setDrawColor(204);
    doc.setLineWidth(0.25);
    doc.line(marginL, y, pageW - marginR, y);
    y += 14;

    let prevCall = null;
    blockCalls.forEach(call => {
      const callVars = call._legVars || vars;
      let text = subVars(call.text || '', callVars);

      // Check if new group (needs extra space)
      const isNewGroup = prevCall && (
        (call.group && prevCall.group && call.group !== prevCall.group) ||
        (call.group && !prevCall.group) ||
        (!call.group && prevCall.group)
      );
      if (isNewGroup) {
        y += 14; // Empty line between groups
      }
      prevCall = call;

      if (call.isTaxiBrief && call.taxiRoutes?.length) {
        checkPage(40);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(0);
        const lines = doc.splitTextToSize(text, contentW);
        doc.text(lines, marginL, y);
        y += lines.length * 14 + 4;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51);
        call.taxiRoutes.filter(r => r.runway && r.route).forEach(r => {
          checkPage(14);
          doc.text(`    RWY ${r.runway}: ${parseTaxiRoute(r.route, abbr)}`, marginL, y);
          y += 14;
        });
        return;
      }

      checkPage(18);
      if (call.type === 'atc') {
        // ATC - italic, right-aligned, gray
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(11);
        doc.setTextColor(119);
        const atcMaxW = contentW * 0.6;
        const lines = doc.splitTextToSize(text, atcMaxW);
        const textW = Math.max(...lines.map(l => doc.getTextWidth(l)));
        doc.text(lines, pageW - marginR - textW, y);
        y += lines.length * 14;
      } else if (call.type === 'note') {
        // Note - NOTE prefix bold gray, text normal
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(153);
        doc.text('NOTE ', marginL, y);
        const noteW = doc.getTextWidth('NOTE ');
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51);
        const lines = doc.splitTextToSize(text, contentW - noteW);
        if (lines.length > 0) {
          doc.text(lines[0], marginL + noteW, y);
          for (let li = 1; li < lines.length; li++) {
            y += 14;
            doc.text(lines[li], marginL, y);
          }
        }
        y += 14;
      } else if (call.type === 'brief') {
        // Brief - first line bold with "(Modify as Needed)" in gray, rest indented
        const briefLines = text.split('\n');
        briefLines.forEach((line, i) => {
          checkPage(14);
          doc.setFontSize(11);
          if (i === 0) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(51);
            doc.text(line, marginL, y);
            const lineW = doc.getTextWidth(line);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(102);
            doc.text(' (Modify as Needed)', marginL + lineW, y);
            y += 14;
          } else {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(85);
            const displayLine = `    ${line}`;
            const wrapped = doc.splitTextToSize(displayLine, contentW);
            doc.text(wrapped, marginL, y);
            y += wrapped.length * 14;
          }
        });
      } else {
        // Radio call - render with bold brackets
        doc.setTextColor(0);
        y = renderTextWithBoldBrackets(doc, text, marginL, y, contentW, 11);
      }
    });
  });

  // Add headers (page 2+) and footers (all pages)
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Header - only on pages 2+
    if (i > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(136);
      doc.text(headerText, pageW / 2, 30, { align: 'center' });
    }

    // Footer - page numbers centered
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(170);
    const pageText = `${i} of ${totalPages}`;
    doc.text(pageText, pageW / 2, footerY, { align: 'center' });
  }

  doc.save(`${fileName}.pdf`);
}
