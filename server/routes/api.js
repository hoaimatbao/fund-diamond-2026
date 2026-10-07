import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { scanBillWithGemini, parseReceiptText } from '../utils/billParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../data/fund_diamond_2026.json');
const UPLOADS_DIR = path.join(__dirname, '../../public/uploads');

// Ensure uploads dir exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage for uploaded bill images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `bill-${uniqueSuffix}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

const router = express.Router();

// Helper to read data
function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (data.transactions && Array.isArray(data.transactions)) {
      data.transactions.forEach(t => {
        if (t.category === 'An u?ng') {
          t.category = 'Ăn uống';
        }
      });
    }
    return data;
  } catch (err) {
    console.error('Error reading JSON DB:', err);
    return { fundInfo: {}, transactions: [] };
  }
}

// Helper to write data and recalculate totals
function saveData(data) {
  // Recalculate summary dynamically
  let totalIncome = 0;
  let totalExpense = 0;

  data.transactions.forEach(t => {
    const val = Number(t.amount) || 0;
    if (t.type === 'THU') {
      totalIncome += val;
    } else if (t.type === 'CHI') {
      totalExpense += val;
    }
  });

  const currentBalance = totalIncome - totalExpense;

  data.fundInfo = {
    ...data.fundInfo,
    summary: {
      totalIncome,
      totalExpense,
      currentBalance
    },
    lastUpdated: new Date().toISOString()
  };

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  return data;
}

// Calculate running balance for each transaction
function attachRunningBalance(transactions) {
  // Sort ascending by ID or date for cumulative calculation
  const sorted = [...transactions].sort((a, b) => Number(a.id) - Number(b.id));
  let running = 0;
  const mapped = sorted.map(t => {
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
  return mapped;
}

// GET /api/fund - Get fund details and transactions
router.get('/fund', (req, res) => {
  const data = readData();
  const transactionsWithBalance = attachRunningBalance(data.transactions);
  
  // Also calculate summary from transactions
  let totalIncome = 0;
  let totalExpense = 0;
  transactionsWithBalance.forEach(t => {
    if (t.type === 'THU') totalIncome += Number(t.amount) || 0;
    if (t.type === 'CHI') totalExpense += Number(t.amount) || 0;
  });

  res.json({
    fundInfo: {
      ...data.fundInfo,
      summary: {
        totalIncome,
        totalExpense,
        currentBalance: totalIncome - totalExpense
      }
    },
    transactions: transactionsWithBalance
  });
});

// PUT /api/fund/settings - Update general fund configuration (banner, members, etc.)
router.put('/fund/settings', (req, res) => {
  const { memberCount, members, bannerTitle, bannerDescription, department, name, treasurer } = req.body;
  const data = readData();

  data.fundInfo = {
    ...data.fundInfo,
    ...(memberCount !== undefined && { memberCount: Number(memberCount) }),
    ...(members !== undefined && { members: Array.isArray(members) ? members : [] }),
    ...(bannerTitle !== undefined && { bannerTitle: bannerTitle.trim() }),
    ...(bannerDescription !== undefined && { bannerDescription: bannerDescription.trim() }),
    ...(department !== undefined && { department: department.trim() }),
    ...(name !== undefined && { name: name.trim() }),
    ...(treasurer !== undefined && { treasurer: treasurer.trim() }),
    lastUpdated: new Date().toISOString()
  };

  saveData(data);

  res.json({
    message: 'Cập nhật cấu hình quỹ thành công',
    fundInfo: data.fundInfo
  });
});

// POST /api/verify-pin - Check treasurer PIN
router.post('/verify-pin', (req, res) => {
  const { pin } = req.body;
  if (pin === '123456') {
    return res.json({ success: true, message: 'Xác thực thủ quỹ thành công' });
  }
  return res.status(401).json({ success: false, message: 'Mã PIN thủ quỹ không chính xác (Mặc định: 123456)' });
});

// POST /api/upload - Upload bill receipt image
router.post('/upload', upload.single('bill'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Không tìm thấy file ảnh' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, filename: req.file.filename });
});

// POST /api/scan-bill - Upload and scan bill with Gemini Vision or OCR fallback
router.post('/scan-bill', upload.single('bill'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Vui lòng chọn hoặc chụp ảnh hóa đơn' });
  }

  const filePath = req.file.path;
  const fileUrl = `/uploads/${req.file.filename}`;
  const mimeType = req.file.mimetype || 'image/jpeg';

  const clientApiKey = req.headers['x-gemini-key'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
  const effectiveApiKey = clientApiKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  const hasApiKey = Boolean(effectiveApiKey);

  const isSvg = req.file.filename.endsWith('.svg') || mimeType.includes('svg');

  if (hasApiKey && !isSvg) {
    try {
      const extracted = await scanBillWithGemini(filePath, mimeType, effectiveApiKey);
      return res.json({
        success: true,
        method: 'gemini',
        billUrl: fileUrl,
        ...extracted
      });
    } catch (err) {
      console.warn('Gemini Vision API error, falling back to local OCR parser:', err.message);
    }
  }

  // Fallback: If SVG or text readable file
  let rawText = '';
  if (req.file.filename.endsWith('.svg') || mimeType.includes('svg')) {
    const svgContent = fs.readFileSync(filePath, 'utf-8');
    const textMatches = [...svgContent.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
    if (textMatches.length > 0) {
      rawText = textMatches.join('\n');
    } else {
      rawText = svgContent.replace(/<[^>]+>/g, ' ');
    }
  }

  const extracted = parseReceiptText(rawText);
  res.json({
    success: true,
    method: 'fallback_ocr',
    billUrl: fileUrl,
    ...extracted
  });
});

// POST /api/parse-text - Parse Vietnamese shorthand text (e.g. "chi ăn chè 154k")
router.post('/parse-text', (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Thiếu nội dung văn bản' });
  }
  const extracted = parseReceiptText(text);
  res.json({
    success: true,
    ...extracted
  });
});

// POST /api/transactions - Add new transaction
router.post('/transactions', (req, res) => {
  const { date, description, type, amount, category, billImage, note, recordedBy, submittedBy, reimbursementStatus } = req.body;

  if (!description || !type || !amount) {
    return res.status(400).json({ error: 'Vui lòng điền đủ thông tin (Lý do, Loại, Số tiền)' });
  }

  const data = readData();
  const maxId = data.transactions.reduce((max, t) => Math.max(max, Number(t.id) || 0), 100);
  const newId = maxId + 1;

  const author = submittedBy || recordedBy || 'Thủ quỹ';
  const isMemberExpense = type.toUpperCase() === 'CHI' && author !== 'Thủ quỹ';
  const resolvedStatus = reimbursementStatus || (isMemberExpense ? 'PENDING' : 'REIMBURSED');

  const newTx = {
    id: newId,
    date: date || new Date().toLocaleDateString('vi-VN'),
    description: description.trim(),
    type: type.toUpperCase() === 'CHI' ? 'CHI' : 'THU',
    amount: Math.abs(Number(amount)),
    category: category || (type === 'THU' ? 'Thu khác' : 'Chi khác'),
    billImage: billImage || null,
    submittedBy: author,
    recordedBy: author,
    reimbursementStatus: resolvedStatus,
    note: note || ''
  };

  data.transactions.push(newTx);
  const saved = saveData(data);

  res.status(201).json({
    message: 'Thêm giao dịch thành công',
    transaction: newTx,
    summary: saved.fundInfo.summary
  });
});

// PUT /api/transactions/:id - Edit transaction
router.put('/transactions/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = readData();
  const idx = data.transactions.findIndex(t => Number(t.id) === id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Không tìm thấy giao dịch' });
  }

  const { date, description, type, amount, category, billImage, note, submittedBy, recordedBy, reimbursementStatus } = req.body;
  const author = submittedBy || recordedBy;

  data.transactions[idx] = {
    ...data.transactions[idx],
    ...(date && { date }),
    ...(description && { description }),
    ...(type && { type: type.toUpperCase() }),
    ...(amount !== undefined && { amount: Math.abs(Number(amount)) }),
    ...(category && { category }),
    ...(billImage !== undefined && { billImage }),
    ...(note !== undefined && { note }),
    ...(author && { submittedBy: author, recordedBy: author }),
    ...(reimbursementStatus !== undefined && { reimbursementStatus })
  };

  const saved = saveData(data);
  res.json({
    message: 'Cập nhật giao dịch thành công',
    transaction: data.transactions[idx],
    summary: saved.fundInfo.summary
  });
});

// PATCH /api/transactions/:id/reimburse - Quick reimbursement toggle
router.patch('/transactions/:id/reimburse', (req, res) => {
  const id = Number(req.params.id);
  const data = readData();
  const idx = data.transactions.findIndex(t => Number(t.id) === id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Không tìm thấy giao dịch' });
  }

  const status = req.body.status || 'REIMBURSED';
  data.transactions[idx].reimbursementStatus = status;

  saveData(data);
  res.json({
    message: status === 'REIMBURSED' ? 'Đã giải ngân khoản chi' : 'Đã chuyển về trạng thái chờ hoàn ứng',
    transaction: data.transactions[idx]
  });
});

// DELETE /api/transactions/:id - Delete transaction
router.delete('/transactions/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = readData();
  const initialLen = data.transactions.length;
  data.transactions = data.transactions.filter(t => Number(t.id) !== id);

  if (data.transactions.length === initialLen) {
    return res.status(404).json({ error: 'Không tìm thấy giao dịch để xóa' });
  }

  const saved = saveData(data);
  res.json({
    message: 'Đã xóa giao dịch',
    summary: saved.fundInfo.summary
  });
});

export default router;
