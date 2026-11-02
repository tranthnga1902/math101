# Báo Cáo Khảo Sát Kiến Trúc Frontend — Danh Mục & Trình Đọc Sách Giáo Khoa (SGK/SBT)

**Dự án**: MATH10 Web Platform (`MATH9_AI_Web_Demo_V6_Vercel`)  
**Tác giả**: Frontend Architecture Explorer Agent  
**Ngày thực hiện**: 13/09/2026  
**Trạng thái**: Hoàn thành khảo sát & Đề xuất phương án kỹ thuật chi tiết  

---

## 1. Tóm Tắt Khảo Sát (Executive Summary)

Hệ thống frontend hiện tại được xây dựng trên nền tảng hiện đại (**React 19.2.6**, **TypeScript 5.9.3**, **Vite 7.3.6**, **Tailwind CSS 4.3.3**, **@tanstack/react-query 5.101.4**, **pdfjs-dist 4.7.76**). Quá trình kiểm tra cơ sở cho thấy mã nguồn sạch, cả hai lệnh `npm run build` và `npm run lint` đều hoàn thành với **0 lỗi**.

Khảo sát hiện trạng chức năng Sách giáo khoa (SGK/SBT) cho thấy:
1. **Admin**: Đã có màn hình sơ khởi `src/admin/TextbookManagement.tsx` dùng Admin UI Kit (`AdminPage`, `AdminTable`), nhưng modal thêm sách đang bị hardcode chỉ có 2 trường (tên + file), thiếu hoàn toàn chức năng Sửa (Edit), thiếu bộ lọc Khối/Môn/Trạng thái/Tìm kiếm, thiếu nút Ẩn sách (Hide), và viewer nội bộ chưa hỗ trợ khớp trang (offset calibration).
2. **Teacher**: Đã có component `src/teacher/TextbookBrowser.tsx` và sub-tab trong `teacher-content`, nhưng chưa có mục riêng trên sidebar chính `src/layout/Sidebar.tsx` (trái với mục tiêu trong MATH10 Master Plan: `Lớp học | Bài học | Sách giáo khoa | Phiếu bài tập`), giao diện card chưa đồng bộ design tokens và thiếu bộ lọc Khối/Môn/Loại sách/Tìm kiếm.
3. **Student**: Đã có tab `textbooks` trên sidebar `StudentShell.tsx` và một bảng card đơn giản trong `StudentExperience.tsx`, nhưng chưa có bộ lọc, chưa có tìm kiếm và khi bấm "Đọc sách" chỉ gọi `openTextbookInBrowser` mở `PdfViewer` chung vốn chỉ biết trang PDF vật lý, hoàn toàn không hiển thị số trang sách thực tế.
4. **Trình đọc PDF (Reader)**: Hệ thống đã có hạ tầng render PDF rất tối ưu bằng `pdfjs-dist` (`src/components/pdfCore.ts`, `PdfScrollPage.tsx` render qua `IntersectionObserver` tránh tốn RAM), nhưng chưa có một component chuyên biệt cho SGK có khả năng:
   - Hiển thị song song **Số trang sách vật lý** (`bookPage`) và **Số trang PDF** (`pdfPage`).
   - Nhảy trang tự động theo công thức: `pdfPage = bookPage + (base_page_offset - 1)`.
   - Cung cấp thanh công cụ cân chỉnh offset trực tiếp (Offset Calibration Bar) cho Admin: bấm 1 nút *"Đặt trang PDF này làm Trang 1"* và lưu ngay vào CSDL.

Báo cáo dưới đây trình bày chi tiết kiến trúc hiện trạng, phân tích khoảng cách (gap analysis) và đưa ra kế hoạch kỹ thuật chuẩn xác để triển khai hoàn thiện.

---

## 2. Kiến Trúc Frontend & Tech Stack Cơ Sở

### 2.1. Tech Stack
- **Framework**: React `19.2.6` + React DOM `19.2.6`
- **Ngôn ngữ**: TypeScript `5.9.3` (`strict` mode)
- **Công cụ build**: Vite `7.0.0` (thực tế chạy `7.3.6`)
- **Styling**: Tailwind CSS `4.3.3` kết hợp plugin `@tailwindcss/vite` và design tokens `@theme` trong `src/globals.css`
- **Quản lý state & data fetching**: `@tanstack/react-query` `5.101.4`
- **Render PDF**: `pdfjs-dist` `4.7.76` (sử dụng worker `pdf.worker.min.mjs` tích hợp sẵn trong Vite bundle)
- **Icons**: `lucide-react` `1.27.0` và `Material Symbols Outlined` (Google Fonts)
- **Font chữ chính**: `Be Vietnam Pro`, `system-ui`, `sans-serif`
- **Bộ UI Primitives**: `class-variance-authority` (`cva`), `clsx`, `tailwind-merge` (`cn()`), Radix UI Slot

### 2.2. Kết quả kiểm tra Baseline Scripts
- `npm run build` (`tsc -b && vite build`): **PASS** (18.18s, 2096 modules transformed, 0 lỗi TypeScript, 0 lỗi build).
- `npm run lint` (`eslint . --ignore-pattern dist`): **PASS** (0 warnings, 0 errors).

### 2.3. Design System & Design Tokens (`src/globals.css` & `SKILL.md`)
Hệ thống sử dụng bảng màu thương hiệu chuẩn MATH10 (Forest Green & Muted Surface):
- **Surfaces**:
  - Nền trang: `bg-surface` (`#f8f9ff`)
  - Nền thẻ/bảng: `bg-surface-container-lowest` (`#ffffff`)
  - Nền phụ: `bg-surface-container` (`#e5eeff`), `bg-surface-container-low` (`#eff4ff`)
- **Text**:
  - Chữ chính: `text-on-surface` (`#0b1c30`)
  - Chữ phụ/nhãn: `text-on-surface-variant` (`#434655`)
- **Borders**:
  - Viền chính: `border-outline-variant` (`#c3c6d7`)
  - Viền đậm: `border-outline` (`#737686`)
- **Thương hiệu (Brand)**:
  - Primary (Xanh rừng): `bg-primary` (`#176b50`), `text-on-primary` (`#ffffff`), container: `bg-primary-container` (`#dff3ea`)
  - Secondary (Xanh lá): `bg-secondary` (`#006e2d`), `bg-secondary-container` (`#7cf994`)
  - Error (Đỏ): `bg-error` (`#ba1a1a`), `bg-error-container` (`#ffdad6`), `text-on-error-container` (`#93000a`)

### 2.4. Thư Viện Admin UI Kit Có Sẵn (`src/admin/components/`)
Đã có sẵn bộ linh kiện chuẩn hóa:
1. `AdminPage`: Bố cục chuẩn gồm `AdminPage.Header`, `AdminPage.Filters`, `AdminPage.Content`.
2. `AdminTable`: Bảng phân trang chuẩn hóa, hỗ trợ skeleton loading, sticky actions, `keyExtractor`.
3. `AdminModal`: Modal pop-up căn giữa với các kích thước `sm`, `md`, `lg`, `xl`.
4. `AdminDrawer`: Panel trượt cạnh phải (`sm`, `md`, `lg`).
5. `AdminEmptyState`: Trạng thái rỗng với icon, tiêu đề, mô tả và nút CTA.
6. `SearchInput` & `FilterSelect`: Ô tìm kiếm có debounce 500ms và dropdown bộ lọc styled chuẩn token.
7. `SkeletonTable`, `SkeletonCard`: Trạng thái nạp dữ liệu.

---

## 3. Khảo Sát Điều Hướng & Routing (Role-Based Layouts)

Ứng dụng sử dụng cơ chế điều hướng SPA dựa trên Role trong `src/App.tsx`:
```tsx
if (session.role === "teacher") return <MainLayout ...><TeacherDashboard ... /></MainLayout>;
if (session.role === "admin") return <AdminShell ...><AdminDashboard ... /></AdminShell>;
return <StudentExperience session={session} ... />;
```

### 3.1. Phân Hệ Quản Trị (Admin)
- **Vị trí file**: `src/admin/AdminShell.tsx`, `src/App.tsx`
- **Menu hiện có**: `overview`, `users`, `programs`, `course-instances`, `classes`, `textbooks`, `documents`, `audit`.
- **Mục "Sách giáo khoa"**:
  - Key: `textbooks`
  - Icon: `GraduationCap` (`lucide-react`)
  - Khi click: `activeSection === "textbooks"` → render `<TextbookManagement session={session} />`.
- **Deep-linking**: `src/admin/navigation.ts` quản lý `AdminDestination` qua custom event `math10:admin-navigation`. Cần bổ sung `{ section: "textbooks"; textbookId?: number }`.

### 3.2. Phân Hệ Giáo Viên (Teacher)
- **Vị trí file**: `src/layout/MainLayout.tsx`, `src/layout/Sidebar.tsx`, `src/App.tsx`
- **Menu hiện có trong Sidebar (`src/layout/Sidebar.tsx`)**:
  - `teacher-overview` (Trang chủ)
  - `teacher-classes` (Lớp học)
  - `teacher-content` (Nội dung học)
  - `teacher-documents` (Tài liệu của tôi)
  - `teacher-pipeline` (Tạo phiếu từ file)
  - `teacher-worksheets` (Phiếu và đề)
  - `teacher-tasks` (Nhiệm vụ)
  - `teacher-grading` (Chấm bài)
  - `teacher-reports` (Báo cáo)
  - `teacher-notifications` (Thông báo)
- **Điểm nghẽn hiện tại**:
  - `teacher-textbooks` đã được định nghĩa trong `mainSections` của `MainLayout.tsx` và trong `App.tsx` (render `TextbookStudentView`), đồng thời nằm trong tab con `Sách giáo khoa` của `teacher-content`.
  - Tuy nhiên, trong thanh điều hướng chính `Sidebar.tsx`, mục "Sách giáo khoa" **chưa xuất hiện ở menu cấp 1**.
  - **Kế hoạch cập nhật**: Thêm `{ id: "teacher-textbooks", icon: BookOpen, label: "Sách giáo khoa" }` vào `MAIN_NAV` của `src/layout/Sidebar.tsx` ngay dưới `teacher-content` (hoặc thay thế vị trí phù hợp theo MATH10 Master Plan).

### 3.3. Phân Hệ Học Sinh (Student)
- **Vị trí file**: `src/student/StudentShell.tsx`, `src/student/StudentExperience.tsx`
- **Menu trong Sidebar (`StudentShell.tsx`)**:
  - Nhóm "Chương trình học":
    - `lessons` (Tổng quan)
    - `videos` (Video)
    - `textbooks` (Sách giáo khoa — Icon: `auto_stories`)
    - `materials` (Tài liệu)
    - `exercises` (Bài tập chương trình)
- **Trạng thái**: Mục menu `textbooks` đã có sẵn trên thanh điều hướng học sinh. Trong `StudentExperience.tsx`, tab này render `TextbooksTab`. Cần thay thế `TextbooksTab` sơ sài bằng component `TextbookCatalog` hoàn chỉnh.

---

## 4. Khảo Sát API Client & Đối Soát Endpoints

### 4.1. Cơ Chế Gọi API Trong `src/api.ts`
- Hàm tiện ích `request<T>(path, options, token)` tự động gắn `${API_BASE_URL}/api${path}`, thêm `Authorization: Bearer ${token}`, quản lý header `Content-Type: application/json` (trừ `FormData`) và bọc qua `withTimeout(20_000, ...)`.
- Mọi API trả về cấu trúc chuẩn `ApiEnvelope<T>`:
  ```json
  { "success": true, "code": 200, "message": "...", "data": { ... } }
  ```

### 4.2. Đối Soát Endpoint Backend vs Yêu Cầu Gốc

| Chức năng | Đường dẫn theo Yêu cầu gốc (R1/R2) | Đường dẫn thực tế trong `src/api.ts` | Backend Controller hiện tại |
|---|---|---|---|
| Danh sách SGK công khai (Student/Teacher) | `GET /api/textbooks` | `request("/documents/textbooks")` → `/api/documents/textbooks` | `@GetMapping("/textbooks")` trong `DocumentController` (`/api/documents`) |
| Chi tiết 1 cuốn SGK | `GET /api/textbooks/{id}` | `request("/documents/textbooks/${id}")` | `@GetMapping("/textbooks/{id}")` trong `DocumentController` |
| Mở SGK & tính offset | `GET /api/textbooks/{id}/open` (hoặc POST) | `request("/documents/textbooks/${id}/open", { method: "POST" })` | `@PostMapping("/textbooks/{id}/open")` trong `DocumentController` |
| Danh sách SGK quản trị (Admin) | `GET /api/admin/textbooks` | `request("/admin/documents/textbooks")` | `@GetMapping("/textbooks")` trong `AdminDocumentController` (`/api/admin/documents`) |
| Upload SGK mới (Admin) | `POST /api/admin/textbooks` | `fetch("${API_BASE_URL}/api/admin/documents/textbooks")` | `@PostMapping("/textbooks")` trong `AdminDocumentController` |
| Cập nhật SGK & Offset (Admin) | `PUT /api/admin/textbooks/{id}` | `request("/admin/documents/textbooks/${id}", { method: "PUT" })` | `@PutMapping("/textbooks/{id}")` trong `AdminDocumentController` |
| Xuất bản SGK (Admin) | `PATCH /api/admin/textbooks/{id}/publish` | `request("/admin/documents/textbooks/${id}/publish", { method: "PATCH" })` | `@PatchMapping("/textbooks/{id}/publish")` trong `AdminDocumentController` |
| Ẩn SGK (Admin) | `PATCH /api/admin/textbooks/{id}/hide` | `request("/admin/documents/textbooks/${id}/hide", { method: "PATCH" })` | `@PatchMapping("/textbooks/{id}/hide")` trong `AdminDocumentController` |
| Xóa SGK (Soft-delete) | `DELETE /api/admin/textbooks/{id}` | `deleteDocument(s, id)` → `/admin/documents/${id}` | `@DeleteMapping("/{id}")` trong `AdminDocumentController` |

> **Khuyến nghị đồng bộ giữa Backend và Frontend**:  
> Trong Acceptance Criteria có yêu cầu:  
> - `Endpoints /api/admin/textbooks, /api/admin/textbooks/{id}, ...`  
> - `Catalog endpoints GET /api/textbooks và GET /api/textbooks/{id}/open`  
> Hiện tại Backend đang đặt dưới prefix `/api/documents/textbooks` và `/api/admin/documents/textbooks`.  
> Đội ngũ Backend Agent nên cấu hình thêm alias routing (hoặc tạo `TextbookController` riêng với route `/api/textbooks` và `/api/admin/textbooks`), đồng thời hỗ trợ cả 2 URL để đảm bảo 100% tương thích ngược và đáp ứng đúng acceptance criteria. Frontend API client sẽ hỗ trợ các hàm gọi chuẩn xác.

### 4.3. Các Kiểu Dữ Liệu (Data Types) Cần Thiết

```typescript
export type TextbookItem = {
  id: number;
  title: string;
  docType: "SGK" | "SBT" | string;
  audience: "STUDENT_ALLOWED" | "TEACHER_ONLY";
  gradeId: number | null;
  gradeName?: string | null;
  subjectId: number | null;
  subjectName?: string | null;
  status: "DRAFT" | "PUBLISHED" | "HIDDEN";
  totalPages: number | null;
  basePageOffset: number; // 1-indexed PDF page where book page 1 begins (mặc định: 1)
  fileUrl: string;
  thumbnailUrl: string | null;
  createdAt: string;
};

export type TextbookOpen = {
  documentId: number;
  title: string;
  fileUrl: string;
  pdfPage: number; // Trang PDF tương ứng với trang sách đã yêu cầu
  totalPages: number | null;
};

export type TextbookUploadPayload = {
  title: string;
  docType: "SGK" | "SBT";
  audience: "STUDENT_ALLOWED" | "TEACHER_ONLY";
  gradeId?: number | null;
  subjectId?: number | null;
  basePageOffset?: number;
  file: File;
};

export type TextbookUpdatePayload = {
  title: string;
  docType: string;
  audience: string;
  gradeId?: number | null;
  subjectId?: number | null;
  totalPages?: number | null;
  basePageOffset?: number;
  status?: "DRAFT" | "PUBLISHED" | "HIDDEN";
};
```

---

## 5. Khảo Sát Trình Đọc PDF & Thuật Toán Khớp Trang (Page Offset)

### 5.1. Hạ Tầng Render PDF Sẵn Có (`src/components/pdfCore.ts`)
Hệ thống sử dụng thư viện `pdfjs-dist 4.7.76` với giải pháp cực kỳ tiết kiệm bộ nhớ:
1. `usePdfDocument(url, accessToken)`: Tải tài liệu qua backend (`Authorization: Bearer`), chỉ tải 1 lần cho toàn bộ phiên đọc.
2. `usePdfPageRender(...)`: Render từng trang ra HTML5 Canvas với tỷ lệ `devicePixelRatio` (sắc nét trên màn Retina/High-DPI) kèm cờ huỷ (`taskRef.cancel()`) khi cuộn nhanh.
3. `PdfScrollPage.tsx`: Sử dụng `IntersectionObserver` với `rootMargin: "150% 0px"`. Canvas chỉ được khởi tạo khi trang nằm gần viewport, và tự huỷ giải phóng bộ nhớ khi cuộn đi xa. Điều này cho phép mở mượt mà các file SGK dung lượng lớn (200 - 400 trang) mà không làm tràn RAM trình duyệt.
4. `useScrollPages(...)`: Quản lý cuộn dọc mượt mà, tính toán trang đang xem theo vị trí cuộn và cung cấp hàm `goTo(page)`.
5. `useDragPan(...)`: Cho phép kéo rê để lia trang và hỗ trợ `Ctrl + cuộn chuột` để phóng to/thu nhỏ.

### 5.2. Công Thức & Quy Tắc Khớp Trang (Page Offset Calculation)
Theo yêu cầu nghiệp vụ:
- `base_page_offset` là **số thứ tự trang PDF (1-indexed)** nơi **Trang 1 của bản in sách** bắt đầu.
- Ví dụ: Cuốn "Toán 10 - Tập 1" có bìa trước, lời nói đầu, mục lục chiếm 13 trang đầu của file PDF. Khi đó, trang in số 1 nằm ở trang PDF thứ 14 → `base_page_offset = 14`.

#### Công thức chuyển đổi:
1. **Từ Trang Sách in sang Trang PDF**:
   $$\text{pdfPage} = \text{bookPage} + (\text{base\_page\_offset} - 1)$$
   - Nhập trang sách $1 \rightarrow 1 + (14 - 1) = \text{PDF } 14$.
   - Nhập trang sách $45 \rightarrow 45 + 13 = \text{PDF } 58$.
2. **Từ Trang PDF sang Trang Sách in**:
   $$\text{bookPage} = \text{pdfPage} - (\text{base\_page\_offset} - 1)$$
   - Nếu $\text{pdfPage} < \text{base\_page\_offset}$: Trang tài liệu nằm ở phần mở đầu (Bìa, Mục lục, Lời nói đầu). Hiển thị nhãn: `Trang phụ (Bìa / Mục lục)`.
   - Nếu $\text{pdfPage} \ge \text{base\_page\_offset}$: Hiển thị `Trang sách: [bookPage]`.

### 5.3. Yêu Cầu Cân Chỉnh Offset Trực Quan (Calibration Toolbar) Cho Admin
Admin khi duyệt hoặc xem trước sách cần công cụ hiệu chuẩn trực quan:
- Khi đang lật từng trang PDF tới trang in có in rõ số trang `1`:
  - Bấm nút: **"Đặt trang PDF này [X] làm Trang 1"** $\rightarrow$ tự động gán `base_page_offset = X`.
  - Có các nút tinh chỉnh: `[ - 1 ]`, `[ + 1 ]`.
  - Khung kiểm tra trực tiếp: *"Nhập thử trang sách: [ 10 ] $\rightarrow$ nhảy ngay tới PDF [ 10 + X - 1 ]"*.
  - Nút **"Lưu cấu hình offset"** $\rightarrow$ gọi API `updateTextbook` cập nhật vào CSDL.

---

## 6. Kế Hoạch Kỹ Thuật Chi Tiết Các Component Mới & Nâng Cấp

### 6.1. Component 1: Quản Trị Sách Giáo Khoa (`src/admin/TextbookManagement.tsx`)
Nâng cấp toàn diện component quản trị theo chuẩn Admin UI Kit.

#### Bố cục giao diện:
- **`AdminPage.Header`**:
  - Eyebrow: `QUẢN TRỊ HỆ THỐNG`
  - Tiêu đề: `Quản lý Sách Giáo Khoa`
  - Mô tả: `Quản lý danh mục SGK, SBT, xuất bản và cân chỉnh số trang cho giáo viên & học sinh.`
  - Action button: `+ Tải lên sách mới` (mở modal Upload).
- **`AdminPage.Filters`**:
  - `SearchInput`: Tìm kiếm tức thì theo tên sách (debounce 300ms).
  - `FilterSelect` Khối lớp: Tất cả | Lớp 10 | Lớp 11 | Lớp 12 (load từ `getGrades`).
  - `FilterSelect` Môn học: Tất cả | Toán | Vật lý... (load từ `getSubjects`).
  - `FilterSelect` Loại sách: Tất cả | SGK (Sách giáo khoa) | SBT (Sách bài tập).
  - `FilterSelect` Trạng thái: Tất cả | Đã xuất bản (`PUBLISHED`) | Đang ẩn (`HIDDEN`) | Bản nháp (`DRAFT`).
- **`AdminTable`**:
  - Cột 1: **Ảnh bìa** (hiển thị ảnh thumbnail hoặc fallback icon PDF).
  - Cột 2: **Tên sách** (tiêu đề in đậm, phân loại SGK/SBT, ngày tạo).
  - Cột 3: **Khối lớp & Môn** (vd: Lớp 10 · Toán).
  - Cột 4: **Trang sách 1** (Hiển thị offset: `PDF trang {basePageOffset}`).
  - Cột 5: **Tổng trang** (`{totalPages} trang`).
  - Cột 6: **Trạng thái xuất bản**:
    - Badge màu:
      - `PUBLISHED`: Màu xanh lục (`bg-emerald-50 text-emerald-700 border-emerald-200`)
      - `HIDDEN`: Màu xám (`bg-slate-100 text-slate-700 border-slate-200`)
      - `DRAFT`: Màu vàng/cam (`bg-amber-50 text-amber-700 border-amber-200`)
    - Nút thao tác nhanh:
      - Nếu `PUBLISHED` → Nút *"Ẩn sách"* (gọi `hideTextbook`).
      - Nếu `HIDDEN` hoặc `DRAFT` → Nút *"Xuất bản"* (gọi `publishTextbook`).
  - Cột 7: **Thao tác**:
    - Nút *"Đọc & Khớp trang"* (Mở `TextbookReader` ở chế độ Admin Calibration).
    - Nút *"Sửa"* (Mở `EditBookModal`).
    - Nút *"Xóa"* (Xóa mềm qua dialog xác nhận an toàn).
- **Modals**:
  1. `UploadBookModal`:
     - Tên sách (Input text, required).
     - Loại sách (Select: `SGK` / `SBT`).
     - Khối lớp (Select từ `getGrades`).
     - Môn học (Select từ `getSubjects`).
     - Đối tượng xem (Select: `STUDENT_ALLOWED` - Cho phép học sinh / `TEACHER_ONLY` - Chỉ giáo viên).
     - Offset ban đầu (Input number, mặc định 1, có hướng dẫn: *"Trang in số 1 nằm ở trang PDF thứ mấy?"*).
     - Chọn file PDF (Input file `.pdf`, required).
     - Nút Hủy và Tải lên (kèm loading state).
  2. `EditBookModal`:
     - Cho phép sửa: Tên sách, Loại sách, Khối lớp, Môn học, Đối tượng xem, Base page offset, Trạng thái.
     - Gọi `updateTextbook` mutation.
  3. `DeleteConfirmDialog`:
     - Cảnh báo rõ: *"Xóa sách '{title}'? Sách sẽ được gỡ khỏi danh mục học sinh và giáo viên nhưng dữ liệu lịch sử vẫn được lưu trữ."*

---

### 6.2. Component 2: Danh Mục Sách Giáo Khoa Chung (`src/textbooks/TextbookCatalog.tsx`)
Component dùng chung cho cả **Teacher** (`activeSection === "teacher-textbooks"`) và **Student** (`tab === "textbooks"` trong `StudentExperience.tsx`).

#### Tính năng:
- **Thanh tìm kiếm & lọc đồng bộ**:
  - Ô tìm kiếm theo tên sách.
  - Dropdown lọc theo Khối lớp (lấy từ `getGrades`).
  - Dropdown lọc theo Môn học (lấy từ `getSubjects`).
  - Tab pills: `Tất cả` | `Sách giáo khoa (SGK)` | `Sách bài tập (SBT)`.
- **Lưới hiển thị thẻ sách (Textbook Card Grid)**:
  - Bố cục responsive: 1 cột (mobile), 2 cột (tablet `sm:`), 3 cột (`lg:`), 4 cột (`xl:`).
  - Thiết kế thẻ sách theo design token chuẩn:
    - Bìa sách: Tỷ lệ `3:4` hoặc `[96px × 132px]`, hiển thị ảnh bìa rõ nét qua `PdfThumbnail` / `AuthedImage`.
    - Badges: Nhãn loại sách (`Sách giáo khoa` / `Sách bài tập`), Nhãn khối lớp (`Khối 10`), Nhãn môn (`Toán`).
    - Tiêu đề sách (truncate 2 dòng, font đậm).
    - Số trang sách (`{totalPages} trang`).
    - **Nút hành động "Đọc sách"**: Bấm vào mở ngay `TextbookReader` từ trang 1 (tương ứng `base_page_offset`).
    - **Ô mở nhanh theo trang sách**:
      - Nhập số trang: `[ 45 ]`
      - Nút icon mũi tên / `Mở` $\rightarrow$ Mở thẳng trình đọc tại trang sách in số 45 (tự động tính PDF page 58).

---

### 6.3. Component 3: Trình Đọc Sách Chuyên Dụng & Cân Chỉnh Offset (`src/textbooks/TextbookReader.tsx`)
Thay thế trình đọc inline đơn giản bằng một trình đọc chuyên nghiệp, kế thừa sức mạnh của `pdfCore.ts`.

#### Tính năng cốt lõi:
1. **Thanh điều hướng hai chế độ trang (Dual-Page Indicator & Controls)**:
   - Hiển thị trang sách in nổi bật: **`Trang sách: [ 45 ]`** / tổng số trang sách.
   - Hiển thị song song trang PDF kỹ thuật: **`(PDF trang 58 / 200)`**.
   - Khi người dùng nhập số vào ô trang sách (vd: `45`): Hệ thống tự cuộn đến PDF page:
     ```ts
     const targetPdfPage = bookPage + (basePageOffset - 1);
     goTo(targetPdfPage);
     ```
   - Khi người dùng cuộn xem qua các trang PDF: Hệ thống tự tính ngược lại:
     ```ts
     const currentBookPage = pdfPage >= basePageOffset ? pdfPage - (basePageOffset - 1) : null;
     ```
     Nếu là trang trước offset, hiển thị nhãn: `Bìa / Mục lục`.
2. **Thanh công cụ đọc đầy đủ**:
   - Nút quay lại / đóng trình đọc (`ArrowBack` / `Close`).
   - Nút phóng to / thu nhỏ / 100%.
   - Chế độ hiển thị: "Vừa trang" (Fit Height), "Vừa chiều ngang" (Fit Width).
   - Nút bật/tắt mục lục thumbnail thu nhỏ bên trái (Sidebar thumbnails).
   - Phím tắt tiện lợi: Mũi tên trái/phải hoặc `PageUp`/`PageDown` để lật trang, `Home`/`End` để về đầu/cuối sách, `Esc` để đóng.
3. **Thanh công cụ Cân chỉnh Khớp trang (Offset Calibration Bar — Chỉ dành cho Admin)**:
   - Thanh công cụ nổi ghim phía trên hoặc dưới màn hình khi có quyền admin (`canCalibrate={true}`):
     - Hiển thị: *"Offset hiện tại: Trang sách 1 = PDF trang [X]"*.
     - Nút tiện ích: **"📍 Đặt trang PDF này làm Trang 1"** (nhấn phát gán ngay `newOffset = currentPage`).
     - Nút tăng giảm offset: `[-1]` và `[+1]`.
     - Nhãn kiểm thử: *"Trang in 10 sẽ nằm ở PDF trang {10 + newOffset - 1}"*.
     - Nút **"Lưu cấu hình"** $\rightarrow$ gọi API `updateTextbook` lưu lại `basePageOffset` mới.

---

## 7. Cập Nhật API Client Trong `src/api.ts`

Cần bổ sung/cập nhật các hàm sau trong `src/api.ts`:

```typescript
// Lấy danh sách SGK cho Teacher & Student (hỗ trợ lọc gradeId, subjectId, docType)
export async function getTextbooks(
  session: AuthSession,
  gradeId?: number | null,
  subjectId?: number | null,
  docType?: string | null
): Promise<TextbookItem[]> {
  const params = new URLSearchParams();
  if (gradeId) params.set("gradeId", String(gradeId));
  if (subjectId) params.set("subjectId", String(subjectId));
  if (docType) params.set("docType", docType);
  // Gọi endpoint textbooks (hỗ trợ cả /textbooks và fallback /documents/textbooks)
  return request<TextbookItem[]>(`/documents/textbooks${params.size ? "?" + params : ""}`, {}, session.accessToken);
}

// Lấy danh sách SGK cho Admin (kèm cả bản nháp, đã ẩn)
export async function getAdminTextbooks(session: AuthSession): Promise<TextbookItem[]> {
  return request<TextbookItem[]>("/admin/documents/textbooks", {}, session.accessToken);
}

// Upload SGK mới
export async function uploadTextbook(
  session: AuthSession,
  payload: TextbookUploadPayload
): Promise<TextbookItem> {
  const form = new FormData();
  form.append("title", payload.title);
  form.append("docType", payload.docType);
  form.append("audience", payload.audience);
  if (payload.gradeId) form.append("gradeId", String(payload.gradeId));
  if (payload.subjectId) form.append("subjectId", String(payload.subjectId));
  if (payload.basePageOffset) form.append("basePageOffset", String(payload.basePageOffset));
  form.append("file", payload.file);

  const response = await withTimeout(UPLOAD_TIMEOUT_MS, signal =>
    fetch(`${API_BASE_URL}/api/admin/documents/textbooks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.accessToken}` },
      body: form,
      signal,
    })
  );
  const json = (await response.json()) as ApiEnvelope<TextbookItem>;
  if (!response.ok || !json.success) throw new Error(json.message || "Upload sách thất bại");
  return json.data;
}

// Cập nhật metadata và offset SGK
export async function updateTextbook(
  session: AuthSession,
  id: number,
  payload: TextbookUpdatePayload
): Promise<TextbookItem> {
  return request<TextbookItem>(`/admin/documents/textbooks/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, session.accessToken);
}

// Xuất bản sách
export async function publishTextbook(session: AuthSession, id: number): Promise<TextbookItem> {
  return request<TextbookItem>(`/admin/documents/textbooks/${id}/publish`, { method: "PATCH" }, session.accessToken);
}

// Ẩn sách
export async function hideTextbook(session: AuthSession, id: number): Promise<TextbookItem> {
  return request<TextbookItem>(`/admin/documents/textbooks/${id}/hide`, { method: "PATCH" }, session.accessToken);
}

// Xóa mềm sách
export async function deleteTextbook(session: AuthSession, id: number): Promise<void> {
  return request<void>(`/admin/documents/textbooks/${id}`, { method: "DELETE" }, session.accessToken)
    .catch(() => request<void>(`/admin/documents/${id}`, { method: "DELETE" }, session.accessToken));
}
```

---

## 8. Cập Nhật Điều Hướng (Navigation Links)

### 8.1. Admin Navigation
- Giữ nguyên mục `["textbooks", "Sách giáo khoa", GraduationCap]` trong `src/admin/AdminShell.tsx` và `src/App.tsx`.
- Trong `src/admin/navigation.ts`, bổ sung type:
  ```typescript
  export type AdminDestination =
    | { section: "programs"; programId: number }
    | { section: "course-instances"; courseId: number }
    | { section: "classes"; classId: number }
    | { section: "textbooks"; textbookId?: number };
  ```

### 8.2. Teacher Navigation
- Trong `src/layout/Sidebar.tsx`: Thêm mục Sách giáo khoa vào `MAIN_NAV`:
  ```typescript
  const MAIN_NAV: NavItem[] = [
    { id: "teacher-overview", icon: Home, label: "Trang chủ" },
    { id: "teacher-classes", icon: Users, label: "Lớp học" },
    { id: "teacher-content", icon: BookOpen, label: "Nội dung học" },
    { id: "teacher-textbooks", icon: GraduationCap, label: "Sách giáo khoa" }, // <-- Bổ sung mục này
    { id: "teacher-documents", icon: FileText, label: "Tài liệu của tôi" },
    ...
  ];
  ```
- Trong `src/layout/MainLayout.tsx`: Bỏ mapping redirect `teacher-textbooks` sang `teacher-content` để khi bấm vào menu nó chuyển thẳng tới view sách chuyên biệt:
  ```typescript
  const sectionTargets: Record<string, string> = {
    "course-create": "teacher-content",
    "problem-create": "teacher-content",
    "teacher-courses": "teacher-content",
    "teacher-problems": "teacher-content",
    // "teacher-textbooks": "teacher-content", // Bỏ dòng này để active thẳng teacher-textbooks
    "teacher-gradebook": "teacher-classes",
  };
  ```
- Trong `src/App.tsx`: Tại nhánh `activeSection === "teacher-textbooks"`, render component `TextbookCatalog`. Đồng thời tại tab `textbooks` của `teacher-content`, render cùng một component `TextbookCatalog`.

### 8.3. Student Navigation
- Trong `src/student/StudentShell.tsx`: Mục `{ key: "textbooks", label: "Sách giáo khoa", icon: "auto_stories" }` đã có sẵn.
- Trong `src/student/StudentExperience.tsx`: Thay thế hàm `TextbooksTab` bằng:
  ```tsx
  {tab === "textbooks" && <TextbookCatalog session={session} role="student" />}
  ```

---

## 9. Kế Hoạch Triển Khai Từng Bước (Implementation Roadmap)

1. **Bước 1: Chuẩn hóa API Client (`src/api.ts`)**:
   - Cập nhật các kiểu dữ liệu `TextbookItem`, `TextbookOpen`, `TextbookUploadPayload`, `TextbookUpdatePayload`.
   - Cập nhật / bổ sung các hàm `getTextbooks`, `getAdminTextbooks`, `uploadTextbook`, `updateTextbook`, `publishTextbook`, `hideTextbook`, `deleteTextbook`.

2. **Bước 2: Xây dựng Trình Đọc Sách Giáo Khoa Đa Năng (`src/textbooks/TextbookReader.tsx`)**:
   - Nhận props: `session`, `book: TextbookItem`, `initialBookPage?: number`, `initialPdfPage?: number`, `canCalibrate?: boolean`, `onClose: () => void`.
   - Triển khai công thức chuyển đổi hai chiều `bookPage <-> pdfPage`.
   - Giao diện đọc cuộn dọc bằng `pdfCore.ts` (`PdfScrollPage`, `usePdfDocument`, `useScrollPages`, `useContentSize`).
   - Tích hợp thanh công cụ đọc (zoom, nhảy trang sách, nhảy trang PDF, sidebar thumbnails).
   - Tích hợp Calibration Toolbar nếu `canCalibrate={true}`: nút "Đặt làm Trang 1", nút lưu offset qua `updateTextbook`.

3. **Bước 3: Xây dựng Danh Mục Sách Giáo Khoa Dùng Chung (`src/textbooks/TextbookCatalog.tsx`)**:
   - Truy vấn `getTextbooks(session, selectedGrade, selectedSubject, selectedDocType)`.
   - Bộ lọc Khối, Môn, Loại sách (SGK/SBT) và Ô tìm kiếm theo tên.
   - Thẻ hiển thị sách với ảnh bìa `PdfThumbnail`, thông tin số trang, nhãn môn/khối.
   - Nút "Đọc sách" và ô "Nhập trang sách cần mở" $\rightarrow$ mở `TextbookReader`.

4. **Bước 4: Nâng Cấp Trang Quản Trị Sách (`src/admin/TextbookManagement.tsx`)**:
   - Áp dụng đầy đủ bộ Admin UI Kit (`AdminPage`, `AdminTable`, `AdminModal`, `AdminEmptyState`).
   - Bộ lọc: Tìm kiếm, Khối, Môn, Loại sách, Trạng thái (Đã xuất bản, Đang ẩn, Bản nháp).
   - Bảng danh sách với đầy đủ cột: Ảnh bìa, Tên sách, Khối & Môn, Offset, Số trang, Trạng thái xuất bản & nút chuyển đổi nhanh (Xuất bản / Ẩn), Thao tác (Xem & Khớp trang, Sửa, Xóa).
   - `UploadBookModal`: Nhập tên, chọn loại sách, chọn khối, chọn môn, phạm vi xem, offset ban đầu, file PDF.
   - `EditBookModal`: Cho phép sửa lại toàn bộ thông tin metadata và offset.
   - Xóa mềm có xác nhận.
   - Bấm "Xem & Khớp trang" $\rightarrow$ mở `TextbookReader` với `canCalibrate={true}`.

5. **Bước 5: Cập Nhật Điều Hướng Phân Hệ (Navigation Links)**:
   - Thêm "Sách giáo khoa" vào `MAIN_NAV` của `src/layout/Sidebar.tsx` cho giáo viên.
   - Cập nhật `src/layout/MainLayout.tsx` để điều hướng mượt mà.
   - Tích hợp `TextbookCatalog` vào `App.tsx` (Teacher) và `StudentExperience.tsx` (Student).
   - Cập nhật `AdminDestination` trong `src/admin/navigation.ts`.

6. **Bước 6: Kiểm Tra & Đảm Bảo Chất Lượng (Verification)**:
   - Chạy `npm run build` $\rightarrow$ Đảm bảo biên dịch thành công 100%, 0 lỗi TypeScript.
   - Chạy `npm run lint` $\rightarrow$ Đảm bảo chuẩn ESLint, 0 lỗi cú pháp.
   - Kiểm tra giao diện trên cả 3 vai trò (Admin, Teacher, Student) đảm bảo responsive, không vỡ layout, không hardcode danh sách tùy chọn.

---

## 10. Kết Luận

Kế hoạch kỹ thuật trên giải quyết trọn vẹn tất cả yêu cầu trong `ORIGINAL_REQUEST.md` và `MATH10_MASTER_PLAN.md`:
- Đảm bảo tính mở rộng cao thông qua component dùng chung `TextbookCatalog` và `TextbookReader`.
- Giải quyết triệt để bài toán lệch trang giữa bản in giấy và file PDF bằng công thức offset trực quan và thanh công cụ calibration 1-click cho Admin.
- Tuân thủ nghiêm ngặt design system chuẩn của dự án (`ui-design` skill), tận dụng tối đa hạ tầng hiệu năng cao đã có của `pdfjs-dist` và Admin UI Kit.
