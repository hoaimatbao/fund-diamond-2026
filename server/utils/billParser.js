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

  const models = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-1.5-flash'];

  const fileData = fs.readFileSync(filePath);
  const base64Data = fileData.toString('base64');
  const todayFormatted = new Date().toLocaleDateString('vi-VN');

  const prompt = `
Bạn là trợ lý AI chuyên bóc tách thông tin hóa đơn, biên lai ngân hàng và đơn đặt hàng tại Việt Nam (ShopeeFood, GrabFood, Baemin, chuyển khoản ngân hàng, nhà hàng).

HÃY ĐỌC KỸ HÌNH ẢNH VÀ TRÍCH XUẤT THEO CÁC QUY TẮC NGHIÊM NGẶT:
1. SỐ TIỀN (amount):
   - Với ảnh tóm tắt đơn hàng (ShopeeFood / GrabFood...): Luôn lấy đúng dòng "Tổng cộng" ở dưới cùng (ví dụ: "87.040đ" hoặc "87.040" -> 87040).
   - Với biên lai chuyển khoản ngân hàng: Lấy số tiền lớn nhất, nổi bật nhất nằm cạnh hoặc dưới chữ "Thành công" và trước chữ "đ" (ví dụ: 430000). TUYỆT ĐỐI không lấy số tài khoản hay ngày tháng.
   - Với hóa đơn giấy: Lấy tổng thanh toán cuối cùng.
   - Trả về dạng số nguyên (integer, ví dụ: 87040).

2. TÊN QUÁN / NỘI DUNG (description):
   - Với ảnh tóm tắt đơn nhóm (ShopeeFood / GrabFood): Lấy dòng đầu tiên có biểu tượng địa điểm xanh hoặc tên quán (ví dụ: "Chè Phan Cải - Chè Ngon, Kem Bơ Xôi...").
   - Với biên lai ngân hàng: Lấy dòng "Nội dung" chuyển khoản.
   - Với hóa đơn giấy: Lấy tên quán ăn hoặc món ăn chính.

3. LOẠI GIAO DỊCH (type):
   - Nếu là mua đồ ăn, chè, trà sữa, chi tiêu, thanh toán tiền -> "expense".
   - Nếu là nộp tiền quỹ, đóng quỹ, thưởng vào quỹ -> "income".

4. NGÀY GIAO DỊCH (date):
   - Ngày ghi trên biên lai/đơn hàng định dạng DD/MM/YYYY. Nếu không có, dùng ngày hôm nay: "${todayFormatted}".

5. DANH MỤC (category):
   - Đơn ăn uống, trà sữa, chè, cafe -> "Ăn uống (Chè, trà sữa, cafe...)".
   - Tiệc, lẩu, buffet, nướng -> "Liên hoan (Lẩu, Buffet, BBQ...)".
   - Đóng quỹ định kỳ -> "Đóng quỹ".
   - Khen thưởng -> "Khen thưởng".
   - Khác -> "Khác".

6. THÀNH VIÊN (member):
   - Ưu tiên tìm xem người đặt đơn, người tham gia hoặc người chuyển khoản/thụ hưởng có trùng hoặc chứa tên các thành viên nhóm: [Huyền Hoài, Hoài, Thanh, Hằng, Tuyển, Phương, Hà].
   - Ví dụ: Người đặt "Huyền Hoài" hoặc "Hoài" -> "Huyền Hoài". Nếu không có ai trong danh sách thì để "Thủ quỹ".

CHỈ TRẢ VỀ DUY NHẤT 1 CHUỖI JSON THÔ GỌN GÀNG, KHÔNG GIẢI THÍCH DÔNG DÀI THEO CẤU TRÚC:
{
  "amount": 87040,
  "type": "expense",
  "date": "${todayFormatted}",
  "category": "Ăn uống (Chè, trà sữa, cafe...)",
  "description": "Chè Phan Cải - Chè Ngon, Kem Bơ Xôi...",
  "member": "Huyền Hoài"
}
`;

  let lastErr = null;
  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.2
        }
      });
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
      let parsedAmount = parsed.amount;
      if (typeof parsedAmount === 'string') {
        parsedAmount = parseInt(parsedAmount.replace(/[^\d]/g, ''), 10) || 0;
      } else {
        parsedAmount = Math.round(Number(parsedAmount)) || 0;
      }

      return {
        amount: parsedAmount || 0,
        description: parsed.description || 'Giao dịch theo biên lai',
        type: (parsed.type === 'income' || parsed.type === 'THU') ? 'THU' : 'CHI',
        date: parsed.date || todayFormatted,
        category: parsed.category || 'Ăn uống',
        member: parsed.member || '',
        note: (parsed.member && parsed.member !== 'Thủ quỹ') ? `Thành viên: ${parsed.member}` : 'AI Gemini Vision trích xuất',
        confidence: '99%'
      };
    } catch (err) {
      console.warn(`Model ${modelName} error in server:`, err.message);
      lastErr = err;
    }
  }

  throw lastErr || new Error('Không thể kết nối tới mô hình Gemini Vision');
}
