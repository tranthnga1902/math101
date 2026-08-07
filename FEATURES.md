# TÀI LIỆU ĐẶC TẢ TÍNH NĂNG HỆ THỐNG MATH10

## 0. Ràng Buộc Hệ Thống

- Frontend: React, Vite, TypeScript, Tailwind/Shadcn.
- Backend: Java 17, Spring Boot 3, Spring Security, Spring Data JPA, Flyway.
- Database: Supabase PostgreSQL cloud.
- Storage: Supabase Storage cho tài liệu PDF/DOC/DOCX, backend gọi bằng REST API qua `WebClient`, không dùng Supabase SDK.
- React không truy cập Supabase trực tiếp và không chứa service-role key.
- Mọi thay đổi schema phải đi qua Flyway migration.
- Dữ liệu dùng soft delete bằng `deleted_at`.
- Không dùng Drag & Drop trong MVP. Mọi thao tác sắp xếp dùng nút `Lên`/`Xuống`.
- Nội dung Toán lưu dạng HTML/Markdown kết hợp LaTeX, frontend render bằng KaTeX.

## 1. Tài Khoản Và Phân Quyền

- Đăng nhập bằng username/email và mật khẩu.
- Sau khi đăng nhập, hệ thống tự điều hướng theo vai trò `ADMIN`, `TEACHER`, `STUDENT`; người dùng không phải chọn loại tài khoản.
- Hỗ trợ đăng xuất và đổi mật khẩu.
- Admin reset mật khẩu cho mọi tài khoản.
- Teacher reset mật khẩu cho học sinh thuộc lớp mình.
- Backend kiểm soát phân quyền bằng `@PreAuthorize` và kiểm tra quyền sở hữu trong service để chống IDOR.

## 2. Admin

- Quản lý người dùng: tạo, sửa, khóa/mở khóa, soft delete, tìm kiếm, lọc vai trò/trạng thái.
- Quản lý cấu hình: môn học, khối lớp, chủ đề, dạng toán.
- Dashboard thống kê người dùng, giáo viên, học sinh, lớp học, khóa học và bài toán.
- Xem nhật ký audit log.
- Quản lý thư viện tài liệu gốc Toán 10:
  - Upload PDF/DOC/DOCX lên Supabase Storage.
  - Lưu metadata vào bảng `documents`.
  - Sửa tên, loại tài liệu và quyền truy cập.
  - Xóa mềm tài liệu.

## 3. Giáo Viên

- Dashboard giáo viên hiển thị lớp đang dạy, cảnh báo học sinh tiến độ thấp và phiếu bài tập gần đây.
- Quản lý lớp học, thêm/gỡ học sinh, xem tiến độ từng học sinh.
- Quản lý khóa học, chương, bài học.
- Lesson Builder:
  - Soạn nội dung bài học HTML/Markdown/LaTeX.
  - Gắn video/link/file phụ qua tài nguyên bài học.
  - Gắn phiếu bài tập vào cuối bài học.
  - Gắn tài liệu từ thư viện gốc vào bài học.
  - Sửa ghi chú tài liệu, đánh dấu bắt buộc/tham khảo, gỡ tài liệu khỏi bài.
  - Sắp xếp chương, bài, tài nguyên và tài liệu bằng nút `Lên`/`Xuống`.
- Ngân hàng bài toán:
  - CRUD chủ đề, dạng toán, bài toán.
  - Bài toán có loại `PRACTICE` hoặc `EXAM`.
  - `PRACTICE` có QR, gợi ý, lời giải và bài tương tự.
  - `EXAM` không sinh QR và không có gợi ý/lời giải.

## 4. Học Sinh

- Xem dashboard học tập mobile-first.
- Xem khóa học, chương, bài học được giao theo phân quyền.
- Trong trang bài học:
  - Xem video, nội dung bài giảng, công thức Toán.
  - Xem tài liệu học tập dạng step-by-step theo thứ tự giáo viên sắp xếp.
  - Mỗi tài liệu hiển thị icon, tên, ghi chú giáo viên, trạng thái bắt buộc/tham khảo và nút `Xem tài liệu`.
  - Chỉ thấy tài liệu có `audience = STUDENT_ALLOWED`.
  - Xem phiếu bài tập cuối bài nếu giáo viên đã gắn.
  - Đánh dấu hoàn thành bài học sau khi đã mở bài đủ thời gian tối thiểu.
- Làm phiếu bài tập được giao và đánh dấu hoàn thành.

## 5. Tài Liệu Học Tập

Triết lý chính: tài liệu chỉ là nguyên liệu, bài học mới là trung tâm quản lý. Học sinh không truy cập trực tiếp kho file; học sinh chỉ thấy tài liệu thông qua bài học do giáo viên thiết lập.

### Bảng dữ liệu

- `documents`: `id`, `title`, `doc_type`, `audience`, `file_url`, `grade_id`, `created_at`, `deleted_at`.
- `lesson_documents`: `id`, `lesson_id`, `document_id`, `is_required`, `teacher_note`, `display_order`, `created_at`, `deleted_at`.
- `lessons`: hệ thống hiện dùng `order_index` cho thứ tự bài học.

### API

- `GET /api/documents`: Admin/Teacher lấy thư viện tài liệu.
- `POST /api/admin/documents`: Admin upload tài liệu lên Supabase Storage và tạo record DB.
- `PUT /api/admin/documents/{id}`: Admin sửa metadata tài liệu.
- `DELETE /api/admin/documents/{id}`: Admin xóa mềm tài liệu.
- `GET /api/lessons/{lessonId}/documents`: lấy tài liệu trong bài học; Student chỉ nhận `STUDENT_ALLOWED`.
- `POST /api/lessons/{lessonId}/documents`: Teacher/Admin gắn tài liệu vào bài học.
- `PUT /api/lessons/{lessonId}/documents/{id}`: Teacher/Admin sửa ghi chú và trạng thái bắt buộc.
- `DELETE /api/lessons/{lessonId}/documents/{id}`: Teacher/Admin gỡ tài liệu khỏi bài học.
- `PATCH /api/lessons/{lessonId}/documents/{id}/move`: Teacher/Admin sắp xếp `UP`/`DOWN`.

## 6. Phiếu Bài Tập Và QR

- Giáo viên chọn bài `PRACTICE` để tạo phiếu bài tập.
- Phiếu có cấu hình tên, số cột, hiện QR, hiện ô họ tên/lớp.
- In/Xuất PDF thực hiện phía frontend bằng `react-to-print` và CSS print.
- QR dùng route public `/q/{qr_slug}`.
- Trang QR hiển thị đề bài, gợi ý, lời giải từng bước và bài tương tự.

## 7. Ngoài Phạm Vi MVP

- Thi trực tuyến đầy đủ.
- Chấm điểm tự động.
- OCR trích xuất đề từ PDF.
- AI sinh lời giải.
- Drag & Drop.
- Quên mật khẩu qua email.
- Import Excel.
- Microservices, Redis, Kafka, Docker trong môi trường dev.
