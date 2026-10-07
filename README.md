# 💎 Smart Fund Team Diamond 2026

Hệ thống quản lý bảng quỹ nội bộ thông minh, minh bạch và tự động hóa cho **Team Diamond (Dự án LobiFruit)**.

## 📊 Số Dư Đối Soát Chuẩn Ban Đầu (Mốc 2026)
- **TỔNG THU:** `53.104.581 đ`
- **TỔNG CHI:** `41.992.450 đ`
- **TỔNG CUỐI (Số dư khả dụng):** `11.112.131 đ`
- Dữ liệu giao dịch kế thừa chuẩn theo bảng tính Excel: từ **STT 112** đến **STT 132** (21 giao dịch thực tế).

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Trên Local

### 1. Cài đặt thư viện:
```bash
npm install
```

### 2. Khởi chạy toàn bộ hệ thống (Client + Server):
```bash
npm run dev
```
- **Frontend (React Vite):** [http://localhost:5173](http://localhost:5173)
- **Backend (Node Express API):** [http://localhost:5000](http://localhost:5000)
- **API Endpoint Quỹ:** `http://localhost:5000/api/fund`

### 3. Build chạy Production:
```bash
npm run build
npm start
```

---

## 🛠️ Công Nghệ Sử Dụng
- **Giao diện (Frontend):** React (Vite), Tailwind CSS, Lucide Icons.
- **Máy chủ & API (Backend):** Node.js (Express), Multer (xử lý upload ảnh bill).
- **Cơ sở dữ liệu cục bộ:** `server/data/fund_diamond_2026.json` (toàn bộ dữ liệu nằm trọn 1 repo, backup cực dễ dàng).
- **Đồng bộ đám mây:** Tự động gửi song song dữ liệu đến Google Sheets Webhook khi xác nhận lưu giao dịch.

---

## ☁️ Đồng Bộ Tự Động Google Sheets Webhook
- **URL Webhook:** `https://script.google.com/macros/s/AKfycbyYkEtOutAZQixh2FEqMKcFlB8PlAhfmsSVkNsIL2PQgKLBg8jBNJqtm5kvHMd2QkVMwg/exec`
- Mỗi khi người dùng bấm **"Xác nhận & Lưu Vào Quỹ"** (cả nhập thủ công và quét bill AI), hệ thống tự động bắn một request POST (JSON) song song với `mode: 'no-cors'`.
- Dữ liệu đồng bộ:
  - `type`: `'income'` (khoản thu) hoặc `'expense'` (khoản chi)
  - `amount`: số tiền giao dịch (số nguyên)
  - `date`: ngày giao dịch (chuỗi ngày/tháng/năm)
  - `member`: thành viên được chọn (Thủ quỹ, Thanh, Hằng, Tuyển, Phương, Hà...)
  - `description`: nội dung / lý do giao dịch
- Tự động bọc trong `try/catch` độc lập, mạng chập chờn vẫn lưu web thông suốt.

---

## 🔐 Phân Quyền
- **Chế độ Thành viên:** Xem công khai 3 thẻ số dư, bảng danh sách Thu - Chi, xem hóa đơn/bill đối soát, lọc tìm kiếm, xuất file Excel CSV.
- **Chế độ Thủ Quỹ:** Đăng nhập bằng mã PIN mặc định `123456` để kích hoạt quyền thêm, sửa, xóa khoản chi tiêu hoặc quét bill AI.

