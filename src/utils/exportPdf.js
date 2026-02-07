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

  // Build route string for filename (KBED-KPWM-KBED)
  const routeIds = route.map(s => s.airport?.id || '???').join('-');
  const fileName = `CommSheet_${callSign?.replace(/\s+/g, '') || 'untitled'}_${flightRules.toUpperCase()}_${routeIds}_${formatDateForFilename(today)}`;

  // Header text for page header (pages 2+)
  const routeArrows = route.map(s => s.airport?.id || '???').join(' → ');
  const headerText = `${callSign || '[Call Sign]'} | ${flightRules.toUpperCase()} | ${routeArrows} | ${formatDate(today)}`;

  const depApt = route.find(s => s.type === 'dep')?.airport;
  const arrApt = route.find(s => s.type === 'arr')?.airport;

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
  doc.text(`COMM SHEET: ${callSign || '[Call Sign]'}`, marginL, y);
  y += 20;

  // Empty line
  y += 11;

  // Flight info - 11pt
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(85, 85, 85);
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
  y += 11;

  // Divider
  doc.setDrawColor(51, 51, 51);
  doc.setLineWidth(0.75);
  doc.line(marginL, y, pageW - marginR, y);
  y += 14;

  // Empty line after divider
  y += 11;

  blockInstances.forEach(inst => {
    const blockCalls = byBlockKey[inst.key];
    if (!blockCalls?.length) return;

    checkPage(60);

    // Empty line before block
    y += 11;

    const label = inst.contextLabel ? `${inst.name} ${inst.contextLabel}` : inst.name;

    // Block header - 14pt bold
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(label, marginL, y);

    // Target frequency - 11pt right-aligned
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(136, 136, 136);
    const targetText = `(${inst.target || ''})`;
    const targetW = doc.getTextWidth(targetText);
    doc.text(targetText, pageW - marginR - targetW, y);
    y += 4;

    // Light underline
    doc.setDrawColor(204, 204, 204);
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
        y += 11; // Empty line between groups
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
        doc.setTextColor(51, 51, 51);
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
        doc.setTextColor(119, 119, 119);
        const atcMaxW = contentW * 0.6;
        const lines = doc.splitTextToSize(text, atcMaxW);
        const textW = Math.max(...lines.map(l => doc.getTextWidth(l)));
        doc.text(lines, pageW - marginR - textW, y);
        y += lines.length * 14;
      } else if (call.type === 'note') {
        // Note - NOTE prefix bold gray, text normal
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(153, 153, 153);
        doc.text('NOTE ', marginL, y);
        const noteW = doc.getTextWidth('NOTE ');
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 51, 51);
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
        // Brief - first line bold with "(Modify as Needed)", rest indented
        const briefLines = text.split('\n');
        briefLines.forEach((line, i) => {
          checkPage(14);
          doc.setFontSize(11);
          if (i === 0) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(51, 51, 51);
            const displayLine = `${line} (Modify as Needed)`;
            const wrapped = doc.splitTextToSize(displayLine, contentW);
            doc.text(wrapped, marginL, y);
            y += wrapped.length * 14;
          } else {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(85, 85, 85);
            const displayLine = `    ${line}`;
            const wrapped = doc.splitTextToSize(displayLine, contentW);
            doc.text(wrapped, marginL, y);
            y += wrapped.length * 14;
          }
        });
      } else {
        // Radio call - normal text, 11pt
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(0);
        const lines = doc.splitTextToSize(text, contentW);
        doc.text(lines, marginL, y);
        y += lines.length * 14;
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
      doc.setTextColor(136, 136, 136);
      const headerW = doc.getTextWidth(headerText);
      doc.text(headerText, (pageW - headerW) / 2, 30);
    }

    // Footer - page numbers centered
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(170, 170, 170);
    const pageText = `${i} of ${totalPages}`;
    const pageTextW = doc.getTextWidth(pageText);
    doc.text(pageText, (pageW - pageTextW) / 2, footerY);
  }

  doc.save(`${fileName}.pdf`);
}
