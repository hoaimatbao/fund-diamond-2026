import { createWorker } from 'tesseract.js';

/**
 * Heuristic parser for Vietnamese shorthand text
 * e.g. "chi ăn chè 154k" -> { amount: 154000, description: "Chi ăn chè", type: "CHI" }
 */
export function parseVietnameseExpenseText(text) {
  if (!text || typeof text !== 'string') {
    return {
      amount: '',
      description: 'Chi tiêu theo hóa đơn',
      type: 'CHI',
      date: new Date().toLocaleDateString('vi-VN'),
      category: 'Ăn uống',
      note: ''
    };
  }

  const cleanText = text.replace(/\r\n/g, '\n');
  const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);

  let amount = 0;
  let type = 'CHI';
  let description = '';
  let date = new Date().toLocaleDateString('vi-VN');
  let category = 'Ăn uống';
  let note = '';

  // 1. Detect Amount
  // Shorthand "k", "K", "nghìn", "ngàn"
  const kRegex = /(\d+(?:[.,]\d+)?)\s*(?:k\b|K\b|nghìn|ngàn|nghin|ngan)/i;
  // Shorthand "tr", "củ", "triệu"
  const trRegex = /(\d+(?:[.,]\d+)?)\s*(?:tr\b|Tr\b|củ|cu|triệu|trieu)/i;
  // Standard formatted numbers (3.552.000, 150,000, 180000)
  const numRegex = /(?:tổng cộng|thành tiền|tổng tiền|cộng tiền|thanh toán|total)?\s*[:=\s]*([1-9]\d{0,2}(?:[.,]\d{3})+|[1-9]\d{4,8})\s*(?:đ|vnđ|vnd)?/i;

  let foundAmount = false;

  // Search keyword lines from bottom up (grand totals like TỔNG CỘNG are always at the bottom of bills)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (/tổng cộng|tổng tiền|tổng thanh toán|thanh toán|thành tiền|tiền hàng|total/i.test(line)) {
      let match = line.match(kRegex) || line.match(trRegex) || line.match(numRegex);
      if (match) {
        amount = convertToAmount(match[0]);
        if (amount > 0) {
          foundAmount = true;
          break;
        }
      }
      // Check next line
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        match = nextLine.match(kRegex) || nextLine.match(trRegex) || nextLine.match(numRegex);
        if (match) {
          amount = convertToAmount(match[0]);
          if (amount > 0) {
            foundAmount = true;
            break;
          }
        }
      }
    }
  }

  // If not found by keywords, search valid lines from bottom up (excluding MST, Hotline, Phone, STK)
  if (!foundAmount) {
    const validLines = lines.filter(l => !/mst\b|mã số thuế|hotline\b|tel\b|sđt\b|phone\b|stk\b|tài khoản/i.test(l));
    for (let i = validLines.length - 1; i >= 0; i--) {
      const line = validLines[i];
      const match = line.match(kRegex) || line.match(trRegex) || line.match(numRegex);
      if (match) {
        const val = convertToAmount(match[0]);
        if (val > 0) {
          amount = val;
          foundAmount = true;
          break;
        }
      }
    }
  }

  // 2. Detect Date
  const dateRegex = /(\b\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4}\b)/;
  const dateMatch = cleanText.match(dateRegex);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    let year = dateMatch[3];
    if (year.length === 2) year = '20' + year;
    date = `${day}/${month}/${year}`;
  } else {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    date = `${day}/${month}/${year}`;
  }

  // 3. Detect Type (THU vs CHI)
  const thuKeywords = /thưởng|thuong|thường|thương|thu\s*quỹ|thu\s*quy|nộp|nop|xung\s*quỹ|xung\s*quy|xung|đóng\s*quỹ|dong\s*quy|đóng|dong|gửi|gui|gủi|hoàn\s*ứng|hoan\s*ung|nhận\s*tiền|nhan\s*tien|ws\b|aff\b|tmvn\b|cá\s*2025|tiền\s*thưởng/i;
  if (thuKeywords.test(cleanText) && !cleanText.toLowerCase().startsWith('chi thưởng')) {
    type = 'THU';
    category = 'Thưởng dự án';
    if (/đóng|dong|xung|nộp|nop/i.test(cleanText)) category = 'Đóng quỹ';
  } else {
    type = 'CHI';
    category = 'Ăn uống';
    if (/buffet|sen tây hồ|sen tay ho|lẩu|lau|gogi|tiệc|tiec/i.test(cleanText)) category = 'Liên hoan';
    if (/thưởng team|thuong team|chi thưởng/i.test(cleanText)) category = 'Khen thưởng';
  }

  // 4. Detect Description
  for (let line of lines) {
    let l = line.replace(/(\d+.*)/, '').trim();
    l = l.replace(/(?:tổng cộng|thành tiền|tổng tiền|tiền hàng|total|thanh toán)[\s:]*$/i, '').trim();
    l = l.replace(/[:\-–—\.]+\s*$/, '').trim();
    if (l.length >= 3 && !/hóa đơn|phiếu|thanh toán|thu ngân|bàn|ngày|tel|mst|cảm ơn/i.test(l)) {
      description = l;
      break;
    }
  }

  if (!description) {
    if (/chè/i.test(cleanText)) description = 'Chi ăn chè';
    else if (/sữa chua/i.test(cleanText)) description = 'Chi ăn sữa chua';
    else if (/sen tây hồ/i.test(cleanText)) description = 'Đi ăn Sen Tây Hồ';
    else if (/cà phê|cafe/i.test(cleanText)) description = 'Chi uống cà phê';
    else if (/trà sữa/i.test(cleanText)) description = 'Chi liên hoan trà sữa';
    else if (/bánh xèo/i.test(cleanText)) description = 'Chi ăn bánh xèo nem lụi';
    else if (/thưởng/i.test(cleanText)) description = 'Thưởng các giải team';
    else if (/đóng quỹ/i.test(cleanText)) description = 'Đóng quỹ team';
    else description = type === 'THU' ? 'Thu quỹ team' : 'Chi tiêu theo hóa đơn';
  }

  description = description.charAt(0).toUpperCase() + description.slice(1);
  note = lines.slice(0, 2).join(' - ');

  return {
    amount: amount || '',
    description,
    type,
    date,
    category,
    note
  };
}

function convertToAmount(str) {
  if (!str) return 0;
  const s = str.toLowerCase().replace(/đ|vnđ|vnd/g, '').trim();

  // If contains "tr", "củ", "triệu"
  if (/(?:tr\b|củ|cu|triệu|trieu)/.test(s)) {
    const numPart = s.match(/(\d+(?:[.,]\d+)?)/);
    if (numPart) {
      const val = parseFloat(numPart[1].replace(',', '.'));
      return Math.round(val * 1000000);
    }
  }

  // If contains "k", "nghìn", "ngàn"
  if (/(?:k\b|nghìn|ngàn|nghin|ngan)/.test(s)) {
    const numPart = s.match(/(\d+(?:[.,]\d+)?)/);
    if (numPart) {
      const val = parseFloat(numPart[1].replace(',', '.'));
      return Math.round(val * 1000);
    }
  }

  const numbersOnly = s.replace(/[^0-9]/g, '');
  if (numbersOnly) {
    return parseInt(numbersOnly, 10);
  }

  return 0;
}

/**
 * Scan receipt image:
 * First attempts server API (Gemini Vision if available),
 * then falls back to client-side Tesseract.js OCR.
 */
export async function scanBillImage(file, onProgress) {
  let serverUploadedUrl = null;
  // Step 1: Upload and try backend /api/scan-bill
  try {
    if (onProgress) onProgress('Đang gửi ảnh sang mô-đun AI phân tích...');
    const formData = new FormData();
    formData.append('bill', file);

    const res = await fetch('/api/scan-bill', {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      const data = await res.json();
      serverUploadedUrl = data.billUrl;
      if (data.success && data.amount > 0) {
        return {
          ...data,
          billImage: data.billUrl,
          source: data.method === 'gemini' ? 'Gemini AI Vision' : 'AI OCR Server'
        };
      }
    }
  } catch (err) {
    console.warn('Backend scan failed, trying client OCR:', err);
  }

  // Step 2: Client-side Fallback using Tesseract.js
  try {
    if (onProgress) onProgress('Đang quét chữ và số trên ảnh bằng OCR tiếng Việt...');
    
    const worker = await createWorker('vie+eng');
    const ret = await worker.recognize(file);
    await worker.terminate();

    const ocrText = ret.data.text;
    console.log('Tesseract OCR extracted text:', ocrText);

    const parsed = parseVietnameseExpenseText(ocrText);
    return {
      ...parsed,
      billImage: serverUploadedUrl || (file ? URL.createObjectURL(file) : ''),
      source: 'Tesseract OCR Client',
      confidence: `${Math.round(ret.data.confidence || 85)}%`
    };
  } catch (ocrErr) {
    console.warn('Client OCR error:', ocrErr);
    // Ultimate fallback
    return {
      amount: '',
      description: 'Chi tiêu theo hóa đơn',
      type: 'CHI',
      date: new Date().toLocaleDateString('vi-VN'),
      category: 'Ăn uống',
      note: 'Vui lòng kiểm tra và điền số tiền',
      billImage: serverUploadedUrl || (file ? URL.createObjectURL(file) : ''),
      source: 'Nhập thủ công',
      confidence: '60%'
    };
  }
}
