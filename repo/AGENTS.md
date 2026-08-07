# Hướng dẫn cho agent — MathQR
 
## Bối cảnh dự án
 
Web app dạy Toán 10 cho trường THPT Việt Nam. Ba vai trò: Admin · Giáo viên · Học sinh.
Cơ chế lõi: giáo viên in phiếu bài tập giấy, mỗi câu gắn mã QR kèm mã ngắn 6 ký tự
(dạng `T10-4821`). Học sinh quét QR trên điện thoại, hoặc gõ mã ngắn trên web,
để xem gợi ý rồi lời giải. Hệ thống ghi lại hành vi này.
 
**Trạng thái hiện tại:** backend Java/Spring Boot đã chạy (Neon PostgreSQL,
21 migration Flyway). Frontend React đã có. Thiết kế 9 trang Admin đã xong trên
Google Stitch. Việc đang làm là **kéo code hiện có về đúng chuẩn**, không phải
dựng mới từ đầu.
 
## Đọc trước khi viết bất kỳ dòng code nào
 
1. `docs/design-system.md` — token màu, cỡ chữ, kích thước. **Nguồn sự thật duy nhất.**
2. `docs/business-rules.md` — ràng buộc nghiệp vụ.
3. `docs/schema-decisions.md` — quyết định về CSDL.
---
 
## 1. Về Stitch (MCP và thư mục design-source)
 
MCP server `stitch` đã kết nối. Thư mục `design-source/` chứa bản xuất zip
làm đối chiếu.
 
**Cả hai đều là THAM CHIẾU BỐ CỤC, KHÔNG PHẢI CODE NGUỒN.**
 
### Tuyệt đối không
 
- Sao chép giá trị màu từ HTML của Stitch. Stitch áp bảng màu Material Design 3
  đè lên spec, tạo xung đột. Màu **luôn** lấy từ `docs/design-system.md`.
- Gọi `stitch.generate_screen_from_text` hoặc `stitch.create_project`.
  Kiến trúc 9 trang đã chốt. Cần màn hình mới thì **dừng lại và hỏi**.
- Giữ `cdn.tailwindcss.com`, Material Symbols, ảnh `lh3.googleusercontent.com`.
- Giữ các lớp `surface-container-*`, `*-fixed`, `*-fixed-dim`, `on-surface-variant`.
  Đó là khái niệm M3, hệ này không dùng.
- Giữ breakpoint `sm:` `md:` `lg:`. Giao diện Admin **chỉ chạy desktop 1440px**.
### Được dùng
 
`stitch.list_screens` và `stitch.get_screen` để đọc. Lấy từ đó: thứ tự khối,
nhãn tiếng Việt, cấu trúc cột bảng, luồng thao tác, khoảng cách và kích thước.
 
### Bảng thay màu khi gặp trong HTML Stitch
 
| Stitch | Thay bằng |
|---|---|
| `#004ac6` | `primary` (#2563EB) |
| `#faf8ff` | `bg-base` (#F8FAFC) |
| `#737686`, `#c3c6d7` | `border-base` (#E2E8F0) |
| `#131b2e` | `text-base` (#0F172A) |
| `#434655` | `text-muted` (#64748B) |
| `#ecfccb`, `#3f6212` | `success-subtle` / `success` |
| `#E65100`, `#FFF3E0` | `warning` / `warning-subtle` |
 
---
 
## 2. Kiến trúc frontend bắt buộc
 
```
Component  →  hook (src/hooks/)  →  api client (src/api/)  →  HTTP
```
 
1. **CẤM khai báo mảng dữ liệu literal trong component.** Mock đặt trong
   `src/mocks/handlers.ts` (MSW), không đặt trong component.
2. **Kiểu dữ liệu server import từ `src/api/types.ts`**, sinh tự động bằng
   `npm run gen:api` từ `/v3/api-docs` của backend. Không tự định nghĩa interface.
   `types.ts` sinh ra xấu thì sửa annotation bên Java, **không** sửa tay `types.ts`.
3. **Chuỗi tiếng Việt của enum lấy từ `src/constants/labels.ts`.**
   Không viết chuỗi tiếng Việt của enum trực tiếp trong JSX.
4. **Bảng dùng component `DataTable`**, khai báo bằng mảng `columns`.
   Không viết `<table>` thủ công.
5. **Trạng thái loading / empty / error suy ra từ query** bên trong `DataTable`,
   không truyền prop từ trang.
6. **Không dùng `localStorage` / `sessionStorage`.**
---
 
## 3. Backend — Flyway và Neon
 
### Không bao giờ sửa migration cũ
 
`validate-on-migrate: true`. Đổi **một ký tự** trong file `db/migration` đã tồn tại
là hỏng checksum và app không khởi động được. Hiện có 21 file.
 
Cần thay đổi schema → tạo file `V` mới. Kể cả khi được nhờ "dọn dẹp" hay "refactor".
 
### Hai chuỗi kết nối, không phải một
 
```yaml
spring:
  datasource:
    url: ${DATABASE_URL}          # CÓ -pooler, kèm &prepareThreshold=0
  flyway:
    url: ${DATABASE_DIRECT_URL}   # KHÔNG có -pooler
```
 
Lý do: Neon chạy PgBouncer ở chế độ transaction. Flyway dùng `pg_advisory_lock`
ở mức phiên — qua pooler khoá này không đáng tin, hai instance khởi động cùng lúc
sẽ làm hỏng `flyway_schema_history`.
 
`prepareThreshold=0` bắt buộc cho chuỗi pooler: PgJDBC mặc định dùng prepared
statement ở mức phiên, va với PgBouncer.
 
### Credential
 
Không bao giờ ghi username, password, API key trực tiếp vào `application.yml`
hay bất kỳ file nào được commit. Dùng biến môi trường. `application.yml` nằm
trong `.gitignore`; bản mẫu là `application.yml.example` với giá trị rỗng.
 
---
 
## 4. Ràng buộc nghiệp vụ không được vi phạm
 
Những luật này không có trong file thiết kế, phải tự nhớ:
 
1. **Không xoá cứng.** Chỉ "Vô hiệu hoá" và "Lưu trữ". Không có nút "Xóa"
   ở bất kỳ đâu trong giao diện. Ở CSDL dùng cột `status` enum, không phải `deleted_at`.
2. **Chưa khớp trang SGK thì không cho xuất bản.** Nút Xuất bản `disabled`,
   tooltip ghi rõ lý do.
3. **Phiếu đã phát hành thì khoá**, muốn sửa phải nhân bản — vì sửa phiếu cũ
   làm QR trên tờ giấy học sinh đang cầm trỏ sai câu.
4. **Hành động ảnh hưởng nhiều người phải nói rõ hậu quả BẰNG SỐ**:
   "45 học sinh lớp 10A2 sẽ không truy cập được nữa. 12 nhiệm vụ đang mở sẽ đóng.
   Điểm đã có vẫn được giữ." — không phải "Bạn có chắc không?".
5. **Điểm số không tô đỏ.** Đỏ chỉ dành cho lỗi hệ thống và hành động phá huỷ.
   Bài làm sai dùng cam.
6. **Cột tên học sinh dính bên trái** khi cuộn ngang trong sổ điểm.
7. **Admin không xem được** bài làm cụ thể và nhận xét riêng của giáo viên.
   Ranh giới riêng tư, không phải thiếu tính năng.
8. **Không dán nhãn lên học sinh.** Cấm chữ "gian lận", "lười", "yếu kém".
   Mô tả hành vi + gợi ý hành động cụ thể.
---
 
## 5. Quy trình làm việc hiện tại
 
Dự án đã có code. Thứ tự sau đây **không được đảo**.
 
### Giai đoạn A — Chuẩn hoá token (làm một lần, trước mọi thứ khác)
 
1. Dựng `tailwind.config.js` theo mục 1–4 của `docs/design-system.md`.
2. Thay toàn bộ màu hardcode trong `src/` bằng token. Không đổi bố cục,
   không đổi logic, chỉ đổi class màu.
3. Thay Material Symbols bằng `lucide-react` theo bảng ánh xạ mục 6
   của `design-system.md`.
### Giai đoạn B — Lát cắt dọc qua trang Tài khoản
 
Trang này có đủ mọi thứ khó: bảng dài, phân trang, lọc, tab, chọn nhiều dòng,
modal import Excel. Làm xuyên suốt CSDL → API → UI trước khi đụng 8 trang kia.
Mọi vấn đề tích hợp sẽ lộ ra ở đây thay vì lộ ra chín lần.
 
### Giai đoạn C — Tám trang còn lại, mỗi phiên một trang
 
Thứ tự: Lớp học → Chuyên đề → Tài liệu → SGK → **Khớp trang** → Nhật ký →
Cài đặt → **Tổng quan**.
 
Khớp trang để gần cuối vì phụ thuộc SGK upload được, và là trang duy nhất
có tính toán thật. Tổng quan để cuối cùng vì chỉ tổng hợp từ 8 trang kia.
 
---
 
## 6. Tiêu chí hoàn thành
 
Trước khi báo xong một trang, chạy đủ bốn khối:
 
```bash
# 1. Không còn tàn dư Stitch
grep -rn "surface-container\|-fixed-dim\|material-symbols\|#004ac6\|#faf8ff" src/
 
# 2. Không còn dữ liệu cứng trong trang
grep -rn "const .* = \[" src/pages/ | grep -v "columns"
 
# 3. Không còn breakpoint mobile, không còn browser storage
grep -rn " sm:\| md:\|localStorage\|sessionStorage" src/pages/
 
# 4. So ảnh với thiết kế Stitch
npm run test:visual
```
 
Ba khối đầu phải ra **rỗng**.
 
Khối 4: mở `tests/diff/<trang>.png`. **Bỏ qua** lệch về màu và icon — đó là cố ý.
**Sửa** lệch về vị trí, khoảng cách, chiều cao dòng, bề rộng cột.
Mức lệch hợp lý sau khi sửa xong: **8–15%**. Dưới 5% nghĩa là đã chép nhầm
bảng màu M3 của Stitch vào code — kiểm tra lại.
 
Điều kiện để so ảnh có nghĩa: mock phải trùng nội dung Stitch (Stitch hiện
8 giáo viên tên gì thì mock đúng 8 người đó), viewport đúng 1440px,
và chờ `document.fonts.ready` trước khi chụp.

Cuối mỗi trang, chạy:v 
grep -rn "surface-container\|material-symbols\|#004ac6\|#faf8ff" src/
grep -rn "const .* = \[" src/pages/ | grep -v columns
grep -rn " sm:\| md:" src/pages/