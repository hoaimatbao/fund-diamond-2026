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
  const rawKey = customApiKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  const apiKey = (rawKey || '').replace(/^["']|["']$/g, '').trim();
  if (!apiKey) {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trong file .env');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const models = ['gemini-1.5-flash', 'gemini-flash-latest', 'gemini-3.8-flash'];

  const fileData = fs.readFileSync(filePath);
  const base64Data = fileData.toString('base64');
  const todayFormatted = new Date().toLocaleDateString('vi-VN');

  const prompt = `Bạn là trợ lý AI chuyên gia phân tích và bóc tách dữ liệu biên lai, hóa đơn tại Việt Nam. Hãy đọc ảnh được cung cấp và nhận diện theo đúng 2 loại hóa đơn thực tế sau:

1. QUY TẮC NHẬN DIỆN BILL CHUYỂN KHOẢN NGÂN HÀNG (BANKING):
(Áp dụng cho: Vietcombank, Techcombank, MB Bank, BIDV, VPBank, TPBank, ACB, Agribank, MoMo, ZaloPay, ViettelMoney, v.v.)
- Số tiền (amount): Lấy số tiền giao dịch chính hiển thị to nhất / nổi bật nhất trên biên lai. Loại bỏ chữ 'đ', 'VND', dấu chấm, dấu phẩy, khoảng trắng, chỉ lấy số nguyên dương. Ví dụ: '12 000 000 đ' -> 12000000, '500.000 VND' -> 500000. TUYỆT ĐỐI KHÔNG lấy số tài khoản, mã tham chiếu giao dịch hay số dư còn lại.
- Ngày giao dịch (date): Lấy trường 'Thời gian' / 'Ngày giao dịch' theo định dạng DD/MM/YYYY. Nếu không có năm, ghép năm 2026. Nếu không rõ ngày, dùng "${todayFormatted}".
- Phân loại (type): Mặc định là "thu" nếu là tiền chuyển vào quỹ / đóng quỹ / nộp tiền. Nếu chuyển chi trả ra ngoài thì để "chi".
- Người thực hiện (member): Quét trong 'Nội dung' hoặc 'Thông tin người gửi/nhận', map chính xác với danh sách 6 thành viên quỹ: ["Hoài", "Thanh", "Hằng", "Tuyển", "Phương", "Hà"].
  + Nếu có 'HOANG THI HOAI', 'HUYEN HOAI', 'HOAI HT', 'HOAI' -> "Hoài"
  + Nếu có 'TRAN THI THANH', 'THANH' -> "Thanh"
  + Nếu có 'NGUYEN THI HANG', 'HANG' -> "Hằng"
  + Nếu có 'NGUYEN THI HONG TUYEN', 'HONG TUYEN', 'TUYEN' -> "Tuyển"
  + Nếu có 'DANG LAN PHUONG', 'LAN PHUONG', 'PHUONG' -> "Phương"
  + Nếu có 'PHAM THI HA', 'THI HA', 'HA' -> "Hà"
  + Nếu không tìm thấy tên ai trong 6 thành viên trên, BẮT BUỘC để: "Thủ quỹ".
- Danh mục (category): Chọn "Đóng quỹ & Thưởng dự án" nếu là thu vào quỹ; hoặc "Chi tiêu khác" nếu là chi.
- Nội dung (note): Lấy NGUYÊN VĂN phần 'Nội dung' chuyển khoản.

2. QUY TẮC NHẬN DIỆN BILL ĐẶT ĐỒ ĂN / MUA HÀNG (GRABFOOD, SHOPEEFOOD,...):
- Số tiền (amount): BẮT BUỘC lấy giá trị tại dòng 'Tổng cộng' cuối cùng (đã trừ mã giảm giá), TUYỆT ĐỐI KHÔNG lấy 'Tổng tạm tính'. (Ví dụ: Tổng cộng 87.040đ -> lấy 87040).
- Phân loại (type): Chọn "chi".
- Danh mục (category): Tự động chọn mục "Ăn uống (Chè, trà sữa, cafe...)".
- Nội dung (note): Ghi tên quán + danh sách món (Ví dụ: 'Chè Phan Cải - Kem bơ, chè dừa dầm...').
- Người thực hiện (member): Quét tên người đặt đơn / người nhận trên bill, map với ["Hoài", "Thanh", "Hằng", "Tuyển", "Phương", "Hà"], nếu không có để "Thủ quỹ".
- Ngày giao dịch (date): Lấy ngày in hóa đơn / ngày đặt theo định dạng DD/MM/YYYY. Nếu không rõ, dùng "${todayFormatted}".

3. YÊU CẦU PHẢN HỒI TỪ AI (BẮT BUỘC):
Gemini chỉ trả về duy nhất chuỗi JSON có cấu trúc sau (không kèm markdown rào trước đón sau):
{
  "type": "thu" | "chi",
  "amount": 87040,
  "member": "Hoài" | "Thanh" | "Hằng" | "Tuyển" | "Phương" | "Hà" | "Thủ quỹ",
  "date": "09/10/2026",
  "category": "Ăn uống (Chè, trà sữa, cafe...)" | "Đóng quỹ & Thưởng dự án" | "Chi tiêu khác",
  "note": "Nội dung giao dịch..."
}`;

  let lastErr = null;
  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1
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

      const rawType = String(parsed.type || '').trim().toLowerCase();
      const normalizedType = (rawType === 'thu' || rawType === 'income') ? 'thu' : 'chi';

      let normalizedMember = String(parsed.member || '').trim();
      const validMembers = ['Hoài', 'Thanh', 'Hằng', 'Tuyển', 'Phương', 'Hà'];
      const matchedMem = validMembers.find(m => m.toLowerCase() === normalizedMember.toLowerCase());
      if (matchedMem) {
        normalizedMember = matchedMem;
      } else if (!normalizedMember || normalizedMember.toLowerCase() === 'thủ quỹ' || normalizedMember.toLowerCase() === 'thu quy') {
        normalizedMember = 'Thủ quỹ';
      }

      let normalizedCategory = String(parsed.category || '').trim();
      if (!normalizedCategory) {
        normalizedCategory = normalizedType === 'thu' ? 'Đóng quỹ & Thưởng dự án' : 'Ăn uống (Chè, trà sữa, cafe...)';
      }

      const finalNote = String(parsed.note || parsed.description || '').trim() || 'Giao dịch theo hóa đơn';

      return {
        type: normalizedType,
        amount: parsedAmount || 0,
        member: normalizedMember,
        date: parsed.date || todayFormatted,
        category: normalizedCategory,
        note: finalNote,
        description: finalNote,
        confidence: '99%'
      };
    } catch (err) {
      console.warn(`Model ${modelName} error in server:`, err.message);
      lastErr = err;
    }
  }

  throw lastErr || new Error('Không thể kết nối tới mô hình Gemini Vision');
}
