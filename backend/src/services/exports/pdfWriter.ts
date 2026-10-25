// backend/src/services/exports/pdfWriter.ts
import type { Writable } from 'stream';
import PDFDocument from 'pdfkit';
import { displayValue } from './format';
import type { ExportDataset } from './types';

const MARGIN = 28;
const ROW_PAD = 3;
const FONT_SIZE = 7.5;

/**
 * Landscape A4 table. Column widths are the dataset's relative widths scaled to the page; long cells wrap, and the header
 * repeats on every page with "Page x of y" in the footer. Built-in PDF fonts only: Latin text renders, Arabic names do not
 * (embed a Unicode font to change that, see docs/EXPORTS.md).
 */
export const writePdf = (data: ExportDataset, out: Writable, meta: { hospital: string; generatedAt: Date; rangeLabel: string }): Promise<void> =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: MARGIN, bufferPages: true, info: { Title: `HospiLink ${data.title}`, Author: 'HospiLink' } });
    doc.on('error', reject);
    out.on('error', reject);
    out.on('finish', resolve);
    doc.pipe(out);

    const usable = doc.page.width - MARGIN * 2;
    const totalWeight = data.columns.reduce((s, c) => s + c.width, 0);
    const widths = data.columns.map((c) => (c.width / totalWeight) * usable);
    const cellOpts = (i: number) => ({ width: widths[i] - ROW_PAD * 2, lineBreak: true });

    const rowHeight = (cells: string[]): number =>
      Math.max(...cells.map((t, i) => doc.heightOfString(t || ' ', cellOpts(i)))) + ROW_PAD * 2;

    const drawRow = (cells: string[], y: number, h: number, header: boolean) => {
      if (header) doc.rect(MARGIN, y, usable, h).fill('#1E3A5F');
      let x = MARGIN;
      cells.forEach((t, i) => {
        doc.fillColor(header ? '#FFFFFF' : '#111827').text(t, x + ROW_PAD, y + ROW_PAD, cellOpts(i));
        x += widths[i];
      });
      if (!header) doc.moveTo(MARGIN, y + h).lineTo(MARGIN + usable, y + h).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
    };

    const title = () => {
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(14).text(`${meta.hospital} — ${data.title}`, MARGIN, MARGIN);
      doc.font('Helvetica').fontSize(8).fillColor('#6B7280')
        .text(`${meta.rangeLabel} · ${data.rows.length} rows · generated ${meta.generatedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`, MARGIN, doc.y + 2);
      doc.moveDown(0.6);
    };

    const headerCells = data.columns.map((c) => c.header);
    const footerSpace = 24;
    title();
    doc.font('Helvetica-Bold').fontSize(FONT_SIZE);
    let y = doc.y;
    drawRow(headerCells, y, rowHeight(headerCells), true);
    y += rowHeight(headerCells);

    doc.font('Helvetica').fontSize(FONT_SIZE);
    for (const row of data.rows) {
      const cells = data.columns.map((c) => displayValue(c.kind, row[c.key] ?? null));
      const h = rowHeight(cells);
      if (y + h > doc.page.height - MARGIN - footerSpace) {
        doc.addPage();
        doc.font('Helvetica-Bold').fontSize(FONT_SIZE);
        y = MARGIN;
        drawRow(headerCells, y, rowHeight(headerCells), true);
        y += rowHeight(headerCells);
        doc.font('Helvetica').fontSize(FONT_SIZE);
      }
      drawRow(cells, y, h, false);
      y += h;
    }
    if (data.rows.length === 0) doc.fillColor('#6B7280').text('No data in this period.', MARGIN, y + 8);

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      // Writing inside the bottom margin would make pdfkit add a blank page after every page.
      doc.page.margins.bottom = 0;
      doc.font('Helvetica').fontSize(8).fillColor('#6B7280')
        .text(`Page ${i + 1} of ${range.count} · Confidential patient data`, MARGIN, doc.page.height - MARGIN - 8, { width: usable, align: 'center', lineBreak: false });
    }
    doc.end();
  });
