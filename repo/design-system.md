# Hệ thiết kế — MathQR

> Đây là **nguồn sự thật duy nhất** về token. Giá trị trong file HTML xuất từ
> Stitch **không** được coi là nguồn tham chiếu — Stitch đã áp bảng màu
> Material Design 3 đè lên spec gốc và tạo ra xung đột. File này đã chốt lại.

---

## 1. Màu

### Đã chốt (dùng đúng các giá trị này)

| Vai trò | Token Tailwind | Mã màu | Dùng ở đâu |
|---|---|---|---|
| Chính | `primary` | `#2563EB` | Nút chính, link, mục sidebar đang mở |
| Chính — nhấn | `primary-hover` | `#1D4ED8` | Trạng thái hover của nút chính |
| Chính — nền nhạt | `primary-subtle` | `#EFF6FF` | Nền mục sidebar đang mở, nền chip xanh |
| Thành công | `success` | `#16A34A` | Đang hoạt động, đã xong, đã khớp trang |
| Thành công — nền | `success-subtle` | `#F0FDF4` | Nền chip trạng thái thành công |
| Cần xử lý | `warning` | `#EA580C` | Chưa khớp trang, chưa đăng nhập, cần chú ý |
| Cần xử lý — nền | `warning-subtle` | `#FFF7ED` | Nền chip cảnh báo |
| Lỗi / phá huỷ | `danger` | `#DC2626` | **CHỈ** lỗi hệ thống và hành động phá huỷ |
| Lỗi — nền | `danger-subtle` | `#FEF2F2` | Nền thông báo lỗi |
| Nền trang | `bg-base` | `#F8FAFC` | Nền toàn trang |
| Nền khối | `bg-surface` | `#FFFFFF` | Thẻ, bảng, modal, panel |
| Nền đầu bảng | `bg-header` | `#F1F5F9` | Hàng tiêu đề của bảng |
| Nền sọc | `bg-stripe` | `#F8FAFC` | Hàng lẻ trong bảng (zebra) |
| Viền | `border-base` | `#E2E8F0` | Mọi đường viền |
| Chữ chính | `text-base` | `#0F172A` | Nội dung chính |
| Chữ phụ | `text-muted` | `#64748B` | Nhãn, chú thích, chữ phụ trợ |
| Chữ vô hiệu | `text-disabled` | `#94A3B8` | Mục đã vô hiệu hoá |

### Các giá trị PHẢI BỎ khi chuyển từ Stitch

Nếu gặp trong HTML nguồn, thay theo bảng này:

| Giá trị Stitch | Thay bằng | Ghi chú |
|---|---|---|
| `#004ac6` (`primary`) | `#2563EB` | Stitch dùng M3, sai so với spec |
| `#faf8ff` (`background`) | `#F8FAFC` | Stitch ám tím, spec là xám lạnh |
| `#737686` (`outline`) | `#E2E8F0` | Stitch quá đậm cho viền |
| `#c3c6d7` (`outline-variant`) | `#E2E8F0` | Gộp về một token viền duy nhất |
| `#131b2e` (`on-surface`) | `#0F172A` | |
| `#434655` (`on-surface-variant`) | `#64748B` | |
| `#ecfccb`, `#3f6212`, `#d9f99d` | `success-subtle` / `success` | Màu lime hardcode, không thuộc hệ |
| `#E65100`, `#FFF3E0` | `warning` / `warning-subtle` | |
| `#006e2d`, `#E6F4EA` | `success` / `success-subtle` | |
| Mọi lớp `surface-container-*` | `bg-surface` hoặc `bg-header` | M3 có 5 mức, hệ này chỉ cần 2 |
| Mọi lớp `*-fixed`, `*-fixed-dim` | Bỏ hẳn | Khái niệm M3, không dùng |

### Quy tắc dùng màu

1. **Điểm số KHÔNG BAO GIỜ tô đỏ.** Điểm 3 là dữ liệu, không phải lỗi.
2. **Đỏ chỉ dành cho lỗi hệ thống và hành động phá huỷ.** Không dùng cho
   trạng thái "chưa hoàn thành" hay "làm sai" — dùng cam.
3. **Không bao giờ dùng riêng màu để truyền tin.** Mọi chip trạng thái phải
   có chữ. Bảng sẽ bị in ra giấy đen trắng.
4. **Không gradient.** Độ sâu thể hiện bằng viền, không bằng đổ bóng nặng.

---

## 2. Chữ

Font duy nhất: **Be Vietnam Pro**, dự phòng Inter.
Lý do: xử lý dấu tiếng Việt tốt (ễ, ố, ỡ) mà không bị cắt.

| Token | Cỡ | Đậm | Dòng cao | Dùng ở đâu |
|---|---|---|---|---|
| `metric-lg` | 32px | 700 | 40px | Số lớn trên thẻ Tổng quan |
| `title-lg` | 24px | 600 | 32px | Tiêu đề trang |
| `title-md` | 20px | 600 | 28px | Tiêu đề khối, tiêu đề modal |
| `body-md` | 16px | 400 | 24px | Nội dung chính, form |
| `table-content` | 14px | 400 | 20px | **Chuẩn cho mọi bảng dữ liệu** |
| `label-sm` | 12px | 500 | 16px | Nhãn phụ, chú thích, chip |

**Bắt buộc:** mọi con số trong bảng và báo cáo dùng `font-variant-numeric: tabular-nums`
để các chữ số thẳng cột.

---

## 3. Kích thước & bố cục

### Khung cố định

| Token | Giá trị |
|---|---|
| `sidebar-expanded` | 240px |
| `sidebar-collapsed` | 64px |
| `topbar-height` | 56px |
| `table-row-height` | 44px |
| `panel-width-md` | 640px (panel trượt phải) |
| `panel-width-sm` | 480px (panel xem chi tiết) |
| `modal-width-md` | 640px |
| `modal-width-sm` | 560px |
| `tap-target-min` | 40px |
| `grid-margin` | 32px (đệm ngang vùng nội dung) |
| `grid-gutter` | 24px |

### Quy tắc bố cục

- Thiết kế ở bề rộng chuẩn **1440px**. Chạy tốt 1280px–1920px.
- **KHÔNG làm giao diện mobile.** Dưới 1280px chỉ cuộn ngang, không đổ cột.
  Nếu thấy breakpoint `sm:` `md:` trong HTML nguồn, bỏ đi.
- **Bảng dữ liệu tràn hết bề rộng màn hình**, không giới hạn 1440px.
- **Trang cấu hình và form giới hạn 800px** cho dễ đọc.
- Lưới 12 cột, khoảng cách 24px.
- Chiều cao khả dụng = `100vh − 56px`.

### Bắt buộc ở mọi bảng

- Đầu bảng **dính** khi cuộn (`sticky top-0`)
- Thanh lọc **dính**
- Cột thao tác **dính bên phải**
- Sổ điểm: cột tên học sinh **dính bên trái** khi cuộn ngang
- Thanh hành động hàng loạt **nổi ở ĐÁY** màn hình khi chọn nhiều dòng
  (không phải trên cùng — tay người dùng đang ở dưới)

---

## 4. Hình khối & độ sâu

- Bo góc mặc định **8px** (`rounded-lg`) cho nút, thẻ, ô nhập, modal, panel
- Chip trạng thái và checkbox: **4px**
- **Không dùng nút bo tròn hoàn toàn (pill)** cho nút hành động
- Mức 0 (nền trang): `#F8FAFC`
- Mức 1 (thẻ, bảng): nền trắng + viền 1px `#E2E8F0`, **không đổ bóng**
- Mức 2 (modal, panel trượt): nền trắng + `0 4px 12px rgba(15,23,42,0.08)`
- Lớp phủ modal: `#0F172A` ở 40% độ mờ

---

## 5. Component chuẩn

| Component | Quy cách |
|---|---|
| Nút chính | Cao 40px, nền `primary`, chữ trắng, bo 8px |
| Nút phụ | Cao 40px, nền trắng, viền `border-base` |
| Nút phá huỷ | Cao 40px, chữ `danger`, viền `danger` — **không** nền đỏ đặc |
| Chip trạng thái | Cao 24px, bo 4px, nền `*-subtle` + chữ `*`, **luôn có chữ** |
| Ô nhập | Cao 40px, viền 1px `border-base`, focus: ring 2px `primary` |
| Hàng bảng | Cao 44px, sọc xen kẽ `bg-stripe` |
| Đầu bảng | Nền `bg-header`, chữ `label-sm`, chữ hoa nhẹ |
| Khung xương tải | Khối `#F1F5F9` có hiệu ứng nhấp nháy nhẹ |
| Modal import | Thanh tiến trình 3 bước: Tải file → Xem trước → Xác nhận |

---

## 6. Icon

Dùng **`lucide-react`**. Không dùng Material Symbols (file HTML nguồn dùng
Material Symbols, phải thay toàn bộ).

Bảng ánh xạ khi chuyển:

| Material Symbols | lucide-react |
|---|---|
| `dashboard` | `LayoutDashboard` |
| `group` | `Users` |
| `school` | `GraduationCap` |
| `menu_book` | `BookOpen` |
| `folder` | `FolderOpen` |
| `category` | `Layers` |
| `history` | `History` |
| `settings` | `Settings` |
| `notifications` | `Bell` |
| `search` | `Search` |
| `more_vert` | `MoreVertical` |
| `edit` | `Pencil` |
| `upload_file` | `Upload` |
| `download` | `Download` |
| `warning` | `AlertTriangle` |
| `check_circle` | `CheckCircle2` |

---

## 7. Định dạng Việt Nam

- Ngày: `DD/MM/YYYY`. Giờ: 24h (`21:43`).
- Số thập phân dùng **dấu phẩy**: `7,5` — không phải `7.5`.
- Điểm hệ 10, bước 0,25.
- Sắp xếp danh sách người theo **TÊN**, không theo họ.
- Loại điểm theo Thông tư 22: Thường xuyên / Giữa kỳ / Cuối kỳ.

---

## 8. Trạng thái bắt buộc ở mọi bảng

Bốn trạng thái này nằm **bên trong** component `DataTable`, suy ra từ trạng
thái query — **không** truyền prop từ từng trang.

| Trạng thái | Thể hiện |
|---|---|
| Đang tải | Khung xương (skeleton), **không** vòng xoay |
| Rỗng | Là **hướng dẫn bắt đầu**: một câu giải thích + nút hành động + nút tải file mẫu |
| Lỗi | Thông báo ngắn + nút "Thử lại" |
| Lọc ra 0 kết quả | **Khác** trạng thái rỗng — bắt buộc có nút "Xoá bộ lọc" |
