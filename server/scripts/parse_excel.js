import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '../..');

const files = fs.readdirSync(rootDir);
const excelFile = files.find(f => f.endsWith('.xlsx'));

if (!excelFile) {
  console.error('No .xlsx file found!');
  process.exit(1);
}

const excelPath = path.join(rootDir, excelFile);
console.log('Reading Excel file:', excelPath);

const workbook = XLSX.readFile(excelPath, { cellDates: true });
console.log('Sheet names:', workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
  console.log(`\n=================== SHEET: ${sheetName} ===================`);
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  
  rows.forEach((row, idx) => {
    if (row.some(cell => cell !== '')) {
      console.log(`Row ${idx + 1}:`, JSON.stringify(row));
    }
  });
  console.log(`Total rows in sheet ${sheetName}:`, rows.length);
});
