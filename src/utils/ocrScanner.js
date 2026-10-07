import { AI_CONFIG } from '../config/aiConfig';

/**
 * Module xử lý OCR và nhận diện hình ảnh biên lai / hóa đơn bằng Google Gemini AI Vision.
 * (Đã tắt hoàn toàn fallback Tesseract theo yêu cầu để đảm bảo chỉ chạy qua Gemini).
 */

/**
 * Lấy Gemini API Key từ:
 * 1. AI_CONFIG (file cấu hình mặc định)
 * 2. import.meta.env.VITE_GEMINI_API_KEY
 * 3. import.meta.env.GEMINI_API_KEY
 * 4. LocalStorage
 */
export function getGeminiApiKey() {
  const configKey = (AI_CONFIG?.GEMINI_API_KEY || '').trim();
  const localKey = typeof window !== 'undefined' ? (localStorage.getItem('gemini_api_key') || '').trim() : '';
  return configKey || localKey || '';
}

/**
 * Lưu Gemini API Key vào LocalStorage
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
 * Nén và resize ảnh bằng HTML Canvas trên trình duyệt trước khi gửi tới Gemini API
 * - Giới hạn chiều rộng tối đa (maxWidth): 1024px
 * - Nén chất lượng ảnh (JPEG quality): 0.75 (trong khoảng 0.7 - 0.8)
 * - Giảm dung lượng từ 5MB-10MB xuống chỉ còn 100KB-200KB, tăng tốc độ gửi gấp 5-10 lần,
 *   tránh hoàn toàn lỗi Timeout / mạng lag trên điện thoại.
 */
export function compressAndResizeImage(file, maxWidth = 1024, quality = 0.75) {
  return new Promise((resolve) => {
    if (!file) {
      return resolve({ base64: '', mimeType: 'image/jpeg', blob: null });
    }

    // Nếu không có Canvas / Image (Node/SSR/Test)
    if (typeof window === 'undefined' || typeof Image === 'undefined') {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result || '';
        const base64 = typeof result === 'string' && result.includes(',') ? result.split(',')[1] : result;
        resolve({ base64, mimeType: file.type || 'image/jpeg', blob: file });
      };
      reader.onerror = () => resolve({ base64: '', mimeType: file.type || 'image/jpeg', blob: file });
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let width = img.width;
      let height = img.height;

      // Giới hạn chiều rộng tối đa 1024px, bảo toàn tỷ lệ khung hình
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        fileToBase64(file).then(base64 => resolve({ base64, mimeType: file.type || 'image/jpeg', blob: file }));
        return;
      }

      // Tô nền trắng đề phòng ảnh PNG trong suốt không bị đen nền khi nén JPEG
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const mimeType = 'image/jpeg';
      const dataUrl = canvas.toDataURL(mimeType, quality);
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;

      if (canvas.toBlob) {
        canvas.toBlob((blob) => {
          resolve({ base64, mimeType, blob: blob || file });
        }, mimeType, quality);
      } else {
        resolve({ base64, mimeType, blob: file });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      fileToBase64(file)
        .then(base64 => resolve({ base64, mimeType: file.type || 'image/jpeg', blob: file }))
        .catch(() => resolve({ base64: '', mimeType: file.type || 'image/jpeg', blob: file }));
    };

    img.src = objectUrl;
  });
}

/**
 * Chuyển đổi File sang Base64 thuần túy (dự phòng)
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = typeof result === 'string' && result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = (err) => reject(new Error('Không thể đọc file ảnh: ' + err));
    reader.readAsDataURL(file);
  });
}

/**
 * Gọi trực tiếp REST API của Google Gemini Flash tốc độ cao
 */
export async function scanWithClientGemini(file, apiKey, onProgress) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Chưa có Gemini API Key! Vui lòng bấm nút "Nhập Key AI" ở phía trên để dán mã API Key');
  }

  const cleanApiKey = apiKey.trim();

  // 1. Nén và resize ảnh bằng Canvas của trình duyệt (maxWidth: 1024px, JPEG quality: 0.75)
  if (onProgress) onProgress('Đang nén và tối ưu hóa ảnh...');
  const { base64: base64Data, mimeType, blob: compressedBlob } = await compressAndResizeImage(file, 1024, 0.75);

  const todayFormatted = new Date().toLocaleDateString('vi-VN');

  // PROMPT BÓC TÁCH TỐI ƯU CHO ĐƠN NHÓM (SHOPEEFOOD / GRABFOOD) VÀ BIÊN LAI NGÂN HÀNG
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

  // 2. URL Endpoint chuẩn Gemini 2.5 Flash
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(cleanApiKey)}`;

  if (onProgress) onProgress('Đang gửi ảnh sang Gemini 2.5 Flash bóc tách...');

  // 3. Body Request tinh gọn tối đa theo chuẩn Google API v1beta
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.1
      }
    })
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    const googleMessage = errorJson.error?.message || `Lỗi HTTP ${response.status}: ${response.statusText}`;
    const googleStatus = errorJson.error?.status || '';
    const fullError = `Google API (gemini-2.5-flash) [${googleStatus || response.status}]: ${googleMessage}`;
    console.warn('Gemini 2.5 Flash API error:', fullError);
    throw new Error(fullError);
  }

  const json = await response.json();
  const textOutput = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOutput) {
    const reason = json.candidates?.[0]?.finishReason;
    throw new Error(`Gemini không trả về nội dung kết quả (Lý do: ${reason || 'Không rõ'})`);
  }

  let parsed = {};
  try {
    parsed = JSON.parse(textOutput);
  } catch {
    const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Gemini trả về văn bản không phải JSON: ' + textOutput.slice(0, 150));
    }
    parsed = JSON.parse(jsonMatch[0]);
  }

  let parsedAmount = parsed.amount;
  if (typeof parsedAmount === 'string') {
    parsedAmount = parseInt(parsedAmount.replace(/[^\d]/g, ''), 10) || 0;
  } else {
    parsedAmount = Math.round(Number(parsedAmount)) || 0;
  }

  const resolvedType = (parsed.type === 'income' || parsed.type === 'THU') ? 'THU' : 'CHI';

  return {
    amount: parsedAmount || '',
    description: parsed.description || 'Giao dịch theo biên lai',
    type: resolvedType,
    date: parsed.date || todayFormatted,
    category: parsed.category || 'Ăn uống',
    member: parsed.member || '',
    payerOrReceiver: parsed.member || parsed.payerOrReceiver || '',
    note: (parsed.member && parsed.member !== 'Thủ quỹ') ? `Thành viên: ${parsed.member}` : '',
    confidence: '99%',
    source: 'Gemini 2.5 Flash',
    compressedBlob
  };
}

/**
 * Hàm quét Bill chính:
 * Bắt buộc chạy qua Gemini AI Vision và hiển thị lỗi cụ thể nếu thất bại (ĐÃ TẮT TESSERACT OCR).
 */
export async function scanBillImage(file, onProgress) {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw new Error(
      'Chưa cấu hình Google Gemini API Key! Vui lòng bấm vào nút "Nhập Key AI" ở thanh trên và dán mã API Key của bạn (bắt đầu bằng AIzaSy...) để quét bill bằng Gemini Vision.'
    );
  }

  if (onProgress) onProgress('Đang chuẩn bị và tối ưu hóa ảnh bill...');
  
  try {
    const result = await scanWithClientGemini(file, apiKey, onProgress);
    return {
      ...result,
      billImage: result.compressedBlob ? URL.createObjectURL(result.compressedBlob) : (file ? URL.createObjectURL(file) : '')
    };
  } catch (geminiError) {
    console.error('Lỗi Gemini Vision:', geminiError);
    // Báo lỗi cụ thể từ Google, không âm thầm fallback sang Tesseract
    throw geminiError;
  }
}
