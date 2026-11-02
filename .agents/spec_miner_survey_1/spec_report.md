# BÁO CÁO ĐẶC TẢ VÀ YÊU CẦU HỆ THỐNG: DANH MỤC VÀ TRÌNH ĐỌC SÁCH GIÁO KHOA (SGK / SBT)
**Dự án**: MATH10 Web Platform (Chương trình Giáo dục Phổ thông 2018)  
**Tài liệu tham chiếu chính**: `MATH10_MASTER_PLAN.md` (Mục 3: "Danh Mục Sách Giáo Khoa"), `.agents/ORIGINAL_REQUEST.md`  
**Ngày thực hiện**: 2026-09-13  
**Người thực hiện**: Specification & Requirements Miner Agent  

---

## 1. Tổng Quan Và Nguồn Đặc Tả (Specification Sources)

Hệ thống Sách Giáo Khoa (SGK) và Sách Bài Tập (SBT) trong MATH10 là một **phân hệ kho sách riêng biệt**, tách biệt khỏi các tài liệu học tập thông thường được giáo viên gán theo từng bài học (`lesson_documents`). Phân hệ này cung cấp một thư viện số hóa các bộ SGK/SBT Toán 10 (Chân Trời Sáng Tạo, Kết Nối Tri Thức, Cánh Diều), cho phép:
1. **Quản trị viên (Admin)**: Upload file PDF sách, quản lý siêu dữ liệu (metadata), hiệu chuẩn offset trang vật lý sang trang PDF, chuyển đổi trạng thái xuất bản (DRAFT / PUBLISHED / HIDDEN) và xóa mềm (soft delete).
2. **Giáo viên (Teacher) và Học sinh (Student)**: Duyệt danh mục sách đã xuất bản theo môn học và khối lớp, mở trình đọc PDF trực tiếp trong ứng dụng, tra cứu và nhảy trực tiếp đến trang PDF chính xác dựa trên số trang sách in vật lý (`bookPage`) thông qua thuật toán hiệu chuẩn offset `base_page_offset`.

### Nguồn Đặc Tả Có Thẩm Quyền Được Khai Thác:
- **`MATH10_MASTER_PLAN.md`**: Mục 1 (Ràng buộc hệ thống), Mục 2 (Kiến trúc dữ liệu cốt lõi), Mục 3 (Phase 1: Danh mục Sách giáo khoa, Mô hình dữ liệu, Phân quyền Admin/Teacher/Student, API SGK, Luồng xuất bản SGK).
- **`.agents/ORIGINAL_REQUEST.md`**: Yêu cầu R1 (Textbook Catalog & Metadata Management), R2 (Textbook Exploration and Reading), R3 (Access Control & Architecture Constraints), Tiêu chí nghiệm thu (Acceptance Criteria) cho Backend, Frontend và E2E script.
- **Cơ sở dữ liệu & Flyway Migrations**:
  - `V202607291700__create_documents_and_lesson_documents.sql`: Bảng cơ sở `documents`.
  - `V202607310000__add_textbook_fields_and_page_mapping.sql`: Cột `status`, `subject_id`, `total_pages`, `base_page_offset` và bảng `document_page_mappings`.
  - `V202607311800__add_document_thumbnail_url.sql`: Cột `thumbnail_url`.
  - `V202608040500__create_textbook_mapping_progress.sql`: Bảng lưu tiến độ và lịch sử thao tác khớp trang.
- **Mã nguồn Backend Hiện Hữu**:
  - Entity: `Document.java`, `DocumentPageMapping.java`, `BaseEntity.java`.
  - Controllers: `AdminDocumentController.java`, `DocumentController.java`.
  - Services: `DocumentServiceImpl.java`, `PdfThumbnailService.java`, `StorageService.java`.
  - Security: `SecurityConfig.java`, `PermissionMatrixTest.java`, `AuditTrailTest.java`.
- **Mã nguồn Frontend Hiện Hữu**:
  - API client & types: `src/api.ts`, `src/api/types.ts`.
  - Giao diện Admin: `src/admin/TextbookManagement.tsx`, `src/admin/AdminShell.tsx`.
  - Giao diện Giáo viên: `src/teacher/TextbookBrowser.tsx`.
  - Giao diện Học sinh: `src/student/StudentExperience.tsx` (`TextbooksTab`).
  - Trình đọc PDF & Host: `src/components/DocumentViewerHost.tsx`, `src/components/PdfViewer.tsx`, `src/components/documentViewerStore.ts`.

---

## 2. Bảng Danh Mục Tính Năng Được Phát Hiện (Features Discovered)

| # | Phân Loại | Tính Năng | Mô Tả Nghiệp Vụ | Dữ Liệu Đầu Vào | Dữ Liệu Đầu Ra | Hành Vi Khi Lỗi | Nguồn Phát Hiện |
|---|---|---|---|---|---|---|---|
| 1 | Admin Catalog | Upload SGK/SBT mới | Admin tải file PDF lên kho, lưu metadata, sinh thumbnail trang 1 và đặt trạng thái ban đầu là DRAFT | `MultipartFile file`, `title`, `docType` (SGK/SBT), `audience`, `gradeId`, `subjectId`, `basePageOffset` | `TextbookListResponse` (id, title, status, fileUrl, thumbnailUrl, basePageOffset, ...) | `400 Bad Request` nếu không phải PDF, file > 500MB hoặc docType không hợp lệ; `401`/`403` nếu không có quyền Admin | `MASTER_PLAN` §3, `ORIGINAL_REQUEST` R1, `AdminDocumentController.java` |
| 2 | Admin Catalog | Cập nhật Metadata Sách | Cập nhật tên sách, môn học, khối lớp, phân loại đối tượng, tổng số trang, và offset | `id` (path), `DocumentUpdateRequest` (title, docType, audience, gradeId, subjectId, totalPages, basePageOffset, status) | `TextbookListResponse` với thông tin đã cập nhật | `404 Not Found` nếu không tìm thấy sách; `400 Bad Request` nếu dữ liệu không hợp lệ | `MASTER_PLAN` §3, `AdminDocumentController.java` |
| 3 | Admin Catalog | Xuất bản Sách (Publish) | Đổi trạng thái từ `DRAFT`/`HIDDEN` sang `PUBLISHED` để hiển thị cho GV/HS | `id` (path) qua PATCH | `TextbookListResponse` với `status = "PUBLISHED"` | `404 Not Found` nếu sách không tồn tại; `403` nếu không phải Admin; ghi audit trail | `MASTER_PLAN` §3, `ORIGINAL_REQUEST` R1, `AdminDocumentController.java` |
| 4 | Admin Catalog | Ẩn Sách (Hide) | Đổi trạng thái từ `PUBLISHED` sang `HIDDEN` để gỡ khỏi danh mục GV/HS | `id` (path) qua PATCH | `TextbookListResponse` với `status = "HIDDEN"` | `404 Not Found` nếu sách không tồn tại; `403` nếu không phải Admin; ghi audit trail | `MASTER_PLAN` §3, `ORIGINAL_REQUEST` R1, `AdminDocumentController.java` |
| 5 | Admin Catalog | Xóa mềm Sách (Soft Delete) | Ghi nhận `deleted_at = now()`, ẩn sách khỏi mọi truy vấn của hệ thống và cascade xóa mềm lesson_documents | `id` (path) qua DELETE | HTTP 204 No Content hoặc 200 OK | `404 Not Found` nếu không tìm thấy; `403` nếu là tài liệu riêng của GV hoặc không phải Admin | `MASTER_PLAN` §1, §3, `ORIGINAL_REQUEST` R1, `DocumentServiceImpl.java` |
| 6 | Offset Calibration | Hiệu chuẩn Offset Tuyến Tính | Thiết lập số trang PDF tương ứng với trang sách in số 1: `base_page_offset = pdfPageForBookPageOne` | `id` (path), `pdfPageForBookPageOne` (int >= 1) | `TextbookListResponse` với `basePageOffset` mới | `400 Bad Request` nếu `pdfPageForBookPageOne < 1` hoặc vượt `totalPages`; `404 Not Found` nếu không có sách | `MASTER_PLAN` §3, `src/api/types.ts` (`setPageOffset`), `TextbookBrowser.tsx` |
| 7 | Detailed Mapping | Khớp Trang Chi Tiết (Granular Mapping) | Khớp từng trang đặc biệt (bìa, La Mã, phụ lục, ngắt chương) qua bảng `document_page_mappings` | `documentId`, `pdfPageNumber`, `bookPageLabel`, `pageType`, `chapterTitle`, `lessonTitle` | Danh sách mapping trang chi tiết | `400 Bad Request` nếu trùng lặp pdfPageNumber; `404 Not Found` nếu document không tồn tại | `MASTER_PLAN` §3 (bảng `document_page_mappings`), Migration `V202607310000` |
| 8 | Catalog Browsing | Xem Danh Mục SGK Đã Xuất Bản | GV và HS duyệt danh sách sách đã xuất bản, hỗ trợ lọc theo khối lớp và môn học | Query params: `gradeId` (optional), `subjectId` (optional) | `List<TextbookListResponse>` (chỉ gồm `status = PUBLISHED`, HS chỉ nhận `STUDENT_ALLOWED`) | `401 Unauthorized` nếu chưa đăng nhập | `MASTER_PLAN` §3, `ORIGINAL_REQUEST` R2, `DocumentController.java` |
| 9 | Reader Navigation | Mở Sách Và Tính Toán Trang PDF | Nhận số trang in vật lý (`bookPage`), tính toán và trả về `pdfPage = bookPage + (base_page_offset - 1)` | `id` (path), `bookPage` (query param, optional, default=1) | `TextbookOpenResponse` (documentId, title, fileUrl, pdfPage, totalPages) | `403 Forbidden` nếu sách chưa xuất bản hoặc HS mở sách GV; `404 Not Found` nếu không có sách; `400` nếu bookPage < 1 | `MASTER_PLAN` §3, `ORIGINAL_REQUEST` R2, `DocumentServiceImpl.java` |
| 10 | Reading Interface | Trình Đọc PDF Tích Hợp | Trình đọc PDF trực tiếp trong ứng dụng React với cuộn trang liên tục, nhảy trang theo initialPage, zoom, fit width/height, kéo pan và thumbnail | Token xác thực, `fileUrl`, `title`, `initialPage` | Giao diện đọc PDF tương tác cao | Báo lỗi thân thiện nếu không tải được file hoặc PDF bị hỏng | `src/components/PdfViewer.tsx`, `DocumentViewerHost.tsx`, `TextbookManagement.tsx` |
| 11 | Thumbnail Pipeline | Tự Động Sinh & Backfill Bìa Sách | Trích xuất trang 1 của PDF thành ảnh PNG (240px) tải lên storage làm bìa thumbnail | PDF InputStream hoặc lệnh backfill Admin | `thumbnailUrl` được gán vào bản ghi `Document` | Log cảnh báo nếu PDF scan hỏng hoặc không trích xuất được; không chặn tạo sách | Migration `V202607311800`, `PdfThumbnailService.java`, `AdminDocumentController.java` |
| 12 | Progress State | Lưu Trạng Thái Đang Đọc & Khớp Trang | Ghi nhớ trang PDF đang đọc, mức zoom, vị trí thumbnail để phục hồi khi chuyển tab/máy | `userId`, `documentId`, `pdfPage`, `zoom`, `thumbPage` | Bản ghi `textbook_mapping_progress` | Bỏ qua hoặc ghi đè (upsert) an toàn | Migration `V202608040500`, `textbook_mapping_progress` |

---

## 3. Mô Hình Dữ Liệu & Siêu Dữ Liệu (Data Model & Schema Specification)

### 3.1. Bảng Cốt Lõi: `documents` (PostgreSQL)

Toàn bộ SGK và SBT được lưu trữ trong bảng `documents`, mở rộng bằng các cột chuyên biệt và cơ chế lọc tự động `@SQLRestriction("deleted_at IS NULL")`.

| Tên Cột | Kiểu Dữ Liệu | Ràng Buộc | Ý Nghĩa Nghiệp Vụ | Giá Trị Hợp Lệ / Mặc Định |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | PRIMARY KEY | Khóa chính duy nhất dạng số nguyên tăng tự động | Identity `bigint` |
| `title` | `VARCHAR(255)` | NOT NULL | Tên sách giáo khoa / bài tập | Ví dụ: "Toán 10 - Tập 1 (Kết Nối Tri Thức)" |
| `doc_type` | `VARCHAR(30)` | NOT NULL | Loại tài liệu | Với sách: bắt buộc là `SGK` hoặc `SBT` |
| `audience` | `VARCHAR(30)` | NOT NULL | Đối tượng được phép xem | `STUDENT_ALLOWED` (HS & GV) hoặc `TEACHER_ONLY` (Chỉ GV) |
| `file_url` | `VARCHAR(1024)` | NOT NULL | Đường dẫn/URL file PDF lưu trên Cloud Storage (Supabase/R2) | URL tuyệt đối hoặc đường dẫn `/api/documents/{id}/content` |
| `thumbnail_url` | `VARCHAR(1024)` | NULLABLE | URL ảnh bìa (trang 1) được backend render tự động | URL ảnh PNG (kích thước chuẩn ngang 240px) |
| `grade_id` | `BIGINT` | FOREIGN KEY | Khối lớp liên kết | Tham chiếu `grades(id)`, ví dụ lớp 10 |
| `subject_id` | `BIGINT` | FOREIGN KEY | Môn học liên kết | Tham chiếu `subjects(id)`, ví dụ môn Toán |
| `status` | `VARCHAR(30)` | NOT NULL | Trạng thái vòng đời xuất bản | `DRAFT` (mới tạo), `PUBLISHED` (đã xuất bản), `HIDDEN` (đang ẩn) |
| `total_pages` | `INT` | NULLABLE | Tổng số trang thực tế của file PDF | Số nguyên dương >= 1 |
| `base_page_offset` | `INT` | NOT NULL | Trang PDF tương ứng với trang in số 1 của sách | Mặc định `1`. Khi sách có bìa/mục lục đầu, `base_page_offset > 1` |
| `chapter_id` | `BIGINT` | NULLABLE | Chương mục liên kết (nếu gắn theo chương) | Tham chiếu `chapters(id)` |
| `owner_id` | `BIGINT` | NULLABLE | Người sở hữu tài liệu | `NULL` với tài liệu dùng chung/Admin; ID giáo viên với tài liệu riêng |
| `folder_id` | `BIGINT` | NULLABLE | Thư mục phân cấp | Tham chiếu `document_folders(id)` |
| `file_format` | `VARCHAR(20)` | NULLABLE | Định dạng tệp | Với sách giáo khoa, bắt buộc là `PDF` |
| `content_markdown` | `TEXT` | NULLABLE | Nội dung số hóa dạng văn bản/OCR | Dùng cho tìm kiếm toàn văn hoặc AI đọc (nếu có) |
| `description` | `TEXT` | NULLABLE | Mô tả chi tiết sách, nhà xuất bản, tái bản | Đoạn văn bản mô tả ngắn |
| `created_at` | `TIMESTAMP` | NOT NULL | Thời điểm tạo bản ghi | `now()` |
| `updated_at` | `TIMESTAMP` | NOT NULL | Thời điểm cập nhật bản ghi gần nhất | `now()` |
| `deleted_at` | `TIMESTAMP` | NULLABLE | Thời điểm xóa mềm | `NULL` nếu đang hoạt động. Khác NULL = đã xóa mềm |

### 3.2. Bảng Khớp Trang Chi Tiết: `document_page_mappings`

Dùng khi sách có cấu trúc không tuyến tính (phần đầu đánh số La Mã `i, ii, iii`, có trang quảng cáo xen kẽ, phụ lục sau sách):

```sql
CREATE TABLE document_page_mappings (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES documents(id),
    pdf_page_number INT NOT NULL,
    book_page_label VARCHAR(30),        -- 'i', 'iv', '1', '2', 'Phụ lục 1'
    page_type VARCHAR(30) DEFAULT 'CONTENT', -- COVER, TABLE_OF_CONTENTS, CONTENT, APPENDIX, BLANK
    chapter_title VARCHAR(255),
    lesson_title VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP,
    CONSTRAINT uq_document_pdf_page UNIQUE (document_id, pdf_page_number)
);
CREATE INDEX idx_document_page_mappings_document ON document_page_mappings(document_id) WHERE deleted_at IS NULL;
```

### 3.3. Bảng Lưu Tiến Độ & Lịch Sử Hiệu Chuẩn: `textbook_mapping_progress`

```sql
CREATE TABLE textbook_mapping_progress (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    document_id BIGINT NOT NULL REFERENCES documents(id),
    pdf_page INT NOT NULL,
    pdf_anchor INT NOT NULL,
    book_anchor INT NOT NULL,
    zoom INT NOT NULL DEFAULT 100,
    thumb_page INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP,
    CONSTRAINT uq_textbook_mapping_progress_user_doc UNIQUE (user_id, document_id)
);
```

---

## 4. Mô Hình Toán Học Và Quy Tắc Hiệu Chuẩn Trang (Page Offset Calibration)

### 4.1. Công Thức Chuẩn Hóa
Thuật toán ánh xạ giữa số trang in vật lý (`bookPage`) và số trang tệp PDF (`pdfPage`) tuân theo công thức toán học xác định:

$$\mathbf{pdfPage} = \mathbf{bookPage} + (\mathbf{base\_page\_offset} - 1)$$

Trong đó:
- `bookPage`: Số trang in vật lý (printed book page) thể hiện bằng chữ số Ả Rập trong thân sách, bắt đầu từ trang 1 ($bookPage \ge 1$).
- `base_page_offset`: Chỉ số trang PDF (1-indexed) nơi xuất hiện trang sách in số 1 ($base\_page\_offset \ge 1$).
- `pdfPage`: Chỉ số trang thực tế của tệp PDF (1-indexed) cần điều hướng tới trình đọc ($1 \le pdfPage \le total\_pages$).

### 4.2. Ý Nghĩa 1-Indexed Semantics & Các Trường Hợp Thực Tế
Cả hệ thống PDF (PDF.js, Apache PDFBox) và số trang in trong sách giáo khoa Việt Nam đều hoạt động theo ngữ nghĩa **1-indexed** (không có trang 0).

1. **Trường hợp Khớp 1:1 Tuyệt Đối (`base_page_offset = 1`)**:
   - Tệp PDF được cắt sạch từ trang in số 1 trở đi (không có bìa, không có lời nói đầu, không có mục lục).
   - Khi $bookPage = 1 \implies pdfPage = 1 + (1 - 1) = 1$.
   - Khi $bookPage = 45 \implies pdfPage = 45 + (1 - 1) = 45$.
2. **Trường hợp Sách Tiêu Chuẩn Có Bìa & Mục Lục Đầu Sách (`base_page_offset > 1`)**:
   - Ví dụ: Cuốn *Toán 10 - Tập 1* có 1 trang bìa trước, 1 trang thông tin xuất bản, 2 trang lời nói đầu, và 2 trang mục lục (tổng cộng 6 trang đầu file PDF). Trang in nội dung số 1 thực sự bắt đầu ở trang PDF thứ 7.
   - Khi đó: $base\_page\_offset = 7$.
   - Học sinh cần đọc trang sách 1: $pdfPage = 1 + (7 - 1) = 7$.
   - Học sinh cần làm bài tập trang 20: $pdfPage = 20 + (7 - 1) = 26$.
   - Giáo viên giao bài trang 115: $pdfPage = 115 + (7 - 1) = 121$.

### 4.3. Quy Trình Hiệu Chuẩn (Calibration Workflow)
Admin thực hiện hiệu chuẩn thông qua giao diện Quản trị / Khớp trang:
1. **Hiệu chuẩn theo Mốc Trang 1 (Standard Calibration)**:
   - Admin mở tài liệu PDF trong trình duyệt xem trang.
   - Admin cuộn đến trang đầu tiên có in chữ số "1" dưới chân trang sách.
   - Admin đọc số trang PDF hiện tại của trình duyệt (ví dụ: Trang PDF số 14).
   - Admin nhập vào ô: *"Trang sách 1 nằm ở PDF page mấy?"* $\implies 14$.
   - Hệ thống lưu trực tiếp: `base_page_offset = 14`.
2. **Hiệu chuẩn Tổng Quát Theo Mốc Bất Kỳ (Arbitrary Anchor Calibration)**:
   - Nếu trang 1 bị rách, mất hoặc khó nhìn, Admin có thể chọn một trang bất kỳ có số rõ ràng, ví dụ trang sách $B_{anchor} = 15$ nằm ở trang PDF $P_{anchor} = 29$.
   - Công thức suy ra offset cơ sở:
     $$base\_page\_offset = P_{anchor} - B_{anchor} + 1 = 29 - 15 + 1 = 15$$
   - Khi áp dụng lại: Với trang sách 1, $pdfPage = 1 + (15 - 1) = 15$.
3. **Ưu Tiên Tra Cứu (Lookup Hierarchy)**:
   - Khi gọi `/open`, backend kiểm tra bảng `document_page_mappings` trước: nếu tồn tại bản ghi khớp chính xác cho trang yêu cầu thì sử dụng; nếu không có bản ghi khớp riêng lẻ, backend áp dụng công thức tuyến tính `resolvePdfPage`.

### 4.4. Điều Kiện Biên & Quy Tắc Kiểm Tra Tính Hợp Lệ (Boundary Conditions)
- $bookPage$ phải là số nguyên dương: $bookPage \ge 1$. Nếu $bookPage \le 0$, API trả về `400 Bad Request`.
- $base\_page\_offset$ phải là số nguyên dương: $base\_page\_offset \ge 1$. Mặc định là 1.
- Nếu $total\_pages$ đã được xác định:
  - $base\_page\_offset \le total\_pages$.
  - Nếu kết quả tính toán $pdfPage > total\_pages$: Hệ thống chặn bằng lỗi `400 Bad Request` ("Số trang vượt quá độ dài của sách") hoặc tự động clamp về trang cuối cùng $total\_pages$.
- Khi không truyền tham số `bookPage`: Mặc định $bookPage = 1$, kết quả trả về đúng trang $pdfPage = base\_page\_offset$.

---

## 5. Ma Trận Phân Quyền Vai Trò (RBAC Matrix)

Hệ thống MATH10 thực thi phân quyền đa tầng: lọc bảo vệ URL qua Spring Security Filter Chain, kiểm soát phương thức qua `@PreAuthorize`, và kiểm tra logic nghiệp vụ/chống IDOR trong Service Layer.

### 5.1. Bảng Ma Trận Phân Quyền Chi Tiết

| Chức Năng / Thao Tác | ADMIN | TEACHER | STUDENT | ANONYMOUS (Chưa Đăng Nhập) | Ghi Chú Bảo Mật |
|---|:---:|:---:|:---:|:---:|---|
| **Xem Danh Mục SGK Đã Xuất Bản** (`GET /api/textbooks`) | Cho phép | Cho phép | Cho phép | Từ chối (401) | HS chỉ nhận sách có `audience = STUDENT_ALLOWED` và `status = PUBLISHED` |
| **Xem Chi Tiết 1 Cuốn Sách** (`GET /api/textbooks/{id}`) | Cho phép | Cho phép | Cho phép* | Từ chối (401) | *HS bị từ chối (403) nếu sách là DRAFT, HIDDEN hoặc TEACHER_ONLY |
| **Mở Trình Đọc Sách & Tính Offset** (`GET /api/textbooks/{id}/open`) | Cho phép | Cho phép | Cho phép* | Từ chối (401) | *HS bị từ chối (403) nếu sách chưa xuất bản hoặc giới hạn GV |
| **Duyệt Danh Sách Quản Trị Sách** (`GET /api/admin/textbooks`) | Cho phép | Cho phép* | Từ chối (403) | Từ chối (401) | Thấy toàn bộ DRAFT, PUBLISHED, HIDDEN (*GV xem theo chính sách đọc) |
| **Tải Lên Sách Mới** (`POST /api/admin/textbooks`) | Cho phép | Từ chối (403) | Từ chối (403) | Từ chối (401) | Chỉ Admin; multipart file PDF $\le$ 500MB |
| **Cập Nhật Metadata & Offset** (`PUT /api/admin/textbooks/{id}`) | Cho phép | Từ chối (403) | Từ chối (403) | Từ chối (401) | Chỉ Admin; cập nhật tên, phân loại, tổng trang, basePageOffset |
| **Hiệu Chuẩn Nhanh Offset** (`PATCH /api/admin/textbooks/{id}/page-offset`) | Cho phép | Từ chối (403) | Từ chối (403) | Từ chối (401) | Chỉ Admin; truyền `pdfPageForBookPageOne` |
| **Xuất Bản Sách** (`PATCH /api/admin/textbooks/{id}/publish`) | Cho phép | Từ chối (403) | Từ chối (403) | Từ chối (401) | Chỉ Admin; ghi nhật ký `audit_logs` |
| **Ẩn Sách Khỏi Danh Mục** (`PATCH /api/admin/textbooks/{id}/hide`) | Cho phép | Từ chối (403) | Từ chối (403) | Từ chối (401) | Chỉ Admin; ghi nhật ký `audit_logs` |
| **Xóa Mềm Sách** (`DELETE /api/admin/textbooks/{id}`) | Cho phép | Từ chối (403) | Từ chối (403) | Từ chối (401) | Chỉ Admin; gán `deleted_at`, cascade `lesson_documents` |
| **Backfill Thumbnails Bìa Sách** (`POST /api/admin/documents/backfill-thumbnails`) | Cho phép | Từ chối (403) | Từ chối (403) | Từ chối (401) | Chỉ Admin |

### 5.2. Nguyên Tắc Bảo Mật Cốt Lõi
1. **Frontend Zero-Credential**: Không lưu trữ Supabase service key, S3 direct credential, hay token lưu trữ trên trình duyệt. Frontend chỉ nhận URL nội bộ `/api/documents/{id}/content` hoặc URL công khai có ký số từ backend.
2. **Ngăn Chặn IDOR (Insecure Direct Object References)**: Học sinh không thể đoán ID sách ở trạng thái `DRAFT` hoặc `HIDDEN` để gọi `/open`. Backend bắt buộc kiểm tra `doc.getStatus() == DocumentStatus.PUBLISHED` và `doc.getAudience() == DocumentAudience.STUDENT_ALLOWED`, nếu không đạt sẽ lập tức ném `AccessDeniedException` (HTTP 403).
3. **Toàn Vẹn Dữ Liệu Xóa Mềm**: Sách đã xóa mềm mang `deleted_at != null` được lọc tự động qua `@SQLRestriction("deleted_at IS NULL")`, mọi request truy cập ID đó đều trả về `404 Not Found`.

---

## 6. Đặc Tả Chi Tiết API Endpoints (API Specification & Contracts)

### 6.1. Phân Tích Hiện Trạng Định Tuyến (Route Path Analysis)
Khi đối chiếu tài liệu `MATH10_MASTER_PLAN.md` (Mục 3) và `ORIGINAL_REQUEST.md` với mã nguồn hiện tại, phát hiện kiến trúc định tuyến cần được chuẩn hóa như sau:

- **Tài liệu chuẩn (`MASTER_PLAN` & `ORIGINAL_REQUEST`)**:
  - Dành cho Client: `GET /api/textbooks`, `GET /api/textbooks/{id}`, `GET /api/textbooks/{id}/open`.
  - Dành cho Admin: `GET /api/admin/textbooks`, `POST /api/admin/textbooks`, `GET /api/admin/textbooks/{id}`, `PUT /api/admin/textbooks/{id}`, `PATCH /api/admin/textbooks/{id}/publish`, `PATCH /api/admin/textbooks/{id}/hide`, `DELETE /api/admin/textbooks/{id}`.
- **Mã nguồn hiện hành trong repo**:
  - Các endpoint được gắn tạm trong `DocumentController` dưới tiền tố `/api/documents/textbooks` và `AdminDocumentController` dưới tiền tố `/api/admin/documents/textbooks`.
  - Endpoint `/open` hiện tại dùng `@PostMapping("/textbooks/{id}/open")` trong khi đặc tả yêu cầu `GET /api/textbooks/{id}/open`.
- **Khuyến nghị đặc tả triển khai**:
  Hệ thống cần cung cấp các route chính thức chuẩn theo RESTful: `/api/textbooks/**` và `/api/admin/textbooks/**`. Đồng thời hỗ trợ alias hoặc tương thích ngược với các đường dẫn cũ `/api/documents/textbooks/**` và hỗ trợ cả method `GET` lẫn `POST` cho endpoint `/open`.

---

### 6.2. Chi Tiết Các Endpoint Khách Hàng (Public / Student / Teacher)

#### EP-01: Lấy danh mục Sách giáo khoa đã xuất bản
- **Đường dẫn**: `GET /api/textbooks` (Alias: `GET /api/documents/textbooks`)
- **Phân quyền**: Yêu cầu xác thực (`hasAnyRole('ADMIN', 'TEACHER', 'STUDENT')`).
- **Query Parameters**:
  - `gradeId` (int64, optional): Lọc theo ID khối lớp (ví dụ: lớp 10).
  - `subjectId` (int64, optional): Lọc theo ID môn học (ví dụ: môn Toán).
- **Quy tắc lọc dữ liệu**:
  - Bắt buộc `deleted_at IS NULL`.
  - Bắt buộc `doc_type IN ('SGK', 'SBT')`.
  - Bắt buộc `status = 'PUBLISHED'`.
  - Nếu vai trò là `STUDENT`: bắt buộc lọc thêm `audience = 'STUDENT_ALLOWED'`.
- **Response Thành Công (200 OK)**:
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách sách giáo khoa thành công",
  "data": [
    {
      "id": 101,
      "title": "Toán 10 - Tập 1 (Kết Nối Tri Thức)",
      "docType": "SGK",
      "audience": "STUDENT_ALLOWED",
      "gradeId": 1,
      "subjectId": 1,
      "status": "PUBLISHED",
      "totalPages": 128,
      "basePageOffset": 14,
      "fileUrl": "/api/documents/101/content",
      "thumbnailUrl": "https://storage.math10.vn/thumbnails/sgk10-t1.png",
      "createdAt": "2026-08-01T08:00:00Z"
    }
  ]
}
```
- **Error Responses**:
  - `401 Unauthorized`: Header `Authorization: Bearer <token>` bị thiếu hoặc không hợp lệ.

---

#### EP-02: Lấy thông tin chi tiết một cuốn sách
- **Đường dẫn**: `GET /api/textbooks/{id}` (Alias: `GET /api/documents/textbooks/{id}`)
- **Phân quyền**: Yêu cầu xác thực (`hasAnyRole('ADMIN', 'TEACHER', 'STUDENT')`).
- **Path Parameters**:
  - `id` (int64, required): ID tài liệu sách giáo khoa.
- **Quy tắc kiểm tra**:
  - Phải tồn tại và thuộc loại `SGK` hoặc `SBT`.
  - Nếu caller là `STUDENT`: sách phải ở trạng thái `PUBLISHED` và `audience = STUDENT_ALLOWED`.
- **Response Thành Công (200 OK)**:
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy chi tiết sách thành công",
  "data": {
    "id": 101,
    "title": "Toán 10 - Tập 1 (Kết Nối Tri Thức)",
    "docType": "SGK",
    "audience": "STUDENT_ALLOWED",
    "gradeId": 1,
    "subjectId": 1,
    "status": "PUBLISHED",
    "totalPages": 128,
    "basePageOffset": 14,
    "fileUrl": "/api/documents/101/content",
    "pageMappings": [
      {
        "pdfPage": 14,
        "bookPageLabel": "1",
        "pageType": "CONTENT",
        "chapterTitle": "Chương I: Mệnh đề và tập hợp",
        "lessonTitle": "Bài 1: Mệnh đề"
      }
    ]
  }
}
```
- **Error Responses**:
  - `401 Unauthorized`: Token không hợp lệ.
  - `403 Forbidden`: Caller là Học sinh nhưng sách chưa xuất bản hoặc chỉ dành cho Giáo viên.
  - `404 Not Found`: Không tìm thấy sách hoặc sách đã bị xóa mềm.

---

#### EP-03: Mở sách và giải mã trang PDF từ số trang sách in
- **Đường dẫn**: `GET /api/textbooks/{id}/open` (Hỗ trợ cả `POST` và alias `/api/documents/textbooks/{id}/open`)
- **Phân quyền**: Yêu cầu xác thực (`hasAnyRole('ADMIN', 'TEACHER', 'STUDENT')`).
- **Path Parameters**: `id` (int64, required)
- **Query Parameters**:
  - `bookPage` (int32, optional, mặc định = 1): Số trang in vật lý cần điều hướng tới.
- **Thuật toán xử lý**:
  1. Kiểm tra tồn tại và `docType IN ('SGK', 'SBT')` $\implies$ nếu không thấy ném 404.
  2. Kiểm tra `status == PUBLISHED` $\implies$ nếu không đạt ném 403 ("Sách này chưa được xuất bản").
  3. Nếu `role == 'STUDENT'` và `audience != 'STUDENT_ALLOWED'` $\implies$ ném 403 ("Bạn không có quyền đọc sách này").
  4. Nếu `bookPage < 1` $\implies$ ném 400 ("Số trang sách không hợp lệ").
  5. Tính $pdfPage = bookPage + (base\_page\_offset - 1)$.
  6. Nếu $total\_pages$ khả dụng và $pdfPage > total\_pages$ $\implies$ clamp về $total\_pages$ hoặc báo lỗi 400.
- **Response Thành Công (200 OK)**:
```json
{
  "success": true,
  "code": 200,
  "message": "Mở sách thành công",
  "data": {
    "documentId": 101,
    "title": "Toán 10 - Tập 1 (Kết Nối Tri Thức)",
    "fileUrl": "/api/documents/101/content",
    "pdfPage": 18,
    "totalPages": 128
  }
}
```
- **Error Responses**:
  - `400 Bad Request`: `bookPage` không phải số nguyên dương hợp lệ.
  - `401 Unauthorized`: Chưa đăng nhập.
  - `403 Forbidden`: Sách chưa xuất bản hoặc tài liệu không cho phép học sinh.
  - `404 Not Found`: Sách không tồn tại.

---

### 6.3. Chi Tiết Các Endpoint Quản Trị (Admin Endpoints)

#### EP-04: Danh sách toàn bộ SGK trong trang quản trị
- **Đường dẫn**: `GET /api/admin/textbooks` (Alias: `GET /api/admin/documents/textbooks`)
- **Phân quyền**: `hasRole('ADMIN')` (hoặc `hasAnyRole('ADMIN', 'TEACHER')`).
- **Mô tả**: Trả về toàn bộ SGK/SBT bao gồm cả bản nháp (`DRAFT`), đã ẩn (`HIDDEN`), và đã xuất bản (`PUBLISHED`).
- **Response (200 OK)**:
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách sách giáo khoa thành công",
  "data": [
    {
      "id": 101,
      "title": "Toán 10 - Tập 1 (Kết Nối Tri Thức)",
      "docType": "SGK",
      "audience": "STUDENT_ALLOWED",
      "gradeId": 1,
      "subjectId": 1,
      "status": "PUBLISHED",
      "totalPages": 128,
      "basePageOffset": 14,
      "fileUrl": "https://storage.math10.vn/textbooks/sgk10-t1.pdf",
      "thumbnailUrl": "https://storage.math10.vn/thumbnails/sgk10-t1.png",
      "createdAt": "2026-08-01T08:00:00Z"
    },
    {
      "id": 102,
      "title": "Toán 10 - Tập 2 (Chân Trời Sáng Tạo)",
      "docType": "SGK",
      "audience": "STUDENT_ALLOWED",
      "gradeId": 1,
      "subjectId": 1,
      "status": "DRAFT",
      "totalPages": 112,
      "basePageOffset": 1,
      "fileUrl": "https://storage.math10.vn/textbooks/sgk10-t2.pdf",
      "thumbnailUrl": null,
      "createdAt": "2026-09-12T10:00:00Z"
    }
  ]
}
```
- **Error Responses**:
  - `401 Unauthorized`: Chưa đăng nhập.
  - `403 Forbidden`: Người dùng có vai trò `STUDENT`.

---

#### EP-05: Tải lên SGK/SBT mới (Multipart Upload)
- **Đường dẫn**: `POST /api/admin/textbooks` (Alias: `POST /api/admin/documents/textbooks`)
- **Phân quyền**: `hasRole('ADMIN')`.
- **Content-Type**: `multipart/form-data`
- **Request Form Data**:
  - `title` (string, required): Tên sách.
  - `docType` (string, required): `SGK` hoặc `SBT`.
  - `audience` (string, required): `STUDENT_ALLOWED` hoặc `TEACHER_ONLY`.
  - `gradeId` (int64, optional): ID khối lớp.
  - `subjectId` (int64, optional): ID môn học.
  - `basePageOffset` (int32, optional, mặc định = 1): Offset ban đầu.
  - `file` (binary file, required): Tệp định dạng PDF, kích thước $\le$ 500MB.
- **Xử lý Backend**:
  1. Kiểm tra MIME tệp: Phải là `application/pdf`. Nếu sai ném 400 ("Sách giáo khoa chỉ hỗ trợ file PDF").
  2. Kiểm tra kích thước: Nếu > 500MB ném 400 ("File vượt 500MB...").
  3. Upload lên Storage service với prefix `textbooks/`.
  4. Trích xuất thumbnail trang 1 qua `pdfThumbnailService.renderFirstPagePng(..., 240)`.
  5. Lưu thực thể `Document` với `status = 'DRAFT'`, `fileFormat = 'PDF'`.
- **Response Thành Công (201 Created)**:
```json
{
  "success": true,
  "code": 201,
  "message": "Upload sách giáo khoa thành công",
  "data": {
    "id": 103,
    "title": "Sách Bài Tập Toán 10 - Tập 1",
    "docType": "SBT",
    "audience": "STUDENT_ALLOWED",
    "gradeId": 1,
    "subjectId": 1,
    "status": "DRAFT",
    "totalPages": 96,
    "basePageOffset": 1,
    "fileUrl": "https://storage.math10.vn/textbooks/sbt10-t1.pdf",
    "thumbnailUrl": "https://storage.math10.vn/thumbnails/sbt10-t1.png",
    "createdAt": "2026-09-13T07:00:00Z"
  }
}
```
- **Error Responses**:
  - `400 Bad Request`: Thiếu file, file rỗng, không phải PDF, quá dung lượng 500MB, hoặc docType không hợp lệ.
  - `401 Unauthorized`: Chưa xác thực.
  - `403 Forbidden`: Người dùng không có vai trò ADMIN.

---

#### EP-06: Cập nhật Metadata và Offset sách
- **Đường dẫn**: `PUT /api/admin/textbooks/{id}` (Alias: `PUT /api/admin/documents/textbooks/{id}`)
- **Phân quyền**: `hasRole('ADMIN')`.
- **Content-Type**: `application/json`
- **Request Body (`DocumentUpdateRequest`)**:
```json
{
  "title": "Toán 10 - Tập 1 (Kết Nối Tri Thức) - Tái Bản 2026",
  "docType": "SGK",
  "audience": "STUDENT_ALLOWED",
  "gradeId": 1,
  "subjectId": 1,
  "totalPages": 130,
  "basePageOffset": 14,
  "status": "DRAFT"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "code": 200,
  "message": "Cập nhật sách giáo khoa thành công",
  "data": {
    "id": 101,
    "title": "Toán 10 - Tập 1 (Kết Nối Tri Thức) - Tái Bản 2026",
    "docType": "SGK",
    "audience": "STUDENT_ALLOWED",
    "gradeId": 1,
    "subjectId": 1,
    "status": "DRAFT",
    "totalPages": 130,
    "basePageOffset": 14,
    "fileUrl": "https://storage.math10.vn/textbooks/sgk10-t1.pdf",
    "thumbnailUrl": "https://storage.math10.vn/thumbnails/sgk10-t1.png",
    "createdAt": "2026-08-01T08:00:00Z"
  }
}
```
- **Error Responses**:
  - `400 Bad Request`: Tiêu đề rỗng hoặc basePageOffset < 1.
  - `401 Unauthorized`: Chưa đăng nhập.
  - `403 Forbidden`: Không phải Admin.
  - `404 Not Found`: ID sách không tồn tại.

---

#### EP-07: Xuất bản sách (Publish Textbook)
- **Đường dẫn**: `PATCH /api/admin/textbooks/{id}/publish` (Alias: `PATCH /api/admin/documents/textbooks/{id}/publish`)
- **Phân quyền**: `hasRole('ADMIN')`.
- **Request Body**: Trống
- **Nghiệp vụ**: Đổi `status` thành `PUBLISHED`, ghi nhật ký kiểm toán `audit_logs` với thao tác `PUBLISH`.
- **Response (200 OK)**:
```json
{
  "success": true,
  "code": 200,
  "message": "Xuất bản sách thành công",
  "data": {
    "id": 103,
    "title": "Sách Bài Tập Toán 10 - Tập 1",
    "status": "PUBLISHED"
  }
}
```
- **Error Responses**:
  - `401 Unauthorized`: Chưa đăng nhập.
  - `403 Forbidden`: Không phải Admin.
  - `404 Not Found`: Không tìm thấy sách.

---

#### EP-08: Ẩn sách (Hide Textbook)
- **Đường dẫn**: `PATCH /api/admin/textbooks/{id}/hide` (Alias: `PATCH /api/admin/documents/textbooks/{id}/hide`)
- **Phân quyền**: `hasRole('ADMIN')`.
- **Request Body**: Trống
- **Nghiệp vụ**: Đổi `status` thành `HIDDEN`, ghi nhật ký kiểm toán `audit_logs` với thao tác `HIDE`. Sách lập tức biến mất khỏi danh mục học sinh và giáo viên.
- **Response (200 OK)**:
```json
{
  "success": true,
  "code": 200,
  "message": "Ẩn sách thành công",
  "data": {
    "id": 103,
    "title": "Sách Bài Tập Toán 10 - Tập 1",
    "status": "HIDDEN"
  }
}
```
- **Error Responses**:
  - `401 Unauthorized`: Chưa đăng nhập.
  - `403 Forbidden`: Không phải Admin.
  - `404 Not Found`: Không tìm thấy sách.

---

#### EP-09: Hiệu chuẩn nhanh Offset trang (Set Page Offset)
- **Đường dẫn**: `PATCH /api/admin/textbooks/{id}/page-offset` (Alias: `PATCH /api/admin/documents/textbooks/{id}/page-offset`)
- **Phân quyền**: `hasRole('ADMIN')`.
- **Content-Type**: `application/json`
- **Request Body (`TextbookPageOffsetRequest`)**:
```json
{
  "pdfPageForBookPageOne": 15
}
```
- **Ràng buộc kiểm tra**: `pdfPageForBookPageOne >= 1`.
- **Nghiệp vụ**: Cập nhật `base_page_offset = pdfPageForBookPageOne`.
- **Response (200 OK)**:
```json
{
  "success": true,
  "code": 200,
  "message": "Hiệu chuẩn offset trang thành công",
  "data": {
    "id": 101,
    "basePageOffset": 15
  }
}
```
- **Error Responses**:
  - `400 Bad Request`: `pdfPageForBookPageOne < 1`.
  - `401/403`: Không đủ quyền.
  - `404 Not Found`: Không tìm thấy sách.

---

#### EP-10: Xóa mềm sách giáo khoa (Soft Delete)
- **Đường dẫn**: `DELETE /api/admin/textbooks/{id}` (Alias: `DELETE /api/admin/documents/{id}`)
- **Phân quyền**: `hasRole('ADMIN')`.
- **Nghiệp vụ**: Gán `deleted_at = now()`, cascade soft-delete toàn bộ liên kết `lesson_documents`, ghi audit log.
- **Response (200 OK hoặc 204 No Content)**:
```json
{
  "success": true,
  "code": 200,
  "message": "Xóa sách giáo khoa thành công",
  "data": null
}
```
- **Error Responses**:
  - `401/403`: Không đủ quyền Admin.
  - `404 Not Found`: Không tìm thấy sách hoặc sách đã bị xóa từ trước.

---

## 7. Bảng Các Trường Hợp Biên & Tình Huống Đặc Biệt (Edge Cases Matrix)

| # | Tính Năng / Kịch Bản | Dữ Liệu Đầu Vào Cụ Thể | Hành Vi Quan Sát / Kỳ Vọng Hệ Thống |
|---|---|---|---|
| 1 | Offset chuẩn 1:1 | `base_page_offset = 1`, `bookPage = 1` | `pdfPage = 1 + (1 - 1) = 1`. Mở đúng trang đầu tiên của PDF |
| 2 | Offset lệch trang lớn | `base_page_offset = 15`, `bookPage = 10` | `pdfPage = 10 + (15 - 1) = 24`. Mở chính xác trang 24 trong tệp PDF |
| 3 | Khuyết thiếu tham số `bookPage` | `bookPage = null` hoặc không truyền | Mặc định coi `bookPage = 1`, trả về `pdfPage = base_page_offset` |
| 4 | Trang sách bằng 0 hoặc số âm | `bookPage = 0` hoặc `bookPage = -5` | `400 Bad Request`: "Số trang sách phải lớn hơn hoặc bằng 1" |
| 5 | Trang sách vượt quá tổng trang | `bookPage = 500` trong khi `totalPages = 120` | Hệ thống hoặc trả về `400 Bad Request` ("Số trang vượt quá độ dài tài liệu") hoặc clamp về `120` |
| 6 | Offset trang không hợp lệ | `pdfPageForBookPageOne = 0` hoặc `-2` | `400 Bad Request`: "Offset trang PDF phải lớn hơn hoặc bằng 1" |
| 7 | Truy cập sách chưa xuất bản | Học sinh gọi `/open` với sách có `status = DRAFT` | `403 Forbidden`: "Sách này chưa được xuất bản" |
| 8 | Truy cập sách đang bị ẩn | Học sinh gọi `/open` với sách có `status = HIDDEN` | `403 Forbidden`: "Sách này chưa được xuất bản" |
| 9 | Học sinh mở sách của giáo viên | Học sinh gọi `/open` với sách `audience = TEACHER_ONLY` | `403 Forbidden`: "Bạn không có quyền đọc sách này" |
| 10 | Giáo viên mở sách của giáo viên | Giáo viên gọi `/open` với sách `audience = TEACHER_ONLY` | `200 OK`: Giáo viên có quyền đọc tài liệu sư phạm |
| 11 | Gọi ID sách không tồn tại | `id = 999999` | `404 Not Found`: "Không tìm thấy sách giáo khoa" |
| 12 | Sách đã bị xóa mềm | Sách có `deleted_at IS NOT NULL` | `@SQLRestriction` chặn truy vấn, ném `404 Not Found` |
| 13 | File upload không phải định dạng PDF | Tệp DOCX, XLSX, PNG hoặc MP4 gửi lên `/api/admin/textbooks` | `400 Bad Request`: "Sách giáo khoa chỉ hỗ trợ file PDF" |
| 14 | File upload vượt quá 500MB | Tệp PDF kích thước 520MB | `400 Bad Request`: "File vượt 500MB (hiện 520MB). Vui lòng nén PDF..." |
| 15 | PDF scan bị lỗi sinh Thumbnail | File PDF hợp lệ nhưng font/hình ảnh bìa không thể render | Bắt exception tại `PdfThumbnailService`, ghi log cảnh báo, đặt `thumbnailUrl = null`, vẫn lưu sách thành công không làm hỏng request upload |
| 16 | Xuất bản sách lặp lại (Idempotency) | Sách đang `PUBLISHED` tiếp tục nhận request `PATCH /publish` | `200 OK` an toàn, trạng thái giữ nguyên `PUBLISHED`, ghi log audit |
| 17 | Ẩn sách lặp lại (Idempotency) | Sách đang `HIDDEN` tiếp tục nhận request `PATCH /hide` | `200 OK` an toàn, trạng thái giữ nguyên `HIDDEN` |
| 18 | Người dùng chưa đăng nhập | Gửi request không có Header `Authorization` | Filter chain chặn ngay từ đầu, trả về `401 Unauthorized` |
| 19 | Học sinh gọi API quản trị | Token vai trò `STUDENT` gọi `POST/PUT/PATCH/DELETE` tới `/api/admin/textbooks/**` | Method security chặn trước khi vào Controller, trả về `403 Forbidden` |

---

## 8. Tiêu Chí Nghiệm Thu & Phương Pháp Kiểm Thử (Acceptance Criteria & Verification)

### 8.1. Kiểm Tra Backend & Cơ Sở Dữ Liệu
- [ ] **Flyway Migration & Hibernate Schema Validation**:
  - Khởi động Spring Boot với cấu hình `spring.jpa.hibernate.ddl-auto=validate`.
  - Mọi cột (`status`, `subject_id`, `total_pages`, `base_page_offset`, `thumbnail_url`) và các bảng liên quan (`documents`, `document_page_mappings`, `textbook_mapping_progress`) đều khớp cấu trúc 100%, không phát sinh lỗi validation khởi động.
- [ ] **Bảo Mật Endpoint & RBAC**:
  - Gọi `/api/admin/textbooks`, `/api/admin/textbooks/{id}`, `/api/admin/textbooks/{id}/publish`, `/api/admin/textbooks/{id}/hide`, `DELETE /api/admin/textbooks/{id}` không có token $\implies$ Nhận `401 Unauthorized`.
  - Gọi các endpoint trên bằng token `STUDENT` $\implies$ Nhận `403 Forbidden`.
  - Gọi các endpoint trên bằng token `ADMIN` $\implies$ Thực thi thành công (200/201/204).
- [ ] **Logic Mở Sách & Ánh Xạ Offset**:
  - `GET /api/textbooks`: Chỉ trả về sách có `status = PUBLISHED`. Với tài khoản học sinh, chỉ trả về sách có `audience = STUDENT_ALLOWED`.
  - `GET /api/textbooks/{id}/open?bookPage={n}`: Tính toán chính xác $pdfPage = n + (base\_page\_offset - 1)$ và trả về đúng URL xem tệp.
- [ ] **Toàn Bộ Suite Test Backend**:
  - Chạy `mvn clean test` đạt 0 lỗi (Zero failures/errors).

### 8.2. Kiểm Tra Frontend & Giao Diện
- [ ] **Biên Dịch & Linting**:
  - Chạy `npm run build` hoàn thành thành công với 0 lỗi TypeScript compilation.
  - Chạy `npm run lint` hoàn thành với 0 lỗi cảnh báo nghiêm trọng.
- [ ] **Trải Nghiệm Người Dùng (UX/UI)**:
  - **Admin**:
    - Menu quản trị hiển thị mục *Sách giáo khoa*.
    - Bảng danh sách hiển thị ảnh bìa, tên sách, tập, số trang, huy hiệu trạng thái (Đã xuất bản / Bản nháp / Đang ẩn), các nút Xuất bản, Ẩn, Xem sách, Xóa.
    - Modal tải lên SGK hỗ trợ chọn file PDF và nhập tên sách.
  - **Giáo viên & Học sinh**:
    - Menu chính có tab *Sách giáo khoa*.
    - Hiển thị danh sách card sách với ảnh bìa, tên, môn học, khối lớp, nút *Đọc sách*.
    - Trình đọc sách cho phép nhập số trang sách in (`bookPage`), nhấn nút chuyển trang và nhảy đến trang PDF tương ứng trong trình xem `PdfViewer`.

### 8.3. Kịch Bản Kiểm Thử Tự Động Đầu-Cuối (Staging E2E Script: `scripts/staging-textbook-e2e.ps1`)
Kịch bản PowerShell chạy trên môi trường Staging/Local thực thi tuần tự các bước:
1. **Khởi tạo**: Đăng nhập lấy Bearer token cho Admin, Teacher, Student.
2. **Kiểm tra Unauthenticated & Unauthorized**:
   - Gọi `GET /api/admin/textbooks` không token $\implies$ Kỳ vọng 401.
   - Gọi `POST /api/admin/textbooks` bằng Student token $\implies$ Kỳ vọng 403.
3. **Tạo SGK Mới (Admin Multipart Upload)**:
   - Admin upload file PDF mẫu với `basePageOffset = 14`, `title = "E2E Test SGK Toan 10"`, `docType = SGK`, `audience = STUDENT_ALLOWED`.
   - Kiểm tra mã trả về `201 Created`, trạng thái sách là `DRAFT`.
4. **Kiểm tra Cách Ly Trạng Thái Draft**:
   - Student gọi `GET /api/textbooks` $\implies$ Khẳng định cuốn sách mới tạo KHÔNG xuất hiện trong danh sách.
   - Student gọi `GET /api/textbooks/{id}/open` $\implies$ Kỳ vọng nhận lỗi `403 Forbidden` ("Sách này chưa được xuất bản").
5. **Admin Hiệu Chuẩn Offset & Xuất Bản**:
   - Admin gọi `PATCH /api/admin/textbooks/{id}/publish` $\implies$ Nhận `200 OK`, trạng thái chuyển thành `PUBLISHED`.
6. **Học Sinh Đọc Sách & Kiểm Tra Offset**:
   - Student gọi `GET /api/textbooks` $\implies$ Sách đã xuất hiện trong danh mục.
   - Student gọi `GET /api/textbooks/{id}/open?bookPage=5` $\implies$ Kiểm tra kết quả `data.pdfPage == 18` (vì $5 + (14 - 1) = 18$).
   - Student gọi `GET /api/textbooks/{id}/open` (không tham số) $\implies$ Kiểm tra kết quả `data.pdfPage == 14`.
7. **Ẩn Sách & Xóa Mềm**:
   - Admin gọi `PATCH /api/admin/textbooks/{id}/hide` $\implies$ Trạng thái thành `HIDDEN`.
   - Student gọi lại `GET /api/textbooks/{id}/open` $\implies$ Nhận `403 Forbidden`.
   - Admin gọi `DELETE /api/admin/textbooks/{id}` $\implies$ Nhận 200/204.
   - Mọi vai trò gọi `GET /api/textbooks/{id}` $\implies$ Nhận `404 Not Found`.
8. **Đánh Giá**: 100% assertions thành công.
