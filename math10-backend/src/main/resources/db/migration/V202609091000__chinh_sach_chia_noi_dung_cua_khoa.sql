-- =============================================================================
-- V202609091000: Chính sách chia nội dung của Khóa
--
-- Trước đây CourseDeliverySessionGenerator chỉ có đúng MỘT quy tắc cứng:
--   "không bao giờ cắt ngang lesson, cho overflow không giới hạn để giữ bài nguyên"
-- và bài kiểm tra LUÔN tách buổi riêng — không có cách nào cấu hình khác.
--
-- Migration này thêm 2 cột cấu hình cạnh units_per_session để Khóa tự chọn cách chia:
--
--   split_policy      cách xử lý khi một bài dài hơn units_per_session
--                        KEEP_LESSON     giữ nguyên bài, overflow không giới hạn (hành vi cũ)
--                        BALANCED        có thể cắt bài, nhưng tránh để lại buổi mồ côi 1 tiết
--                        FIXED_CAPACITY  không bao giờ vượt units_per_session, luôn cắt đúng ranh giới
--
--   assessment_policy  cách xử lý tiết KIEM_TRA
--                        SEPARATE  luôn tách buổi riêng (hành vi cũ)
--                        MERGE     cho phép gộp chung với tiết khác nếu còn dung lượng
--
-- Default giữ nguyên hành vi hiện tại (KEEP_LESSON / SEPARATE) — các khóa đã sinh buổi
-- trước migration này không đổi kết quả cho tới khi Admin chủ động đổi cấu hình.
--
-- Đồng thời thêm is_continuation vào course_delivery_sessions: true khi buổi này chứa
-- phần tiếp theo của một lesson đã bắt đầu ở buổi liền trước (chỉ có thể true khi
-- split_policy cho phép cắt bài — BALANCED hoặc FIXED_CAPACITY).
--
-- Nguyên tắc additive: chỉ ADD COLUMN, không DROP, không thay đổi ràng buộc cũ.
-- =============================================================================

alter table course_instances
    add column if not exists split_policy varchar(20) not null default 'KEEP_LESSON';

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'ck_ci_split_policy') then
        alter table course_instances
            add constraint ck_ci_split_policy
            check (split_policy in ('KEEP_LESSON', 'BALANCED', 'FIXED_CAPACITY'));
    end if;
end $$;

comment on column course_instances.split_policy is
    'Cách chia nội dung khi một bài dài hơn units_per_session: '
    'KEEP_LESSON (giữ nguyên bài, mặc định) | BALANCED (cắt nhưng tránh buổi mồ côi) | '
    'FIXED_CAPACITY (không bao giờ vượt units_per_session).';

alter table course_instances
    add column if not exists assessment_policy varchar(20) not null default 'SEPARATE';

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'ck_ci_assessment_policy') then
        alter table course_instances
            add constraint ck_ci_assessment_policy
            check (assessment_policy in ('SEPARATE', 'MERGE'));
    end if;
end $$;

comment on column course_instances.assessment_policy is
    'Cách xử lý tiết KIEM_TRA khi gom buổi: SEPARATE (luôn tách buổi riêng, mặc định) | '
    'MERGE (cho gộp chung với tiết khác nếu còn dung lượng).';

alter table course_delivery_sessions
    add column if not exists is_continuation boolean not null default false;

comment on column course_delivery_sessions.is_continuation is
    'true = buổi này chứa phần tiếp theo của một lesson đã bắt đầu ở buổi liền trước '
    '(lesson bị cắt qua nhiều buổi do split_policy BALANCED/FIXED_CAPACITY).';
