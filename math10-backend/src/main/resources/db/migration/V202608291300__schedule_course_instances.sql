alter table program_schedules add column if not exists course_instance_id bigint references course_instances(id);
create index idx_program_schedule_instance on program_schedules(course_instance_id,starts_on,ends_on) where deleted_at is null;

-- Course instance dùng lịch riêng; các dòng legacy vẫn dùng course_id để tương thích.
create unique index uq_program_schedule_instance_chapter
 on program_schedules(course_instance_id,chapter_id)
 where deleted_at is null and course_instance_id is not null;

-- Chỉ mục cũ ràng (course_id, chapter_id) trên toàn bảng, mà mọi khóa của cùng một mẫu đều mang
-- chung một course_id. Giữ nguyên thì khóa học năm thứ hai xếp lịch cho chương đã xếp ở năm đầu
-- sẽ vỡ ràng buộc — tức tách ba tầng ra rồi mà vẫn chỉ dùng được một năm. Thu hẹp nó về đúng
-- phạm vi nó còn cần: các dòng legacy chưa gắn khóa học.
drop index if exists uq_program_schedule_chapter;
create unique index uq_program_schedule_chapter
 on program_schedules(course_id,chapter_id)
 where deleted_at is null and course_instance_id is null;
