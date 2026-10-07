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
  // Pattern 1: Short-hand with "k" / "K" / "nghìn" / "ngàn" (e.g., "154k", "154 k", "154 nghìn", "154.000")
  const kRegex = /(\d+(?:[.,]\d+)?)\s*(?:k\b|K\b|nghìn|ngàn|nghin|ngan)/i;
  // Pattern 2: Short-hand with "tr" / "củ" / "triệu" (e.g., "2tr", "1.5tr", "3 củ", "2 triệu")
  const trRegex = /(\d+(?:[.,]\d+)?)\s*(?:tr\b|Tr\b|củ|cu|triệu|trieu)/i;
  // Pattern 3: Formatted numbers like 3.552.000 or 150,000 or 180000
  const fullNumberRegex = /(?:tổng cộng|thành tiền|tổng tiền|cộng tiền|thanh toán|payment|total)?\s*[:=\s]*([1-9]\d{0,2}(?:[.,]\d{3})+|[1-9]\d{4,8})\s*(?:đ|vnđ|vnd)?/i;

  let foundAmount = false;

  // Search keyword lines from bottom up (grand totals like TỔNG CỘNG are always at the bottom of bills)
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
      // Check next line (e.g., "TỔNG CỘNG THANH TOÁN:" on line i and "3.552.000 đ" on line i+1)
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

  // If not found by keywords, search valid lines from bottom up (excluding MST, Hotline, Phone, STK)
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
  // Robust keywords supporting with and without Vietnamese accents
  const thuKeywords = /thưởng|thuong|thường|thương|thu\s*quỹ|thu\s*quy|nộp|nop|xung\s*quỹ|xung\s*quy|xung|đóng\s*quỹ|dong\s*quy|đóng|dong|gửi|gui|gủi|hoàn\s*ứng|hoan\s*ung|nhận\s*tiền|nhan\s*tien|ws\b|aff\b|tmvn\b|cá\s*2025|tiền\s*thưởng/i;
  const chiKeywords = /chi\b|ăn\b|an\b|uống\b|uong\b|mua\b|thanh toán|thanh toan|hóa đơn|hoa don|bill|tiệc|tiec|trà\b|tra\b|chè\b|che\b|cà phê|ca phe|cafe|buffet|nem lụi|sữa chua|sua chua|bánh|banh|ốc\b|oc\b|ếch\b|ech\b/i;

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
  // Find primary subject line
  for (let line of lines) {
    let l = line.replace(/(\d+.*)/, '').trim(); // strip trailing numbers
    l = l.replace(/(?:tổng cộng|thành tiền|tổng tiền|tiền hàng|total|thanh toán)[\s:]*$/i, '').trim();
    l = l.replace(/[:\-–—\.]+\s*$/, '').trim();
    if (l.length >= 3 && !/hóa đơn|phiếu|thanh toán|thu ngân|bàn|ngày|tel|mst|cảm ơn/i.test(l)) {
      description = l;
      break;
    }
  }

  if (!description) {
    // Check common patterns
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

  // Capitalize first letter
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

  // Standard integer with thousand separators (e.g. 3.552.000 or 150000)
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

  const genAI = new GoogleGenerativeAI(apiKey);
  const models = ['gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];

  const fileData = fs.readFileSync(filePath);
  const base64Data = fileData.toString('base64');
  const todayFormatted = new Date().toLocaleDateString('vi-VN');

  const prompt = `
Bạn là chuyên gia bóc tách hóa đơn, biên lai chuyển khoản ngân hàng và giấy viết tay chi tiêu cho quỹ nội bộ công ty tại Việt Nam.
Hãy đọc kỹ hình ảnh (đặc biệt là ảnh chụp màn hình biên lai chuyển khoản ngân hàng như Vietcombank, BIDV, Techcombank, VPBank, MBBank, Momo, v.v., hoặc hóa đơn thanh toán, giấy viết tay) và trích xuất chính xác các thông tin:

1. Số tiền (amount): 
   - ĐỐI VỚI BIÊN LAI CHUYỂN KHOẢN NGÂN HÀNG: Tìm chính xác con số lớn nhất đi liền sau chữ "Thành công" / "Giao dịch thành công" hoặc ngay trước ký hiệu "đ", "VND", "VNĐ" (Ví dụ: "430 000 đ" -> 430000, "150.000 VND" -> 150000).
   - TUYỆT ĐỐI KHÔNG lấy số ngày tháng (ví dụ 07/10/2026), không lấy số tài khoản/số thẻ, và TUYỆT ĐỐI KHÔNG lấy các mã ở phần nội dung/lời nhắn (ví dụ mã như "T102026", "Q10", "STT132" KHÔNG PHẢI là số tiền).
   - ĐỐI VỚI CHỮ VIẾT TẮT TIẾNG VIỆT: Đọc các đơn vị viết tắt thông dụng: 'k', 'K', 'nghìn', 'ngàn' -> nhân 1.000 (Ví dụ: '154k' -> 154000). Đọc chữ 'tr', 'củ', 'triệu' -> nhân 1.000.000 (Ví dụ: '2tr' -> 2000000, '1.5tr' -> 1500000).
   - Trả về SỐ NGUYÊN DƯƠNG (integer), không chứa dấu chấm hay phẩy hay chữ đ.

2. Nội dung / Lý do (description): 
   - Lấy chính xác dòng "Nội dung" / "Nội dung giao dịch" / "Lời nhắn" trên biên lai chuyển khoản (Ví dụ: "Team Diamond ck quy NB T102026" -> ghi nhận là "Team Diamond ck quy NB T102026" hoặc rút gọn tên khoản chi như "Đóng quỹ nội bộ T10/2026").
   - Nếu là hóa đơn mua sắm/ăn uống/liên hoan: Lấy tên món ăn, quán ăn hoặc mục đích chi tiêu (Ví dụ: 'Chi ăn chè', 'Đi ăn Sen Tây Hồ', 'Bánh xèo nem lụi', 'Thưởng team').

3. Người nhận / Người thụ hưởng (receiver):
   - Lấy tên người nhận / người thụ hưởng trên biên lai nếu có (Ví dụ: 'NGUYEN THI PHUONG NGAN', 'HOANG THI HOAI', v.v.).

4. Ngày giao dịch (date): 
   - Lấy chính xác thời gian chuyển khoản/thanh toán trên biên lai. Định dạng 'DD/MM/YYYY' (Ví dụ: '07/10/2026'). Nếu không có năm, lấy năm 2026. Nếu không thấy rõ ngày, lấy ngày hôm nay (${todayFormatted}).

5. Loại giao dịch (type): 
   - 'THU': Nếu là biên lai chuyển tiền vào quỹ, đóng quỹ ("ck quy", "nop quy", "dong quy"), nộp tiền, thưởng dự án, hoàn ứng.
   - 'CHI': Nếu là hóa đơn chi tiêu ăn uống, mua sắm, trả tiền dịch vụ, hoặc biên lai chuyển khoản thanh toán khoản chi.

6. Danh mục (category): 
   - Chọn 1 trong các mục: 'Ăn uống', 'Liên hoan', 'Thưởng dự án', 'Khen thưởng', 'Đóng quỹ', 'Sinh nhật', 'Teambuilding', 'Khác'.

7. Ghi chú (note): 
   - Ghi chú thêm người nhận hoặc chi tiết giao dịch (Ví dụ: 'Người nhận: NGUYEN THI PHUONG NGAN').

CHỈ TRẢ VỀ DUY NHẤT CHUỖI JSON HỢP LỆ THEO CẤU TRÚC:
{
  "amount": 430000,
  "description": "Team Diamond ck quy NB T102026",
  "receiver": "NGUYEN THI PHUONG NGAN",
  "type": "THU",
  "date": "07/10/2026",
  "category": "Đóng quỹ",
  "note": "Người nhận: NGUYEN THI PHUONG NGAN",
  "confidence": "99%"
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
        category: parsed.category || 'Ăn uống',
        note: parsed.note || (parsed.receiver ? `Người nhận: ${parsed.receiver}` : 'AI Gemini Vision trích xuất'),
        confidence: parsed.confidence || '98%'
      };
    } catch (err) {
      console.warn(`Model ${modelName} error in server:`, err.message);
      lastErr = err;
    }
  }

  throw lastErr || new Error('Không thể kết nối tới mô hình Gemini Vision');
}
