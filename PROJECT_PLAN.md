# KẾ HOẠCH DỰ ÁN: BẢNG QUẢN LÝ QUỸ TEAM DIAMOND 2026 (SMART TEAM FUND)

## 1. Tổng quan dự án
- **Tên dự án:** Smart Fund Team Diamond 2026
- **Mục tiêu:** Chuyển đổi toàn diện "Bảng Quản Lý Quỹ Team Diamond 2026" từ file bảng tính Excel thủ công sang nền tảng web trực quan, minh bạch và tự động hóa.
- **Điểm đột phá:** Thủ quỹ chỉ cần chụp ảnh bill/hóa đơn ăn uống hoặc biên lai chuyển khoản thưởng/đóng quỹ, hệ thống AI tự quét số tiền, phân loại Thu/Chi và cộng/trừ trực tiếp vào số dư quỹ.
- **Dữ liệu hiện tại của quỹ (mốc đối soát):**
  - **TỔNG THU:** `53.104.581 đ`
  - **TỔNG CHI:** `41.992.450 đ`
  - **TỔNG CUỐI (Số dư khả dụng):** `11.112.131 đ`

---

## 2. Cấu trúc trường dữ liệu (Schema)

Kế thừa chính xác cấu trúc cột từ bảng Excel thực tế:
- `id` (STT): Số thứ tự tăng dần.
- `date` (Ngày nhập quỹ): Định dạng `DD/MM/YYYY`.
- `description` (Lý do): Diễn giải nội dung giao dịch (ví dụ: "chi ăn chè", "thưởng các giải team", "đi ăn Sen Tây Hồ", "chi thưởng team Thanh, Hoài...").
- `type`: Phân loại `THU` hoặc `CHI`.
- `amount`: Số tiền giao dịch (VNĐ).
- `billImage`: Link ảnh hoặc chuỗi base64 của hóa đơn đính kèm để cả phòng đối soát.

---

## 3. Tính năng cốt lõi

### 3.1. Phân hệ Bảng quỹ công khai (Dành cho thành viên team)
- **3 thẻ thống kê nổi bật (KPI Header):**
  - Thẻ Xanh lá: **TỔNG THU** (`53.104.581 đ`).
  - Thẻ Đỏ cam: **TỔNG CHI** (`41.992.450 đ`).
  - Thẻ Vàng nổi bật: **TỔNG CUỐI / SỐ DƯ HIỆN TẠI** (`11.112.131 đ`).
- **Bảng dữ liệu Thu - Chi:**
  - Hiển thị theo thứ tự thời gian mới nhất lên đầu (hoặc theo STT chuẩn như file Excel).
  - Số tiền được định dạng có dấu chấm phân cách hàng nghìn (ví dụ: `3.552.000 đ`).
  - Biểu tượng xem nhanh ảnh bill đính kèm ở từng dòng.
- **Tìm kiếm & Bộ lọc nhanh:**
  - Ô tìm kiếm theo lý do (gõ "ăn chè", "Sen Tây Hồ", "thưởng team"... sẽ lọc ngay các dòng tương ứng).
  - Bộ lọc theo tháng hoặc theo trạng thái (Tất cả / Chỉ xem Thu / Chỉ xem Chi).

### 3.2. Phân hệ Thủ quỹ & AI Scan Bill (Bảo vệ bằng PIN `123456`)
- **Quét bill thông minh:**
  - Nút bấm mở camera điện thoại hoặc tải ảnh chụp hóa đơn (bill ăn trưa, cà phê, trà sữa, biên lai ngân hàng).
  - Tự động nhận diện nội dung:
    + Từ khóa hóa đơn dịch vụ/ẩm thực 👉 Tự động chọn loại **CHI (-)**.
    + Biên lai nộp tiền/thưởng dự án/WS 👉 Tự động chọn loại **THU (+)**.
    + Tự động bóc tách tổng số tiền cần thanh toán và ngày tháng.
- **Xác nhận 1 chạm:** Màn hình popup điền sẵn thông tin bóc tách để thủ quỹ kiểm tra lại trước khi bấm "Lưu vào quỹ".
- **Nhập thủ công dự phòng:** Đầy đủ form để nhập tay những khoản chi không có hóa đơn (tiền gửi xe, trà đá...).
- **Chỉnh sửa / Xóa:** Quyền sửa sai sót hoặc xóa giao dịch nhập nhầm.

---

## 4. Kiến trúc kỹ thuật đề xuất (Tech Stack)

- **Frontend:** React (Vite) + Tailwind CSS + Lucide Icons (thiết kế chuẩn Mobile-first để thủ quỹ thao tác ngay trên điện thoại).
- **Backend & Database:** Node.js (Express) + File CSDL cục bộ `server/data/fund_diamond_2026.json` (giúp toàn bộ web và dữ liệu nằm trọn 1 repo, backup cực dễ, không tốn chi phí thuê database cloud riêng).
- **Mô-đun đọc ảnh bill:** Tích hợp AI Vision API (hoặc nhận diện OCR tiếng Việt) trích xuất dữ liệu trả về dạng JSON.
- **Triển khai:** Vibe Host (kèm file `public/_redirects` để điều hướng SPA mượt mà, không gặp lỗi 403/404)[cite: 2].

---

## 5. Cấu trúc thư mục dự án

```text
fund-diamond-2026/
├── public/
│   ├── uploads/                      # Thư mục lưu ảnh bill
│   └── _redirects                    # File điều hướng máy chủ SPA
├── src/
│   ├── components/
│   │   ├── SummaryCards.jsx          # 3 thẻ Tổng Thu, Tổng Chi, Tổng Cuối
│   │   ├── FundTable.jsx             # Bảng danh sách STT, Ngày, Lý do, Thu, Chi
│   │   ├── BillScannerModal.jsx      # Modal chụp/tải ảnh bill & AI phân tích
│   │   └── ManualEntryModal.jsx      # Form nhập tay dự phòng
│   ├── pages/
│   │   └── Dashboard.jsx             # Màn hình chính
│   ├── App.jsx
│   └── main.jsx
├── server/
│   ├── data/
│   │   └── fund_diamond_2026.json    # Dữ liệu quỹ gốc và các giao dịch mới
│   ├── routes/
│   │   └── api.js                    # API thêm, sửa, xóa, bóc tách bill
│   └── index.js
├── .env.example
├── package.json
└── README.md
## 6. Lộ trình thực hiện từng bước (Roadmap) & Trạng thái hoàn thiện

- [x] **Bước 1 (Đồng bộ dữ liệu Excel gốc):** Đã đọc trực tiếp toàn bộ dữ liệu từ file `quỹ team DM.xlsx` và nhập vào `server/data/fund_diamond_2026.json`. Khớp chính xác 100% mốc đối soát:
  - **TỔNG THU:** `53.104.581 đ`
  - **TỔNG CHI:** `41.992.450 đ`
  - **TỔNG CUỐI (Số dư khả dụng):** `11.112.131 đ`

- [x] **Bước 2 (Giao diện Bảng Quỹ công khai):** 
  - 3 thẻ thống kê nổi bật (KPI Header) theo chuẩn màu sắc đối soát.
  - Bảng giao dịch kế thừa đúng thứ tự STT, ngày tháng, lý do, phân loại, số tiền và nút xem bill.
  - Thanh tìm kiếm theo từ khóa thông minh, bộ lọc theo Tháng và lọc theo Loại (Tất cả / Thu / Chi).

- [x] **Bước 3 (Nhãn Phân loại Tương tác & Bộ lọc nhanh):**
  - Bấm trực tiếp vào badge phân loại (Ăn uống, Thưởng dự án, Đóng quỹ, Liên hoan, Khen thưởng...) hiển thị menu dropdown để đổi nhanh phân loại.
  - Tự động đồng bộ và lưu ngay vào file JSON của server.
  - Click đúp hoặc bấm "Lọc mục này" để lọc nhanh toàn bộ các khoản cùng danh mục.

- [x] **Bước 4 (Chế độ Quản trị Thủ Quỹ - Không cần PIN):**
  - Vào trực tiếp trang Quản trị Thủ Quỹ từ Header chỉ với 1 click.
  - Chỉnh sửa cấu hình chung: Tiêu đề banner, mô tả quỹ, số lượng thành viên (15 người), danh sách họ tên từng thành viên Team Diamond (thêm/xóa linh hoạt).
  - Thao tác nhanh trên bảng giao dịch: Nút Sửa (Edit) mọi thông tin và nút Xóa (Delete) có modal cảnh báo xác nhận.
  - Mọi thao tác thêm/sửa/xóa đều tự động tính toán lại số dư lũy kế, Tổng Thu, Tổng Chi và cập nhật tức thì.

- [x] **Bước 5 (AI Quét Bill & Nhận diện Hóa đơn Thông minh):**
  - Mô-đun AI Vision (Google Gemini Vision API) kết hợp Client OCR (Tesseract.js) và bộ xử lý regex tiếng Việt chuyên sâu.
  - Tự động nhận diện chữ in, hóa đơn ăn uống, biên lai chuyển khoản và chữ viết tay trên giấy.
  - Tự động bóc tách và quy đổi đơn vị viết tắt tiếng Việt: `k`, `K`, `nghìn`, `ngàn` (x1.000); `tr`, `củ`, `triệu` (x1.000.000).
  - Tự động nhận diện lý do, ngày tháng và phân loại Thu/Chi.
  - Sau khi quét, tự động điền vào **các ô nhập liệu (Input fields)** để thủ quỹ kiểm tra, gõ sửa trực tiếp số tiền, ngày, nội dung và chuyển đổi Thu/Chi trước khi bấm "Xác nhận & Lưu vào quỹ".

- [x] **Bước 6 (Đóng gói & Sẵn sàng Triển khai):**
  - Build hoàn thiện mã nguồn frontend vào thư mục `dist/`.
  - Cấu hình file điều hướng `public/_redirects` cho máy chủ SPA (tránh lỗi 404 khi F5/reload).
  - Khởi chạy đồng thời cả Backend API (port 5000) và Frontend client.

- [x] **Bước 7 (Tối ưu hiển thị bảng & Phân trang không mỏi tay):**
  - **Mặc định mới nhất lên đầu:** Sắp xếp các khoản chi tiêu/thu quỹ mới nhất (STT 132, 131, 130...) lên hàng đầu tiên của bảng. Mở web ra là thấy ngay khoản gần nhất.
  - **Nút chuyển đổi linh hoạt:** Bấm đổi nhanh giữa *"Mới nhất trước"* và *"Cũ nhất trước (Gốc Excel)"*.
  - **Phân trang (Pagination):** Chia bảng thành 15 dòng/trang mặc định, có thanh điều hướng chuyển trang `[1, 2, 3...]`, Trang trước, Trang sau, và dropdown chọn hiển thị (10, 15, 20, 50, hoặc Tất cả dòng/trang). Áp dụng đồng bộ cho cả Bảng công khai và Bảng Quản trị Thủ Quỹ.
  - **Khắc phục lỗi font:** Sửa và chuẩn hóa vĩnh viễn ký tự lỗi `"An u?ng"` thành `"Ăn uống"` ở STT 70 và toàn bộ hệ thống.