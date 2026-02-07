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

// Render text with [brackets] bold - returns array of {text, bold} segments
function parseTextSegments(text) {
  const segments = [];
  const regex = /\[([^\]]+)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    segments.push({ text: `[${match[1]}]`, bold: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false });
  }

  return segments.length > 0 ? segments : [{ text, bold: false }];
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
  const marginL = 40;
  const marginR = 40;
  const contentW = pageW - marginL - marginR;
  const headerY = 25;
  const footerY = pageH - 25;
  let y = 50; // Start below header area

  const today = new Date();

  // Build route string for filename (KBED-KPWM-KBED)
  const routeIds = route.map(s => s.airport?.id || '???').join('-');
  const fileName = `CommSheet_${callSign?.replace(/\s+/g, '') || 'untitled'}_${flightRules.toUpperCase()}_${routeIds}_${formatDateForFilename(today)}`;

  // Header text for page header
  const routeArrows = route.map(s => s.airport?.id || '???').join(' → ');
  const headerText = `${callSign || '[Call Sign]'} | ${flightRules.toUpperCase()} | ${routeArrows} | ${formatDate(today)}`;

  const depApt = route.find(s => s.type === 'dep')?.airport;
  const arrApt = route.find(s => s.type === 'arr')?.airport;

  const checkPage = (needed = 40) => {
    if (y + needed > pageH - 60) {
      doc.addPage();
      y = 50;
    }
  };

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text(`COMM SHEET: ${callSign || '[Call Sign]'}`, marginL, y);
  y += 22;

  // Flight info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100);
  const info = [
    `Flight Rules: ${flightRules.toUpperCase()}`,
    `Route: ${routeArrows}`,
    `Departure: ${depApt?.name || '???'} (${depApt?.towered ? 'Towered' : 'Non-Towered'})`,
    `Arrival: ${arrApt?.name || '???'} (${arrApt?.towered ? 'Towered' : 'Non-Towered'})`,
  ];
  info.forEach(line => {
    doc.text(line, marginL, y);
    y += 13;
  });

  y += 6;

  // Divider
  doc.setDrawColor(60);
  doc.setLineWidth(0.5);
  doc.line(marginL, y, pageW - marginR, y);
  y += 16;

  doc.setTextColor(0);

  blockInstances.forEach(inst => {
    const blockCalls = byBlockKey[inst.key];
    if (!blockCalls?.length) return;

    checkPage(60);

    // Empty line before block
    y += 11;

    const label = inst.contextLabel ? `${inst.name} ${inst.contextLabel}` : inst.name;

    // Block header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30);
    doc.text(label, marginL, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(140);
    const targetW = doc.getTextWidth(inst.target || '');
    doc.text(inst.target || '', pageW - marginR - targetW, y);
    y += 4;

    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(marginL, y, pageW - marginR, y);
    y += 11;

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
        doc.setTextColor(40);
        const lines = doc.splitTextToSize(text, contentW);
        doc.text(lines, marginL, y);
        y += lines.length * 13 + 4;

        doc.setFont('helvetica', 'normal');
        call.taxiRoutes.filter(r => r.runway && r.route).forEach(r => {
          checkPage(14);
          doc.text(`RWY ${r.runway}: ${parseTaxiRoute(r.route, abbr)}`, marginL + 20, y);
          y += 13;
        });
        return;
      }

      checkPage(18);
      if (call.type === 'atc') {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(11);
        doc.setTextColor(120);
        const atcMaxW = contentW * 0.5;
        const lines = doc.splitTextToSize(text, atcMaxW);
        const textW = Math.max(...lines.map(l => doc.getTextWidth(l)));
        doc.text(lines, pageW - marginR - textW, y);
        y += lines.length * 13;
      } else if (call.type === 'note') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(120);
        doc.text('NOTE ', marginL, y);
        const noteW = doc.getTextWidth('NOTE ');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(30);
        const lines = doc.splitTextToSize(text, contentW - noteW);
        if (lines.length > 0) {
          doc.text(lines[0], marginL + noteW, y);
          for (let li = 1; li < lines.length; li++) {
            y += 13;
            doc.text(lines[li], marginL, y);
          }
        }
        y += 13;
      } else if (call.type === 'brief') {
        const briefLines = text.split('\n');
        briefLines.forEach((line, i) => {
          checkPage(14);
          doc.setFontSize(11);
          if (i === 0) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(40);
          } else {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80);
          }
          const displayLine = i === 0 ? `${line} (Modify as Needed)` : `    ${line}`;
          const wrapped = doc.splitTextToSize(displayLine, contentW);
          doc.text(wrapped, marginL, y);
          y += wrapped.length * 13;
        });
      } else {
        // Radio call - render with bold brackets
        doc.setFontSize(11);
        doc.setTextColor(30);

        // Parse segments and render with mixed formatting
        const segments = parseTextSegments(text);
        let currentX = marginL;
        const lineHeight = 13;

        segments.forEach(seg => {
          doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');

          // Handle text that might wrap
          const words = seg.text.split(' ');
          words.forEach((word, wi) => {
            const wordWithSpace = wi < words.length - 1 ? word + ' ' : word;
            const wordWidth = doc.getTextWidth(wordWithSpace);

            if (currentX + wordWidth > pageW - marginR && currentX > marginL) {
              y += lineHeight;
              currentX = marginL;
              checkPage(lineHeight);
            }

            doc.text(wordWithSpace, currentX, y);
            currentX += wordWidth;
          });
        });

        y += lineHeight;
      }
    });

    y += 11;
  });

  // Add headers and footers to all pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Header
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(140);
    const headerW = doc.getTextWidth(headerText);
    doc.text(headerText, (pageW - headerW) / 2, headerY);

    // Footer - page numbers
    doc.setFontSize(11);
    doc.setTextColor(170);
    const pageText = `${i} of ${totalPages}`;
    const pageTextW = doc.getTextWidth(pageText);
    doc.text(pageText, (pageW - pageTextW) / 2, footerY);
  }

  doc.save(`${fileName}.pdf`);
}
