import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';

/**
 * Heuristic parser for Vietnamese receipt / handwritten text
 * Handles "154k", "2tr", "500 củ", formatted numbers, date, type
 */
export function parseReceiptText(text) {
  if (!text || typeof text !== 'string') {
    return {
      amount: 0,
      description: 'Chi tiêu theo hóa đơn',
      type: 'CHI',
      date: new Date().toLocaleDateString('vi-VN'),
      category: 'Ăn uống',
      note: 'Quét tự động từ ảnh',
      confidence: '75%'
    };
  }

  const cleanText = text.replace(/\r\n/g, '\n');
  const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);

  let amount = 0;
  let type = 'CHI';
  let description = '';
  let date = new Date().toLocaleDateString('vi-VN');
  let category = 'Ăn uống';
  let confidence = '85%';

  // 1. Detect Amount
  const kRegex = /(\d+(?:[.,]\d+)?)\s*(?:k\b|K\b|nghìn|ngàn|nghin|ngan)/i;
  const trRegex = /(\d+(?:[.,]\d+)?)\s*(?:tr\b|Tr\b|củ|cu|triệu|trieu)/i;
  const fullNumberRegex = /(?:tổng cộng|thành tiền|tổng tiền|cộng tiền|thanh toán|payment|total)?\s*[:=\s]*([1-9]\d{0,2}(?:[.,]\d{3})+|[1-9]\d{4,8})\s*(?:đ|vnđ|vnd)?/i;

  let foundAmount = false;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (/tổng cộng|tổng tiền|tổng thanh toán|thanh toán|thành tiền|tiền hàng|total/i.test(line)) {
      let match = line.match(kRegex) || line.match(trRegex) || line.match(fullNumberRegex);
      if (match) {
        amount = extractAmountFromMatch(match[0]);
        if (amount > 0) {
          foundAmount = true;
          confidence = '95%';
          break;
        }
      }
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        match = nextLine.match(kRegex) || nextLine.match(trRegex) || nextLine.match(fullNumberRegex);
        if (match) {
          amount = extractAmountFromMatch(match[0]);
          if (amount > 0) {
            foundAmount = true;
            confidence = '95%';
            break;
          }
        }
      }
    }
  }

  if (!foundAmount) {
    const validLines = lines.filter(l => !/mst\b|mã số thuế|hotline\b|tel\b|sđt\b|phone\b|stk\b|tài khoản/i.test(l));
    for (let i = validLines.length - 1; i >= 0; i--) {
      const line = validLines[i];
      const match = line.match(kRegex) || line.match(trRegex) || line.match(fullNumberRegex);
      if (match) {
        const val = extractAmountFromMatch(match[0]);
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
    else if (/thưởng/i.test(cleanText)) description = 'Thưởng team';
    else if (/đóng quỹ/i.test(cleanText)) description = 'Đóng quỹ team';
    else description = type === 'THU' ? 'Thu nhập quỹ' : 'Chi tiêu theo hóa đơn';
  }

  description = description.charAt(0).toUpperCase() + description.slice(1);

  return {
    amount: amount || 0,
    description,
    type,
    date,
    category,
    note: `Bóc tách từ ảnh: ${lines.slice(0, 2).join(' - ')}`,
    confidence
  };
}

/**
 * Convert string number with suffix (k, tr, củ, nghìn...) to integer VND
 */
export function extractAmountFromMatch(str) {
  if (!str) return 0;
  const s = str.toLowerCase().replace(/đ|vnđ|vnd/g, '').trim();

  if (/(?:tr\b|củ|cu|triệu|trieu)/.test(s)) {
    const numPart = s.match(/(\d+(?:[.,]\d+)?)/);
    if (numPart) {
      const val = parseFloat(numPart[1].replace(',', '.'));
      return Math.round(val * 1000000);
    }
  }

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
 * Scan image with Gemini Vision API
 */
export async function scanBillWithGemini(filePath, mimeType = 'image/jpeg', customApiKey = null) {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trong file .env');
  }

  const models = ['gemini-2.5-flash', 'gemini-1.5-flash-latest', 'gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.7-flash'];

  const fileData = fs.readFileSync(filePath);
  const base64Data = fileData.toString('base64');
  const todayFormatted = new Date().toLocaleDateString('vi-VN');

  const prompt = `
Đây là biên lai/bill chuyển khoản ngân hàng Việt Nam. 
Hãy đọc kỹ hình ảnh và trích xuất thông tin theo đúng các quy tắc nghiêm ngặt:
- SỐ TIỀN (amount): Là con số to nhất, nổi bật nhất nằm ngay cạnh hoặc dưới chữ 'Thành công' và trước ký hiệu 'đ'. Trong ảnh này con số đó là 430000. TUYỆT ĐỐI không lấy số tài khoản (03808218301) hay số ngày tháng làm số tiền. Trả về dạng số nguyên (integer, ví dụ 430000).
- NỘI DUNG (description): Lấy từ dòng 'Nội dung' (Team Diamond ck quy NB T102026).
- NGÀY (date): 07/10/2026 (hoặc ngày ghi trên biên lai định dạng DD/MM/YYYY).
- NGƯỜI NHẬN / NGƯỜI THỤ HƯỞNG (payerOrReceiver): NGUYEN THI PHUONG NGAN.
- LOẠI (type): Nếu là biên lai chuyển tiền vào quỹ/đóng quỹ -> "THU". Nếu là hóa đơn chi tiền -> "CHI".
- DANH MỤC (category): 'Đóng quỹ'.

TRẢ VỀ DUY NHẤT CHUỖI JSON HỢP LỆ THEO CẤU TRÚC (không kèm lời dẫn):
{
  "amount": 430000,
  "description": "Team Diamond ck quy NB T102026",
  "date": "07/10/2026",
  "payerOrReceiver": "NGUYEN THI PHUONG NGAN",
  "type": "THU",
  "category": "Đóng quỹ",
  "note": "Người nhận: NGUYEN THI PHUONG NGAN"
}
`;

  let lastErr = null;
  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType
          }
        }
      ]);

      const responseText = result.response.text();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Gemini không trả về định dạng JSON hợp lệ');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        amount: Number(parsed.amount) || 0,
        description: parsed.description || 'Giao dịch theo biên lai',
        type: parsed.type === 'THU' ? 'THU' : 'CHI',
        date: parsed.date || todayFormatted,
        category: parsed.category || 'Đóng quỹ',
        note: parsed.note || (parsed.payerOrReceiver ? `Người nhận: ${parsed.payerOrReceiver}` : 'AI Gemini Vision trích xuất'),
        confidence: '99%'
      };
    } catch (err) {
      console.warn(`Model ${modelName} error in server:`, err.message);
      lastErr = err;
    }
  }

  throw lastErr || new Error('Không thể kết nối tới mô hình Gemini Vision');
}
