import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, TabStopPosition, TabStopType,
  Footer, PageNumber, NumberFormat
} from 'docx';
import { saveAs } from 'file-saver';
import { subVars } from './callSign';
import { parseTaxiRoute } from './taxiParser';

export async function exportToDocx({ callSign, flightRules, route, blockInstances, calls, hidden, hiddenBlocks, vars, abbr }) {
  const visible = calls.filter(c => !hidden.has(c.id) && !hiddenBlocks.has(c._blockKey || c.block));
  const byBlockKey = visible.reduce((acc, c) => {
    const key = c._blockKey || c.block;
    (acc[key] = acc[key] || []).push(c);
    return acc;
  }, {});

  const children = [];
  const fileName = `CommSheet_${callSign?.replace(/\s+/g, '_') || 'untitled'}_${new Date().toISOString().slice(0, 10)}`;

  // Title
  children.push(new Paragraph({
    children: [new TextRun({ text: `COMM SHEET: ${callSign || '[Call Sign]'}`, bold: true, size: 32, font: 'Calibri' })],
    spacing: { after: 100 },
  }));

  // Flight info
  const depApt = route.find(s => s.type === 'dep')?.airport;
  const arrApt = route.find(s => s.type === 'arr')?.airport;
  const infoLines = [
    `Flight Rules: ${flightRules.toUpperCase()}`,
    `Route: ${route.map(s => s.airport?.id || '???').join(' → ')}`,
    `Departure: ${depApt?.name || '???'} (${depApt?.towered ? 'Towered' : 'Non-Towered'})`,
    `Arrival: ${arrApt?.name || '???'} (${arrApt?.towered ? 'Towered' : 'Non-Towered'})`,
  ];
  infoLines.forEach(line => {
    children.push(new Paragraph({
      children: [new TextRun({ text: line, size: 20, font: 'Calibri', color: '555555' })],
      spacing: { after: 40 },
    }));
  });

  children.push(new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '333333' } },
    spacing: { after: 200 },
  }));

  // Blocks
  blockInstances.forEach(inst => {
    const blockCalls = byBlockKey[inst.key];
    if (!blockCalls?.length) return;

    const label = inst.contextLabel ? `${inst.name} ${inst.contextLabel}` : inst.name;

    // Block header
    children.push(new Paragraph({
      children: [
        new TextRun({ text: label, bold: true, size: 24, font: 'Calibri' }),
        new TextRun({ text: `  (${inst.target || ''})`, size: 18, font: 'Calibri', color: '888888' }),
      ],
      spacing: { before: 240, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
    }));

    let prevCall = null;
    blockCalls.forEach(call => {
      const callVars = call._legVars || vars;
      let text = subVars(call.text || '', callVars);
      // Remove markup brackets for clean text
      text = text.replace(/\[([^\]]+)\]/g, '[$1]');

      // Add spacing between different groups (no line, just breathing room)
      const isNewGroup = prevCall && (
        (call.group && prevCall.group && call.group !== prevCall.group) ||
        (call.group && !prevCall.group) ||
        (!call.group && prevCall.group)
      );
      // Store whether this call needs extra space before it
      const needsGroupSpace = isNewGroup;
      prevCall = call;

      if (call.isTaxiBrief && call.taxiRoutes?.length) {
        children.push(new Paragraph({
          children: [new TextRun({ text, bold: true, size: 20, font: 'Calibri' })],
          spacing: { before: needsGroupSpace ? 200 : 0, after: 0 },
        }));
        call.taxiRoutes.filter(r => r.runway && r.route).forEach(r => {
          children.push(new Paragraph({
            children: [new TextRun({ text: `    RWY ${r.runway}: ${parseTaxiRoute(r.route, abbr)}`, size: 20, font: 'Calibri', color: '333333' })],
            indent: { left: 360 },
            spacing: { before: 0, after: 0 },
          }));
        });
        return;
      }

      if (call.type === 'atc') {
        children.push(new Paragraph({
          children: [new TextRun({ text, italics: true, size: 20, font: 'Calibri', color: '777777' })],
          alignment: AlignmentType.RIGHT,
          indent: { left: 4320 },
          spacing: { before: needsGroupSpace ? 200 : 0, after: 0 },
        }));
      } else if (call.type === 'note') {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: 'NOTE ', bold: true, size: 18, font: 'Calibri', color: '999999' }),
            new TextRun({ text, size: 20, font: 'Calibri', color: '333333' }),
          ],
          spacing: { before: needsGroupSpace ? 200 : 0, after: 0 },
        }));
      } else if (call.type === 'brief') {
        // Multi-line briefs
        const lines = text.split('\n');
        lines.forEach((line, i) => {
          children.push(new Paragraph({
            children: [
              new TextRun({
                text: i === 0 ? line : `    ${line}`,
                bold: i === 0,
                size: 20,
                font: 'Calibri',
                color: i === 0 ? '333333' : '555555',
              }),
              ...(i === 0 ? [new TextRun({ text: ' (Modify as Needed)', italics: true, size: 16, font: 'Calibri', color: 'CC8800' })] : []),
            ],
            spacing: { before: (i === 0 && needsGroupSpace) ? 200 : 0, after: 0 },
            border: i === 0 ? { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'EEEEEE' } } : undefined,
          }));
        });
      } else {
        // Radio call
        children.push(new Paragraph({
          children: [new TextRun({ text, size: 22, font: 'Calibri' })],
          spacing: { before: needsGroupSpace ? 200 : 0, after: 0 },
        }));
      }
    });
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: fileName, size: 14, font: 'Calibri', color: 'AAAAAA' }),
                new TextRun({ text: '    ', size: 14 }),
                new TextRun({ children: [PageNumber.CURRENT], size: 14, font: 'Calibri', color: 'AAAAAA' }),
                new TextRun({ text: ' of ', size: 14, font: 'Calibri', color: 'AAAAAA' }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, font: 'Calibri', color: 'AAAAAA' }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${fileName}.docx`);
}
