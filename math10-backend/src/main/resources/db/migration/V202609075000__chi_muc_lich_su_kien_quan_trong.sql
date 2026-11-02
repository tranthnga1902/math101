-- Lịch tổng quan luôn đọc bài đã giao, bắt buộc và có hạn. Chỉ mục từng phần tránh quét
-- bản nháp / bài tự chọn / luyện tự do vốn không bao giờ xuất hiện trên lịch.
create index if not exists idx_assignments_important_due
    on assignments (due_at, class_id)
    where deleted_at is null
      and status = 'PUBLISHED'
      and requirement = 'BAT_BUOC'
      and task_kind in ('BAI_KIEM_TRA', 'BAI_TAP')
      and due_at is not null;

-- Hai mốc của khóa chỉ được đưa lên lịch khi khóa đã phát hành.
create index if not exists idx_course_instances_published_starts
    on course_instances (starts_on)
    where deleted_at is null and status = 'PUBLISHED';

create index if not exists idx_course_instances_published_ends
    on course_instances (ends_on)
    where deleted_at is null and status = 'PUBLISHED';
