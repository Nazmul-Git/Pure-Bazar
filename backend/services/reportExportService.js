const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

async function toExcel({ title, columns, rows, totals }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(title.slice(0, 31));
  sheet.columns = columns.map((column) => ({ header: column.label, key: column.key, width: column.width || 18 }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));
  if (totals) {
    const totalRow = sheet.addRow({ [columns[0].key]: 'Total', ...totals });
    totalRow.font = { bold: true };
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function toPdf({ title, subtitle, columns, rows, totals }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const width = (doc.page.width - 72) / columns.length;
    const line = (values, bold) => {
      if (doc.y > doc.page.height - 60) doc.addPage();
      const y = doc.y;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
      values.forEach((value, index) => {
        doc.text(String(value ?? ''), 36 + index * width, y, { width: width - 6, lineBreak: false, ellipsis: true });
      });
      doc.y = y + 16;
    };

    doc.font('Helvetica-Bold').fontSize(16).text(title);
    if (subtitle) doc.font('Helvetica').fontSize(10).text(subtitle);
    doc.moveDown();
    line(columns.map((column) => column.label), true);
    rows.forEach((row) => line(columns.map((column) => row[column.key]), false));
    if (totals) line(columns.map((column, index) => (index === 0 ? 'Total' : totals[column.key])), true);
    doc.end();
  });
}

module.exports = { toExcel, toPdf };
