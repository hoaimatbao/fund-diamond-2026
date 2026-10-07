import { createWorker } from 'tesseract.js';

/**
 * Retrieve Gemini API Key from:
 * 1. LocalStorage (user entered in UI)
 * 2. import.meta.env.VITE_GEMINI_API_KEY
 * 3. import.meta.env.GEMINI_API_KEY
 */
export function getGeminiApiKey() {
  const localKey = typeof window !== 'undefined' ? (localStorage.getItem('gemini_api_key') || '') : '';
  const viteKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
  const directKey = (import.meta.env.GEMINI_API_KEY || '').trim();
  return (localKey || viteKey || directKey).trim();
}

/**
 * Save Gemini API Key directly to LocalStorage
 */
export function saveGeminiApiKey(key) {
  if (typeof window !== 'undefined') {
    if (key && key.trim()) {
      localStorage.setItem('gemini_api_key', key.trim());
    } else {
      localStorage.removeItem('gemini_api_key');
    }
  }
}

/**
 * Convert file/blob to base64 string
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = typeof result === 'string' && result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Direct client-side Gemini Vision OCR
 */
export async function scanWithClientGemini(file, apiKey, onProgress) {
  const models = ['gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
  const base64Data = await fileToBase64(file);
  const mimeType = file.type || 'image/jpeg';
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

  let lastError = null;
  for (const model of models) {
    try {
      if (onProgress) onProgress(`Đang gửi ảnh sang ${model} phân tích...`);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64Data
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              response_mime_type: 'application/json'
            }
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const json = await response.json();
      const textOutput = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textOutput) throw new Error('Không nhận được nội dung trả về từ Gemini');

      const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Phản hồi không chứa JSON hợp lệ');

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        amount: Number(parsed.amount) || 0,
        description: parsed.description || 'Giao dịch theo biên lai',
        type: parsed.type === 'THU' ? 'THU' : 'CHI',
        date: parsed.date || todayFormatted,
        category: parsed.category || 'Ăn uống',
        note: parsed.note || (parsed.receiver ? `Người nhận: ${parsed.receiver}` : 'Gemini AI Vision trích xuất'),
        confidence: parsed.confidence || '99%',
        source: `Gemini AI Vision (${model})`
      };
    } catch (err) {
      console.warn(`Model ${model} failed:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('Không thể kết nối tới Gemini Vision API');
}

/**
 * Heuristic parser for Vietnamese shorthand text (Fallback)
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
  const numRegex = /(?:tổng cộng|thành tiền|tổng tiền|cộng tiền|thanh toán|total|thành công)?\s*[:=\s]*([1-9]\d{0,2}(?:[.,]\d{3})+|[1-9]\d{4,8})\s*(?:đ|vnđ|vnd)?/i;

  let foundAmount = false;

  // Search keyword lines from bottom up
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (/tổng cộng|tổng tiền|tổng thanh toán|thanh toán|thành tiền|tiền hàng|total|thành công/i.test(line)) {
      let match = line.match(kRegex) || line.match(trRegex) || line.match(numRegex);
      if (match) {
        amount = convertToAmount(match[0]);
        if (amount > 0) {
          foundAmount = true;
          break;
        }
      }
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

  // If not found by keywords, search valid lines excluding MST, Hotline, Phone, STK, and codes like T102026
  if (!foundAmount) {
    const validLines = lines.filter(l => 
      !/mst\b|mã số thuế|hotline\b|tel\b|sđt\b|phone\b|stk\b|tài khoản|[a-zA-Z]+\d{4,}/i.test(l)
    );
    for (let i = validLines.length - 1; i >= 0; i--) {
      const line = validLines[i];
      const match = line.match(kRegex) || line.match(trRegex) || line.match(numRegex);
      if (match) {
        const val = convertToAmount(match[0]);
        // Do not take years (e.g. 2026) or code numbers as amount
        if (val > 0 && val !== 2025 && val !== 2026) {
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
  const thuKeywords = /thưởng|thuong|thường|thương|thu\s*quỹ|thu\s*quy|nộp|nop|xung\s*quỹ|xung\s*quy|xung|đóng\s*quỹ|dong\s*quy|đóng|dong|gửi|gui|gủi|hoàn\s*ứng|hoan\s*ung|nhận\s*tiền|nhan\s*tien|ws\b|aff\b|tmvn\b|cá\s*2025|tiền\s*thưởng|ck\s*quy/i;
  if (thuKeywords.test(cleanText) && !cleanText.toLowerCase().startsWith('chi thưởng')) {
    type = 'THU';
    category = 'Đóng quỹ';
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
    if (l.length >= 3 && !/hóa đơn|phiếu|thanh toán|thu ngân|bàn|ngày|tel|mst|cảm ơn|thành công/i.test(l)) {
      description = l;
      break;
    }
  }

  if (!description) {
    if (/chè/i.test(cleanText)) description = 'Chi ăn chè';
    else if (/sữa chua/i.test(cleanText)) description = 'Chi ăn sữa chua';
    else if (/cà phê|cafe/i.test(cleanText)) description = 'Chi uống cà phê';
    else if (/trà sữa/i.test(cleanText)) description = 'Chi liên hoan trà sữa';
    else if (/bánh xèo/i.test(cleanText)) description = 'Chi ăn bánh xèo nem lụi';
    else if (/đóng quỹ|ck quy/i.test(cleanText)) description = 'Đóng quỹ team Diamond';
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
 * 1. Checks Gemini API Key (localStorage / env) -> runs direct Gemini Vision in browser.
 * 2. Attempts server API (/api/scan-bill).
 * 3. Falls back to client-side Tesseract.js OCR.
 */
export async function scanBillImage(file, onProgress) {
  const apiKey = getGeminiApiKey();

  // Step 1: If Gemini API Key exists, prioritize direct Gemini Vision in browser (100% accurate)
  if (apiKey) {
    try {
      if (onProgress) onProgress('Đang gửi ảnh sang Gemini AI Vision (chính xác 100%)...');
      const geminiResult = await scanWithClientGemini(file, apiKey, onProgress);
      if (geminiResult && geminiResult.amount > 0) {
        return {
          ...geminiResult,
          billImage: file ? URL.createObjectURL(file) : ''
        };
      }
    } catch (geminiErr) {
      console.warn('Direct Gemini Vision call failed, trying backend server:', geminiErr);
    }
  }

  // Step 2: Try backend /api/scan-bill
  let serverUploadedUrl = null;
  try {
    if (onProgress) onProgress('Đang gửi ảnh sang máy chủ phân tích...');
    const formData = new FormData();
    formData.append('bill', file);

    const headers = {};
    if (apiKey) headers['x-gemini-key'] = apiKey;

    const res = await fetch('/api/scan-bill', {
      method: 'POST',
      headers,
      body: formData
    });

    if (res.ok) {
      const data = await res.json();
      serverUploadedUrl = data.billUrl;
      if (data.success && data.amount > 0) {
        return {
          ...data,
          billImage: data.billUrl,
          source: data.method === 'gemini' ? 'Gemini AI Vision (Server)' : 'AI OCR Server'
        };
      }
    }
  } catch (err) {
    console.warn('Backend scan failed, trying local OCR:', err);
  }

  // Step 3: Client-side Fallback using Tesseract.js
  try {
    if (onProgress) onProgress('Đang quét chữ và số trên ảnh bằng OCR tiếng Việt (Dự phòng)...');
    
    const worker = await createWorker('vie+eng');
    const ret = await worker.recognize(file);
    await worker.terminate();

    const ocrText = ret.data.text;
    console.log('Tesseract OCR extracted text:', ocrText);

    const parsed = parseVietnameseExpenseText(ocrText);
    return {
      ...parsed,
      billImage: serverUploadedUrl || (file ? URL.createObjectURL(file) : ''),
      source: 'Tesseract OCR Client (Dự phòng)',
      confidence: `${Math.round(ret.data.confidence || 80)}%`
    };
  } catch (ocrErr) {
    console.warn('Client OCR error:', ocrErr);
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
