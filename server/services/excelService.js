import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../data/fund_diamond_2026.json');

// Đường dẫn thư mục lưu cố định theo yêu cầu
export const TARGET_FOLDER = process.env.EXCEL_EXPORT_DIR || 'C:\\Hoài\\Quỹ Team';

/**
 * Đảm bảo thư mục lưu trữ C:\Hoài\Quỹ Team tồn tại
 */
export function ensureTargetFolderExists(dir = TARGET_FOLDER) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Đã tự động tạo thư mục lưu trữ: ${dir}`);
  }
  return dir;
}

/**
 * Đọc dữ liệu quỹ từ database JSON
 */
function getFundData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return data;
  } catch (err) {
    console.error('Lỗi đọc database quỹ khi xuất Excel:', err);
    return { fundInfo: {}, transactions: [] };
  }
}

/**
 * Định dạng ngày YYYY-MM-DD từ đối tượng Date
 */
export function getFormattedDate(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Tính toán số dư lũy kế
 */
function attachRunningBalance(transactions) {
  const sorted = [...transactions].sort((a, b) => Number(a.id) - Number(b.id));
  let running = 0;
  return sorted.map(t => {
    const amt = Number(t.amount) || 0;
    if (t.type === 'THU') {
      running += amt;
    } else {
      running -= amt;
    }
    return {
      ...t,
      runningBalance: running
    };
  });
}

/**
 * Tạo Workbook Excel chuẩn đẹp cho quỹ Diamond
 */
export function buildFundWorkbook(fundData) {
  const { fundInfo = {}, transactions = [] } = fundData;
  const transactionsWithBalance = attachRunningBalance(transactions);

  // Tính tổng thu, tổng chi và số dư
  let totalIncome = 0;
  let totalExpense = 0;
  transactionsWithBalance.forEach(t => {
    const val = Number(t.amount) || 0;
    if (t.type === 'THU') totalIncome += val;
    else if (t.type === 'CHI') totalExpense += val;
  });
  const currentBalance = totalIncome - totalExpense;

  const nowStr = new Date().toLocaleString('vi-VN');

  // Mảng 2 chiều đại diện cho sheet Excel
  const aoaData = [
    ['BẢNG TỔNG HỢP VÀ ĐỐI SOÁT THU - CHI QUỸ TEAM DIAMOND 2026'],
    [`Thời gian lập / Chốt sổ: ${nowStr}`],
    [`Thư mục lưu trữ cố định: ${TARGET_FOLDER}`],
    [''],
    // Bảng tóm tắt số liệu
    ['TỔNG QUAN TÀI CHÍNH QUỸ TEAM DIAMOND', '', '', ''],
    ['Tổng khoản thu:', totalIncome, 'VNĐ', `(${totalIncome.toLocaleString('vi-VN')} đ)`],
    ['Tổng khoản chi:', totalExpense, 'VNĐ', `(${totalExpense.toLocaleString('vi-VN')} đ)`],
    ['Số dư quỹ hiện tại:', currentBalance, 'VNĐ', `(${currentBalance.toLocaleString('vi-VN')} đ)`],
    ['Số lượng thành viên:', fundInfo.memberCount || 6, 'người', ''],
    ['Tổng số giao dịch:', transactionsWithBalance.length, 'giao dịch', ''],
    [''],
    // Header cột dữ liệu chi tiết
    [
      'STT',
      'Ngày giao dịch',
      'Diễn giải / Lý do thu chi',
      'Phân loại danh mục',
      'Thu (VNĐ)',
      'Chi (VNĐ)',
      'Số dư lũy kế (VNĐ)',
      'Người thực hiện / Ứng tiền',
      'Trạng thái giải ngân',
      'Ghi chú'
    ]
  ];

  // Dữ liệu từng giao dịch
  transactionsWithBalance.forEach((t, idx) => {
    const isThu = t.type === 'THU';
    const thuAmt = isThu ? Number(t.amount) || 0 : 0;
    const chiAmt = !isThu ? Number(t.amount) || 0 : 0;
    const statusText = t.reimbursementStatus === 'REIMBURSED'
      ? 'Đã quyết toán'
      : (t.reimbursementStatus === 'PENDING' ? 'Chờ hoàn ứng' : 'Chưa quyết toán');

    aoaData.push([
      t.id || (idx + 1),
      t.date || '',
      t.description || '',
      t.category || '',
      thuAmt,
      chiAmt,
      t.runningBalance || 0,
      t.submittedBy || t.recordedBy || '',
      statusText,
      t.note || ''
    ]);
  });

  // Hàng tổng kết cuối bảng
  aoaData.push([
    'TỔNG CỘNG',
    '',
    `Tổng cộng ${transactionsWithBalance.length} giao dịch`,
    '',
    totalIncome,
    totalExpense,
    currentBalance,
    '',
    '',
    ''
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoaData);

  // Cấu hình độ rộng từng cột cho đẹp mắt
  ws['!cols'] = [
    { wch: 8 },   // STT
    { wch: 15 },  // Ngày giao dịch
    { wch: 38 },  // Diễn giải
    { wch: 22 },  // Phân loại danh mục
    { wch: 18 },  // Thu (VNĐ)
    { wch: 18 },  // Chi (VNĐ)
    { wch: 20 },  // Số dư lũy kế (VNĐ)
    { wch: 24 },  // Người thực hiện
    { wch: 18 },  // Trạng thái giải ngân
    { wch: 30 }   // Ghi chú
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'So_Quy_Team_Diamond');
  return wb;
}

/**
 * Lưu file Excel trực tiếp vào thư mục C:\Hoài\Quỹ Team
 * Định dạng tên: Quy_Team_Diamond_YYYY-MM-DD.xlsx
 */
export function saveExcelToTargetFolder(options = {}) {
  const {
    date = new Date(),
    targetDir = TARGET_FOLDER,
    prefix = 'Quy_Team_Diamond_'
  } = options;

  // 1. Kiểm tra và tự động tạo thư mục nếu chưa tồn tại
  ensureTargetFolderExists(targetDir);

  // 2. Tạo tên file theo format: Quy_Team_Diamond_YYYY-MM-DD.xlsx
  const dateStr = getFormattedDate(date);
  const fileName = `${prefix}${dateStr}.xlsx`;
  const filePath = path.join(targetDir, fileName);

  // 3. Đọc dữ liệu quỹ và build workbook
  const fundData = getFundData();
  const wb = buildFundWorkbook(fundData);

  // 4. Lưu trực tiếp file Excel
  XLSX.writeFile(wb, filePath);

  const stats = fs.statSync(filePath);
  const summary = fundData.fundInfo?.summary || {};

  console.log(`✅ [Excel Auto-Save] Đã lưu thành công file: ${filePath} (${stats.size} bytes)`);

  return {
    success: true,
    fileName,
    filePath,
    targetDir,
    fileSize: stats.size,
    dateStr,
    createdAt: stats.mtime.toISOString(),
    totalTransactions: fundData.transactions?.length || 0,
    summary
  };
}

/**
 * Lấy danh sách các file Excel đã lưu trong thư mục C:\Hoài\Quỹ Team
 */
export function listSavedExcelFiles(targetDir = TARGET_FOLDER) {
  try {
    ensureTargetFolderExists(targetDir);
    const files = fs.readdirSync(targetDir);
    const excelFiles = files
      .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'))
      .map(fileName => {
        const fullPath = path.join(targetDir, fileName);
        const stats = fs.statSync(fullPath);
        return {
          fileName,
          fullPath,
          size: stats.size,
          mtime: stats.mtime,
          formattedTime: stats.mtime.toLocaleString('vi-VN')
        };
      })
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    return excelFiles;
  } catch (err) {
    console.error('Lỗi khi đọc danh sách file Excel:', err);
    return [];
  }
}
