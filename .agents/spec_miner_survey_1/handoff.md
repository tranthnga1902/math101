# BÁO CÁO BÀN GIAO (HANDOFF REPORT) — SPECIFICATION MINER SURVEY

**Mã phân công**: `spec_miner_survey_1`  
**Vai trò**: Specification & Requirements Miner  
**Thư mục làm việc**: `c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/.agents/spec_miner_survey_1/`  
**Người nhận**: Parent Agent (`50a935d1-4f71-4466-94a3-0d6d3d36d038`)  
**Thời điểm hoàn tất**: 2026-09-13T07:04:00Z  

---

## 1. Quan Sát (Observation)

### 1.1. Nguồn Yêu Cầu Gốc & Tài Liệu Chỉ Đạo
- **File**: `c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/.agents/ORIGINAL_REQUEST.md`
  - Dòng 14-22: Yêu cầu R1 (Admin quản lý metadata, upload, publish, hide, soft delete, offset), R2 (Teacher & Student duyệt sách theo grade/subject, mở sách và nhảy trang theo công thức `pdfPage = bookPage + (base_page_offset - 1)`), R3 (Phân quyền RBAC nghiêm ngặt, backend REST API, Flyway migration với soft delete).
  - Dòng 26-29: Tiêu chí nghiệm thu backend yêu cầu rõ các endpoint `/api/admin/textbooks`, `/api/admin/textbooks/{id}`, `/api/admin/textbooks/{id}/publish`, `/api/admin/textbooks/{id}/hide`, và catalog endpoints `GET /api/textbooks`, `GET /api/textbooks/{id}/open`.
  - Dòng 37: Yêu cầu script kiểm thử E2E tự động `scripts/staging-textbook-e2e.ps1`.
- **File**: `c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/MATH10_MASTER_PLAN.md`
  - Dòng 75-159 (Mục 3: "Danh Mục Sách Giáo Khoa"): Định nghĩa đây là **kho sách riêng** tách khỏi tài liệu bài học thông thường.
  - Dòng 81-86: Mô hình dữ liệu mở rộng bảng `documents` với `status` (`DRAFT`, `PUBLISHED`, `HIDDEN`), `subject_id`, `total_pages`, `base_page_offset` (mặc định 1).
  - Dòng 113: Công thức chuyển đổi: `pdfPage = bookPage + (basePageOffset - 1)`.
  - Dòng 120-130: Bảng API SGK định nghĩa các phương thức: `GET /api/textbooks`, `GET /api/textbooks/{id}`, `GET /api/textbooks/{id}/open`, `GET /api/admin/textbooks`, `POST /api/admin/textbooks`, `PUT /api/admin/textbooks/{id}`, `PATCH /api/admin/textbooks/{id}/publish`, `PATCH /api/admin/textbooks/{id}/hide`.
  - Dòng 133-140: Cấu trúc response mẫu của `/api/textbooks/{id}/open`: `{"documentId": 1, "title": "SGK Toán 10 - Tập 1", "fileUrl": "https://...", "pdfPage": 14, "totalPages": 100}`.

### 1.2. Cơ Sở Dữ Liệu & Flyway Migrations Hiện Hữu
- **`V202607291700__create_documents_and_lesson_documents.sql`**: Khởi tạo bảng `documents` với các cột `id`, `title`, `doc_type`, `audience`, `file_url`, `grade_id`, `created_at`, `updated_at`, `deleted_at`.
- **`V202607310000__add_textbook_fields_and_page_mapping.sql`**: Thêm vào bảng `documents` các cột `status varchar(30) default 'DRAFT'`, `subject_id bigint references subjects(id)`, `total_pages int`, `base_page_offset int default 1`. Đồng thời tạo bảng `document_page_mappings` với unique constraint `(document_id, pdf_page_number)`.
- **`V202607311800__add_document_thumbnail_url.sql`**: Thêm cột `thumbnail_url varchar(1024)` lưu ảnh bìa trang 1 render từ PDF.
- **`V202608040500__create_textbook_mapping_progress.sql`**: Tạo bảng `textbook_mapping_progress` và `textbook_mapping_history` lưu trạng thái và lịch sử hiệu chuẩn trang.

### 1.3. Mã Nguồn Backend Hiện Hữu
- **`Document.java`**: Khai báo `@SQLRestriction("deleted_at IS NULL")`, kế thừa `BaseEntity` (có `markDeleted()`), ánh xạ đầy đủ các cột `status`, `basePageOffset`, `totalPages`, `thumbnailUrl`, `docType`, `audience`, `subject`.
- **`DocumentServiceImpl.java`**:
  - Dòng 768-816 (`uploadTextbook`): Kiểm tra PDF, kích thước $\le$ 500MB, upload storage, sinh thumbnail qua `pdfThumbnailService.renderFirstPagePng(..., 240)`.
  - Dòng 820-835 (`listTextbooks`): Lọc theo `TEXTBOOK_TYPES` (`SGK`, `SBT`) và `DocumentStatus.PUBLISHED`. *(Lưu ý: hiện chưa lọc `audience = STUDENT_ALLOWED` khi caller là Học sinh)*.
  - Dòng 876-890 (`openTextbook`): Kiểm tra status `PUBLISHED` (dòng 881-883), kiểm tra quyền học sinh (dòng 884-887), gọi `resolvePdfPage(id, bookPage != null ? bookPage : 1, doc.getBasePageOffset())`.
  - Dòng 970-982 (`resolvePdfPage`): Áp dụng chuẩn công thức `basePageOffset + bookPage - 1`.
  - Dòng 919-943 (`publishTextbook`, `hideTextbook`): Cập nhật trạng thái và ghi audit trail.
  - Dòng 359-368 (`deleteDocument`): Gán `deleted_at` (soft delete) và cascade xóa mềm `lesson_documents`.
- **Định tuyến Controller Backend Hiện Hành**:
  - `AdminDocumentController.java` (dòng 31): Đặt `@RequestMapping("/api/admin/documents")`, các method có `@GetMapping("/textbooks")`, `@PostMapping("/textbooks")`, `@PutMapping("/textbooks/{id}")`, `@PatchMapping("/textbooks/{id}/publish")`, `@PatchMapping("/textbooks/{id}/hide")`. $\implies$ Các URL thực tế hiện tại là `/api/admin/documents/textbooks/**`.
  - `DocumentController.java` (dòng 27): Đặt `@RequestMapping("/api/documents")`, các method có `@GetMapping("/textbooks")`, `@GetMapping("/textbooks/{id}")`, `@PostMapping("/textbooks/{id}/open")`. $\implies$ Các URL thực tế hiện tại là `/api/documents/textbooks/**`.

### 1.4. Mã Nguồn Frontend Hiện Hữu
- **`src/api.ts`**:
  - Dòng 870-899: Định nghĩa các hàm `getTextbooks`, `getTextbook`, `openTextbook`, `openTextbookInBrowser`, `getAdminTextbooks`, `uploadTextbook`, `updateTextbook`, `publishTextbook`, `hideTextbook`.
  - Dòng 877: `openTextbook` đang gọi POST `/documents/textbooks/{id}/open`.
  - Dòng 880-882: `openTextbookInBrowser` gọi `openDocumentViewer({ session, fileUrl: info.fileUrl, title: info.title, startPage: info.pdfPage })`.
- **`src/components/DocumentViewerHost.tsx` & `PdfViewer.tsx`**:
  - Trình đọc `PdfViewer` nhận prop `initialPage` từ `startPage` của `DocumentViewerHost`, sau đó truyền vào hook `useScrollPages` (dòng 74), cuộn và nhảy thẳng đến trang PDF được chỉ định.
- **`src/admin/TextbookManagement.tsx`**: Quản trị SGK cho Admin với bảng danh sách, xem trước thumbnail, nút Xuất bản, Xóa, Xem sách trong admin reader.
- **`src/teacher/TextbookBrowser.tsx` & `src/student/StudentExperience.tsx`**: Danh mục hiển thị card sách, giao diện nhập trang sách in vật lý để mở sách.

---

## 2. Chuỗi Suy Luận Logic (Logic Chain)

1. **Từ Quan sát 1.1 và 1.3**: Tiêu chí nghiệm thu trong `ORIGINAL_REQUEST.md` (dòng 27-28, 37) và đặc tả trong `MATH10_MASTER_PLAN.md` (dòng 120-130) quy định rõ ràng rằng các endpoint phục vụ client và script nghiệm thu phải là `/api/textbooks/**` và `/api/admin/textbooks/**`.
2. **Từ Quan sát 1.3**: Hiện tại backend chỉ mới ánh xạ `/api/admin/documents/textbooks/**` và `/api/documents/textbooks/**`. Nếu chạy test E2E hoặc kiểm thử độc lập đối với các endpoint `/api/admin/textbooks` và `/api/textbooks`, server sẽ trả về `404 Not Found`. Do đó, cần thiết lập route chính thức `/api/textbooks/**` và `/api/admin/textbooks/**` (có thể bằng Controller riêng biệt hoặc route alias đa tiền tố), đồng thời giữ tương thích ngược với `/api/documents/textbooks/**`.
3. **Từ Quan sát 1.1, 1.3 và 1.4**: Phương thức của endpoint `/open`:
   - `ORIGINAL_REQUEST.md` và `MASTER_PLAN` ghi `GET /api/textbooks/{id}/open`.
   - `DocumentController.java` và `src/api.ts` hiện tại lại dùng `POST /api/documents/textbooks/{id}/open`.
   - Suy luận: Backend nên hỗ trợ cả `GET` và `POST` trên endpoint `/open` để vừa đáp ứng đúng 100% Acceptance Criteria của tài liệu chuẩn, vừa không làm gãy các lời gọi hiện tại từ frontend.
4. **Từ Quan sát 1.3**: Trong `DocumentServiceImpl.java`, phương thức `listTextbooks(gradeId, subjectId)` hiện chỉ kiểm tra `status = PUBLISHED` mà chưa lọc `audience = STUDENT_ALLOWED` khi người dùng đăng nhập là Học sinh (`STUDENT`). Trong khi đó, theo nguyên tắc bảo mật và đặc tả dòng 72 của Master Plan: *"Backend bắt buộc lọc: Student chỉ nhận tài liệu STUDENT_ALLOWED"*. Suy luận: Cần bổ sung điều kiện lọc `audience` theo vai trò trong danh mục để chống rò rỉ siêu dữ liệu sách sư phạm.
5. **Từ Quan sát 1.1 và 1.3**: Công thức hiệu chuẩn $pdfPage = bookPage + (base\_page\_offset - 1)$ đã được triển khai chính xác tại dòng 970-982 của `DocumentServiceImpl.java` và được kiểm chứng qua toán học 1-indexed. Khi $bookPage = 1$, $pdfPage = base\_page\_offset$. Khi nhập số trang $bookPage$, kết quả luôn cộng thêm độ lệch $(base\_page\_offset - 1)$.
6. **Từ Quan sát 1.4**: Frontend đã có sẵn hạ tầng render PDF (`PdfViewer`, `DocumentViewerHost`, `PdfScrollPage`, `useScrollPages`) hỗ trợ nhảy trang qua `initialPage = info.pdfPage`.

---

## 3. Cảnh Báo & Điểm Cần Lưu Ý (Caveats)

1. **Dung Lượng Tệp & Ràng Buộc Storage**:
   - `MATH10_MASTER_PLAN.md` lưu ý Supabase Storage gói miễn phí có giới hạn file $\le$ 50MB, nhưng trong `DocumentServiceImpl.java` giới hạn đang để là 500MB (phù hợp Cloudflare R2 / S3 hiện tại). Cần lưu ý cấu hình `spring.servlet.multipart.max-file-size=500MB` trên server staging.
2. **Kịch Bản E2E Script Chưa Có Sẵn**:
   - Tệp `scripts/staging-textbook-e2e.ps1` được yêu cầu trong nghiệm thu hiện chưa tồn tại trong repo. Script này cần được tạo mới bám sát đặc tả 8 bước đã mô tả trong mục 8.3 của báo cáo `spec_report.md`.
3. **Phân Biệt Kho Sách Riêng vs Tài Liệu Bài Học**:
   - Sách giáo khoa trong bảng `documents` dùng chung cấu trúc với tài liệu học tập thông thường nhưng có thuộc tính nhận diện: `doc_type IN ('SGK', 'SBT')`. Khi truy vấn sách, luôn phải kẹp điều kiện loại tài liệu này để tránh lẫn lộn với `KHBD`, `VIDEO` hay giáo án riêng của giáo viên.

---

## 4. Kết Luận (Conclusion)

1. Toàn bộ yêu cầu nghiệp vụ, mô hình dữ liệu, công thức hiệu chuẩn trang, ma trận RBAC và hợp đồng API của phân hệ Sách Giáo Khoa đã được khai phá, tổng hợp và tài liệu hóa đầy đủ, chi tiết tại:
   `c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/.agents/spec_miner_survey_1/spec_report.md`.
2. Kiến trúc giải pháp kỹ thuật đáp ứng hoàn toàn yêu cầu của `ORIGINAL_REQUEST.md` và `MATH10_MASTER_PLAN.md`.
3. Điểm then chốt cần thực hiện khi bước vào triển khai:
   - Chuẩn hóa định tuyến backend: Bổ sung controller hoặc alias cho `/api/textbooks` và `/api/admin/textbooks`, hỗ trợ method `GET` cho `/open`.
   - Bổ sung bộ lọc `audience = STUDENT_ALLOWED` khi Student truy vấn `GET /api/textbooks`.
   - Cung cấp endpoint xóa mềm chuẩn `DELETE /api/admin/textbooks/{id}`.
   - Xây dựng kịch bản kiểm thử tự động `scripts/staging-textbook-e2e.ps1`.

---

## 5. Phương Pháp Kiểm Chứng Độc Lập (Verification Method)

Người nhận bàn giao có thể kiểm chứng độc lập các kết quả khảo sát bằng các bước sau:

1. **Kiểm tra Báo cáo Đặc tả**:
   - Đọc trực tiếp tệp `c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/.agents/spec_miner_survey_1/spec_report.md`.
2. **Kiểm tra Cấu trúc Database & Flyway**:
   - Kiểm tra tệp migration: `math10-backend/src/main/resources/db/migration/V202607310000__add_textbook_fields_and_page_mapping.sql` và `V202607311800__add_document_thumbnail_url.sql`.
   - Xác nhận sự tồn tại của các cột `status`, `subject_id`, `total_pages`, `base_page_offset`, `thumbnail_url`.
3. **Kiểm tra Logic Ánh Xạ Trang Trong Codebase**:
   - Mở tệp `math10-backend/src/main/java/com/math10/documents/service/impl/DocumentServiceImpl.java`, đối chiếu các dòng 876-890 và dòng 970-982 với công thức $pdfPage = bookPage + (base\_page\_offset - 1)$.
4. **Kiểm tra Build & Test Hiện Hữu Của Dự Án**:
   - Kiểm tra frontend build: `npm run build` tại thư mục gốc của dự án.
   - Kiểm tra backend test: `mvn test -Dtest=PermissionMatrixTest,AuditTrailTest` trong thư mục `math10-backend`.
