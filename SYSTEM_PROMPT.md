# QUY TẮC PHÁT TRIỂN MATH10

File này nhắc lại các nguyên tắc bắt buộc cho mọi lần code. Nguồn sự thật chính là `MATH10_MASTER_PLAN.md`.

## Cách Làm Việc

- Luôn đọc `MATH10_MASTER_PLAN.md` trước khi implement tính năng.
- Làm theo vertical slice: Database -> Backend API -> Frontend UI -> kiểm thử.
- Không code theo cảm hứng, không tạo dữ liệu giả để “cho giao diện chạy”.
- Không sửa schema thủ công, không sửa migration đã chạy.

## Dữ Liệu Và Phân Quyền

- Dữ liệu nghiệp vụ phải đến từ database/API.
- Frontend không dùng Supabase SDK và không có service-role key.
- Backend chịu trách nhiệm phân quyền, validation và chống IDOR.
- Học sinh chỉ thấy nội dung/tài liệu qua bài học hoặc bài tập được phân quyền.

## Lưu Trữ

- PostgreSQL trên Supabase lưu dữ liệu nghiệp vụ.
- Supabase Storage lưu file tài liệu PDF/DOC/DOCX.
- Backend gọi Supabase Storage qua REST API bằng `WebClient`, không dùng Supabase SDK.

## Kiểm Tra

- Sửa frontend thì chạy `npm.cmd run build`.
- Sửa backend thì chạy `mvn clean test` trong `math10-backend`.
- Quét và loại bỏ nhắc tới MATH9/Toán 9 trong code/tài liệu đang phát triển.
