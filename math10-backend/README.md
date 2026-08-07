# MATH10 Backend

Spring Boot backend theo kiến trúc modular monolith cho hệ thống học Toán 10.

## API chính

- `POST /api/auth/login`
- `GET/POST/PUT/DELETE /api/users`, `PATCH /api/users/{id}/reset-password|lock|activate`
- `GET/POST/PUT/DELETE /api/courses`, `PATCH /api/courses/reorder`
- `GET/POST/PUT/DELETE /api/chapters`, `PATCH /api/chapters/reorder`
- `GET/POST/PUT/DELETE /api/lessons`, `PATCH /api/lessons/reorder`
- `GET /api/documents`, `POST /api/admin/documents`
- `GET/POST /api/lessons/{lessonId}/documents`, `PATCH /api/lessons/{lessonId}/documents/{id}/move`
- `GET/POST/PUT/DELETE /api/resources`, `PATCH /api/resources/reorder`
- `GET/POST/PUT/DELETE /api/classes`, `PATCH /api/classes/{id}/lock`
- `POST /api/enrollments/class-teachers|class-students|class-courses`
- `PATCH /api/progress/opened|completed`, `GET /api/progress?studentId=...`

## Auth

- Login kiểm tra mật khẩu BCrypt.
- Access token là JWT HMAC-SHA256, ký bằng `JWT_SECRET`.
- `JWT_SECRET` phải có tối thiểu 32 ký tự.
- Frontend gửi token bằng header `Authorization: Bearer <token>`.

## Quy Tắc Bắt Buộc

- Controller chỉ nhận request và trả DTO response, không gọi repository trực tiếp.
- Service chứa nghiệp vụ, transaction và kiểm soát quyền sở hữu.
- Repository chỉ giao tiếp database.
- Không trả entity trực tiếp ra API.
- Không dùng `repository.delete()`. Soft delete bằng `deleted_at`.
- Entity có `@SQLRestriction("deleted_at IS NULL")`.
- API trả qua `ApiResponse<T>`.
- Lỗi đi qua `GlobalExceptionHandler`.
- Dùng `@PreAuthorize` ở controller và `SecurityService` ở service để tránh IDOR.
- Tài liệu học tập PDF/DOCX lưu trên Supabase Storage qua REST API từ Spring Boot, không dùng Supabase SDK.
- Module file nội bộ vẫn có thể dùng `FILE_STORAGE_PATH` cho tài nguyên nhỏ khác khi cần.
- Dùng SLF4J, không dùng `System.out.println()`.

## Cấu Trúc Module Chuẩn

```text
com.math10.<module>
|-- controller
|-- service
|   `-- impl
|-- repository
|-- entity
|-- dto
|   |-- request
|   `-- response
|-- mapper
|-- validator
`-- exception
```

## Chạy Local

```bash
mvn spring-boot:run
```

Biến môi trường chính:

```text
SERVER_PORT
DATABASE_URL
DATABASE_DIRECT_URL
DATABASE_USERNAME
DATABASE_PASSWORD
JWT_SECRET
JWT_EXPIRATION
SUPABASE_URL
SUPABASE_SERVICE_KEY
SUPABASE_STORAGE_BUCKET
FRONTEND_URL
CORS_ALLOWED_ORIGINS
```

Ví dụ Supabase:

```text
DATABASE_URL=jdbc:postgresql://SUPABASE_HOST:5432/postgres?sslmode=require
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=documents
```

## Neon and Flyway connections

Use separate URLs for application traffic and schema migrations:

```text
DATABASE_URL=jdbc:postgresql://YOUR_ENDPOINT-pooler.REGION.aws.neon.tech/math10?sslmode=require
DATABASE_DIRECT_URL=jdbc:postgresql://YOUR_ENDPOINT.REGION.aws.neon.tech/math10?sslmode=require
DATABASE_USERNAME=...
DATABASE_PASSWORD=...
```

Both URLs must target the same Neon branch and database. The pooled URL is for
normal application transactions; Flyway uses the direct URL. Spring Boot does
not load `.env` files automatically, so export these variables in the shell or
configure them in the deployment platform before starting the backend.
