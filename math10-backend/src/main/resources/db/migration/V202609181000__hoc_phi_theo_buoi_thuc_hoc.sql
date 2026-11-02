-- Học phí theo buổi thực học và lập lại khi lớp đổi.
-- Không xóa cột nào; ba cột mới đều có mặc định an toàn cho dữ liệu cũ.

-- Bật/tắt tính theo số buổi học sinh còn học, thay vì cả khóa.
alter table course_fee_policies add column if not exists prorate boolean not null default false;
comment on column course_fee_policies.prorate is 'true: tính theo số buổi lớp còn dạy kể từ ngày học sinh vào lớp';

-- Ngày học sinh bắt đầu học ở lớp. Rỗng = học từ đầu (dùng created_at).
alter table class_students add column if not exists joined_on date;
comment on column class_students.joined_on is 'Ngày vào lớp; rỗng thì lấy ngày ghi danh (created_at)';

-- Số buổi đã dùng để tính khoản thu, để biết khi nào cần lập lại.
alter table student_fees add column if not exists billable_sessions integer;
comment on column student_fees.billable_sessions is 'Số buổi dùng khi tính khoản thu này';
