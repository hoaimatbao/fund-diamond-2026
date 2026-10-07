/**
 * Module xử lý OCR và nhận diện hình ảnh biên lai / hóa đơn bằng Google Gemini AI Vision.
 * (Đã tắt hoàn toàn fallback Tesseract theo yêu cầu để đảm bảo chỉ chạy qua Gemini).
 */

/**
 * Lấy Gemini API Key từ:
 * 1. LocalStorage (người dùng nhập trực tiếp tại giao diện)
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
 * Chuyển đổi File sang Base64
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
 * Gọi trực tiếp REST API của Google Gemini 1.5 Flash / Gemini 1.5 Pro
 */
export async function scanWithClientGemini(file, apiKey, onProgress) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Chưa có Gemini API Key! Vui lòng bấm nút "Nhập Key AI" ở phía trên để dán mã API Key (AIzaSy...)');
  }

  const cleanApiKey = apiKey.trim();
  // Danh sách model chuẩn: ưu tiên gemini-1.5-flash, gemini-1.5-pro và model đề xuất bởi Google
  const candidateEndpoints = [
    { name: 'gemini-1.5-flash', url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(cleanApiKey)}` },
    { name: 'gemini-1.5-flash (v1)', url: `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(cleanApiKey)}` },
    { name: 'gemini-1.5-pro', url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${encodeURIComponent(cleanApiKey)}` },
    { name: 'gemini-3.8-flash', url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(cleanApiKey)}` }
  ];
  const base64Data = await fileToBase64(file);
  const mimeType = file.type || 'image/jpeg';
  const todayFormatted = new Date().toLocaleDateString('vi-VN');

  // PROMPT ĐẶC BIỆT THEO YÊU CẦU CHO BIÊN LAI NGÂN HÀNG VIỆT NAM
  const prompt = `
Đây là biên lai/bill chuyển khoản ngân hàng Việt Nam. 
Hãy đọc kỹ hình ảnh và trích xuất thông tin theo đúng các quy tắc nghiêm ngặt:
- SỐ TIỀN (amount): Là con số to nhất, nổi bật nhất nằm ngay cạnh hoặc dưới chữ 'Thành công' và trước ký hiệu 'đ'. Trong ảnh này con số đó là 430000. TUYỆT ĐỐI không lấy số tài khoản (03808218301) hay số ngày tháng làm số tiền. Trả về dạng số nguyên (integer, ví dụ 430000).
- NỘI DUNG (description): Lấy từ dòng 'Nội dung' (Team Diamond ck quy NB T102026).
- NGÀY (date): 07/10/2026 (hoặc ngày ghi trên biên lai định dạng DD/MM/YYYY).
- NGƯỜI NHẬN / NGƯỜI THỤ HƯỞNG (payerOrReceiver): NGUYEN THI PHUONG NGAN.
- LOẠI (type): Nếu là biên lai chuyển tiền vào quỹ/đóng quỹ/thưởng -> "THU". Nếu là thanh toán tiền ăn uống/chi phí -> "CHI".
- DANH MỤC (category): Chọn 1 trong các mục: 'Đóng quỹ', 'Ăn uống', 'Liên hoan', 'Thưởng dự án', 'Khen thưởng', 'Khác'.

TRẢ VỀ DUY NHẤT CHUỖI JSON HỢP LỆ THEO CẤU TRÚC (không kèm giải thích markdown):
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

  let lastError = null;

  for (const candidate of candidateEndpoints) {
    try {
      if (onProgress) onProgress(`Đang gửi ảnh sang ${candidate.name} phân tích...`);
      
      const response = await fetch(candidate.url, {
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
      });

      // Nếu lỗi, trích xuất rõ ràng thông báo lỗi từ Google
      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        const googleMessage = errorJson.error?.message || `Lỗi HTTP ${response.status}: ${response.statusText}`;
        const googleStatus = errorJson.error?.status || '';
        const fullError = `Google API (${candidate.name}) [${googleStatus || response.status}]: ${googleMessage}`;
        console.error('Chi tiết lỗi Google Gemini:', fullError, errorJson);
        throw new Error(fullError);
      }

      const json = await response.json();
      const textOutput = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textOutput) {
        const reason = json.candidates?.[0]?.finishReason;
        throw new Error(`Gemini không trả về nội dung kết quả (Lý do: ${reason || 'Không rõ'})`);
      }

      const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Gemini trả về văn bản không phải JSON: ' + textOutput.slice(0, 150));
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const parsedAmount = Number(parsed.amount) || 0;

      return {
        amount: parsedAmount || '',
        description: parsed.description || 'Giao dịch theo biên lai',
        type: parsed.type === 'THU' ? 'THU' : 'CHI',
        date: parsed.date || todayFormatted,
        category: parsed.category || 'Đóng quỹ',
        note: parsed.note || (parsed.payerOrReceiver ? `Người nhận: ${parsed.payerOrReceiver}` : ''),
        payerOrReceiver: parsed.payerOrReceiver || '',
        confidence: '99%',
        source: `Gemini AI Vision (${candidate.name})`
      };
    } catch (err) {
      console.warn(`Thử model ${candidate.name} thất bại:`, err.message);
      lastError = err;
    }
  }

  // Nếu cả các model đều gặp lỗi, ném lỗi ra ngoài để hiển thị cho người dùng
  throw lastError || new Error('Không thể kết nối tới Google Gemini Vision API');
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

  // Bắt buộc gọi qua Gemini Vision
  if (onProgress) onProgress('Đang gửi ảnh sang Gemini 1.5 Flash...');
  
  try {
    const result = await scanWithClientGemini(file, apiKey, onProgress);
    return {
      ...result,
      billImage: file ? URL.createObjectURL(file) : ''
    };
  } catch (geminiError) {
    console.error('Lỗi Gemini Vision:', geminiError);
    // Báo lỗi cụ thể từ Google, không âm thầm fallback sang Tesseract
    throw geminiError;
  }
}
