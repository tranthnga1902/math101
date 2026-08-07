# Kế Hoạch Phát Triển MATH10 MVP

Phiên bản tài liệu: 1.3  
Kiến trúc: Modular Monolith  
Frontend: React + Vite + TypeScript  
Backend: Java + Spring Boot  
Database: Supabase PostgreSQL cloud  
Thời gian đề xuất: 10-12 tuần  
Quy mô đội: 3 người

## Kiến Trúc Chính Thức

```text
React + Vite + TypeScript
        ->
Spring Boot REST API
        ->
Supabase PostgreSQL
```

Supabase được dùng làm PostgreSQL cloud và Supabase Storage cho tài liệu học tập. Không dùng Supabase Auth, không đưa service-role key ra frontend, không truy cập database trực tiếp từ React. Backend Spring Boot gọi Supabase Storage bằng REST API.

## Công Nghệ

Frontend:
- React.
- Vite.
- TypeScript.
- UI Library: Ant Design hoac Shadcn UI.
- React Router.
- TanStack Query.
- React Hook Form.
- Zod.
- Axios.

Backend:
- Java 17.
- Spring Boot.
- Spring Web.
- Spring Security.
- Spring Data JPA.
- Bean Validation.
- Flyway.
- OpenAPI/Swagger.

Database:
- Supabase PostgreSQL.

## Phạm Vi MVP

- Đăng nhập, đăng xuất, đổi mật khẩu, phân quyền `ADMIN`, `TEACHER`, `STUDENT`.
- Admin/Teacher reset mật khẩu cho user khác, chưa làm quên mật khẩu qua SMTP.
- CRUD user, course, chapter, lesson, lesson resource, class.
- Gan giao vien, hoc sinh va khoa hoc cho lop.
- Hoc sinh xem noi dung duoc cap quyen va danh dau hoan thanh bai.
- Giao vien xem tien do lop va tung hoc sinh.
- API public cho QR qua `public_code`.
- Soft delete cho du lieu hoc tap.

## Quy Tắc Database

- Moi thay doi schema phai co Flyway migration.
- Migration dat ten theo timestamp: `V{yyyyMMddHHmm}__description.sql`.
- Hibernate chi duoc `validate`, khong tu tao bang production.
- Khong sua bang production bang tay.
- Khong sua noi dung migration da chay tren moi truong chung.
- Development, staging va production dung Supabase project/database rieng.

## Quy Tắc Bảo Mật

- Spring Boot chiu trach nhiem phan quyen nghiep vu.
- Controller dung `@PreAuthorize`.
- Service kiem tra quyen so huu/chong IDOR qua `SecurityService`.
- Khong dua `DATABASE_URL`, password, Supabase service-role key hoac JWT secret ra frontend.
- Public QR chi tra du lieu khi lesson/problem o trang thai `PUBLISHED`.

## Xử Lý File

- Video uu tien external URL nhu YouTube hoac Google Drive.
- Tài liệu PDF/DOCX lưu trên Supabase Storage bucket `documents` qua REST API từ Spring Boot, không dùng Supabase SDK.
- Database chi luu metadata: `file_name`, `file_url`, `mime_type`, `file_size`, `created_at`.
- Khong luu file nhi phan lon truc tiep trong PostgreSQL.

## Kế Hoạch Quản Lý Và Hiển Thị Tài Liệu MATH10

Triết lý chính: tài liệu chỉ là nguyên liệu, bài học mới là trung tâm quản lý. Học sinh không truy cập trực tiếp kho file 64+ tài liệu; học sinh chỉ thấy tài liệu thông qua bài học do giáo viên thiết lập.

Phân quyền:
- Admin quản lý kho tài liệu gốc, upload file, phân loại `SGK`, `SBT`, `KHBD`, `VIDEO`, và gán quyền `TEACHER_ONLY` hoặc `STUDENT_ALLOWED`.
- Teacher không upload file gốc. Giáo viên chọn tài liệu từ thư viện, gắn vào bài học, nhập `teacher_note`, đánh dấu bắt buộc/tham khảo và sắp xếp bằng nút `Lên`/`Xuống`.
- Student vào bài học và xem tài liệu step-by-step theo thứ tự giáo viên đã sắp xếp.

Cấu trúc dữ liệu:
- `documents`: kho tài liệu gốc, gồm `id`, `title`, `doc_type`, `audience`, `file_url`, `grade_id`, `created_at`, `deleted_at`.
- `lessons`: bài học. Hệ thống hiện dùng `order_index` cho thứ tự bài học; không đổi sang `display_order` để tránh phá schema đã chạy.
- `lesson_documents`: bảng trung gian gồm `id`, `lesson_id`, `document_id`, `is_required`, `teacher_note`, `display_order`, `deleted_at`.

Backend:
- `SupabaseStorageService` dùng `WebClient` gọi REST API Supabase Storage, không dùng Supabase SDK.
- `POST /api/admin/documents`: Admin upload PDF/DOC/DOCX lên bucket `documents`, backend lưu public URL vào DB.
- `GET /api/documents`: Admin/Teacher lấy danh sách thư viện tài liệu.
- `POST /api/lessons/{lessonId}/documents`: Teacher/Admin gắn tài liệu vào bài học.
- `PATCH /api/lessons/{lessonId}/documents/{id}/move`: Teacher/Admin đổi thứ tự bằng `UP`/`DOWN`.
- `GET /api/lessons/{lessonId}/documents`: Student chỉ nhận tài liệu có `audience = STUDENT_ALLOWED`.

Frontend:
- Admin có trang “Thư viện tài liệu” dạng lưới và form upload.
- Teacher có nút “Tài liệu” trong Lesson Builder để gắn tài liệu vào bài, nhập ghi chú và sắp xếp `Lên`/`Xuống`.
- Student thấy mục “Tài liệu học tập” trong trang bài học, mỗi step có icon, tên tài liệu, ghi chú giáo viên và nút “Xem tài liệu”.

## Chay Development

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd math10-backend
mvn spring-boot:run
```

Backend ket noi Supabase PostgreSQL qua bien moi truong. Developer khong can cai PostgreSQL local hoac container database.

## Timeline

| Giai doan | Noi dung chinh |
|---|---|
| 0 | Khoi tao React + Vite, Spring Boot, Supabase env, Flyway, OpenAPI. |
| 1 | Auth, JWT, protected routes, phan quyen, reset mat khau boi Admin/Teacher. |
| 2 | CRUD user, phan trang, soft delete, audit log co ban. |
| 3 | CRUD khoa hoc, loc, trang thai, gan giao vien. |
| 4 | Chuong va bai hoc, reorder bang nut Len/Xuong va `PATCH /reorder`. |
| 5 | Tai nguyen bai hoc, external video URL, metadata file. |
| 6 | Lop hoc, thanh vien, gan giao vien/hoc sinh/khoa hoc. |
| 7 | Giao dien hoc sinh, xem bai, tai lieu, hoan thanh bai, tien do. |
| 8 | Bao cao tien do lop va ca nhan. |
| 9 | Toi uu query, index, backup Supabase, staging, production, rollback, UAT. |

## Definition Of Done

- Co migration neu thay doi database.
- Entity phu hop schema.
- API duoc cap nhat trong OpenAPI/Swagger.
- Validation day du.
- Phan quyen kiem tra tai Spring Boot.
- Frontend khong truy cap Supabase truc tiep.
- Khong co secret trong repository.
- Chay duoc voi Supabase development.
- Test duoc tren staging.
