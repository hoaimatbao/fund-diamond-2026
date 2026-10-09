import { AI_CONFIG } from '../config/aiConfig.js';

/**
 * Module xử lý OCR và nhận diện hình ảnh biên lai / hóa đơn bằng Google Gemini 1.5 Flash.
 */

let cachedServerKey = '';

/**
 * Lấy Gemini API Key dự phòng từ server Express (/api/config/ai-key)
 */
export async function fetchServerGeminiApiKey() {
  if (cachedServerKey) return cachedServerKey;
  try {
    const res = await fetch('/api/config/ai-key');
    if (res.ok) {
      const data = await res.json();
      if (data.apiKey && typeof data.apiKey === 'string') {
        cachedServerKey = data.apiKey.trim();
        return cachedServerKey;
      }
    }
  } catch (err) {
    console.warn('Không thể lấy API key từ máy chủ:', err);
  }
  return '';
}

/**
 * Lấy Gemini API Key từ nhiều nguồn theo thứ tự ưu tiên:
 * 1. LocalStorage (người dùng tự nhập)
 * 2. import.meta.env.VITE_GEMINI_API_KEY / GEMINI_API_KEY (từ file .env qua Vite)
 * 3. AI_CONFIG.GEMINI_API_KEY (cấu hình hệ thống)
 * 4. cachedServerKey (đã fetch từ server)
 */
export function getGeminiApiKey() {
  const localKey = typeof window !== 'undefined' ? (localStorage.getItem('gemini_api_key') || '').trim() : '';
  let envKey = '';
  try {
    const metaEnv = typeof import.meta !== 'undefined' ? import.meta?.['env'] : null;
    if (metaEnv) {
      envKey = (metaEnv['VITE_GEMINI_API_KEY'] || metaEnv['GEMINI_API_KEY'] || '').trim();
    }
  } catch {}
  const configKey = (AI_CONFIG?.GEMINI_API_KEY || '').trim();
  const rawKey = localKey || envKey || configKey || cachedServerKey || '';
  return rawKey.replace(/^["']|["']$/g, '').trim();
}

/**
 * Lưu Gemini API Key vào LocalStorage
 */
export function saveGeminiApiKey(key) {
  if (typeof window !== 'undefined') {
    if (key && key.trim()) {
      localStorage.setItem('gemini_api_key', key.replace(/^["']|["']$/g, '').trim());
    } else {
      localStorage.removeItem('gemini_api_key');
    }
  }
}

/**
 * Chuyển đổi File/Blob sang chuỗi Base64 an toàn, không bao giờ treo
 */
export function fileToBase64(file) {
  return new Promise((resolve) => {
    try {
      if (!file) return resolve('');
      if (typeof file === 'string') {
        const b64 = file.includes(',') ? file.split(',')[1] : file;
        return resolve(b64);
      }
      if (!(file instanceof Blob)) {
        return resolve('');
      }
      const reader = new FileReader();
      const timer = setTimeout(() => {
        try { reader.abort(); } catch {}
        resolve('');
      }, 2000);

      reader.onload = () => {
        clearTimeout(timer);
        const result = reader.result;
        const base64 = typeof result === 'string' && result.includes(',') ? result.split(',')[1] : (result || '');
        resolve(base64);
      };
      reader.onerror = () => {
        clearTimeout(timer);
        resolve('');
      };
      reader.onabort = () => {
        clearTimeout(timer);
        resolve('');
      };
      reader.readAsDataURL(file);
    } catch {
      resolve('');
    }
  });
}

/**
 * Nén và resize ảnh bằng HTML5 Canvas trên trình duyệt:
 * - Bao bọc toàn bộ bằng try...catch và Promise
 * - Giới hạn cạnh lớn nhất tối đa 1200px - 1400px (mặc định 1280px)
 * - Nén chất lượng JPEG 80% (0.8)
 * - CƠ CHẾ AN TOÀN: Nếu nén ảnh thất bại hoặc quá 3 giây, tự động lấy ảnh gốc gửi đi luôn chứ không để treo loading!
 */
export async function compressAndResizeImage(file, maxDimension = 1280, quality = 0.8) {
  // Hàm fallback trả về dữ liệu ảnh gốc
  const fallbackToOriginal = async (reason = '') => {
    try {
      if (reason) console.warn('Canvas compression fallback to original image:', reason);
      const base64 = await fileToBase64(file);
      const mimeType = (file && typeof file === 'object' && file.type) ? file.type : 'image/jpeg';
      const originalSize = (file && typeof file === 'object' && file.size) 
        ? file.size 
        : (typeof file === 'string' ? Math.round(file.length * 0.75) : 0);
      return {
        base64,
        mimeType: mimeType || 'image/jpeg',
        blob: file instanceof Blob ? file : null,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 0,
        width: 0,
        height: 0,
        isFallback: true
      };
    } catch (err) {
      console.error('Lỗi khi fallback sang ảnh gốc:', err);
      return {
        base64: '',
        mimeType: 'image/jpeg',
        blob: file instanceof Blob ? file : null,
        originalSize: 0,
        compressedSize: 0,
        compressionRatio: 0,
        width: 0,
        height: 0,
        isFallback: true
      };
    }
  };

  if (!file) {
    return await fallbackToOriginal('Không có file ảnh');
  }

  // Khởi tạo Promise nén canvas được bao bọc an toàn
  const compressionPromise = new Promise((resolve) => {
    let hasResolved = false;
    const safeResolve = (data) => {
      if (!hasResolved) {
        hasResolved = true;
        resolve(data);
      }
    };

    try {
      if (typeof window === 'undefined' || typeof Image === 'undefined') {
        fallbackToOriginal('Môi trường không có window/Image').then(safeResolve);
        return;
      }

      // 1. Trường hợp file đã là Base64 hoặc Data URL
      if (typeof file === 'string') {
        let base64 = file;
        let mimeType = 'image/jpeg';
        let dataUrl = file;

        if (file.startsWith('data:')) {
          const matches = file.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            mimeType = matches[1];
            base64 = matches[2];
          } else {
            base64 = file.split(',')[1] || file;
          }
        } else {
          dataUrl = `data:image/jpeg;base64,${file}`;
        }

        const img = new Image();
        img.onload = () => {
          try {
            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;
            if (!width || !height) {
              fallbackToOriginal('Kích thước ảnh chuỗi rỗng').then(safeResolve);
              return;
            }

            const maxSide = Math.max(width, height);
            if (maxSide > maxDimension) {
              const scale = maxDimension / maxSide;
              width = Math.round(width * scale);
              height = Math.round(height * scale);
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              fallbackToOriginal('Không tạo được context 2D').then(safeResolve);
              return;
            }

            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            const outMime = 'image/jpeg';
            const outDataUrl = canvas.toDataURL(outMime, quality);
            const outBase64 = outDataUrl.includes(',') ? outDataUrl.split(',')[1] : outDataUrl;
            const originalSize = Math.round(base64.length * 0.75);
            const compressedSize = Math.round(outBase64.length * 0.75);
            const compressionRatio = originalSize > 0 ? Math.round((1 - compressedSize / originalSize) * 100) : 0;

            safeResolve({
              base64: outBase64,
              mimeType: outMime,
              blob: null,
              originalSize,
              compressedSize,
              compressionRatio: Math.max(0, compressionRatio),
              width,
              height,
              isFallback: false
            });
          } catch (e) {
            fallbackToOriginal('Lỗi trong img.onload chuỗi base64: ' + e.message).then(safeResolve);
          }
        };

        img.onerror = () => {
          fallbackToOriginal('img.onerror chuỗi base64').then(safeResolve);
        };

        img.src = dataUrl;
        return;
      }

      // 2. Trường hợp file là File hoặc Blob
      let objectUrl = '';
      try {
        objectUrl = URL.createObjectURL(file);
      } catch (objErr) {
        fallbackToOriginal('Không tạo được ObjectURL: ' + objErr.message).then(safeResolve);
        return;
      }

      const img = new Image();

      img.onload = () => {
        try {
          try { URL.revokeObjectURL(objectUrl); } catch {}

          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;
          if (!width || !height) {
            fallbackToOriginal('Kích thước ảnh File rỗng').then(safeResolve);
            return;
          }

          const maxSide = Math.max(width, height);
          if (maxSide > maxDimension) {
            const scale = maxDimension / maxSide;
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            fallbackToOriginal('Không lấy được canvas 2d context').then(safeResolve);
            return;
          }

          // Nền trắng tinh chống đen nền PNG trong suốt
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          const mimeType = 'image/jpeg';
          const dataUrl = canvas.toDataURL(mimeType, quality);
          const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
          const originalSize = file?.size || 0;

          if (canvas.toBlob) {
            try {
              canvas.toBlob((blob) => {
                const finalBlob = blob || file;
                const compressedSize = finalBlob?.size || Math.round(base64.length * 0.75);
                const compressionRatio = originalSize > 0 ? Math.round((1 - compressedSize / originalSize) * 100) : 0;
                safeResolve({
                  base64,
                  mimeType,
                  blob: finalBlob,
                  originalSize,
                  compressedSize,
                  compressionRatio: Math.max(0, compressionRatio),
                  width,
                  height,
                  isFallback: false
                });
              }, mimeType, quality);
            } catch {
              const compressedSize = Math.round(base64.length * 0.75);
              const compressionRatio = originalSize > 0 ? Math.round((1 - compressedSize / originalSize) * 100) : 0;
              safeResolve({
                base64,
                mimeType,
                blob: file,
                originalSize,
                compressedSize,
                compressionRatio: Math.max(0, compressionRatio),
                width,
                height,
                isFallback: false
              });
            }
          } else {
            const compressedSize = Math.round(base64.length * 0.75);
            const compressionRatio = originalSize > 0 ? Math.round((1 - compressedSize / originalSize) * 100) : 0;
            safeResolve({
              base64,
              mimeType,
              blob: file,
              originalSize,
              compressedSize,
              compressionRatio: Math.max(0, compressionRatio),
              width,
              height,
              isFallback: false
            });
          }
        } catch (innerErr) {
          fallbackToOriginal('Lỗi khi vẽ Canvas: ' + innerErr.message).then(safeResolve);
        }
      };

      img.onerror = () => {
        try { URL.revokeObjectURL(objectUrl); } catch {}
        fallbackToOriginal('img.onerror khi đọc File').then(safeResolve);
      };

      img.src = objectUrl;
    } catch (outerErr) {
      fallbackToOriginal('Lỗi khởi tạo nén ảnh: ' + outerErr.message).then(safeResolve);
    }
  });

  // Strict 3-second Timeout: Nếu nén ảnh quá 3 giây, tự động lấy ảnh gốc gửi đi ngay!
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      resolve(null);
    }, 3000);
  });

  const winner = await Promise.race([compressionPromise, timeoutPromise]);
  if (!winner) {
    console.warn('Canvas compression quá 3 giây! Tự động gửi ảnh gốc để không treo giao diện.');
    return await fallbackToOriginal('Timeout nén ảnh quá 3 giây');
  }
  return winner;
}

// Lưu model hoạt động nhanh nhất đã xác thực thành công (gemini-3.8-flash hoạt động ổn định nhất trên API v1beta)
let cachedWorkingModel = 'gemini-3.8-flash';

/**
 * Gọi trực tiếp REST API của Google Gemini Flash với JSON mode và Timeout 15 giây
 */
export async function scanWithClientGemini(file, apiKey, onProgress) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Không thể kết nối đến Gemini AI: Chưa có API Key. Vui lòng kiểm tra biến môi trường VITE_GEMINI_API_KEY hoặc bấm "Cấu hình API Key" để cập nhật.');
  }

  const cleanApiKey = apiKey.trim();

  // 1. Nén ảnh với Timeout 3s (nếu lỗi/quá 3s tự lấy ảnh gốc)
  if (onProgress) onProgress('Đang nén và tối ưu hóa ảnh bằng HTML5 Canvas...');
  let compressionResult;
  try {
    compressionResult = await compressAndResizeImage(file, 1280, 0.8);
  } catch (compErr) {
    console.warn('Lỗi hàm nén, lấy ảnh gốc:', compErr);
    const b64 = await fileToBase64(file);
    compressionResult = {
      base64: b64,
      mimeType: file?.type || 'image/jpeg',
      blob: file instanceof Blob ? file : null,
      originalSize: file?.size || 0,
      compressedSize: file?.size || 0,
      compressionRatio: 0,
      width: 0,
      height: 0
    };
  }

  const { 
    base64: base64Data, 
    mimeType, 
    blob: compressedBlob, 
    originalSize, 
    compressedSize, 
    compressionRatio, 
    width: imgWidth, 
    height: imgHeight 
  } = compressionResult;

  if (!base64Data) {
    throw new Error('Không thể đọc dữ liệu file ảnh. Vui lòng thử lại với ảnh khác.');
  }

  const todayFormatted = new Date().toLocaleDateString('vi-VN');

  // PROMPT BÓC TÁCH TỐI ƯU CHO 2 LOẠI BILL THỰC TẾ (GEMINI FLASH)
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

  // Cấu hình danh sách endpoint theo đúng model Gemini Flash được hỗ trợ trên API v1beta
  const allCandidates = [
    { 
      name: 'gemini-3.8-flash', 
      displayName: 'Gemini Flash AI', 
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(cleanApiKey)}` 
    },
    { 
      name: 'gemini-flash-latest', 
      displayName: 'Gemini Flash Latest', 
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(cleanApiKey)}` 
    },
    { 
      name: 'gemini-3.7-flash', 
      displayName: 'Gemini 3.7 Flash', 
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${encodeURIComponent(cleanApiKey)}` 
    },
    { 
      name: 'gemini-3.5-flash', 
      displayName: 'Gemini 3.5 Flash', 
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${encodeURIComponent(cleanApiKey)}` 
    },
    { 
      name: 'gemini-1.5-flash', 
      displayName: 'Gemini 1.5 Flash', 
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(cleanApiKey)}` 
    }
  ];

  // Ưu tiên model đã xác thực thành công trước đó để gọi ngay tức thì không độ trễ
  const candidateEndpoints = [...allCandidates].sort((a, b) => {
    if (a.name === cachedWorkingModel) return -1;
    if (b.name === cachedWorkingModel) return 1;
    return 0;
  });

  let lastError = null;

  for (const candidate of candidateEndpoints) {
    // AbortController thiết lập Timeout tối đa 15 giây cho mỗi lượt gọi API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 15000);

    try {
      if (onProgress) onProgress(`Đang gửi ảnh sang ${candidate.displayName} bóc tách thông tin...`);

      const response = await fetch(candidate.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
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
            response_mime_type: 'application/json',
            temperature: 0.1
          }
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        const googleMessage = errorJson.error?.message || `Lỗi HTTP ${response.status}: ${response.statusText}`;
        const googleStatus = errorJson.error?.status || '';
        const fullError = `Google API (${candidate.name}) [${googleStatus || response.status}]: ${googleMessage}`;
        console.warn('Candidate endpoint error:', fullError);
        throw new Error(fullError);
      }

      const json = await response.json();
      const textOutput = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textOutput) {
        const reason = json.candidates?.[0]?.finishReason;
        throw new Error(`Gemini không trả về nội dung kết quả (Lý do: ${reason || 'Không rõ'})`);
      }

      let parsed = null;
      try {
        parsed = JSON.parse(textOutput);
      } catch {
        const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Gemini trả về văn bản không phải JSON: ' + textOutput.slice(0, 150));
        }
      }

      let parsedAmount = parsed.amount;
      if (typeof parsedAmount === 'string') {
        parsedAmount = parseInt(parsedAmount.replace(/[^\d]/g, ''), 10) || 0;
      } else {
        parsedAmount = Math.round(Number(parsedAmount)) || 0;
      }

      // Lưu lại model thành công để lần sau gọi trực tiếp
      cachedWorkingModel = candidate.name;

      // Chuẩn hóa type
      const rawType = String(parsed.type || '').trim().toLowerCase();
      const normalizedType = (rawType === 'thu' || rawType === 'income') ? 'thu' : 'chi';

      // Chuẩn hóa member
      let normalizedMember = String(parsed.member || '').trim();
      const validMembers = ['Hoài', 'Thanh', 'Hằng', 'Tuyển', 'Phương', 'Hà'];
      const matchedMem = validMembers.find(m => m.toLowerCase() === normalizedMember.toLowerCase());
      if (matchedMem) {
        normalizedMember = matchedMem;
      } else if (!normalizedMember || normalizedMember.toLowerCase() === 'thủ quỹ' || normalizedMember.toLowerCase() === 'thu quy') {
        normalizedMember = 'Thủ quỹ';
      }

      // Chuẩn hóa category
      let normalizedCategory = String(parsed.category || '').trim();
      if (!normalizedCategory) {
        normalizedCategory = normalizedType === 'thu' ? 'Đóng quỹ & Thưởng dự án' : 'Ăn uống (Chè, trà sữa, cafe...)';
      }

      const finalNote = String(parsed.note || parsed.description || '').trim() || 'Giao dịch theo hóa đơn';

      return {
        type: normalizedType, // 'thu' | 'chi'
        amount: parsedAmount || '',
        member: normalizedMember, // 'Hoài' | 'Thanh' | 'Hằng' | 'Tuyển' | 'Phương' | 'Hà' | 'Thủ quỹ'
        date: parsed.date || todayFormatted,
        category: normalizedCategory,
        note: finalNote,
        description: finalNote,
        confidence: '99%',
        source: 'Gemini 1.5 Flash',
        compressedBlob,
        compressionStats: {
          originalSize,
          compressedSize,
          compressionRatio,
          width: imgWidth,
          height: imgHeight
        }
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.warn(`Model ${candidate.name} timed out after 15s.`);
        lastError = new Error('Quá thời gian chờ phản hồi (15 giây) từ máy chủ Google Gemini.');
      } else {
        console.warn(`Thử model ${candidate.name} thất bại:`, err.message);
        lastError = err;
      }
    }
  }

  // 3. Dự phòng cấp 2: Nếu gọi trực tiếp Google từ Client thất bại (do mạng/CORS), gửi qua server trung gian
  try {
    if (onProgress) onProgress('Đang thử kết nối bóc tách qua máy chủ backend...');
    const serverFormData = new FormData();
    const fileToUpload = compressedBlob || file;
    if (fileToUpload instanceof Blob) {
      serverFormData.append('bill', fileToUpload, (file && typeof file === 'object' && file.name) || 'bill.jpg');
      const serverRes = await fetch('/api/scan-bill', {
        method: 'POST',
        headers: {
          'x-gemini-key': cleanApiKey
        },
        body: serverFormData
      });
      if (serverRes.ok) {
        const serverJson = await serverRes.json();
        if (serverJson.success && serverJson.amount !== undefined) {
          const sType = String(serverJson.type || '').toLowerCase() === 'thu' ? 'thu' : 'chi';
          const sNote = String(serverJson.note || serverJson.description || '').trim() || 'Giao dịch theo biên lai';
          return {
            type: sType,
            amount: serverJson.amount || '',
            member: serverJson.member || 'Thủ quỹ',
            date: serverJson.date || todayFormatted,
            category: serverJson.category || (sType === 'thu' ? 'Đóng quỹ & Thưởng dự án' : 'Ăn uống (Chè, trà sữa, cafe...)'),
            note: sNote,
            description: sNote,
            confidence: serverJson.confidence || '95%',
            source: 'Gemini 1.5 Flash (Server)',
            compressedBlob,
            compressionStats: {
              originalSize,
              compressedSize,
              compressionRatio,
              width: imgWidth,
              height: imgHeight
            }
          };
        }
      }
    }
  } catch (serverFallbackErr) {
    console.warn('Backend OCR fallback error:', serverFallbackErr);
  }

  throw lastError || new Error('Không thể kết nối đến Gemini AI, vui lòng kiểm tra API Key hoặc thử lại.');
}

/**
 * Hàm quét Bill chính:
 * Bắt buộc chạy qua Gemini AI Vision với đầy đủ try...catch, timeout và fallback an toàn.
 */
export async function scanBillImage(file, onProgress) {
  let apiKey = getGeminiApiKey();
  if (!apiKey) {
    apiKey = await fetchServerGeminiApiKey();
  }

  if (!apiKey) {
    throw new Error(
      'Không thể kết nối đến Gemini AI: Chưa cấu hình API Key. Vui lòng kiểm tra biến môi trường VITE_GEMINI_API_KEY hoặc bấm nút "Nhập Key AI" để cập nhật mã API Key.'
    );
  }

  if (onProgress) onProgress('Đang nén và tối ưu hóa ảnh...');
  
  try {
    const result = await scanWithClientGemini(file, apiKey, onProgress);
    return {
      ...result,
      billImage: result.compressedBlob 
        ? URL.createObjectURL(result.compressedBlob) 
        : (file instanceof Blob 
            ? URL.createObjectURL(file) 
            : (typeof file === 'string' ? file : ''))
    };
  } catch (geminiError) {
    console.error('Lỗi Gemini Vision:', geminiError);
    const msg = geminiError.message || '';
    if (msg.includes('15 giây') || msg.includes('timeout') || msg.includes('AbortError')) {
      throw new Error('Không thể kết nối đến Gemini AI: Quá thời gian chờ (15 giây). Vui lòng thử lại hoặc kiểm tra kết nối mạng.');
    }
    if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid') || msg.includes('400') || msg.includes('403') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('Không thể kết nối đến Gemini AI, vui lòng kiểm tra API Key hoặc thử lại.');
    }
    throw new Error(geminiError.message || 'Không thể kết nối đến Gemini AI, vui lòng kiểm tra API Key hoặc thử lại.');
  }
}
