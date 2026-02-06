import jsPDF from 'jspdf';
import { subVars } from './callSign';
import { parseTaxiRoute } from './taxiParser';

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
  let y = 40;

  const fileName = `CommSheet_${callSign?.replace(/\s+/g, '_') || 'untitled'}_${new Date().toISOString().slice(0, 10)}`;

  const checkPage = (needed = 40) => {
    if (y + needed > pageH - 50) {
      doc.addPage();
      y = 40;
    }
  };

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`COMM SHEET: ${callSign || '[Call Sign]'}`, marginL, y);
  y += 22;

  // Info
  const depApt = route.find(s => s.type === 'dep')?.airport;
  const arrApt = route.find(s => s.type === 'arr')?.airport;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100);
  const info = [
    `Flight Rules: ${flightRules.toUpperCase()}    Route: ${route.map(s => s.airport?.id || '???').join(' → ')}`,
    `Departure: ${depApt?.name || '???'} (${depApt?.towered ? 'Towered' : 'Non-Towered'})    Arrival: ${arrApt?.name || '???'} (${arrApt?.towered ? 'Towered' : 'Non-Towered'})`,
  ];
  info.forEach(line => {
    doc.text(line, marginL, y);
    y += 12;
  });

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

    const label = inst.contextLabel ? `${inst.name} ${inst.contextLabel}` : inst.name;

    // Block header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text(label, marginL, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140);
    const targetW = doc.getTextWidth(inst.target || '');
    doc.text(inst.target || '', pageW - marginR - targetW, y);
    y += 4;

    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(marginL, y, pageW - marginR, y);
    y += 10;

    let prevCall = null;
    blockCalls.forEach(call => {
      const callVars = call._legVars || vars;
      let text = subVars(call.text || '', callVars);

      // Add spacing between different groups (no line, just breathing room)
      const isNewGroup = prevCall && (
        (call.group && prevCall.group && call.group !== prevCall.group) ||
        (call.group && !prevCall.group) ||
        (!call.group && prevCall.group)
      );
      if (isNewGroup) {
        y += 10; // Just spacing, no line
      }
      prevCall = call;

      if (call.isTaxiBrief && call.taxiRoutes?.length) {
        checkPage(40);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(40);
        const lines = doc.splitTextToSize(text, contentW);
        doc.text(lines, marginL, y);
        y += lines.length * 12 + 4;

        doc.setFont('helvetica', 'normal');
        call.taxiRoutes.filter(r => r.runway && r.route).forEach(r => {
          checkPage(14);
          doc.text(`RWY ${r.runway}: ${parseTaxiRoute(r.route, abbr)}`, marginL + 20, y);
          y += 12;
        });
        return;
      }

      checkPage(18);
      if (call.type === 'atc') {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(120);
        const atcMaxW = contentW * 0.5;
        const lines = doc.splitTextToSize(text, atcMaxW);
        const textW = Math.max(...lines.map(l => doc.getTextWidth(l)));
        doc.text(lines, pageW - marginR - textW, y);
        y += lines.length * 11; // 0pt extra spacing
      } else if (call.type === 'note') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text('NOTE ', marginL, y);
        const noteW = doc.getTextWidth('NOTE ');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(30);
        const lines = doc.splitTextToSize(text, contentW - noteW);
        if (lines.length > 0) {
          doc.text(lines[0], marginL + noteW, y);
          for (let li = 1; li < lines.length; li++) {
            y += 10;
            doc.text(lines[li], marginL, y);
          }
        }
        y += 10; // 0pt extra spacing
      } else if (call.type === 'brief') {
        const briefLines = text.split('\n');
        briefLines.forEach((line, i) => {
          checkPage(14);
          if (i === 0) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(40);
          } else {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(80);
          }
          const displayLine = i === 0 ? `${line} (Modify as Needed)` : `    ${line}`;
          const wrapped = doc.splitTextToSize(displayLine, contentW);
          doc.text(wrapped, marginL, y);
          y += wrapped.length * 11; // 0pt extra spacing
        });
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(30);
        const lines = doc.splitTextToSize(text, contentW);
        doc.text(lines, marginL, y);
        y += lines.length * 12; // 0pt extra spacing (tighter line height)
      }
    });

    y += 10;
  });

  // Add page number footers to all pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(170);
    doc.text(`${fileName}`, marginL, pageH - 20);
    doc.text(`${i} of ${totalPages}`, pageW - marginR, pageH - 20, { align: 'right' });
  }

  doc.save(`${fileName}.pdf`);
}
