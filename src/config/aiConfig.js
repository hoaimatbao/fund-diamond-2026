/**
 * Cấu hình AI Gemini toàn hệ thống Smart Fund Team Diamond
 * Cho phép tất cả các thành viên tự động sử dụng AI Vision quét bill mà không cần tự nhập key.
 */
export const AI_CONFIG = {
  // Lấy từ biến môi trường VITE_GEMINI_API_KEY hoặc nhúng trực tiếp key tại đây
  GEMINI_API_KEY: import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY || '',
  
  // Model chuẩn mặc định
  PRIMARY_MODEL: 'gemini-1.5-flash'
};
