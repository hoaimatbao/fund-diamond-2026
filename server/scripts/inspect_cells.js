import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '../..');

const excelPath = path.join(rootDir, 'quỹ team DM.xlsx');
// Read without cellDates: true so we see the raw values or formatted strings
const workbook = XLSX.readFile(excelPath, { cellDates: false, raw: false });
const sheet = workbook.Sheets['Trang_tính1'];

console.log('Range:', sheet['!ref']);

// Let's print rows 4 to 74
const range = XLSX.utils.decode_range(sheet['!ref']);
for (let r = 3; r <= range.e.r; r++) {
  const rowData = [];
  for (let c = 0; c <= 4; c++) {
    const cellAddr = XLSX.utils.encode_cell({ r, c });
    const cell = sheet[cellAddr];
    rowData.push(cell ? { v: cell.v, w: cell.w, t: cell.t } : null);
  }
  const hasContent = rowData.some(c => c !== null);
  if (hasContent) {
    console.log(`Row ${r + 1}:`, JSON.stringify(rowData.map(c => c ? c.w || c.v : '')));
  }
}
