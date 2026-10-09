import { saveExcelToTargetFolder, TARGET_FOLDER, getFormattedDate } from './excelService.js';

let dailyTimer = null;

/**
 * Tính toán số mili-giây còn lại từ thời điểm hiện tại đến 23:59:00 kế tiếp
 */
export function getMillisecondsUntil2359(now = new Date()) {
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0);
  if (now.getTime() >= target.getTime()) {
    // Nếu hôm nay đã qua 23:59, hẹn cho 23:59 ngày mai
    target.setDate(target.getDate() + 1);
  }
  return target.getTime() - now.getTime();
}

/**
 * Lên lịch tự động chốt sổ cuối ngày lúc 23:59
 */
export function scheduleDailyClose() {
  if (dailyTimer) {
    clearTimeout(dailyTimer);
    dailyTimer = null;
  }

  const delayMs = getMillisecondsUntil2359();
  const nextRunDate = new Date(Date.now() + delayMs);
  const minutesLeft = Math.round(delayMs / 60000);

  console.log(`⏰ [Scheduler] Đã kích hoạt hẹn giờ chốt sổ cuối ngày (23:59).`);
  console.log(`   Lần chạy kế tiếp: ${nextRunDate.toLocaleString('vi-VN')} (còn khoảng ${minutesLeft} phút).`);
  console.log(`   Thư mục đích lưu file Excel: ${TARGET_FOLDER}`);

  dailyTimer = setTimeout(() => {
    try {
      const now = new Date();
      console.log(`\n======================================================`);
      console.log(`🔔 [23:59 CHỐT SỔ CUỐI NGÀY] Bắt đầu tự động tạo file Excel...`);
      console.log(`   Thời gian kích hoạt: ${now.toLocaleString('vi-VN')}`);
      
      const result = saveExcelToTargetFolder({ date: now });
      
      console.log(`✅ [23:59 CHỐT SỔ CUỐI NGÀY] Thành công!`);
      console.log(`   File: ${result.filePath}`);
      console.log(`   Dung lượng: ${(result.fileSize / 1024).toFixed(1)} KB | Tổng số GD: ${result.totalTransactions}`);
      console.log(`======================================================\n`);
    } catch (err) {
      console.error('❌ [23:59 CHỐT SỔ CUỐI NGÀY] Lỗi khi tự động lưu file Excel:', err);
    } finally {
      // Tự động lên lịch lại cho 23:59 ngày tiếp theo
      scheduleDailyClose();
    }
  }, delayMs);

  return { nextRunDate, delayMs };
}

/**
 * Khởi động hệ thống Scheduler chốt sổ
 */
export function initDailyClosingScheduler() {
  return scheduleDailyClose();
}
