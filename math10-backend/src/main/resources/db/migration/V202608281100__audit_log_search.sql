-- Nhật ký trước nay chỉ ghi 5 loại đối tượng, và màn hình quản trị lấy 50 dòng mới nhất rồi lọc
-- ngay trong trình duyệt. Từ lát này nhật ký ghi thêm bài giao, chấm điểm, thành viên lớp, gắn
-- tài liệu vào lớp và xuất bản/ẩn — số dòng tăng nhiều lần, nên bộ lọc phải chạy dưới CSDL.

-- Trả lời "ai đã đụng vào đối tượng này": tra theo loại + mã, sắp xếp mới nhất trước. Bản nền đã
-- có idx_audit_target trên (target_type, target_id) nhưng thiếu created_at, nên vẫn phải sắp xếp
-- lại toàn bộ kết quả. Phải xoá rồi tạo lại: "create if not exists" trùng tên sẽ lặng lẽ bỏ qua và
-- để nguyên chỉ mục cũ, tức là di trú chạy xanh mà không đổi gì.
drop index if exists idx_audit_target;
create index idx_audit_target on audit_logs (target_type, target_id, created_at desc);

-- Trang mặc định không có bộ lọc nào, chỉ sắp xếp theo thời gian.
create index if not exists idx_audit_created on audit_logs (created_at desc);
