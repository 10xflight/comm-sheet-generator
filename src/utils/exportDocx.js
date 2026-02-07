import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, TabStopPosition, TabStopType,
  Header, Footer, PageNumber, NumberFormat
} from 'docx';
import { saveAs } from 'file-saver';
import { subVars } from './callSign';
import { parseTaxiRoute } from './taxiParser';

// Parse text and create TextRuns with [brackets] bold
function parseTextWithBrackets(text, baseStyle = {}) {
  const runs = [];
  const regex = /\[([^\]]+)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the bracket
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index), ...baseStyle }));
    }
    // Add the bracketed text (bold)
    runs.push(new TextRun({ text: `[${match[1]}]`, ...baseStyle, bold: true }));
    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex), ...baseStyle }));
  }

  return runs.length > 0 ? runs : [new TextRun({ text, ...baseStyle })];
}

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

export async function exportToDocx({ callSign, flightRules, route, blockInstances, calls, hidden, hiddenBlocks, vars, abbr }) {
  const visible = calls.filter(c => !hidden.has(c.id) && !hiddenBlocks.has(c._blockKey || c.block));
  const byBlockKey = visible.reduce((acc, c) => {
    const key = c._blockKey || c.block;
    (acc[key] = acc[key] || []).push(c);
    return acc;
  }, {});

  const children = [];
  const today = new Date();

  // Build filename
  const isLibraryExportForName = !route || route.length === 0;
  const routeIds = isLibraryExportForName ? '' : route.map(s => s.airport?.id || '???').join('-');
  const fileName = isLibraryExportForName
    ? `MasterCommSheetLibrary_${formatDateForFilename(today)}`
    : `CommSheet_${callSign?.replace(/\s+/g, '') || 'untitled'}_${flightRules.toUpperCase()}_${routeIds}_${formatDateForFilename(today)}`;

  // Check if this is a library export (no route)
  const isLibraryExport = !route || route.length === 0;

  // Header text for page header
  const routeArrows = isLibraryExport ? '' : route.map(s => s.airport?.id || '???').join(' → ');
  const headerText = isLibraryExport
    ? `${callSign || 'Master Comm Sheet Library'} | ${formatDate(today)}`
    : `${callSign || '[Call Sign]'} | ${flightRules.toUpperCase()} | ${routeArrows} | ${formatDate(today)}`;

  const depApt = route?.find(s => s.type === 'dep')?.airport;
  const arrApt = route?.find(s => s.type === 'arr')?.airport;

  // Title
  children.push(new Paragraph({
    children: [new TextRun({ text: isLibraryExport ? 'MASTER COMM SHEET LIBRARY' : `COMM SHEET: ${callSign || '[Call Sign]'}`, bold: true, size: 32, font: 'Calibri' })],
    spacing: { after: 0 },
  }));

  // Empty line
  children.push(new Paragraph({ children: [], spacing: { after: 0 } }));

  // Flight info (only for comm sheets, not library exports)
  if (!isLibraryExport) {
    const infoLines = [
      `Flight Rules: ${flightRules.toUpperCase()}`,
      `Route: ${routeArrows}`,
      `Departure: ${depApt?.name || '???'} (${depApt?.towered ? 'Towered' : 'Non-Towered'})`,
      `Arrival: ${arrApt?.name || '???'} (${arrApt?.towered ? 'Towered' : 'Non-Towered'})`,
    ];
    infoLines.forEach(line => {
      children.push(new Paragraph({
        children: [new TextRun({ text: line, size: 22, font: 'Calibri', color: '555555' })],
        spacing: { after: 0 },
      }));
    });

    // Empty line
    children.push(new Paragraph({ children: [], spacing: { after: 0 } }));
  }

  // Divider line
  children.push(new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '333333' } },
    spacing: { after: 0 },
  }));

  // Empty line after divider
  children.push(new Paragraph({ children: [], spacing: { after: 0 } }));

  // Blocks
  blockInstances.forEach(inst => {
    const blockCalls = byBlockKey[inst.key];
    if (!blockCalls?.length) return;

    const label = inst.contextLabel ? `${inst.name} ${inst.contextLabel}` : inst.name;

    // Empty line before block
    children.push(new Paragraph({ children: [], spacing: { after: 0 } }));

    // Block header
    children.push(new Paragraph({
      children: [
        new TextRun({ text: label, bold: true, size: 28, font: 'Calibri' }),
        new TextRun({ text: `  (${inst.target || ''})`, size: 22, font: 'Calibri', color: '888888' }),
      ],
      spacing: { after: 0 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
    }));

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
      prevCall = call;

      // Add empty line between groups
      if (isNewGroup) {
        children.push(new Paragraph({ children: [], spacing: { after: 0 } }));
      }

      if (call.isTaxiBrief && call.taxiRoutes?.length) {
        children.push(new Paragraph({
          children: parseTextWithBrackets(text, { bold: true, size: 22, font: 'Calibri' }),
          spacing: { after: 0 },
        }));
        call.taxiRoutes.filter(r => r.runway && r.route).forEach(r => {
          children.push(new Paragraph({
            children: [new TextRun({ text: `    RWY ${r.runway}: ${parseTaxiRoute(r.route, abbr)}`, size: 22, font: 'Calibri', color: '333333' })],
            indent: { left: 360 },
            spacing: { after: 0 },
          }));
        });
        return;
      }

      if (call.type === 'atc') {
        children.push(new Paragraph({
          children: parseTextWithBrackets(text, { italics: true, size: 22, font: 'Calibri', color: '777777' }),
          alignment: AlignmentType.RIGHT,
          indent: { left: 4320 },
          spacing: { after: 0 },
        }));
      } else if (call.type === 'note') {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: 'NOTE ', bold: true, size: 22, font: 'Calibri', color: '999999' }),
            ...parseTextWithBrackets(text, { size: 22, font: 'Calibri', color: '333333' }),
          ],
          spacing: { after: 0 },
        }));
      } else if (call.type === 'brief') {
        // Multi-line briefs - all at size 22 (11pt), no color on "(Modify as Needed)"
        const lines = text.split('\n');
        lines.forEach((line, i) => {
          const baseStyle = i === 0
            ? { bold: true, size: 22, font: 'Calibri', color: '333333' }
            : { size: 22, font: 'Calibri', color: '555555' };

          children.push(new Paragraph({
            children: [
              ...parseTextWithBrackets(i === 0 ? line : `    ${line}`, baseStyle),
              ...(i === 0 ? [new TextRun({ text: ' (Modify as Needed)', italics: true, size: 22, font: 'Calibri', color: '666666' })] : []),
            ],
            spacing: { after: 0 },
            border: i === 0 ? { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'EEEEEE' } } : undefined,
          }));
        });
      } else {
        // Radio call
        children.push(new Paragraph({
          children: parseTextWithBrackets(text, { size: 22, font: 'Calibri' }),
          spacing: { after: 0 },
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
      headers: {
        // Empty header for first page
        first: new Header({
          children: [],
        }),
        // Header for pages 2+
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: headerText, size: 22, font: 'Calibri', color: '888888' }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ children: [PageNumber.CURRENT], size: 22, font: 'Calibri', color: 'AAAAAA' }),
                new TextRun({ text: ' of ', size: 22, font: 'Calibri', color: 'AAAAAA' }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 22, font: 'Calibri', color: 'AAAAAA' }),
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
