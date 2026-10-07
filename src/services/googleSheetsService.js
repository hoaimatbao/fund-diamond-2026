/**
 * Dịch vụ đồng bộ dữ liệu giao dịch sang Google Sheets Webhook
 * URL Webhook Google Apps Script
 */

export const GOOGLE_SHEETS_WEBHOOK_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_SHEETS_WEBHOOK_URL) ||
  'https://script.google.com/macros/s/AKfycbyYkEtOutAZQixh2FEqMKcFlB8PlAhfmsSVkNsIL2PQgKLBg8jBNJqtm5kvHMd2QkVMwg/exec';

/**
 * Chuẩn hóa dữ liệu giao dịch theo cấu trúc yêu cầu của Google Sheets Webhook
 * @param {Object} tx
 * @returns {{ type: 'income'|'expense', amount: number, date: string, member: string, description: string }}
 */
export function formatTransactionForWebhook(tx = {}) {
  const rawType = String(tx.type || '').trim().toLowerCase();
  const type = (rawType === 'thu' || rawType === 'income') ? 'income' : 'expense';

  let rawAmount = tx.amount;
  let amount = 0;
  if (typeof rawAmount === 'number') {
    amount = Math.round(rawAmount);
  } else if (typeof rawAmount === 'string') {
    const clean = rawAmount.trim();
    if (/(?:k\b|nghìn|ngàn)/i.test(clean)) {
      const numPart = parseFloat(clean.replace(/[^\d.,]/g, '').replace(',', '.'));
      amount = Math.round(numPart * 1000) || 0;
    } else if (/(?:tr\b|triệu|củ)/i.test(clean)) {
      const numPart = parseFloat(clean.replace(/[^\d.,]/g, '').replace(',', '.'));
      amount = Math.round(numPart * 1000000) || 0;
    } else {
      // VND không có số thập phân; dấu chấm/phẩy thường là phân tách hàng nghìn (vd: 500.000 hoặc 500,000)
      const digitsOnly = clean.replace(/[^\d]/g, '');
      amount = parseInt(digitsOnly, 10) || 0;
    }
  }

  let dateStr = '';
  if (tx.date) {
    if (typeof tx.date === 'string') {
      dateStr = tx.date.trim();
    } else if (tx.date instanceof Date) {
      dateStr = tx.date.toLocaleDateString('vi-VN');
    }
  }
  if (!dateStr) {
    dateStr = new Date().toLocaleDateString('vi-VN');
  }

  const member = tx.member || tx.submittedBy || tx.recordedBy || 'Thủ quỹ';
  const description = (tx.description || tx.note || '').trim();

  return {
    type,
    amount,
    date: dateStr,
    member,
    description
  };
}

/**
 * Gửi song song request POST (JSON) đến Google Sheets Webhook
 * - Dùng mode: 'no-cors' để vượt qua chuyển hướng 302 của Google Apps Script mà không bị chặn CORS
 * - Bọc trong try/catch để đảm bảo không làm gián đoạn việc lưu dữ liệu trên web
 * @param {Object} transaction
 * @returns {Promise<{ success: boolean, payload?: Object, error?: any }>}
 */
export async function syncTransactionToGoogleSheets(transaction) {
  if (!transaction) return { success: false, error: 'No transaction data' };

  try {
    const payload = formatTransactionForWebhook(transaction);

    console.log('📡 Đang gửi giao dịch song song đến Google Sheets Webhook:', payload);

    await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    console.log('✅ Đã gửi song song tới Google Sheets Webhook thành công:', payload);
    return { success: true, payload };
  } catch (error) {
    console.warn('⚠️ Lỗi gửi Google Sheets Webhook (giao dịch trên web vẫn được lưu bình thường):', error);
    return { success: false, error };
  }
}

export default {
  GOOGLE_SHEETS_WEBHOOK_URL,
  formatTransactionForWebhook,
  syncTransactionToGoogleSheets
};
