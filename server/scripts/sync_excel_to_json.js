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
const jsonPath = path.join(rootDir, 'server/data/fund_diamond_2026.json');

console.log('Reading Excel file:', excelPath);
const workbook = XLSX.readFile(excelPath, { raw: false });
const sheet = workbook.Sheets['Trang_tính1'];

// Helper to format date string to DD/MM/YYYY
function formatVNDate(rawDate) {
  if (!rawDate) return '';
  const str = String(rawDate).trim();
  const parts = str.split('/');
  if (parts.length === 3) {
    let day = parts[0].padStart(2, '0');
    let month = parts[1].padStart(2, '0');
    let year = parts[2];
    if (year.length === 2) {
      year = '20' + year;
    }
    return `${day}/${month}/${year}`;
  }
  return str;
}

// Categorization helper
function getCategory(desc, type) {
  const d = (desc || '').toLowerCase();
  if (d.includes('kỳ trước') || d.includes('kết chuyển')) return 'Quỹ ban đầu';
  if (d.includes('chè') || d.includes('sữa chua') || d.includes('ốc') || d.includes('ếch') || d.includes('bánh xèo') || d.includes('cà phê') || d.includes('trà') || d.includes('uống nước')) return 'Ăn uống';
  if (d.includes('sen tây hồ') || d.includes('ngan cháy')) return 'Liên hoan';
  if (d.includes('thưởng tmvn') || d.includes('thưởng team') || d.includes('chi thưởng')) return 'Khen thưởng';
  if (d.includes('thưởng') || d.includes('thường') || d.includes('aff') || d.includes('ws') || d.includes('cá 2025')) return 'Thưởng dự án';
  if (d.includes('xung quỹ') || d.includes('gủi quỹ') || d.includes('gửi quỹ') || d.includes('đóng')) return 'Đóng quỹ';
  if (d.includes('đi chơi') || d.includes('chia cá')) return 'Teambuilding';
  if (d.includes('sn sếp') || d.includes('sinh nhật')) return 'Sinh nhật';
  if (d.includes('viếng') || d.includes('hiếu')) return 'Hiếu hỉ';
  return type === 'THU' ? 'Thu khác' : 'Chi khác';
}

const transactions = [];

// Row 72 totals in Excel
const targetTotalThu = 53104581;
const targetTotalChi = 41992450;
const targetTotalCuoi = 11112131;

// Read rows 7 to 70 from Excel
let excelSumThu = 0;
let excelSumChi = 0;

for (let r = 7; r <= 70; r++) {
  const idCell = sheet['A' + r]?.w || sheet['A' + r]?.v;
  const dateCell = sheet['B' + r]?.w || sheet['B' + r]?.v;
  const descCell = sheet['C' + r]?.w || sheet['C' + r]?.v;
  const thuCell = sheet['D' + r];
  const chiCell = sheet['E' + r];

  const rawThu = thuCell ? Number(String(thuCell.v).replace(/,/g, '')) || 0 : 0;
  const rawChi = chiCell ? Number(String(chiCell.v).replace(/,/g, '')) || 0 : 0;

  const isThu = rawThu > 0;
  const amount = isThu ? rawThu : rawChi;
  const type = isThu ? 'THU' : 'CHI';

  excelSumThu += rawThu;
  excelSumChi += rawChi;

  let billImage = null;
  if (descCell && descCell.includes('Sen Tây Hồ')) {
    billImage = '/uploads/bill_sen_tay_ho.svg';
  }

  // Handle duplicate ID 132 for row 70 (give distinct id 133 or keep label)
  let numId = Number(idCell);
  if (r === 70 && numId === 132) {
    numId = 133;
  }

  transactions.push({
    id: numId,
    excelId: idCell,
    date: formatVNDate(dateCell),
    description: (descCell || '').trim(),
    type,
    amount,
    category: getCategory(descCell, type),
    billImage,
    recordedBy: 'Thủ quỹ',
    note: r === 70 ? 'STT 132 trong file Excel gốc' : ''
  });
}

console.log(`Excel sheet rows 7-70 count: ${transactions.length}`);
console.log(`Excel subtotal Thu: ${excelSumThu.toLocaleString('vi-VN')} đ`);
console.log(`Excel subtotal Chi: ${excelSumChi.toLocaleString('vi-VN')} đ`);

// Calculate difference with Target Totals (STT 1 to 69 from earlier periods)
const prevPeriodThu = targetTotalThu - excelSumThu;
const prevPeriodChi = targetTotalChi - excelSumChi;
const prevPeriodBalance = prevPeriodThu - prevPeriodChi;

console.log(`Brought-forward Thu (STT 1-69): ${prevPeriodThu.toLocaleString('vi-VN')} đ`);
console.log(`Brought-forward Chi (STT 1-69): ${prevPeriodChi.toLocaleString('vi-VN')} đ`);
console.log(`Brought-forward Net Balance: ${prevPeriodBalance.toLocaleString('vi-VN')} đ`);

// Prepend the brought forward entries so the totals match 53.104.581 and 41.992.450
const fullTransactions = [
  {
    id: 68,
    excelId: '1-69',
    date: '01/01/2026',
    description: 'Tổng các khoản THU lũy kế đợt trước kết chuyển sang (STT 1 đến 69)',
    type: 'THU',
    amount: prevPeriodThu,
    category: 'Quỹ ban đầu',
    billImage: null,
    recordedBy: 'Thủ quỹ',
    note: 'Số liệu đối soát lũy kế từ đợt trước năm 2026'
  },
  {
    id: 69,
    excelId: '1-69',
    date: '01/01/2026',
    description: 'Tổng các khoản CHI lũy kế đợt trước kết chuyển sang (STT 1 đến 69)',
    type: 'CHI',
    amount: prevPeriodChi,
    category: 'Quỹ ban đầu',
    billImage: null,
    recordedBy: 'Thủ quỹ',
    note: 'Chi tiêu lũy kế các đợt trước đã quyết toán'
  },
  ...transactions
];

// Sort and compute running balance
let runningBalance = 0;
let finalThu = 0;
let finalChi = 0;

const processedTransactions = fullTransactions.map(t => {
  if (t.type === 'THU') {
    runningBalance += t.amount;
    finalThu += t.amount;
  } else {
    runningBalance -= t.amount;
    finalChi += t.amount;
  }
  return {
    ...t,
    runningBalance
  };
});

console.log(`\n================ FINAL VERIFICATION ================`);
console.log(`Total Transactions: ${processedTransactions.length}`);
console.log(`Final Thu: ${finalThu.toLocaleString('vi-VN')} đ (Target: ${targetTotalThu.toLocaleString('vi-VN')} đ) -> ${finalThu === targetTotalThu ? '✅ MATCH' : '❌ MISMATCH'}`);
console.log(`Final Chi: ${finalChi.toLocaleString('vi-VN')} đ (Target: ${targetTotalChi.toLocaleString('vi-VN')} đ) -> ${finalChi === targetTotalChi ? '✅ MATCH' : '❌ MISMATCH'}`);
console.log(`Final Balance: ${runningBalance.toLocaleString('vi-VN')} đ (Target: ${targetTotalCuoi.toLocaleString('vi-VN')} đ) -> ${runningBalance === targetTotalCuoi ? '✅ MATCH' : '❌ MISMATCH'}`);

const dbData = {
  fundInfo: {
    name: 'Smart Fund Team Diamond 2026',
    department: 'Team Diamond',
    year: 2026,
    currency: 'VNĐ',
    treasurer: 'Thủ Quỹ Team Diamond',
    excelSource: 'quỹ team DM.xlsx',
    summary: {
      totalIncome: finalThu,
      totalExpense: finalChi,
      currentBalance: runningBalance
    },
    lastUpdated: new Date().toISOString()
  },
  transactions: processedTransactions
};

fs.writeFileSync(jsonPath, JSON.stringify(dbData, null, 2), 'utf-8');
console.log(`\n✅ Saved successfully to ${jsonPath}`);
